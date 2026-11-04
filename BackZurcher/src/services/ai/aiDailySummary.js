/**
 * ☀️ ZurcherAI — resumen del día
 *
 * Se arma con consultas directas a la base (sin IA: gratis e instantáneo) y se muestra al abrir
 * ZurcherAI: mis tareas, instalaciones, inspecciones y visitas de hoy, leads sin contactar y
 * cobros pendientes de clientes (invoices finales y facturas vencidas).
 */
const { Op, fn, col } = require('sequelize');
const {
  Reminder, ReminderAssignment, Work, Inspection, MaintenanceVisit, SalesLead, CustomInvoice, FinalInvoice, WorkNote,
} = require('../../data/index');

const MAX_ITEMS = 5;

function floridaDates() {
  const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const now = new Date();
  return { today: fmt(now), tomorrow: fmt(new Date(now.getTime() + 24 * 60 * 60 * 1000)) };
}

const shortDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

async function addressesOf(workIds) {
  const ids = [...new Set(workIds.filter(Boolean))];
  if (!ids.length) return {};
  const works = await Work.findAll({ where: { idWork: ids }, attributes: ['idWork', 'propertyAddress'], raw: true });
  return Object.fromEntries(works.map(w => [w.idWork, w.propertyAddress]));
}

async function myTasks(staffId, today, limit = MAX_ITEMS) {
  const assignments = await ReminderAssignment.findAll({ where: { staffId, completed: false }, attributes: ['reminderId'], raw: true });
  if (!assignments.length) return null;
  const reminders = await Reminder.findAll({
    where: { id: assignments.map(a => a.reminderId) },
    attributes: ['id', 'title', 'dueDate', 'priority'],
    raw: true,
  });
  const rank = (r) => (r.dueDate && r.dueDate < today ? 0 : r.dueDate === today ? 1 : r.priority === 'urgent' ? 2 : 3);
  reminders.sort((a, b) => rank(a) - rank(b) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  const overdue = reminders.filter(r => r.dueDate && r.dueDate < today).length;
  return {
    key: 'tasks',
    title: 'Mis tareas pendientes',
    count: reminders.length,
    alert: overdue ? `${overdue} vencida${overdue > 1 ? 's' : ''}` : null,
    path: '/reminders-board',
    items: reminders.slice(0, limit).map(r => ({
      text: r.title,
      meta: r.dueDate ? (r.dueDate < today ? `venció ${shortDate(r.dueDate)}` : r.dueDate === today ? 'hoy' : shortDate(r.dueDate)) : null,
      urgent: (r.dueDate && r.dueDate < today) || r.priority === 'urgent',
    })),
  };
}

async function installationsToday(today) {
  const works = await Work.findAll({
    where: { installationStartDate: today, status: { [Op.notIn]: ['cancelled'] } },
    attributes: ['idWork', 'propertyAddress', 'status'],
    raw: true,
  });
  if (!works.length) return null;
  return {
    key: 'installations',
    title: 'Instalaciones de hoy',
    count: works.length,
    items: works.slice(0, MAX_ITEMS).map(w => ({ text: w.propertyAddress, path: `/work/${w.idWork}` })),
  };
}

async function inspectionsSoon(today, tomorrow) {
  const rows = await Inspection.findAll({
    where: { inspectorScheduledDate: [today, tomorrow] },
    attributes: ['workId', 'type', 'inspectorScheduledDate'],
    order: [['inspectorScheduledDate', 'ASC']],
    raw: true,
  });
  if (!rows.length) return null;
  const addresses = await addressesOf(rows.map(r => r.workId));
  return {
    key: 'inspections',
    title: 'Inspecciones hoy y mañana',
    count: rows.length,
    items: rows.slice(0, MAX_ITEMS).map(r => ({
      text: addresses[r.workId] || 'Obra',
      meta: `${r.type === 'final' ? 'Final' : 'Inicial'} · ${r.inspectorScheduledDate === today ? 'hoy' : 'mañana'}`,
      path: r.workId ? `/work/${r.workId}` : null,
    })),
  };
}

async function maintenanceToday(today) {
  const visits = await MaintenanceVisit.findAll({
    where: { scheduledDate: today, status: ['scheduled', 'assigned'] },
    attributes: ['workId', 'visitNumber'],
    raw: true,
  });
  if (!visits.length) return null;
  const addresses = await addressesOf(visits.map(v => v.workId));
  return {
    key: 'maintenance',
    title: 'Visitas de mantenimiento de hoy',
    count: visits.length,
    path: '/maintenance',
    items: visits.slice(0, MAX_ITEMS).map(v => ({ text: addresses[v.workId] || 'Obra', meta: v.visitNumber ? `Visita #${v.visitNumber}` : null })),
  };
}

async function newLeads(today) {
  const leads = await SalesLead.findAll({
    where: { status: 'new' },
    attributes: ['applicantName', 'propertyAddress', 'priority', 'createdAt'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  if (!leads.length) return null;
  const days = (d) => Math.max(0, Math.round((new Date(today) - new Date(String(d).slice(0, 10))) / 86400000));
  return {
    key: 'leads',
    title: 'Leads sin contactar',
    count: leads.length,
    alert: leads.some(l => days(l.createdAt) >= 2) ? 'hay leads con 2+ días sin respuesta' : null,
    path: '/sales-leads',
    items: leads.slice(0, MAX_ITEMS).map(l => ({
      text: l.applicantName || l.propertyAddress || 'Lead',
      meta: days(l.createdAt) === 0 ? 'hoy' : `hace ${days(l.createdAt)} d`,
      urgent: l.priority === 'urgent' || days(l.createdAt) >= 2,
    })),
  };
}

// Invoices finales enviadas con saldo pendiente. La fecha es el PRIMER envío (primera nota automática
// "Factura Final #N ENVIADA"): si se reenvía, la antigüedad no se reinicia.
async function unpaidFinalInvoices(today, role) {
  const invoices = (await FinalInvoice.findAll({
    where: { status: ['pending', 'partially_paid'] },
    attributes: ['workId', 'invoiceNumber', 'finalAmountDue', 'totalAmountPaid'],
    raw: true,
  })).filter(i => (Number(i.finalAmountDue) || 0) - (Number(i.totalAmountPaid) || 0) > 0.01);
  if (!invoices.length) return null;

  const firstSent = await WorkNote.findAll({
    where: {
      workId: invoices.map(i => i.workId),
      noteType: 'payment',
      message: { [Op.like]: '%Factura Final%ENVIADA%' },
    },
    attributes: ['workId', [fn('MIN', col('createdAt')), 'firstSentAt']],
    group: ['workId'],
    raw: true,
  });
  const sentByWork = Object.fromEntries(firstSent.map(n => [n.workId, n.firstSentAt]));
  const addresses = await addressesOf(invoices.map(i => i.workId));

  const days = (d) => Math.max(0, Math.round((new Date(today) - new Date(new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))) / 86400000));
  const sent = invoices
    .filter(i => sentByWork[i.workId])
    .map(i => ({
      ...i,
      firstSentAt: sentByWork[i.workId],
      pending: (Number(i.finalAmountDue) || 0) - (Number(i.totalAmountPaid) || 0),
    }))
    .sort((a, b) => new Date(a.firstSentAt) - new Date(b.firstSentAt));
  if (!sent.length) return null;

  const total = sent.reduce((a, i) => a + i.pending, 0);
  const old = sent.filter(i => days(i.firstSentAt) >= 30).length;
  const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  return {
    key: 'finalInvoices',
    title: 'Invoices finales sin cobrar',
    count: sent.length,
    alert: `${money(total)} pendientes${old ? ` · ${old} con 30+ días` : ''}`,
    path: ['owner', 'admin'].includes(role) ? '/accounts-receivable?tab=overview' : null, // recepción no tiene esa pantalla
    items: sent.slice(0, MAX_ITEMS).map(i => ({
      text: addresses[i.workId] || `Invoice #${i.invoiceNumber || ''}`,
      meta: `${money(i.pending)} · enviada ${shortDate(new Date(i.firstSentAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }))} (hace ${days(i.firstSentAt)} d)`,
      path: `/work/${i.workId}`,
      urgent: days(i.firstSentAt) >= 30,
    })),
  };
}

async function overdueInvoices(today) {
  const invoices = await CustomInvoice.findAll({
    where: { status: ['sent', 'viewed', 'approved', 'signed'], dueDate: { [Op.lt]: today } },
    attributes: ['invoiceNumber', 'clientName', 'total', 'paidAmount', 'dueDate'],
    order: [['dueDate', 'ASC']],
    raw: true,
  });
  if (!invoices.length) return null;
  const pending = invoices.reduce((a, i) => a + (Number(i.total) || 0) - (Number(i.paidAmount) || 0), 0);
  return {
    key: 'invoices',
    title: 'Facturas a clientes vencidas',
    count: invoices.length,
    alert: `$${Math.round(pending).toLocaleString('en-US')} pendientes`,
    path: '/custom-invoices',
    items: invoices.slice(0, MAX_ITEMS).map(i => ({
      text: `${i.invoiceNumber || ''} ${i.clientName || ''}`.trim(),
      meta: `venció ${shortDate(String(i.dueDate).slice(0, 10))}`,
      urgent: true,
    })),
  };
}

// El owner reparte el trabajo y ve el día completo; el resto ve solo las tareas que tiene asignadas
async function dailySummary(staff) {
  const { today, tomorrow } = floridaDates();
  const safe = (p) => p.catch(err => { console.error('⚠️ [AI] resumen del día:', err.message); return null; });
  if (staff.role !== 'owner') {
    const tasks = await safe(myTasks(staff.id, today, 10));
    return { date: today, scope: 'tasks', sections: tasks ? [tasks] : [] };
  }
  const sections = await Promise.all([
    safe(myTasks(staff.id, today)),
    safe(installationsToday(today)),
    safe(inspectionsSoon(today, tomorrow)),
    safe(maintenanceToday(today)),
    safe(newLeads(today)),
    safe(unpaidFinalInvoices(today, staff.role)),
    safe(overdueInvoices(today)), // facturas a clientes (no de proveedores)
  ]);
  return { date: today, scope: 'full', sections: sections.filter(Boolean) };
}

module.exports = { dailySummary };
