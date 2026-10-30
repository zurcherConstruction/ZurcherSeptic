/**
 * 🔁 Renovación de contratos de mantenimiento ATU + 💳 visita de diagnóstico
 *
 * Renovaciones (cron diario):
 *  - Un contrato vence en la fecha de la última visita programada de la obra (4 visitas = 2 años).
 *  - Solo se renuevan contratos con al menos UNA visita hecha por nosotros (status "completed").
 *  - 45 días antes del vencimiento (o si ya venció hace poco) se crea una Custom Invoice en borrador
 *    ($450, 2 años, 4 visitas) con su link de pago de Stripe, y una tarea para el empleado asignado
 *    al evento "maintenance_renewal_due". El envío al cliente es MANUAL (revisión del equipo).
 *  - Cuando se paga (Stripe o "marcar como pagado"), se generan las 4 visitas del nuevo período.
 *
 * Visita de diagnóstico ($300): la crea el asistente de la landing con su link de pago; al pagarse,
 * se crea una tarea para programar la visita.
 */
const cron = require('node-cron');
const { Op } = require('sequelize');
const { addMonths, addDays, format, parseISO } = require('date-fns');
const { v4: uuidv4 } = require('uuid');
const { CustomInvoice, Work, Permit, Budget, MaintenanceVisit } = require('../data');
const { createCustomInvoicePaymentLink } = require('../utils/stripePaymentLink');
const { createRoutedReminder } = require('../utils/createRoutedReminder');
const { sendEmail } = require('../utils/notifications/emailService');

const RENEWAL_TITLE = 'ATU Maintenance Contract Renewal (2 years)';
const DIAGNOSTIC_TITLE = 'Septic Diagnostic Visit';
const RENEWAL_PRICE = 450;
const DIAGNOSTIC_PRICE = 300;
const RENEWAL_DAYS_BEFORE = 45;
const RENEWAL_LOOKBACK_DAYS = 90; // contratos ya vencidos sin renovar que todavía se incluyen
const NOTIFY_EMAIL = process.env.PUBLIC_BOT_LEAD_EMAIL || 'sales@zurcherseptic.com';

const toDateOnly = d => format(d, 'yyyy-MM-dd');
const parseDateOnly = s => (s instanceof Date ? s : parseISO(`${String(s).slice(0, 10)}T12:00:00`));

function frontendUrl() {
  let url = process.env.FRONTEND_URL || '';
  if (!url || (process.env.NODE_ENV === 'production' && url.includes('localhost'))) url = 'https://www.zurcherseptic.com';
  return url.replace(/\/$/, '');
}

// ---------------------------------------------------------------------------
// Factura automática (Custom Invoice + link de Stripe)
// ---------------------------------------------------------------------------

async function createAutoInvoice({ title, description, amount, client, workId = null, notes = null, dueDate = null }) {
  // Requerido aquí para evitar dependencias circulares al cargar controladores
  const { _generateInvoiceNumber, _computeTotals } = require('../controllers/CustomInvoiceController');
  const items = [{ description, quantity: 1, unitPrice: amount, amount }];
  const year = new Date().getFullYear();
  const { invoiceNumber, sequenceNumber } = await _generateInvoiceNumber('INV', year);
  const { subtotal, taxAmount, total } = _computeTotals(items, 0, 0);

  const invoice = await CustomInvoice.create({
    invoiceType: 'INV',
    invoiceNumber,
    sequenceNumber,
    year,
    title,
    clientName: client.name || 'Customer',
    clientEmail: client.email || null,
    clientPhone: client.phone || null,
    clientAddress: client.address || null,
    companyName: 'ZURCHER CONSTRUCTION',
    companyEmail: 'admin@zurcherseptic.com',
    companyPhone: '+1 (954) 636-8200',
    companyAddress: 'SEPTIC TANK DIVISION - CFC1433240',
    items,
    subtotal,
    discountAmount: 0,
    taxRate: 0,
    taxAmount,
    total,
    priceDisplay: 'prices',
    notes,
    issueDate: toDateOnly(new Date()),
    dueDate,
    workId,
    requireSignature: false,
    requirePayment: true,
    paymentPercentage: 100,
    paymentAmount: total,
    status: 'draft',
    publicToken: uuidv4(),
  });

  let paymentUrl = null;
  try {
    ({ url: paymentUrl } = await createCustomInvoicePaymentLink(invoice));
  } catch (err) {
    console.error(`⚠️ [Renewals] No se pudo crear el link de Stripe para ${invoiceNumber}:`, err.message);
  }
  return { invoice, paymentUrl, publicUrl: `${frontendUrl()}/invoice/${invoice.publicToken}` };
}

// ---------------------------------------------------------------------------
// Renovaciones de contratos ATU
// ---------------------------------------------------------------------------

async function getWorkClientContact(work) {
  const [permit, budget] = await Promise.all([
    work.idPermit ? Permit.findByPk(work.idPermit, { attributes: ['applicant', 'applicantName', 'applicantEmail', 'applicantPhone', 'ppiPropertyOwnerEmail', 'ppiPropertyOwnerPhone'] }) : null,
    work.idBudget ? Budget.findByPk(work.idBudget, { attributes: ['applicantName', 'applicantEmail'] }) : null,
  ]);
  let form = work.maintenanceContractFormData;
  if (typeof form === 'string') { try { form = JSON.parse(form); } catch { form = null; } }
  // Se descartan datos de relleno de obras legacy ("⚠️ EDITAR NOMBRE CLIENTE") y emails de la propia empresa
  const isPlaceholder = v => /editar|edit name|^n\/?a$|^-+$/i.test(v) || /@zurcherseptic\.com$/i.test(v);
  const pick = (...values) => values
    .map(v => (typeof v === 'string' ? v.trim() : v))
    .find(v => v && !isPlaceholder(v)) || null;
  return {
    name: pick(form?.customerName, permit?.applicantName, permit?.applicant, budget?.applicantName),
    email: pick(form?.customerEmail, work.maintenanceContractSentEmail, permit?.applicantEmail, budget?.applicantEmail, permit?.ppiPropertyOwnerEmail),
    phone: pick(form?.customerPhone, permit?.applicantPhone, permit?.ppiPropertyOwnerPhone),
    address: work.propertyAddress,
  };
}

/**
 * Contratos que vencen dentro de RENEWAL_DAYS_BEFORE días (o vencieron hace menos de
 * RENEWAL_LOOKBACK_DAYS), con al menos una visita hecha por nosotros y sin renovación creada.
 */
async function findRenewalsDue(today = new Date()) {
  const visits = await MaintenanceVisit.findAll({
    attributes: ['workId', 'visitNumber', 'scheduledDate', 'status'],
    raw: true,
  });
  const byWork = {};
  for (const v of visits) (byWork[v.workId] ||= []).push(v);

  const from = addDays(today, -RENEWAL_LOOKBACK_DAYS);
  const to = addDays(today, RENEWAL_DAYS_BEFORE);
  const due = [];
  for (const [workId, list] of Object.entries(byWork)) {
    const dates = list.map(v => v.scheduledDate).filter(Boolean).map(parseDateOnly);
    if (!dates.length) continue;
    const endsAt = new Date(Math.max(...dates));
    const completed = list.filter(v => v.status === 'completed').length;
    if (completed > 0 && endsAt >= from && endsAt <= to) due.push({ workId, endsAt, completed, visits: list.length });
  }
  return due;
}

async function checkMaintenanceRenewals({ dryRun = false } = {}) {
  const due = await findRenewalsDue();
  const created = [];

  for (const item of due) {
    try {
      // Ya existe una renovación para este período
      const existing = await CustomInvoice.findOne({
        where: {
          workId: item.workId,
          title: RENEWAL_TITLE,
          status: { [Op.ne]: 'void' },
          createdAt: { [Op.gte]: addDays(item.endsAt, -180) },
        },
      });
      if (existing) continue;

      const work = await Work.findByPk(item.workId);
      if (!work) continue;
      const contact = await getWorkClientContact(work);
      const endsLabel = format(item.endsAt, 'MM/dd/yyyy');

      if (dryRun) {
        created.push({ workId: item.workId, address: work.propertyAddress, endsAt: toDateOnly(item.endsAt), contact, completedVisits: item.completed });
        continue;
      }

      const { invoice, paymentUrl, publicUrl } = await createAutoInvoice({
        title: RENEWAL_TITLE,
        description: `ATU maintenance contract renewal — 2 years, 4 service visits (one every 6 months). Required by the Florida Department of Health. Property: ${work.propertyAddress}. Current contract ends ${endsLabel}.`,
        amount: RENEWAL_PRICE,
        client: contact,
        workId: work.idWork,
        dueDate: toDateOnly(item.endsAt),
        notes: `Renovación automática del contrato de mantenimiento ATU. Contrato actual vence el ${endsLabel}. Visitas hechas por Zurcher: ${item.completed} de ${item.visits}.`,
      });

      const missing = [!contact.name && 'nombre', !contact.email && 'email', !contact.phone && 'teléfono'].filter(Boolean);
      await createRoutedReminder('maintenance_renewal_due', {
        customInvoiceId: invoice.id,
        propertyAddress: work.propertyAddress,
        endsLabel,
        missingContact: missing.length === 3,
      });

      created.push({ address: work.propertyAddress, endsLabel, invoiceNumber: invoice.invoiceNumber, invoiceId: invoice.id, paymentUrl, publicUrl, missing });
    } catch (err) {
      console.error(`❌ [Renewals] Error creando renovación para work ${item.workId}:`, err.message);
    }
  }

  if (!dryRun && created.length) {
    const rows = created.map(c => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${c.address}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${c.endsLabel}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb"><a href="${frontendUrl()}/custom-invoices/${c.invoiceId}">${c.invoiceNumber}</a></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${c.missing.length ? `⚠️ falta ${c.missing.join(', ')}` : '✅ completo'}</td>
      </tr>`).join('');
    await sendEmail({
      to: NOTIFY_EMAIL,
      subject: `🔁 ${created.length} contrato(s) de mantenimiento ATU por renovar`,
      html: `<div style="font-family:Arial,sans-serif;max-width:680px">
        <h2>🔁 Contratos de mantenimiento ATU por renovar</h2>
        <p>Se generaron las facturas de renovación ($${RENEWAL_PRICE} / 2 años) con su link de pago de Stripe, en <strong>borrador</strong>.
        Revisalas, completá los datos de contacto que falten y envialas al cliente desde Custom Invoices (o copiá el link de pago para WhatsApp/SMS).</p>
        <table style="border-collapse:collapse;width:100%;font-size:13px">
          <tr style="background:#f3f4f6"><th style="padding:6px 8px;text-align:left">Propiedad</th><th style="padding:6px 8px;text-align:left">Vence</th><th style="padding:6px 8px;text-align:left">Factura</th><th style="padding:6px 8px;text-align:left">Contacto</th></tr>
          ${rows}
        </table>
        <p style="color:#6b7280;font-size:12px">El Health Department exige que todo ATU tenga contrato de mantenimiento vigente. Al pagarse la factura, el sistema crea automáticamente las 4 visitas del nuevo período.</p>
      </div>`,
    }).catch(err => console.error('❌ [Renewals] email resumen:', err.message));
  }

  console.log(`🔁 [Renewals] ${due.length} contrato(s) en ventana · ${created.length} renovación(es) ${dryRun ? 'detectadas (simulación)' : 'creadas'}`);
  return created;
}

// Al pagarse la renovación: 4 visitas nuevas, una cada 6 meses desde el fin del contrato anterior
async function generateRenewalVisits(workId, contractEndDate = null) {
  const visits = await MaintenanceVisit.findAll({ where: { workId }, attributes: ['visitNumber', 'scheduledDate'], raw: true });
  if (!visits.length) return 0;
  // Si ya existen visitas posteriores al fin del contrato renovado, no se duplican
  if (contractEndDate) {
    const end = parseDateOnly(contractEndDate);
    if (visits.filter(v => v.scheduledDate && parseDateOnly(v.scheduledDate) > end).length >= 4) return 0;
  }
  const lastNumber = Math.max(...visits.map(v => v.visitNumber || 0));
  const lastDate = new Date(Math.max(...visits.map(v => v.scheduledDate).filter(Boolean).map(parseDateOnly)));
  for (let i = 1; i <= 4; i++) {
    await MaintenanceVisit.create({
      workId,
      visitNumber: lastNumber + i,
      scheduledDate: toDateOnly(addMonths(lastDate, i * 6)),
      status: 'pending_scheduling',
    });
  }
  console.log(`✅ [Renewals] 4 visitas nuevas creadas para work ${workId} (desde la #${lastNumber + 1})`);
  return 4;
}

/**
 * Se llama cuando un Custom Invoice queda pagado (webhook de Stripe o "marcar como pagado").
 */
async function onCustomInvoicePaid(invoice) {
  try {
    if (invoice.title === RENEWAL_TITLE && invoice.workId) {
      await generateRenewalVisits(invoice.workId, invoice.dueDate);
      createRoutedReminder('maintenance_renewal_paid', { idWork: invoice.workId, propertyAddress: invoice.clientAddress });
    } else if (invoice.title === DIAGNOSTIC_TITLE) {
      createRoutedReminder('diagnostic_visit_paid', {
        customInvoiceId: invoice.id,
        applicantName: invoice.clientName,
        propertyAddress: invoice.clientAddress,
      });
      await sendEmail({
        to: NOTIFY_EMAIL,
        subject: `💳 Visita de diagnóstico pagada: ${invoice.clientName} — programar visita`,
        html: `<div style="font-family:Arial,sans-serif">
          <h2>💳 Visita de diagnóstico pagada ($${DIAGNOSTIC_PRICE})</h2>
          <p><strong>${invoice.clientName}</strong><br>${invoice.clientAddress || ''}<br>${invoice.clientPhone || ''} ${invoice.clientEmail || ''}</p>
          <p>Contactar al cliente para programar la visita. Si contrata la reparación, descontar los $${DIAGNOSTIC_PRICE} del presupuesto.</p>
          <p><a href="${frontendUrl()}/custom-invoices/${invoice.id}">Ver factura ${invoice.invoiceNumber}</a></p>
        </div>`,
      }).catch(err => console.error('❌ [Diagnostic] email:', err.message));
    }
  } catch (err) {
    console.error('❌ [Renewals] onCustomInvoicePaid:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Visita de diagnóstico (la crea el asistente de la landing)
// ---------------------------------------------------------------------------

async function createDiagnosticVisitInvoice({ name, email, phone, address, problem }) {
  const { invoice, paymentUrl, publicUrl } = await createAutoInvoice({
    title: DIAGNOSTIC_TITLE,
    description: `Septic system diagnostic visit${address ? ` at ${address}` : ''}. If you hire Zurcher Septic for the repair, this $${DIAGNOSTIC_PRICE} is credited toward the repair quote.`,
    amount: DIAGNOSTIC_PRICE,
    client: { name, email, phone, address },
    notes: `Creada por el asistente de la web. Problema reportado: ${problem || '—'}`,
  });
  if (!paymentUrl) throw new Error('Could not create the payment link');
  await invoice.update({ status: 'sent', sentAt: new Date() });

  if (email) {
    await sendEmail({
      to: email,
      subject: `Zurcher Septic — Diagnostic visit payment (${invoice.invoiceNumber})`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
        <h2 style="color:#1d4ed8">Septic Diagnostic Visit — $${DIAGNOSTIC_PRICE}</h2>
        <p>Hi ${name},</p>
        <p>Thanks for contacting Zurcher Septic. Here is the payment link for your diagnostic visit${address ? ` at <strong>${address}</strong>` : ''}.
        Once it's paid, our team will contact you to schedule the earliest available appointment.</p>
        <p>If you hire us for the repair, the $${DIAGNOSTIC_PRICE} is <strong>credited toward your repair quote</strong>.</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${paymentUrl}" style="background:#16a34a;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold">Pay Diagnostic Visit</a>
        </p>
        <p style="font-size:12px;color:#6b7280">Card payments include a 3% processing fee. Invoice: <a href="${publicUrl}">${invoice.invoiceNumber}</a>. Questions? Call or WhatsApp (954) 636-8200.</p>
        <p>Zurcher Septic · License CFC1433240</p>
      </div>`,
    }).catch(err => console.error('❌ [Diagnostic] email cliente:', err.message));
  }
  return { invoiceNumber: invoice.invoiceNumber, invoiceId: invoice.id, paymentUrl, publicUrl };
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

function startMaintenanceRenewalCron() {
  cron.schedule('30 7 * * *', async () => {
    try {
      await checkMaintenanceRenewals();
    } catch (err) {
      console.error('❌ [Renewals] cron:', err.message);
    }
  }, { timezone: 'America/New_York' });
  console.log('✅ Cron de renovaciones de contratos ATU programado (7:30 AM ET)');
}

module.exports = {
  RENEWAL_TITLE,
  DIAGNOSTIC_TITLE,
  checkMaintenanceRenewals,
  findRenewalsDue,
  onCustomInvoicePaid,
  generateRenewalVisits,
  createDiagnosticVisitInvoice,
  startMaintenanceRenewalCron,
};
