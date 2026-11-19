/**
 * 🔗 ZurcherAI ↔ Notion
 *
 * Lectura (directa): buscar en Notion, leer una página, listar prospectos/seguimientos.
 * Escritura (con botón "Confirmar", igual que las demás acciones de ZurcherAI): crear o actualizar
 * un prospecto, crear una página y agregar contenido a una página.
 *
 * Solo funciona con lo que se compartió con la integración en Notion.
 */
const { SalesLead, Staff } = require('../../data');
const notion = require('./notionClient');
const sync = require('./notionProspectsSync');

const CONFIRM_NOTE = 'Nothing is done until the user presses the confirm button. Show a short summary of what will happen and the "confirmLink" exactly as a markdown link, e.g. [✅ Confirmar: actualizar en Notion](confirmLink). Never say it was done.';

const ESTADO_ENUM = sync.ESTADOS;
const PAGE_REF = 'Notion page id or URL (from notion_search / notion_list_prospects), or for prospects the contact or company name';

const NOTION_READ_TOOLS = [
  {
    name: 'notion_search',
    description: 'Search the company Notion workspace (pages and databases shared with the integration): procedures, notes, prospect follow-ups... Returns titles, ids and links. Then use notion_read_page to read one.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to search (empty = most recently edited)' },
        type: { type: 'string', enum: ['page', 'data_source'], description: 'Optional: only pages or only databases' },
      },
    },
  },
  {
    name: 'notion_read_page',
    description: 'Read a Notion page: its properties and its content as text. Also works for a prospect of the "Seguimiento de Prospectos" database.',
    input_schema: {
      type: 'object',
      properties: { page: { type: 'string', description: PAGE_REF } },
      required: ['page'],
    },
  },
  {
    name: 'notion_list_prospects',
    description: 'List the prospects of the Notion database "Seguimiento de Prospectos — Zurcher Septic" (synced with Sales Leads): contact, company, estado, responsible employee, next follow-up date, next step and current situation. Use it for "mis seguimientos", "qué tengo que hacer hoy con los prospectos", "prospectos urgentes", etc.',
    input_schema: {
      type: 'object',
      properties: {
        responsible: { type: 'string', description: 'Optional: employee name or email ("me" = the current user)' },
        estado: { type: 'string', enum: ESTADO_ENUM, description: 'Optional filter by estado' },
        dueOnOrBefore: { type: 'string', description: 'Optional YYYY-MM-DD: only follow-ups due on or before this date' },
        includeClosed: { type: 'boolean', description: 'Include "✅ Cerrado" (default false)' },
      },
    },
  },
];

const PROSPECT_FIELDS = {
  estado: { type: 'string', enum: ESTADO_ENUM },
  nextStep: { type: 'string', description: 'Próximo paso (concrete next action)' },
  nextDate: { type: 'string', description: 'Fecha próx. seguimiento, YYYY-MM-DD ("" to clear)' },
  responsible: { type: 'array', items: { type: 'string' }, description: 'Employee names or emails (replaces the current ones)' },
  situation: { type: 'string', description: 'Situación actual (replaces the current text)' },
  addComment: { type: 'string', description: 'Comment added to "Comentarios del equipo" (keeps the previous comments)' },
};

const NOTION_ACTION_TOOLS = [
  {
    name: 'propose_notion_prospect_update',
    description: `Propose updating a prospect in the Notion database "Seguimiento de Prospectos" (estado, next step, follow-up date, responsible, situation, or add a team comment). The change is synced to the Sales Lead and to the employee's follow-up task. ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: { page: { type: 'string', description: PAGE_REF }, ...PROSPECT_FIELDS },
      required: ['page'],
    },
  },
  {
    name: 'propose_notion_prospect_create',
    description: `Propose adding a new prospect to the Notion database "Seguimiento de Prospectos" (it is also created as a Sales Lead by the sync). ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: 'Contact name (title)' },
        company: { type: 'string' },
        ...PROSPECT_FIELDS,
      },
      required: ['contact'],
    },
  },
  {
    name: 'propose_notion_page',
    description: `Propose creating a new Notion page (e.g. a procedure, meeting notes, a personal follow-up list) inside a parent page the user names. Content uses simple markdown: # headings, - bullets, - [ ] to-dos, paragraphs. ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        parentPage: { type: 'string', description: 'Parent page id or URL (from notion_search). Optional only if a default parent is configured.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'propose_notion_append',
    description: `Propose adding content at the end of an existing Notion page (e.g. a follow-up note). Simple markdown. ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'string', description: PAGE_REF },
        content: { type: 'string' },
      },
      required: ['page', 'content'],
    },
  },
];

const NOTION_READ_TOOL_NAMES = NOTION_READ_TOOLS.map(t => t.name);
const NOTION_ACTION_TOOL_NAMES = NOTION_ACTION_TOOLS.map(t => t.name);

function getNotionTools() {
  if (!notion.isNotionConfigured()) return [];
  return [...NOTION_READ_TOOLS, ...NOTION_ACTION_TOOLS];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let prospectsCache = { at: 0, pages: [] };
async function allProspects() {
  if (Date.now() - prospectsCache.at < 60 * 1000) return prospectsCache.pages;
  const pages = await notion.queryDataSource(sync.DATA_SOURCE_ID(), { limit: 500 });
  prospectsCache = { at: Date.now(), pages };
  return pages;
}

async function resolvePage(ref) {
  const id = notion.normalizeId(ref);
  if (id) return notion.getPage(id);
  const q = String(ref || '').trim().toLowerCase();
  if (!q) throw new Error('Missing page');
  const prospects = await Promise.all((await allProspects()).map(sync.readProspect));
  const exact = prospects.filter(p => p.contact.toLowerCase() === q || p.company.toLowerCase() === q);
  const matches = exact.length ? exact : prospects.filter(p => p.contact.toLowerCase().includes(q) || p.company.toLowerCase().includes(q));
  if (!matches.length) throw new Error(`No prospect matches "${ref}". Use notion_search or notion_list_prospects to find the page id.`);
  if (matches.length > 1) throw new Error(`"${ref}" matches several prospects (${matches.map(m => m.contact).join(', ')}): ask the user which one.`);
  return notion.getPage(matches[0].id);
}

const isProspect = page => {
  const ds = page?.parent?.data_source_id || page?.parent?.database_id;
  return ds && notion.normalizeId(ds) === notion.normalizeId(sync.DATA_SOURCE_ID())
    || page?.parent?.database_id && notion.normalizeId(page.parent.database_id) === notion.normalizeId(process.env.NOTION_PROSPECTS_DATABASE_ID || '41cdbd7a-6eda-8118-b8be-ec3ab409d017');
};

async function resolveStaff(names = [], currentStaff) {
  const active = await Staff.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'email'], raw: true });
  return names.map(raw => {
    const q = String(raw).trim().toLowerCase();
    if (q === 'me' || q === 'yo') return active.find(s => s.id === currentStaff.id) || currentStaff;
    const byEmail = active.filter(s => s.email?.toLowerCase() === q);
    const matches = byEmail.length ? byEmail : active.filter(s => s.name?.toLowerCase().includes(q));
    if (!matches.length) throw new Error(`No active staff member matches "${raw}"`);
    if (matches.length > 1) throw new Error(`"${raw}" matches several staff members (${matches.map(m => m.name).join(', ')}): ask the user which one.`);
    return matches[0];
  });
}

// Empleados → usuarios de Notion (por email)
async function notionUsersFor(staffList) {
  const users = await notion.listUsers();
  return staffList.map(s => {
    const user = users.find(u => u.email && u.email === String(s.email || '').toLowerCase());
    if (!user) throw new Error(`${s.name || s.email} has no Notion user with the same email (${s.email}). Invite them to the Notion workspace with that email first.`);
    return { staff: s, user };
  });
}

function validateFields(input) {
  if (input.estado && !ESTADO_ENUM.includes(input.estado)) throw new Error(`estado must be one of: ${ESTADO_ENUM.join(', ')}`);
  if (input.nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextDate)) throw new Error('nextDate must be YYYY-MM-DD');
}

async function buildProspectProperties(input, staff, currentComments = '') {
  const values = {};
  if (input.contact !== undefined) values.contact = String(input.contact).trim();
  if (input.company !== undefined) values.company = String(input.company).trim();
  if (input.estado) values.estado = input.estado;
  if (input.nextStep !== undefined) values.nextStep = String(input.nextStep).trim();
  if (input.nextDate !== undefined) values.nextDate = input.nextDate || null;
  if (input.situation !== undefined) values.situation = String(input.situation).trim();
  let people = [];
  if (Array.isArray(input.responsible)) {
    people = await notionUsersFor(await resolveStaff(input.responsible, staff));
    values.responsibleIds = people.map(p => p.user.id);
  }
  const props = sync.notionProperties(values);
  if (input.addComment) {
    const date = new Date().toLocaleDateString('es-AR', { timeZone: 'America/New_York' });
    const line = `${date} · ${staff.name || staff.email}: ${String(input.addComment).trim()}`;
    props[sync.P.comments] = { rich_text: notion.richText(currentComments ? `${currentComments}\n${line}` : line) };
  }
  return { props, people };
}

function fieldSummary(input, people) {
  return [
    input.estado && `estado ${input.estado}`,
    input.nextStep && `próximo paso "${input.nextStep}"`,
    input.nextDate !== undefined && (input.nextDate ? `seguimiento el ${input.nextDate}` : 'sin fecha de seguimiento'),
    people.length && `responsable ${people.map(p => p.staff.name).join(', ')}`,
    input.situation !== undefined && 'situación actual',
    input.addComment && 'un comentario',
  ].filter(Boolean).join(', ');
}

async function leadIdForPage(pageId) {
  const lead = await SalesLead.findOne({ where: { notionPageId: pageId }, attributes: ['id'], raw: true });
  return lead?.id || null;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

async function executeNotionReadTool(staff, name, input = {}) {
  if (name === 'notion_search') {
    const data = await notion.search(input.query, { type: input.type, limit: 15 });
    return {
      results: (data.results || []).map(r => ({
        id: r.id,
        type: r.object,
        title: r.object === 'page' ? notion.pageTitle(r) : notion.plain(r.title) || '(sin título)',
        url: r.url || sync.pageUrl(r.id),
        lastEdited: r.last_edited_time,
        isProspect: r.object === 'page' ? Boolean(isProspect(r)) : undefined,
      })),
      note: 'Only pages shared with the Zurcher integration are visible.',
    };
  }

  if (name === 'notion_read_page') {
    const page = await resolvePage(input.page);
    const blocks = await notion.getBlocks(page.id, 300);
    const properties = Object.fromEntries(Object.entries(page.properties || {}).map(([k, v]) => [k, notion.propertyValue(v)]));
    return {
      id: page.id,
      title: notion.pageTitle(page),
      url: page.url || sync.pageUrl(page.id),
      lastEdited: page.last_edited_time,
      isProspect: Boolean(isProspect(page)),
      salesLeadId: isProspect(page) ? await leadIdForPage(page.id) : undefined,
      properties,
      content: blocks.map(notion.blockText).filter(Boolean).join('\n').slice(0, 20000) || '(página sin contenido)',
    };
  }

  if (name === 'notion_list_prospects') {
    const prospects = await Promise.all((await allProspects()).map(sync.readProspect));
    let list = prospects.filter(p => !p.archived);
    if (!input.includeClosed) list = list.filter(p => p.estado !== sync.E.cerrado);
    if (input.estado) list = list.filter(p => p.estado === input.estado);
    if (input.dueOnOrBefore) list = list.filter(p => p.nextDate && p.nextDate <= input.dueOnOrBefore);
    if (input.responsible) {
      const [who] = await resolveStaff([input.responsible], staff);
      const email = String(who.email || '').toLowerCase();
      list = list.filter(p => p.responsible.some(r => r.email === email));
    }
    const leads = await SalesLead.findAll({ where: { notionPageId: list.map(p => p.id) }, attributes: ['id', 'notionPageId'], raw: true });
    const leadByPage = Object.fromEntries(leads.map(l => [l.notionPageId, l.id]));
    list.sort((a, b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999'));
    return {
      count: list.length,
      prospects: list.slice(0, 80).map(p => ({
        pageId: p.id,
        url: p.url,
        salesLeadId: leadByPage[p.id] || null,
        contact: p.contact,
        company: p.company,
        estado: p.estado,
        responsible: p.responsible.map(r => r.name || r.email),
        nextDate: p.nextDate || null,
        nextStep: p.nextStep || null,
        situation: p.situation || null,
        comments: p.comments ? p.comments.slice(-600) : null,
        lastEdited: p.lastEdited,
      })),
    };
  }
  throw new Error(`Unknown Notion tool ${name}`);
}

// ---------------------------------------------------------------------------
// Acciones (al proponer y al confirmar)
// ---------------------------------------------------------------------------

async function describeNotionAction(staff, name, input) {
  if (name === 'propose_notion_prospect_update') {
    validateFields(input);
    const page = await resolvePage(input.page);
    if (!isProspect(page)) throw new Error('That page is not a prospect of "Seguimiento de Prospectos". Use propose_notion_append for other pages.');
    const current = await sync.readProspect(page);
    const { props, people } = await buildProspectProperties(input, staff, current.comments);
    if (!Object.keys(props).length) throw new Error('Nothing to update');
    return { type: 'notion_prospect_update', page, props, summary: `Actualizar en Notion el prospecto ${current.contact}${current.company ? ` (${current.company})` : ''}: ${fieldSummary(input, people)}` };
  }
  if (name === 'propose_notion_prospect_create') {
    validateFields(input);
    if (!String(input.contact || '').trim()) throw new Error('contact is required');
    const { props, people } = await buildProspectProperties({ estado: sync.E.pendiente, ...input }, staff);
    const extra = fieldSummary(input, people);
    return { type: 'notion_prospect_create', props, summary: `Agregar a Notion el prospecto ${input.contact.trim()}${input.company ? ` (${input.company})` : ''}${extra ? `: ${extra}` : ''}` };
  }
  if (name === 'propose_notion_page') {
    if (!String(input.title || '').trim()) throw new Error('title is required');
    const parentRef = input.parentPage || process.env.NOTION_DEFAULT_PARENT_PAGE_ID;
    if (!parentRef) throw new Error('Ask the user in which Notion page to create it (parentPage), and find it with notion_search.');
    const parent = await resolvePage(parentRef);
    return { type: 'notion_page', parent, summary: `Crear en Notion la página "${input.title.trim()}" dentro de "${notion.pageTitle(parent)}"` };
  }
  if (name === 'propose_notion_append') {
    if (!String(input.content || '').trim()) throw new Error('content is required');
    const page = await resolvePage(input.page);
    return { type: 'notion_append', page, summary: `Agregar contenido al final de la página de Notion "${notion.pageTitle(page)}"` };
  }
  throw new Error(`Unknown Notion action ${name}`);
}

function triggerSync(pageId) {
  if (pageId) sync.queuePage(pageId); // el webhook también avisa, pero así no depende de él
  else sync.syncProspects().catch(err => console.error("❌ [Notion] sync tras acción de ZurcherAI:", err.message));
}

async function runNotionAction(staff, name, input, plan) {
  prospectsCache.at = 0;
  if (plan.type === 'notion_prospect_update') {
    await notion.updatePage(plan.page.id, plan.props);
    triggerSync(plan.page?.id);
    return { message: 'Prospecto actualizado en Notion (el lead y la tarea se actualizan en unos segundos)', url: plan.page.url || sync.pageUrl(plan.page.id) };
  }
  if (plan.type === 'notion_prospect_create') {
    const page = await notion.createPage({ dataSourceId: sync.DATA_SOURCE_ID(), properties: plan.props });
    triggerSync(page.id);
    return { message: 'Prospecto agregado a Notion (también se crea como Lead)', url: page.url || sync.pageUrl(page.id) };
  }
  if (plan.type === 'notion_page') {
    const page = await notion.createPage({
      parentPageId: plan.parent.id,
      properties: { title: { title: notion.richText(input.title.trim()) } },
      children: notion.textToBlocks(input.content),
    });
    return { message: `Página "${input.title.trim()}" creada en Notion`, url: page.url || sync.pageUrl(page.id) };
  }
  if (plan.type === 'notion_append') {
    await notion.appendBlocks(plan.page.id, notion.textToBlocks(input.content));
    if (isProspect(plan.page)) triggerSync(plan.page.id);
    return { message: 'Contenido agregado en Notion', url: plan.page.url || sync.pageUrl(plan.page.id) };
  }
  throw new Error('Unknown Notion action');
}

module.exports = {
  getNotionTools,
  NOTION_READ_TOOL_NAMES,
  NOTION_ACTION_TOOL_NAMES,
  executeNotionReadTool,
  describeNotionAction,
  runNotionAction,
};
