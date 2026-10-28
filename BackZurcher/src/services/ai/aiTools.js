/**
 * 🤖 ZurcherAI — registro de herramientas por rol
 * Devuelve solo las herramientas que el rol puede usar y vuelve a validar el permiso
 * al ejecutar cada una (defensa en profundidad).
 */
const { isToolAllowed, getAllowedMailboxes } = require('./aiPermissions');
const { BUSINESS_TOOLS, executeBusinessTool } = require('./aiBusinessTools');
const { buildEntityToolDefinitions, describeEntity, queryRecords, aggregateRecords } = require('./aiEntityCatalog');
const gmail = require('./gmailService');

function buildEmailTools(mailboxes) {
  return [
    {
      name: 'search_emails',
      description: `Search company Google Workspace mailboxes (read-only). Uses Gmail search syntax in "query", e.g. "from:client@x.com", "subject:invoice", "after:2026/10/01 before:2026/10/15", "has:attachment", "is:unread", or plain words such as an address or client name. Returns sender, subject, date and snippet per message. Available mailboxes: ${mailboxes.join(', ')}.`,
      input_schema: {
        type: 'object',
        properties: {
          mailbox: { type: 'string', enum: ['all', ...mailboxes], description: 'Mailbox to search, or "all".' },
          query: { type: 'string', description: 'Gmail search query. Empty = most recent messages.' },
          maxResults: { type: 'integer', description: 'Max messages per mailbox (1-25, default 10).' },
        },
        required: ['mailbox'],
      },
    },
    {
      name: 'read_email',
      description: 'Read the full body and attachment list of one email found with search_emails.',
      input_schema: {
        type: 'object',
        properties: {
          mailbox: { type: 'string', enum: mailboxes },
          messageId: { type: 'string' },
        },
        required: ['mailbox', 'messageId'],
      },
    },
    {
      name: 'read_email_thread',
      description: 'Read a whole email conversation (thread) found with search_emails.',
      input_schema: {
        type: 'object',
        properties: {
          mailbox: { type: 'string', enum: mailboxes },
          threadId: { type: 'string' },
        },
        required: ['mailbox', 'threadId'],
      },
    },
  ];
}

const EMAIL_TOOL_NAMES = ['search_emails', 'read_email', 'read_email_thread'];
const ENTITY_TOOL_NAMES = ['describe_entity', 'query_records', 'aggregate_records'];

function getToolsForRole(role) {
  const tools = [
    ...BUSINESS_TOOLS.filter(t => isToolAllowed(role, t.name)),
    ...buildEntityToolDefinitions(role),
  ];
  const mailboxes = getAllowedMailboxes(role);
  if (mailboxes.length && gmail.isGmailConfigured()) {
    tools.push(...buildEmailTools(mailboxes));
  }
  return tools;
}

function assertMailbox(role, mailbox) {
  const allowed = getAllowedMailboxes(role);
  const mb = String(mailbox || '').toLowerCase();
  if (!allowed.includes(mb)) throw new Error(`Mailbox not available for your role: ${mailbox}`);
  return mb;
}

async function executeTool(role, name, input = {}) {
  if (!isToolAllowed(role, name)) throw new Error(`Tool not allowed for role ${role}: ${name}`);

  if (ENTITY_TOOL_NAMES.includes(name)) {
    if (name === 'describe_entity') return describeEntity(role, input);
    if (name === 'query_records') return queryRecords(role, input);
    return aggregateRecords(role, input);
  }

  if (EMAIL_TOOL_NAMES.includes(name)) {
    if (!gmail.isGmailConfigured()) throw new Error('Email access is not configured');
    if (name === 'search_emails') {
      const mailboxes = input.mailbox === 'all' ? getAllowedMailboxes(role) : [assertMailbox(role, input.mailbox)];
      return gmail.searchEmails(mailboxes, input);
    }
    const mailbox = assertMailbox(role, input.mailbox);
    if (name === 'read_email') return gmail.readEmail(mailbox, input);
    return gmail.readThread(mailbox, input);
  }

  const result = await executeBusinessTool(role, name, input);
  if (result === undefined) throw new Error(`Unknown tool: ${name}`);
  return result;
}

module.exports = { getToolsForRole, executeTool, EMAIL_TOOL_NAMES };
