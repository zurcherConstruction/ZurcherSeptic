/**
 * 📋 Notion — reporte semanal de seguimientos para los owners
 *
 * Viernes 10:00 (hora de Orlando) manda a cada owner activo un email con los prospectos de la base
 * "Seguimiento de Prospectos": estado, responsable, situación, próximo paso, fecha de seguimiento y
 * cuándo se actualizó por última vez cada uno.
 *
 * Adjunta un PDF con una ficha por prospecto y el último seguimiento (fecha, autor y nota).
 *
 * Es UNA consulta a Notion por semana, más dos consultas a la base (owners y últimas notas).
 *
 * Variables opcionales:
 *  - NOTION_WEEKLY_REPORT=off   apaga el envío
 *  - NOTION_WEEKLY_REPORT_TO    lista de emails (separados por coma) en lugar de los owners
 */

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Staff, SalesLead, LeadNote } = require('../../data');
const notion = require('./notionClient');
const { DATA_SOURCE_ID, readProspect, E } = require('./notionProspectsSync');
const { sendEmail } = require('../../utils/notifications/emailService');
const { generateNotionReportPdf } = require('../../utils/pdfGenerators/notionReportPdfGenerator');

const TZ = 'America/New_York';
const STALE_DAYS = 7;
// Orden: lo que más atención necesita primero
const ORDER = [E.urgente, E.pendiente, E.confirmar, E.analizar, E.espera];
const COLORS = {
  [E.urgente]: '#ea580c', [E.pendiente]: '#dc2626', [E.confirmar]: '#2563eb',
  [E.analizar]: '#7c3aed', [E.espera]: '#ca8a04', [E.cerrado]: '#16a34a',
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const fmtDate = iso => iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = iso => iso ? new Date(iso).toLocaleString('es-ES', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const ago = days => days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
const truncate = (s, n = 280) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
// Notas automáticas escritas de forma más clara para el reporte (no cambia lo guardado)
const friendlyNote = (msg = '') => {
  const proposal = msg.match(/Proposal email sent to\s+(\S+?)(?:\s+with attachments|\s*$)/i);
  if (proposal) return `Se enviaron presupuestos generales por email a ${proposal[1]}`;
  return msg;
};
// Último comentario: la última línea con texto de "Comentarios del equipo"
const lastComment = s => friendlyNote((s || '').split('\n').map(l => l.trim()).filter(Boolean).pop() || '');

// Grupos del reporte: los "Pendiente" de Notion son seguimientos de Invertech (Rafael Aguilar);
// el resto, de Zurcher
const GROUPS = [
  { key: 'invertech', title: 'Seguimientos Invertech', subtitle: 'Asignados a Rafael Aguilar', defaultResponsible: 'Rafael Aguilar (Invertech)' },
  { key: 'zurcher', title: 'Seguimientos Zurcher', subtitle: 'Equipo Zurcher Septic', defaultResponsible: 'Sin asignar' },
];
const groupOf = p => (p.estado === E.pendiente ? 'invertech' : 'zurcher');
const responsibleText = p => p.responsible.map(r => r.name || r.email).filter(Boolean).join(', ')
  || GROUPS.find(g => g.key === p.group).defaultResponsible;

async function collectProspects() {
  const pages = await notion.queryDataSource(DATA_SOURCE_ID());
  const today = todayISO();
  const items = [];
  for (const page of pages) {
    const p = await readProspect(page);
    if (p.archived) continue;
    const lastEditedDays = daysBetween(p.lastEdited, new Date());
    items.push({
      ...p,
      group: groupOf(p),
      lastEditedDays,
      stale: p.estado !== E.cerrado && lastEditedDays >= STALE_DAYS,
      overdue: p.estado !== E.cerrado && p.nextDate && p.nextDate < today,
      dueThisWeek: p.estado !== E.cerrado && p.nextDate && p.nextDate >= today && daysBetween(today, p.nextDate) <= 7,
    });
  }
  const rank = p => (ORDER.indexOf(p.estado) + 1) || ORDER.length + 1;
  const open = items.filter(p => p.estado !== E.cerrado)
    .sort((a, b) => rank(a) - rank(b) || (a.nextDate || '9999').localeCompare(b.nextDate || '9999'));
  const closedThisWeek = items.filter(p => p.estado === E.cerrado && p.lastEditedDays < 7);
  return { open, closedThisWeek, total: items.length };
}

function prospectRow(p) {
  const color = COLORS[p.estado] || '#6b7280';
  const responsible = responsibleText(p);
  const comment = lastComment(p.comments);
  const flags = [
    p.overdue && '<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Seguimiento vencido</span>',
    p.stale && `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Sin actualizar ${p.lastEditedDays} días</span>`,
  ].filter(Boolean).join(' ');
  return `
    <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:15px;font-weight:700;color:#111827;">
          <a href="${esc(p.url)}" style="color:#111827;text-decoration:none;">${esc(p.contact || 'Sin nombre')}</a>
          ${p.company ? `<span style="font-weight:400;color:#6b7280;"> · ${esc(p.company)}</span>` : ''}
        </td>
        <td align="right" style="font-size:12px;font-weight:600;color:${color};white-space:nowrap;">${esc(p.estado)}</td>
      </tr></table>
      ${flags ? `<div style="margin-top:6px;">${flags}</div>` : ''}
      <div style="margin-top:8px;font-size:13px;color:#374151;line-height:1.5;">
        ${p.situation ? `<div><b>Situación:</b> ${esc(truncate(p.situation))}</div>` : ''}
        ${comment ? `<div><b>Último comentario:</b> ${esc(truncate(comment, 200))}</div>` : ''}
        ${p.nextStep ? `<div><b>Próximo paso:</b> ${esc(truncate(p.nextStep, 200))}</div>` : ''}
      </div>
      <div style="margin-top:8px;font-size:12px;color:#6b7280;">
        👤 ${esc(responsible)} &nbsp;·&nbsp; 📅 Próx. seguimiento: <b style="color:${p.overdue ? '#b91c1c' : '#374151'};">${fmtDate(p.nextDate)}</b>
        &nbsp;·&nbsp; ✏️ Actualizado ${ago(p.lastEditedDays)} (${fmtDateTime(p.lastEdited)})
      </div>
    </td></tr>`;
}

function buildHtml({ open, closedThisWeek }) {
  const overdue = open.filter(p => p.overdue).length;
  const dueWeek = open.filter(p => p.dueThisWeek).length;
  const stale = open.filter(p => p.stale).length;
  const stat = (n, label, color) => `
    <td align="center" style="padding:10px;">
      <div style="font-size:26px;font-weight:700;color:${color};">${n}</div>
      <div style="font-size:12px;color:#6b7280;">${label}</div>
    </td>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:20px 8px;">
    <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">
      <tr><td style="background:#1a3a5c;padding:22px 24px;color:#ffffff;">
        <div style="font-size:20px;font-weight:700;">📋 Seguimiento de prospectos</div>
        <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Reporte semanal · ${fmtDate(todayISO())}</div>
      </td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${stat(open.length, 'Abiertos', '#1a3a5c')}
          ${stat(overdue, 'Seguimiento vencido', '#b91c1c')}
          ${stat(dueWeek, 'Para esta semana', '#2563eb')}
          ${stat(stale, `Sin actualizar +${STALE_DAYS} días`, '#92400e')}
        </tr></table>
      </td></tr>
      ${open.length ? GROUPS.map(g => {
        const list = open.filter(p => p.group === g.key);
        if (!list.length) return '';
        return `
      <tr><td style="padding:14px 16px 10px;background:#eef2f7;border-bottom:2px solid #1a3a5c;">
        <div style="font-size:16px;font-weight:700;color:#1a3a5c;">${g.title} (${list.length})</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${g.subtitle}</div>
      </td></tr>
      ${list.map(prospectRow).join('')}`;
      }).join('') : '<tr><td style="padding:24px;text-align:center;color:#6b7280;">No hay prospectos abiertos.</td></tr>'}
      ${closedThisWeek.length ? `
      <tr><td style="padding:14px 16px;background:#f0fdf4;font-size:13px;color:#166534;">
        ✅ <b>Cerrados esta semana (${closedThisWeek.length}):</b> ${closedThisWeek.map(p => esc(p.contact || p.company || 'Sin nombre')).join(', ')}
      </td></tr>` : ''}
      <tr><td style="padding:16px;text-align:center;font-size:11px;color:#9ca3af;">
        Datos tomados de Notion el ${fmtDateTime(new Date().toISOString())}. Tocá un nombre para abrir la ficha en Notion.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/**
 * Última nota de seguimiento de cada prospecto (las notas del lead en el sistema: incluyen las que
 * se cargan acá y los comentarios que llegan de Notion). Devuelve Map notionPageId → nota.
 * Se prefieren notas escritas por personas; los "cambio de estado" automáticos solo si no hay otra.
 */
async function lastNotesByPage(pageIds) {
  const result = new Map();
  if (!pageIds.length) return result;
  const leads = await SalesLead.findAll({ where: { notionPageId: { [Op.in]: pageIds } }, attributes: ['id', 'notionPageId'], raw: true });
  if (!leads.length) return result;
  const pageByLead = new Map(leads.map(l => [l.id, l.notionPageId]));
  const notes = await LeadNote.findAll({
    where: { leadId: { [Op.in]: leads.map(l => l.id) } },
    attributes: ['leadId', 'message', 'noteType', 'createdAt'],
    include: [{ model: Staff, as: 'author', attributes: ['name'], required: false }],
    order: [['createdAt', 'DESC']],
  });
  const fallback = new Map();
  for (const note of notes) {
    const pageId = pageByLead.get(note.leadId);
    const target = note.noteType === 'status_change' ? fallback : result;
    if (target.has(pageId)) continue;
    const fromNotion = note.message.startsWith('💬 Notion');
    target.set(pageId, {
      dateText: new Date(note.createdAt).toLocaleString('es-ES', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      author: [note.author?.name, fromNotion ? 'desde Notion' : null].filter(Boolean).join(' ') || null,
      type: note.noteType,
      message: truncate(friendlyNote(note.message.replace(/^💬 Notion:\s*/, '')), 900),
    });
  }
  for (const [pageId, note] of fallback) if (!result.has(pageId)) result.set(pageId, note);
  return result;
}

async function buildPdf(data) {
  const notes = await lastNotesByPage(data.open.map(p => p.id)).catch(err => {
    console.error('⚠️ [Notion] reporte: no se pudieron leer las notas:', err.message);
    return new Map();
  });
  return generateNotionReportPdf({
    generatedAt: fmtDate(todayISO()),
    staleDays: STALE_DAYS,
    stats: {
      open: data.open.length,
      overdue: data.open.filter(p => p.overdue).length,
      dueWeek: data.open.filter(p => p.dueThisWeek).length,
      stale: data.open.filter(p => p.stale).length,
    },
    closedThisWeek: data.closedThisWeek,
    groups: GROUPS.map(({ key, title, subtitle }) => ({ key, title, subtitle })),
    open: data.open.map(p => ({
      ...p,
      estadoColor: COLORS[p.estado] || '#6b7280',
      responsibleText: responsibleText(p),
      nextDateText: fmtDate(p.nextDate),
      lastEditedText: `${ago(p.lastEditedDays)} (${fmtDateTime(p.lastEdited)})`,
      situation: truncate(p.situation, 600),
      nextStep: truncate(p.nextStep, 400),
      lastNote: notes.get(p.id) || (lastComment(p.comments)
        ? { dateText: null, author: 'Comentarios del equipo (Notion)', type: null, message: truncate(lastComment(p.comments), 900) }
        : null),
    })),
  });
}

async function recipients() {
  const override = (process.env.NOTION_WEEKLY_REPORT_TO || '').split(',').map(s => s.trim()).filter(s => s.includes('@'));
  if (override.length) return override;
  const owners = await Staff.findAll({ where: { role: 'owner', isActive: true }, attributes: ['email'], raw: true });
  return [...new Set(owners.map(o => (o.email || '').trim().toLowerCase()).filter(e => e.includes('@')))];
}

/**
 * Arma y manda el reporte. { to } permite mandarlo a un email puntual (prueba);
 * { dryRun: true } devuelve el HTML sin enviar.
 */
async function sendWeeklyNotionReport({ to, dryRun = false } = {}) {
  if (!notion.isNotionConfigured()) throw new Error('Notion no está configurado (falta NOTION_TOKEN)');
  const data = await collectProspects();
  const html = buildHtml(data);
  const overdue = data.open.filter(p => p.overdue).length;
  const subject = `📋 Seguimiento de prospectos · ${data.open.length} abiertos${overdue ? ` · ${overdue} vencidos` : ''}`;
  const list = to ? [].concat(to) : await recipients();
  const pdf = await buildPdf(data);
  if (dryRun) return { subject, html, pdf, recipients: list, open: data.open.length };
  if (!list.length) throw new Error('No hay owners activos con email para mandar el reporte');
  const filename = `Seguimiento_Prospectos_${todayISO()}.pdf`;
  for (const email of list) {
    await sendEmail({ to: email, subject, html, attachments: [{ filename, content: pdf, contentType: 'application/pdf' }] });
  }
  console.log(`📋 [Notion] Reporte semanal enviado a ${list.length} destinatario(s): ${data.open.length} abiertos, ${overdue} vencidos`);
  return { subject, recipients: list, open: data.open.length, overdue };
}

function startNotionWeeklyReportCron() {
  if (!notion.isNotionConfigured() || process.env.NOTION_WEEKLY_REPORT === 'off') return;
  cron.schedule('0 10 * * 5', () => {
    sendWeeklyNotionReport().catch(err => console.error('❌ [Notion] reporte semanal:', err.message));
  }, { timezone: TZ });
  console.log('✅ Notion: reporte semanal a los owners los viernes 10:00 (Orlando)');
}

module.exports = { sendWeeklyNotionReport, startNotionWeeklyReportCron, buildHtml, collectProspects, lastNotesByPage };
