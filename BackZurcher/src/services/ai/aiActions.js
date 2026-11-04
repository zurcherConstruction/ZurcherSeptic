/**
 * ✅ ZurcherAI — acciones con confirmación
 *
 * ZurcherAI nunca modifica nada por su cuenta: las herramientas propose_* solo validan y arman la
 * propuesta, y la respuesta muestra un botón "Confirmar". Recién cuando el usuario lo toca, el
 * servidor busca esa propuesta en el historial de SU conversación, revalida todo con su rol y la
 * ejecuta una sola vez (AIActionLog.toolUseId es único).
 */
const { Op } = require('sequelize');
const {
  Staff, Reminder, ReminderAssignment, Work, Budget, SalesLead, WorkNote, BudgetNote, LeadNote, AIActionLog,
} = require('../../data/index');
const { getAllowedMailboxes } = require('./aiPermissions');
const gmail = require('./gmailService');

const ACTION_LINK = (toolUseId) => `#ai-action/${toolUseId}`;
const LEAD_STATUSES = ['new', 'contacted', 'no_answer', 'interested', 'quoted', 'negotiating', 'won', 'lost', 'archived'];
const LEAD_STATUS_ES = {
  new: 'Nuevo', contacted: 'Contactado', no_answer: 'No contesta', interested: 'Interesado', quoted: 'Cotizado',
  negotiating: 'En negociación', won: 'Ganado', lost: 'Perdido', archived: 'Archivado',
};
const LINK_TYPES = { Work: 'work', Budget: 'budget', SalesLead: 'salesLead', CustomInvoice: 'customInvoice', SupplierInvoice: 'supplierInvoice' };

const CONFIRM_NOTE = 'Nothing is done until the user presses the confirm button. Show a short summary of what will happen and the "confirmLink" exactly as a markdown link, e.g. [✅ Confirmar: crear tarea para Santi](confirmLink). Never say it was done.';

const ACTION_TOOLS = [
  {
    name: 'propose_reminder',
    description: `Propose creating a task/reminder on the task board, for the user or for other staff members (e.g. "recordale a Santi que llame a este cliente el jueves"). ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title (max 200 chars)' },
        description: { type: 'string' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Staff names or emails. Empty = the current user.' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        link: {
          type: 'object',
          description: 'Optional record the task is about',
          properties: {
            entity: { type: 'string', enum: Object.keys(LINK_TYPES) },
            id: { type: 'string', description: 'Record id from tool results (idWork, idBudget, lead id...)' },
          },
          required: ['entity', 'id'],
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'propose_note',
    description: `Propose adding a follow-up note to a work, budget or sales lead (it is saved with the user as author). ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ['Work', 'Budget', 'SalesLead'] },
        id: { type: 'string', description: 'idWork, idBudget or lead id from tool results' },
        message: { type: 'string' },
      },
      required: ['entity', 'id', 'message'],
    },
  },
  {
    name: 'propose_lead_status',
    description: `Propose changing the status of a sales lead (optionally with a note explaining why). ${CONFIRM_NOTE}`,
    input_schema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        status: { type: 'string', enum: LEAD_STATUSES },
        note: { type: 'string' },
      },
      required: ['leadId', 'status'],
    },
  },
];

const EMAIL_DRAFT_TOOL = {
  name: 'propose_email_draft',
  description: `Propose saving an email as a DRAFT in a company Gmail mailbox, so the user reviews and sends it from Gmail (nothing is ever sent automatically). Use it whenever the user asks you to write, answer or reply to an email: write the complete final email (greeting, body, signature with the company name) in the language the recipient used. To answer an email, pass replyToMessageId (from search_emails/read_email) so the draft stays in the same thread, and the mailbox that received it. Also show the email text in your answer. ${CONFIRM_NOTE}`,
  input_schema: {
    type: 'object',
    properties: {
      mailbox: { type: 'string', description: 'Company mailbox where the draft is saved' },
      to: { type: 'string', description: 'Recipient email(s), comma separated' },
      cc: { type: 'string' },
      subject: { type: 'string', description: 'Optional when replying (uses "Re: original subject")' },
      body: { type: 'string', description: 'Plain text email body' },
      replyToMessageId: { type: 'string' },
    },
    required: ['mailbox', 'to', 'body'],
  },
};

function getActionTools(role) {
  const tools = [...ACTION_TOOLS];
  if (getAllowedMailboxes(role).length && gmail.isGmailConfigured()) tools.push(EMAIL_DRAFT_TOOL);
  return tools;
}

const ACTION_TOOL_NAMES = [...ACTION_TOOLS.map(t => t.name), EMAIL_DRAFT_TOOL.name];

// ---------------------------------------------------------------------------
// Validaciones (se usan al proponer y otra vez al ejecutar)
// ---------------------------------------------------------------------------

async function resolveAssignees(names = [], currentStaff) {
  if (!names.length) return [{ id: currentStaff.id, name: currentStaff.name || currentStaff.email }];
  const active = await Staff.findAll({ where: { isActive: true }, attributes: ['id', 'name', 'email'], raw: true });
  return names.map(raw => {
    const q = String(raw).trim().toLowerCase();
    const byEmail = active.filter(s => s.email?.toLowerCase() === q);
    const matches = byEmail.length ? byEmail : active.filter(s => s.name?.toLowerCase().includes(q));
    if (!matches.length) throw new Error(`No active staff member matches "${raw}". Check the name with the Staff entity.`);
    if (matches.length > 1) throw new Error(`"${raw}" matches several staff members (${matches.map(m => m.name).join(', ')}): ask the user which one.`);
    return { id: matches[0].id, name: matches[0].name || matches[0].email };
  });
}

async function findRecord(entity, id) {
  const value = String(id || '').trim();
  if (!value) throw new Error(`Missing ${entity} id`);
  if (entity === 'Work') {
    const w = await Work.findByPk(value, { attributes: ['idWork', 'propertyAddress'] });
    return w && { id: w.idWork, label: w.propertyAddress };
  }
  if (entity === 'Budget') {
    if (!/^\d+$/.test(value)) throw new Error('Budget id must be the numeric idBudget');
    const b = await Budget.findByPk(value, { attributes: ['idBudget', 'propertyAddress', 'applicantName'] });
    return b && { id: b.idBudget, label: `Presupuesto #${b.idBudget} · ${b.propertyAddress || b.applicantName || ''}`.trim() };
  }
  if (entity === 'SalesLead') {
    const l = await SalesLead.findByPk(value, { attributes: ['id', 'applicantName', 'propertyAddress', 'status'] });
    return l && { id: l.id, label: l.applicantName || l.propertyAddress, status: l.status };
  }
  return { id: value, label: null };
}

async function requireRecord(entity, id) {
  const record = await findRecord(entity, id);
  if (!record) throw new Error(`${entity} ${id} not found`);
  return record;
}

function assertMailbox(role, mailbox) {
  const mb = String(mailbox || '').toLowerCase().trim();
  if (!getAllowedMailboxes(role).includes(mb)) throw new Error(`Mailbox not available for your role: ${mailbox}`);
  return mb;
}

// Arma la descripción de la acción (al proponer y al ejecutar)
async function describe(role, staff, name, input) {
  if (name === 'propose_reminder') {
    if (!String(input.title || '').trim()) throw new Error('title is required');
    if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error('dueDate must be YYYY-MM-DD');
    const assignees = await resolveAssignees(input.assignees, staff);
    const link = input.link?.entity ? await requireRecord(input.link.entity, input.link.id) : null;
    return {
      type: 'reminder',
      assignees,
      link,
      summary: `Crear tarea "${input.title.trim().slice(0, 200)}" para ${assignees.map(a => a.name).join(', ')}${input.dueDate ? ` (vence ${input.dueDate})` : ''}${link?.label ? ` · ${link.label}` : ''}`,
    };
  }
  if (name === 'propose_note') {
    if (!String(input.message || '').trim()) throw new Error('message is required');
    const record = await requireRecord(input.entity, input.id);
    const where = { Work: 'la obra', Budget: 'el presupuesto', SalesLead: 'el lead' }[input.entity];
    return { type: 'note', record, summary: `Agregar nota en ${where} ${record.label || ''}`.trim() };
  }
  if (name === 'propose_lead_status') {
    if (!LEAD_STATUSES.includes(input.status)) throw new Error(`Invalid status. Use one of: ${LEAD_STATUSES.join(', ')}`);
    const record = await requireRecord('SalesLead', input.leadId);
    return { type: 'lead_status', record, summary: `Cambiar el lead ${record.label} de "${LEAD_STATUS_ES[record.status] || record.status}" a "${LEAD_STATUS_ES[input.status]}"` };
  }
  if (name === 'propose_email_draft') {
    const mailbox = assertMailbox(role, input.mailbox);
    if (!String(input.to || '').includes('@')) throw new Error('to must be an email address');
    if (!String(input.body || '').trim()) throw new Error('body is required');
    return { type: 'email_draft', mailbox, summary: `Guardar borrador en ${mailbox} para ${input.to}${input.replyToMessageId ? ' (respuesta en el mismo hilo)' : ''}` };
  }
  throw new Error(`Unknown action ${name}`);
}

// Cuando la IA llama la herramienta: valida y devuelve la propuesta con el link de confirmación
async function proposeAction(role, staff, name, input, toolUseId) {
  const { summary } = await describe(role, staff, name, input);
  return { needsConfirmation: true, summary, confirmLink: ACTION_LINK(toolUseId) };
}

// ---------------------------------------------------------------------------
// Ejecución (cuando el usuario confirma)
// ---------------------------------------------------------------------------

async function run(role, staff, name, input, plan) {
  if (plan.type === 'reminder') {
    const reminder = await Reminder.create({
      title: input.title.trim().slice(0, 200),
      description: input.description?.trim() || null,
      type: plan.assignees.length === 1 && plan.assignees[0].id === staff.id ? 'personal' : 'tagged',
      priority: ['low', 'medium', 'high', 'urgent'].includes(input.priority) ? input.priority : 'medium',
      dueDate: input.dueDate || null,
      createdBy: staff.id,
      linkedEntityType: plan.link ? LINK_TYPES[input.link.entity] : null,
      linkedEntityId: plan.link ? String(plan.link.id) : null,
      linkedEntityLabel: plan.link?.label?.slice(0, 200) || null,
    });
    await ReminderAssignment.bulkCreate(plan.assignees.map(a => ({ reminderId: reminder.id, staffId: a.id })), { ignoreDuplicates: true });
    return { message: `Tarea creada para ${plan.assignees.map(a => a.name).join(', ')}`, path: '/reminders-board' };
  }

  if (plan.type === 'note') {
    const message = `${input.message.trim()}`;
    if (input.entity === 'Work') {
      await WorkNote.create({ workId: plan.record.id, staffId: staff.id, message, noteType: 'follow_up', priority: 'medium' });
      return { message: 'Nota agregada en la obra', path: `/work/${plan.record.id}` };
    }
    if (input.entity === 'Budget') {
      await BudgetNote.create({ budgetId: plan.record.id, staffId: staff.id, message, noteType: 'follow_up', priority: 'medium' });
      return { message: 'Nota agregada en el presupuesto', path: '/budgets' };
    }
    await LeadNote.create({ leadId: plan.record.id, staffId: staff.id, message, noteType: 'follow_up', priority: 'medium' });
    await SalesLead.update({ lastActivityDate: new Date() }, { where: { id: plan.record.id } });
    return { message: 'Nota agregada en el lead', path: '/sales-leads' };
  }

  if (plan.type === 'lead_status') {
    await SalesLead.update({ status: input.status, lastActivityDate: new Date() }, { where: { id: plan.record.id } });
    await LeadNote.create({
      leadId: plan.record.id,
      staffId: staff.id,
      noteType: 'follow_up',
      priority: 'medium',
      message: `Estado cambiado a "${LEAD_STATUS_ES[input.status]}"${input.note ? `: ${input.note.trim()}` : ''}`,
    });
    return { message: `Lead ${plan.record.label} ahora está en "${LEAD_STATUS_ES[input.status]}"`, path: '/sales-leads' };
  }

  if (plan.type === 'email_draft') {
    const draft = await gmail.createDraft(plan.mailbox, {
      to: input.to, cc: input.cc, subject: input.subject, body: input.body, replyToMessageId: input.replyToMessageId,
    });
    return { message: `Borrador guardado en ${plan.mailbox}. Revisalo y envialo desde Gmail.`, url: draft.openUrl };
  }
  throw new Error('Unknown action');
}

/**
 * Ejecuta una propuesta confirmada. toolUse: el bloque tool_use guardado en la conversación del usuario.
 */
async function executeAction(staff, conversationId, toolUse) {
  if (!ACTION_TOOL_NAMES.includes(toolUse.name)) throw new Error('Not an action');
  const plan = await describe(staff.role, staff, toolUse.name, toolUse.input);

  // Se reserva primero: dos clics seguidos no pueden ejecutarla dos veces
  let log;
  try {
    log = await AIActionLog.create({ toolUseId: toolUse.id, conversationId, staffId: staff.id, actionType: toolUse.name });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const done = await AIActionLog.findOne({ where: { toolUseId: toolUse.id } });
      return { alreadyDone: true, ...(done?.result || { message: 'Esta acción ya se ejecutó' }) };
    }
    throw err;
  }
  try {
    const result = await run(staff.role, staff, toolUse.name, toolUse.input, plan);
    await log.update({ result });
    console.log(`✅ [AI] ${staff.email} confirmó ${toolUse.name}: ${plan.summary}`);
    return result;
  } catch (err) {
    await log.destroy().catch(() => {});
    throw err;
  }
}

async function executedActions(conversationId) {
  const rows = await AIActionLog.findAll({ where: { conversationId, result: { [Op.ne]: null } }, attributes: ['toolUseId', 'result'], raw: true });
  return Object.fromEntries(rows.map(r => [r.toolUseId, r.result]));
}

module.exports = { getActionTools, ACTION_TOOL_NAMES, proposeAction, executeAction, executedActions };
