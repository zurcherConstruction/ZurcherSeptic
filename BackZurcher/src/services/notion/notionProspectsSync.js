/**
 * 🔗 Sincronización Notion ↔ Sales Leads (base "Seguimiento de Prospectos — Zurcher Septic")
 *
 * Qué se sincroniza:
 *  - Todo prospecto cargado en Notion se crea (o se vincula, si ya existía con el mismo nombre o
 *    empresa) como Sales Lead.
 *  - Los Sales Leads de categoría "constructora" se agregan a Notion. Los leads de la web/chat no.
 *
 * Campos:  Contacto ↔ applicantName · Empresa ↔ companyName · Estado ↔ status/priority ·
 *          Situación actual ↔ notes
 *  - "Comentarios del equipo" (Notion) → se agrega como nota del lead (nunca se borra nada).
 *  - Notas nuevas del lead (sistema) → se agregan al cuerpo de la página de Notion.
 *  - Responsable + Fecha próx. seguimiento + Próximo paso → UNA tarea del tablero por prospecto,
 *    asignada al empleado cuyo email coincide con el del usuario de Notion.
 *
 * Conflictos: se guarda una "foto" (notion_snapshot) de cada sincronización. Si un campo cambió de un
 * solo lado, gana ese lado; si cambió de los dos, gana el cambio más reciente (hora de edición de la
 * página en Notion vs. updatedAt del lead).
 *
 * Tiempo real: Notion avisa por webhook (POST /notion/webhook) y se sincroniza solo ese prospecto;
 * los cambios hechos en el sistema (lead o nota) se mandan a Notion al momento (hooks del modelo).
 * Respaldo: corrida completa al arrancar, cada 12 h y a pedido (POST /notion/sync).
 */
const cron = require('node-cron');
const { Op } = require('sequelize');
const { SalesLead, LeadNote, Staff, Reminder, ReminderAssignment, AISetting } = require('../../data');
const notion = require('./notionClient');

const DATA_SOURCE_ID = () => process.env.NOTION_PROSPECTS_DATA_SOURCE_ID || '41cdbd7a-6eda-81d3-ba58-000be09b32bd';
const STATE_KEY = 'notion_prospects_sync';

// Nombres de las columnas en Notion
const P = {
  contact: 'Contacto',
  company: 'Empresa',
  estado: 'Estado',
  responsible: 'Responsable',
  nextDate: 'Fecha próx. seguimiento',
  nextStep: 'Próximo paso',
  situation: 'Situación actual',
  comments: 'Comentarios del equipo',
};

const E = {
  pendiente: '🔴 Pendiente',
  urgente: '🟠 Urgente',
  confirmar: '🔵 Confirmar',
  espera: '🟡 En espera',
  analizar: '🟣 Analizar',
  cerrado: '✅ Cerrado',
};
const ESTADOS = Object.values(E);
const TERMINAL = ['won', 'lost', 'archived'];
const NOTION_NOTE_PREFIX = '💬 Notion';

const pageUrl = id => `https://www.notion.so/${String(id).replace(/-/g, '')}`;
// "—", "-", "N/A" en Notion significan "vacío" (no es un nombre de empresa)
const clean = v => {
  const s = v == null ? '' : String(v).trim();
  return /^([-–—.]+|n\/?a)$/i.test(s) ? '' : s;
};

// ---------------------------------------------------------------------------
// Estado ↔ status
// ---------------------------------------------------------------------------

function estadoFromLead(lead, currentEstado) {
  // Si el estado actual de Notion ya corresponde al status del lead, no se cambia (varios estados
  // de Notion equivalen al mismo status del sistema)
  if (currentEstado) {
    const back = statusFromEstado(currentEstado, lead);
    if (back.status === lead.status && (currentEstado === E.urgente) === (lead.priority === 'urgent' && !TERMINAL.includes(lead.status))) {
      return currentEstado;
    }
  }
  if (TERMINAL.includes(lead.status)) return E.cerrado;
  if (lead.priority === 'urgent') return E.urgente;
  return {
    new: E.pendiente,
    contacted: E.espera,
    no_answer: E.espera,
    interested: E.analizar,
    quoted: E.confirmar,
    negotiating: E.confirmar,
  }[lead.status] || E.pendiente;
}

function statusFromEstado(estado, lead = {}) {
  const current = lead.status;
  const keepPriority = lead.priority === 'urgent' ? 'high' : (lead.priority || 'medium');
  switch (estado) {
    case E.pendiente: return { status: 'new', priority: keepPriority };
    case E.urgente: return { status: current && !TERMINAL.includes(current) && current !== 'new' ? current : 'interested', priority: 'urgent' };
    case E.confirmar: return { status: 'negotiating', priority: keepPriority };
    case E.espera: return { status: 'contacted', priority: keepPriority };
    case E.analizar: return { status: 'interested', priority: keepPriority };
    // Cerrado = terminado: queda Ganado/Perdido si ya lo era; si no, Archivado
    case E.cerrado: return { status: current === 'won' || current === 'lost' ? current : 'archived', priority: keepPriority };
    default: return { status: current || 'new', priority: lead.priority || 'medium' };
  }
}

// ---------------------------------------------------------------------------
// Lectura / escritura de un prospecto
// ---------------------------------------------------------------------------

async function readProspect(page) {
  const props = page.properties || {};
  const people = props[P.responsible]?.people || [];
  let users = null;
  const responsible = [];
  for (const person of people) {
    let email = person.person?.email?.toLowerCase();
    if (!email) {
      users = users || await notion.listUsers().catch(() => []);
      email = users.find(u => u.id === person.id)?.email || null;
    }
    responsible.push({ id: person.id, name: person.name || null, email });
  }
  return {
    id: page.id,
    url: page.url || pageUrl(page.id),
    lastEdited: page.last_edited_time,
    archived: Boolean(page.archived || page.in_trash),
    contact: clean(notion.propertyValue(props[P.contact])),
    company: clean(notion.propertyValue(props[P.company])),
    estado: clean(notion.propertyValue(props[P.estado])) || E.pendiente,
    situation: clean(notion.propertyValue(props[P.situation])),
    comments: clean(notion.propertyValue(props[P.comments])),
    nextStep: clean(notion.propertyValue(props[P.nextStep])),
    nextDate: clean(notion.propertyValue(props[P.nextDate])).slice(0, 10),
    responsible,
  };
}

// Valores del lead expresados como campos de Notion
function leadValues(lead, snapshot = {}) {
  return {
    contact: clean(lead.applicantName),
    company: clean(lead.companyName),
    estado: estadoFromLead(lead, snapshot.estado),
    situation: clean(lead.notes).slice(0, 2000),
  };
}

function notionProperties(values) {
  const props = {};
  if ('contact' in values) props[P.contact] = { title: notion.richText(values.contact || 'Sin nombre') };
  if ('company' in values) props[P.company] = { rich_text: notion.richText(values.company) };
  if ('estado' in values && ESTADOS.includes(values.estado)) props[P.estado] = { status: { name: values.estado } };
  if ('situation' in values) props[P.situation] = { rich_text: notion.richText(values.situation) };
  if ('nextStep' in values) props[P.nextStep] = { rich_text: notion.richText(values.nextStep) };
  if ('nextDate' in values) props[P.nextDate] = { date: values.nextDate ? { start: values.nextDate } : null };
  if ('responsibleIds' in values) props[P.responsible] = { people: values.responsibleIds.map(id => ({ object: 'user', id })) };
  return props;
}

// ---------------------------------------------------------------------------
// Tarea de seguimiento del tablero (una por prospecto)
// ---------------------------------------------------------------------------

async function staffForEmails(emails) {
  const list = emails.filter(Boolean);
  if (!list.length) return [];
  const staff = await Staff.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'email'], raw: true });
  return staff.filter(s => list.includes(String(s.email || '').toLowerCase()));
}

async function syncFollowUpTask(lead, n, changed, stats) {
  const closed = n.estado === E.cerrado || n.archived;
  const hasFollowUp = Boolean(n.nextStep || n.nextDate);
  let reminder = lead.notionReminderId ? await Reminder.findByPk(lead.notionReminderId) : null;

  if (closed || !hasFollowUp) {
    if (reminder) {
      await ReminderAssignment.update({ completed: true, completedAt: new Date() }, { where: { reminderId: reminder.id, completed: false } });
    }
    return;
  }
  if (reminder && !changed) return;

  const staff = await staffForEmails(n.responsible.map(r => r.email));
  if (!staff.length) {
    if (n.responsible.length) {
      stats.unmatchedPeople.push(...n.responsible.map(r => r.email || r.name || r.id).filter(Boolean));
    }
    return;
  }

  const company = n.company && n.company.toLowerCase() !== n.contact.toLowerCase() ? ` · ${n.company}` : '';
  const fields = {
    title: `Seguimiento: ${n.contact || n.company}${company}`.slice(0, 200),
    description: [
      n.nextStep && `Próximo paso: ${n.nextStep}`,
      n.situation && `Situación: ${n.situation}`,
      `Notion: ${n.url}`,
    ].filter(Boolean).join('\n'),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(n.nextDate) ? n.nextDate : null,
    priority: n.estado === E.urgente ? 'urgent' : 'medium',
    linkedEntityType: 'salesLead',
    linkedEntityId: String(lead.id),
    linkedEntityLabel: (n.company || n.contact || '').slice(0, 200) || null,
  };

  if (!reminder) {
    reminder = await Reminder.create({ ...fields, type: 'tagged', createdBy: staff[0].id });
    stats.tasksCreated++;
  } else {
    await reminder.update(fields);
    stats.tasksUpdated++;
  }

  // Asignaciones = responsables actuales; si cambió el seguimiento, la tarea vuelve a quedar pendiente
  const ids = staff.map(s => s.id);
  await ReminderAssignment.destroy({ where: { reminderId: reminder.id, staffId: { [Op.notIn]: ids } } });
  const existing = await ReminderAssignment.findAll({ where: { reminderId: reminder.id }, attributes: ['staffId'], raw: true });
  const have = new Set(existing.map(a => a.staffId));
  await ReminderAssignment.bulkCreate(ids.filter(id => !have.has(id)).map(staffId => ({ reminderId: reminder.id, staffId })));
  await ReminderAssignment.update({ completed: false, completedAt: null }, { where: { reminderId: reminder.id } });

  if (lead.notionReminderId !== reminder.id) lead.notionReminderId = reminder.id;
}

// ---------------------------------------------------------------------------
// Sincronización de un par (lead + página)
// ---------------------------------------------------------------------------

// Texto nuevo de "Comentarios del equipo" respecto de la última vez
function newCommentText(previous, current) {
  if (!current || current === previous) return null;
  if (previous && current.startsWith(previous)) return current.slice(previous.length).trim() || null;
  return current;
}

async function pushNewNotes(lead, pageId, since) {
  const where = { leadId: lead.id, message: { [Op.notLike]: `${NOTION_NOTE_PREFIX}%` } };
  if (since) where.createdAt = { [Op.gt]: since };
  const notes = await LeadNote.findAll({
    where,
    include: [{ model: Staff, as: 'author', attributes: ['name'], required: false }],
    order: [['createdAt', 'ASC']],
    limit: 50,
  }).catch(() => LeadNote.findAll({ where, order: [['createdAt', 'ASC']], limit: 50 }));
  if (!notes.length) return 0;
  const blocks = notes.map(note => {
    const date = new Date(note.createdAt).toLocaleDateString('es-AR', { timeZone: 'America/New_York' });
    const author = note.author?.name ? ` · ${note.author.name}` : '';
    return { object: 'block', type: 'paragraph', paragraph: { rich_text: notion.richText(`📝 ${date}${author}: ${note.message}`) } };
  });
  await notion.appendBlocks(pageId, blocks);
  return notes.length;
}

async function syncPair(lead, page, stats) {
  const n = await readProspect(page);
  const snap = lead.notionSnapshot || {};
  const firstLink = !lead.notionSnapshot;
  const lv = leadValues(lead, snap);
  const pageTime = new Date(n.lastEdited).getTime();
  const leadTime = new Date(lead.updatedAt).getTime();

  const toLead = {};
  const toNotion = {};
  for (const key of ['contact', 'company', 'estado', 'situation']) {
    const notionChanged = n[key] !== (snap[key] ?? '');
    const leadChanged = lv[key] !== (snap[key] ?? '');
    if (firstLink) {
      // Primera vinculación: Notion completa lo que tenga; el lead completa lo que falte en Notion
      if (n[key] && n[key] !== lv[key]) toLead[key] = n[key];
      else if (!n[key] && lv[key]) toNotion[key] = lv[key];
    } else if (notionChanged && leadChanged && n[key] !== lv[key]) {
      if (pageTime >= leadTime) toLead[key] = n[key]; else toNotion[key] = lv[key];
    } else if (notionChanged && n[key] !== lv[key]) {
      toLead[key] = n[key];
    } else if (leadChanged && n[key] !== lv[key]) {
      toNotion[key] = lv[key];
    }
  }

  // Aplicar al lead
  const updates = {};
  if ('contact' in toLead && toLead.contact) updates.applicantName = toLead.contact;
  if ('company' in toLead) updates.companyName = toLead.company || null;
  if ('situation' in toLead) updates.notes = toLead.situation || null;
  if ('estado' in toLead) Object.assign(updates, statusFromEstado(toLead.estado, lead));
  if (Object.keys(updates).length) {
    updates.lastActivityDate = new Date();
    await lead.update(updates, { notionSync: true });
    stats.leadsUpdated++;
  }

  // Comentarios del equipo → nota del lead
  const comment = newCommentText(snap.comments || '', n.comments);
  if (comment) {
    const [author] = await staffForEmails(n.responsible.map(r => r.email));
    await LeadNote.create({
      leadId: lead.id,
      staffId: author?.id || null,
      message: `${NOTION_NOTE_PREFIX}: ${comment}`.slice(0, 5000),
      noteType: 'follow_up',
      priority: 'medium',
    }, { notionSync: true });
    stats.notesFromNotion++;
  }

  // Aplicar a Notion
  if (Object.keys(toNotion).length) {
    await notion.updatePage(n.id, notionProperties(toNotion));
    stats.pagesUpdated++;
  }

  // Notas nuevas del sistema → cuerpo de la página
  stats.notesToNotion += await pushNewNotes(lead, n.id, firstLink ? null : lead.notionSyncedAt).catch(err => {
    stats.errors.push(`Notas de "${lead.applicantName}": ${err.message}`);
    return 0;
  });

  const final = { ...lv, ...toLead, ...toNotion };

  // Tarea de seguimiento (con el estado que queda después de sincronizar, de cualquiera de los dos lados)
  const effective = { ...n, estado: final.estado, situation: final.situation, contact: final.contact || n.contact, company: final.company };
  const followUpChanged = firstLink
    || n.nextStep !== (snap.nextStep ?? '')
    || n.nextDate !== (snap.nextDate ?? '')
    || final.estado !== (snap.estado ?? '')
    || JSON.stringify(n.responsible.map(r => r.email).sort()) !== JSON.stringify([...(snap.responsible || [])].sort());
  await syncFollowUpTask(lead, effective, followUpChanged, stats);
  await lead.update({
    notionPageId: n.id,
    notionReminderId: lead.notionReminderId || null,
    notionSyncedAt: new Date(),
    notionSnapshot: {
      contact: final.contact,
      company: final.company,
      estado: final.estado,
      situation: final.situation,
      comments: n.comments,
      nextStep: n.nextStep,
      nextDate: n.nextDate,
      responsible: n.responsible.map(r => r.email).filter(Boolean),
    },
  }, { silent: true, notionSync: true });
}

// Lead existente sin vincular que corresponde a un prospecto de Notion (mismo nombre o empresa)
async function findMatchingLead(n) {
  const or = [];
  if (n.company) or.push({ companyName: { [Op.iLike]: n.company } });
  if (n.contact) or.push({ applicantName: { [Op.iLike]: n.contact } });
  if (!or.length) return null;
  return SalesLead.findOne({ where: { notionPageId: null, [Op.or]: or }, order: [['updatedAt', 'DESC']] });
}

async function createLeadFromNotion(page, stats) {
  const n = await readProspect(page);
  if (!n.contact && !n.company) return null;
  const [creator] = await staffForEmails(n.responsible.map(r => r.email));
  const { status, priority } = statusFromEstado(n.estado, {});
  const lead = await SalesLead.create({
    applicantName: n.contact || n.company,
    companyName: n.company || null,
    leadCategory: n.company ? 'constructora' : 'cliente',
    status,
    priority,
    source: 'other',
    notes: n.situation || null,
    firstContactDate: new Date(),
    lastActivityDate: new Date(),
    createdBy: creator?.id || null,
    tags: ['notion'],
  }, { notionSync: true });
  stats.leadsCreated++;
  return lead;
}

async function createPageFromLead(lead, stats) {
  const values = leadValues(lead);
  const details = [
    lead.applicantPhone && `📞 ${lead.applicantPhone}`,
    lead.applicantEmail && `✉️ ${lead.applicantEmail}`,
    lead.propertyAddress && `📍 ${lead.propertyAddress}`,
    lead.serviceType && `🔧 ${lead.serviceType}`,
  ].filter(Boolean).join(' · ');
  const page = await notion.createPage({
    dataSourceId: DATA_SOURCE_ID(),
    properties: notionProperties(values),
    children: details
      ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: notion.richText(`Lead del sistema · ${details}`) } }]
      : [],
  });
  stats.pagesCreated++;
  return page;
}

// ---------------------------------------------------------------------------
// Sincronización: tiempo real (webhooks de Notion + cambios en el sistema) y corrida completa de respaldo
// ---------------------------------------------------------------------------

// Una sola cosa a la vez (cola en tiempo real, corrida completa, botón) para no pisarse
let chain = Promise.resolve();
const exclusive = fn => {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
};
let fullRun = null;

async function getState() {
  const row = await AISetting.findByPk(STATE_KEY);
  return row?.value || {};
}

async function saveState(value) {
  await AISetting.upsert({ key: STATE_KEY, value });
}

const newStats = () => ({
  pagesRead: 0, leadsCreated: 0, leadsLinked: 0, leadsUpdated: 0, pagesCreated: 0, pagesUpdated: 0,
  notesFromNotion: 0, notesToNotion: 0, tasksCreated: 0, tasksUpdated: 0, unmatchedPeople: [], errors: [],
});

const DATABASE_ID = () => process.env.NOTION_PROSPECTS_DATABASE_ID || '41cdbd7a-6eda-8118-b8be-ec3ab409d017';

// ¿La página es un prospecto de "Seguimiento de Prospectos"? (los webhooks avisan de cualquier página compartida)
function isProspectPage(page) {
  const parent = page?.parent || {};
  if (parent.data_source_id) return notion.normalizeId(parent.data_source_id) === notion.normalizeId(DATA_SOURCE_ID());
  if (parent.database_id) return notion.normalizeId(parent.database_id) === notion.normalizeId(DATABASE_ID());
  return false;
}

// El prospecto se borró en Notion: el lead queda en el sistema, sin vínculo, y no se vuelve a crear en Notion
async function unlinkDeletedPage(lead) {
  if (lead.notionReminderId) {
    await ReminderAssignment.update({ completed: true, completedAt: new Date() }, { where: { reminderId: lead.notionReminderId, completed: false } });
  }
  await lead.update(
    { notionPageId: null, notionSyncedAt: null, notionSnapshot: { removedFromNotion: new Date().toISOString() } },
    { silent: true, notionSync: true },
  );
}

// Prospecto de Notion → lead (lo crea o lo vincula si no existe)
async function syncNotionPage(page, stats, { skipIfUnchanged = false } = {}) {
  const deleted = Boolean(page.archived || page.in_trash);
  let lead = await SalesLead.findOne({ where: { notionPageId: page.id } });
  if (deleted) {
    if (lead) await unlinkDeletedPage(lead);
    return lead;
  }
  if (lead && skipIfUnchanged && lead.notionSyncedAt
    && new Date(page.last_edited_time) < new Date(lead.notionSyncedAt).setSeconds(0, 0) - 60 * 1000) {
    return lead; // sin cambios en Notion desde la última sincronización de este prospecto
  }
  if (!lead) {
    const n = await readProspect(page);
    lead = await findMatchingLead(n);
    if (lead) stats.leadsLinked++;
    else lead = await createLeadFromNotion(page, stats);
    if (!lead) return null;
  }
  await syncPair(lead, page, stats);
  return lead;
}

// Lead del sistema → Notion (constructoras nuevas se crean; los vinculados se actualizan)
async function pushLead(lead, stats) {
  let page;
  if (lead.notionPageId) {
    page = await notion.getPage(lead.notionPageId).catch(err => {
      if (err.status === 404) return null;
      throw err;
    });
    if (!page || page.archived || page.in_trash) {
      await unlinkDeletedPage(lead);
      return;
    }
  } else {
    if (lead.leadCategory !== 'constructora' || lead.notionSnapshot?.removedFromNotion) return;
    page = await createPageFromLead(lead, stats);
  }
  await syncPair(lead, page, stats);
}

function logStats(prefix, stats) {
  const summary = `🔗 [Notion${prefix}] ${stats.pagesRead} página(s) leídas · leads +${stats.leadsCreated} nuevos, ${stats.leadsLinked} vinculados, ${stats.leadsUpdated} actualizados · Notion +${stats.pagesCreated} páginas, ${stats.pagesUpdated} actualizadas · tareas +${stats.tasksCreated}/${stats.tasksUpdated}`;
  console.log(summary + (stats.errors.length ? ` · ⚠️ ${stats.errors.length} error(es)` : ''));
  if (stats.errors.length) console.error('🔗 [Notion] errores:', stats.errors.slice(0, 10));
}

// ---- Corrida completa (respaldo: cada 12 h, al arrancar y con el botón) ----
async function runSync() {
  const stats = newStats();
  const startedAt = new Date();
  const state = await getState();
  const handled = new Set();

  // 1. Páginas de Notion editadas desde la última corrida (margen de 5 min: Notion redondea la hora al minuto)
  const since = state.lastRunAt ? new Date(new Date(state.lastRunAt).getTime() - 5 * 60 * 1000).toISOString() : null;
  const pages = await notion.queryDataSource(DATA_SOURCE_ID(), {
    filter: since ? { timestamp: 'last_edited_time', last_edited_time: { on_or_after: since } } : undefined,
  });
  stats.pagesRead = pages.length;

  for (const page of pages) {
    try {
      const lead = await syncNotionPage(page, stats, { skipIfUnchanged: true });
      if (lead) handled.add(lead.id);
    } catch (err) {
      stats.errors.push(`Página ${page.id}: ${err.message}`);
    }
  }

  // 2. Leads del sistema: constructoras sin página, y leads vinculados con cambios o notas nuevas
  const notesSince = state.lastRunAt ? new Date(state.lastRunAt) : null;
  const leadsWithNewNotes = notesSince
    ? (await LeadNote.findAll({
      where: { createdAt: { [Op.gt]: notesSince }, message: { [Op.notLike]: `${NOTION_NOTE_PREFIX}%` } },
      attributes: ['leadId'],
      raw: true,
    })).map(n => n.leadId)
    : [];

  const toPush = await SalesLead.findAll({
    where: {
      [Op.or]: [
        { notionPageId: null, notionSnapshot: null, leadCategory: 'constructora' },
        { notionPageId: { [Op.ne]: null }, notionSyncedAt: null },
        { notionPageId: { [Op.ne]: null }, updatedAt: { [Op.gt]: SalesLead.sequelize.col('notion_synced_at') } },
        ...(leadsWithNewNotes.length ? [{ notionPageId: { [Op.ne]: null }, id: { [Op.in]: leadsWithNewNotes } }] : []),
      ],
    },
    limit: 200,
  });

  for (const lead of toPush) {
    if (handled.has(lead.id)) continue;
    try {
      await pushLead(lead, stats);
    } catch (err) {
      stats.errors.push(`Lead "${lead.applicantName}": ${err.message}`);
    }
  }

  stats.unmatchedPeople = [...new Set(stats.unmatchedPeople)];
  const latest = await getState(); // conserva lastWebhookAt si llegó un aviso durante la corrida
  await saveState({ ...latest, lastRunAt: startedAt.toISOString(), lastResult: { ...stats, finishedAt: new Date().toISOString() } });
  logStats('', stats);
  return stats;
}

function syncProspects() {
  if (!notion.isNotionConfigured()) return Promise.reject(new Error('Notion no está configurado (falta NOTION_TOKEN)'));
  if (!fullRun) fullRun = exclusive(runSync).finally(() => { fullRun = null; });
  return fullRun;
}

// ---- Tiempo real: cola con espera corta (junta varios avisos seguidos del mismo prospecto) ----
const pendingPages = new Set();
const pendingLeads = new Set();
let flushTimer = null;
const FLUSH_DELAY_MS = 4000;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    exclusive(processQueue).catch(err => console.error('❌ [Notion] tiempo real:', err.message));
  }, FLUSH_DELAY_MS);
}

function queuePage(pageId) {
  const id = notion.normalizeId(pageId);
  if (!id || !notion.isNotionConfigured()) return;
  pendingPages.add(id);
  scheduleFlush();
}

function queueLead(leadId) {
  if (!leadId || !notion.isNotionConfigured()) return;
  pendingLeads.add(leadId);
  scheduleFlush();
}

async function processQueue() {
  const pageIds = [...pendingPages];
  const leadIds = [...pendingLeads];
  pendingPages.clear();
  pendingLeads.clear();
  if (!pageIds.length && !leadIds.length) return null;

  const stats = newStats();
  const handled = new Set();
  for (const id of pageIds) {
    try {
      const page = await notion.getPage(id).catch(err => {
        if (err.status === 404) return null;
        throw err;
      });
      if (!page) {
        const lead = await SalesLead.findOne({ where: { notionPageId: id } });
        if (lead) {
          await unlinkDeletedPage(lead);
          handled.add(lead.id);
        }
        continue;
      }
      if (!isProspectPage(page)) continue;
      stats.pagesRead++;
      const lead = await syncNotionPage(page, stats);
      if (lead) handled.add(lead.id);
    } catch (err) {
      stats.errors.push(`Página ${id}: ${err.message}`);
    }
  }
  for (const id of leadIds) {
    if (handled.has(id)) continue;
    try {
      const lead = await SalesLead.findByPk(id);
      if (lead) await pushLead(lead, stats);
    } catch (err) {
      stats.errors.push(`Lead ${id}: ${err.message}`);
    }
  }
  const touched = stats.leadsCreated + stats.leadsLinked + stats.leadsUpdated + stats.pagesCreated + stats.pagesUpdated
    + stats.notesFromNotion + stats.notesToNotion + stats.tasksCreated + stats.tasksUpdated + stats.errors.length;
  if (touched) logStats(' tiempo real', stats);
  return stats;
}

// Cambios hechos en el sistema → Notion al momento (sin esperar a la corrida completa)
const LEAD_FIELDS = ['applicantName', 'companyName', 'status', 'priority', 'notes', 'leadCategory'];
let hooksInstalled = false;
function installLeadHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  SalesLead.addHook('afterCreate', 'notionRealtime', (lead, options) => {
    if (!options?.notionSync && lead.leadCategory === 'constructora') queueLead(lead.id);
  });
  SalesLead.addHook('afterUpdate', 'notionRealtime', (lead, options) => {
    if (options?.notionSync) return;
    if (!lead.notionPageId && lead.leadCategory !== 'constructora') return;
    const changed = lead.changed() || options?.fields || [];
    if (changed.some(f => LEAD_FIELDS.includes(f))) queueLead(lead.id);
  });
  LeadNote.addHook('afterCreate', 'notionRealtime', (note, options) => {
    if (options?.notionSync || String(note.message || '').startsWith(NOTION_NOTE_PREFIX)) return;
    queueLead(note.leadId);
  });
}

// ---- Webhooks de Notion ----
const WEBHOOK_KEY = 'notion_webhook';
let botUserId = null;

async function getWebhookSecret() {
  if (process.env.NOTION_WEBHOOK_SECRET) return process.env.NOTION_WEBHOOK_SECRET;
  const row = await AISetting.findByPk(WEBHOOK_KEY);
  return row?.value?.verificationToken || null;
}

// Notion manda el token una vez al crear la suscripción: se guarda (para validar las firmas) y se muestra en el log
async function saveWebhookVerificationToken(token) {
  await AISetting.upsert({ key: WEBHOOK_KEY, value: { verificationToken: token, receivedAt: new Date().toISOString() } });
}

async function markWebhookReceived() {
  const state = await getState();
  await saveState({ ...state, lastWebhookAt: new Date().toISOString() });
}

async function handleWebhookEvent(event) {
  const type = String(event?.type || '');
  if (!type.startsWith('page.')) return; // comentarios, cambios de estructura, etc. no afectan a los leads
  const pageId = event.entity?.id;
  if (!pageId) return;

  // Cambios hechos por esta misma conexión (el sistema escribiendo en Notion): no hace falta volver a leerlos
  const authors = event.authors || [];
  if (authors.length && authors.every(a => a.type === 'bot')) {
    if (!botUserId) botUserId = (await notion.notionRequest('GET', '/users/me').catch(() => null))?.id || null;
    if (botUserId && authors.every(a => a.id === botUserId)) return;
  }
  queuePage(pageId);
}

async function getSyncStatus() {
  const state = await getState();
  const webhook = await AISetting.findByPk(WEBHOOK_KEY);
  return {
    configured: notion.isNotionConfigured(),
    running: Boolean(fullRun),
    realtime: Boolean(process.env.NOTION_WEBHOOK_SECRET || webhook?.value?.verificationToken),
    lastWebhookAt: state.lastWebhookAt || null,
    lastRunAt: state.lastRunAt || null,
    lastResult: state.lastResult || null,
    databaseUrl: pageUrl(DATABASE_ID()),
  };
}

function startNotionSyncCron() {
  if (!notion.isNotionConfigured()) {
    console.log('ℹ️ Notion no configurado (NOTION_TOKEN): sincronización de prospectos apagada');
    return;
  }
  installLeadHooks();
  // Respaldo por si se perdió algún aviso: al arrancar (1 min después) y 2 veces por día
  setTimeout(() => syncProspects().catch(err => console.error('❌ [Notion] sync inicial:', err.message)), 60 * 1000);
  cron.schedule('0 6,18 * * *', () => {
    syncProspects().catch(err => console.error('❌ [Notion] sync:', err.message));
  }, { timezone: 'America/New_York' });
  console.log('✅ Notion ↔ Leads: tiempo real (webhooks + cambios del sistema) y respaldo cada 12 h');
}

module.exports = {
  P, E, ESTADOS, DATA_SOURCE_ID, pageUrl,
  readProspect, notionProperties, statusFromEstado, estadoFromLead,
  syncProspects, getSyncStatus, startNotionSyncCron,
  queuePage, queueLead, installLeadHooks, handleWebhookEvent, getWebhookSecret, saveWebhookVerificationToken, markWebhookReceived,
};
