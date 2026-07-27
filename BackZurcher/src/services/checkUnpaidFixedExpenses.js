/**
 * Cron: Verifica gastos fijos sin pagar en el mes actual.
 * - Corre diariamente a las 8 AM
 * - Envía email una vez por mes (dedup via Reminder)
 * - Notifica al staff configurado en Routing de Alertas → 'unpaid_fixed_expenses'
 */
const { Op } = require('sequelize');
const { FixedExpense, Reminder, ReminderAssignment } = require('../data');
const { sendEmail } = require('../utils/notifications/emailService');
const { getRoutedStaff } = require('../utils/getRoutedStaff');

const toDateOnly = (date) => date.toISOString().split('T')[0];

const FREQUENCY_LABELS = {
  monthly: 'Mensual',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  weekly: 'Semanal',
  one_time: 'Único',
};

function formatCurrency(amount) {
  return `$${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function checkUnpaidFixedExpenses() {
  try {
    console.log('\n🔍 [CRON - GASTOS FIJOS] Verificando gastos fijos impagos del mes...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const monthKey = `${year}-${month}`;

    // Último día del mes actual
    const lastDayOfMonth = new Date(Date.UTC(year, today.getMonth() + 1, 0));
    const lastDayStr = toDateOnly(lastDayOfMonth);

    // Staff configurado para recibir esta alerta
    const staff = await getRoutedStaff('unpaid_fixed_expenses');
    if (!staff.length) {
      console.log('⚠️ [CRON - GASTOS FIJOS] No hay responsable configurado en Routing de Alertas');
      return;
    }

    // Dedup: ya se envió la alerta este mes?
    const alreadySent = await Reminder.findOne({
      where: {
        linkedEntityType: 'fixed_expense_alert',
        linkedEntityId: monthKey,
      },
    });

    if (alreadySent) {
      console.log(`✅ [CRON - GASTOS FIJOS] Alerta de ${monthKey} ya enviada previamente.`);
      return;
    }

    // Gastos activos cuyo nextDueDate ya llegó este mes y aún no están pagados
    const unpaid = await FixedExpense.findAll({
      where: {
        isActive: true,
        paymentStatus: { [Op.notIn]: ['paid', 'paid_via_credit_card'] },
        nextDueDate: { [Op.lte]: lastDayStr },
      },
      order: [['nextDueDate', 'ASC']],
    });

    if (!unpaid.length) {
      console.log('✅ [CRON - GASTOS FIJOS] Todos los gastos del mes están pagados.');
      return;
    }

    console.log(`📋 [CRON - GASTOS FIJOS] ${unpaid.length} gasto(s) impago(s) encontrados.`);

    // Crear Reminder de dedup (marca que ya alertamos este mes)
    const reminder = await Reminder.create({
      title: `Gastos Fijos sin pagar — ${monthKey}`,
      description: `Alerta automática: ${unpaid.length} gasto(s) fijo(s) pendientes de pago para ${monthKey}.`,
      type: 'tagged',
      priority: 'high',
      dueDate: lastDayStr,
      linkedEntityType: 'fixed_expense_alert',
      linkedEntityId: monthKey,
      linkedEntityLabel: `Alerta mensual ${monthKey}`,
      createdBy: staff[0].id,
    });

    await ReminderAssignment.bulkCreate(
      staff.map((s) => ({ reminderId: reminder.id, staffId: s.id })),
      { ignoreDuplicates: true }
    );

    // Construir tabla HTML de gastos
    const rows = unpaid.map((exp) => {
      const amount = exp.variableAmount
        ? `<span style="color:#6b7280;">Variable (ref. ${formatCurrency(exp.totalAmount)})</span>`
        : `<strong>${formatCurrency(exp.totalAmount)}</strong>`;
      const status =
        exp.paymentStatus === 'partial'
          ? `<span style="color:#d97706;">Pago parcial (${formatCurrency(exp.paidAmount)})</span>`
          : `<span style="color:#dc2626;">Sin pagar</span>`;
      const freq = FREQUENCY_LABELS[exp.frequency] || exp.frequency || '-';
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px 12px;font-weight:600;">${exp.name}</td>
          <td style="padding:10px 12px;color:#6b7280;">${exp.category || '-'}</td>
          <td style="padding:10px 12px;">${amount}</td>
          <td style="padding:10px 12px;">${freq}</td>
          <td style="padding:10px 12px;">${status}</td>
        </tr>`;
    }).join('');

    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/fixed-expenses`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937;">
        <h2 style="color:#d97706;margin-bottom:4px;">💸 Gastos Fijos sin pagar — ${monthKey}</h2>
        <p style="margin-top:0;color:#4b5563;">
          Hay <strong>${unpaid.length}</strong> gasto(s) fijo(s) pendientes de pago para este mes.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <thead>
            <tr style="background:#f3f4f6;text-align:left;">
              <th style="padding:10px 12px;">Nombre</th>
              <th style="padding:10px 12px;">Categoría</th>
              <th style="padding:10px 12px;">Monto</th>
              <th style="padding:10px 12px;">Frecuencia</th>
              <th style="padding:10px 12px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <a href="${dashboardUrl}"
           style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;margin-top:8px;">
          Ir a Gastos Fijos
        </a>

        <p style="margin-top:18px;font-size:12px;color:#9ca3af;">
          Esta alerta se envía una vez por mes automáticamente.
        </p>
      </div>
    `;

    for (const member of staff) {
      if (!member.email) continue;
      await sendEmail({
        to: member.email,
        subject: `💸 Gastos Fijos sin pagar — ${monthKey} (${unpaid.length} pendiente${unpaid.length !== 1 ? 's' : ''})`,
        html,
        text: `Hay ${unpaid.length} gasto(s) fijo(s) sin pagar para ${monthKey}. Ingresá al sistema para registrar los pagos.`,
      });
      console.log(`📧 [CRON - GASTOS FIJOS] Email enviado a ${member.email}`);
    }

    console.log(`✅ [CRON - GASTOS FIJOS] Alerta enviada: ${unpaid.length} gastos impagos en ${monthKey}.`);
  } catch (err) {
    console.error('❌ [CRON - GASTOS FIJOS] Error:', err.message);
  }
}

module.exports = { checkUnpaidFixedExpenses };
