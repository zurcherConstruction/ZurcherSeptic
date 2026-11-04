/**
 * 📧 ZurcherAI — lectura de buzones de Google Workspace (SOLO LECTURA)
 *
 * Usa una cuenta de servicio de Google Cloud con "domain-wide delegation" y el scope
 * gmail.readonly, impersonando cada buzón configurado (info@, admin@, sales@...).
 *
 * Variables de entorno:
 *  - GOOGLE_SERVICE_ACCOUNT_JSON: contenido del JSON de la cuenta de servicio
 *    (texto JSON o base64 del archivo).
 *  - AI_MAILBOXES: lista de buzones separados por coma.
 */
const { JWT } = require('google-auth-library');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_BODY_CHARS = 15000;
const MAX_THREAD_BODY_CHARS = 4000;

let cachedCredentials;
const clients = new Map();

function getCredentials() {
  if (cachedCredentials !== undefined) return cachedCredentials;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    cachedCredentials = null;
    return null;
  }
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const json = JSON.parse(text);
  cachedCredentials = {
    email: json.client_email,
    key: (json.private_key || '').replace(/\\n/g, '\n'),
  };
  return cachedCredentials;
}

function isGmailConfigured() {
  try {
    return !!getCredentials();
  } catch (err) {
    console.error('❌ [AI Gmail] GOOGLE_SERVICE_ACCOUNT_JSON inválido:', err.message);
    return false;
  }
}

function getClient(mailbox) {
  if (!clients.has(mailbox)) {
    const creds = getCredentials();
    clients.set(mailbox, new JWT({ email: creds.email, key: creds.key, scopes: [GMAIL_SCOPE], subject: mailbox }));
  }
  return clients.get(mailbox);
}

async function gmailGet(mailbox, path, params = {}) {
  // Los arrays se envían como parámetros repetidos (?metadataHeaders=From&metadataHeaders=To)
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    (Array.isArray(v) ? v : [v]).forEach(item => qs.append(k, String(item)));
  }
  const query = qs.toString();
  const { data } = await getClient(mailbox).request({ url: `${GMAIL_API}${path}${query ? `?${query}` : ''}` });
  return data;
}

function header(headers = [], name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || null;
}

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Recorre las partes MIME y devuelve el cuerpo en texto + nombres de adjuntos
function extractContent(payload) {
  let plain = '';
  let html = '';
  const attachments = [];

  const walk = part => {
    if (!part) return;
    if (part.filename) {
      attachments.push({ name: part.filename, mimeType: part.mimeType, size: part.body?.size || 0, attachmentId: part.body?.attachmentId, data: part.body?.data });
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      plain += decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      html += decodeBase64Url(part.body.data);
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);

  return { body: (plain || htmlToText(html)).trim(), attachments };
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + `\n…[truncated, ${text.length - max} more chars]` : text;
}

function summarizeMessage(mailbox, msg) {
  const h = msg.payload?.headers;
  return {
    mailbox,
    messageId: msg.id,
    threadId: msg.threadId,
    date: header(h, 'Date'),
    from: header(h, 'From'),
    to: header(h, 'To'),
    subject: header(h, 'Subject'),
    snippet: msg.snippet,
    unread: (msg.labelIds || []).includes('UNREAD'),
  };
}

async function searchMailbox(mailbox, query, maxResults) {
  const list = await gmailGet(mailbox, '/messages', { q: query || undefined, maxResults });
  const ids = (list.messages || []).map(m => m.id);
  const messages = await Promise.all(ids.map(id => gmailGet(mailbox, `/messages/${id}`, {
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  })));
  return messages.map(m => summarizeMessage(mailbox, m));
}

async function searchEmails(mailboxes, { query, maxResults = 10 }) {
  const perMailbox = Math.min(Math.max(parseInt(maxResults, 10) || 10, 1), 25);
  const results = await Promise.all(mailboxes.map(async mb => {
    try {
      return { mailbox: mb, messages: await searchMailbox(mb, query, perMailbox) };
    } catch (err) {
      return { mailbox: mb, error: err.response?.data?.error?.message || err.message };
    }
  }));
  return { query: query || null, results };
}

async function readEmail(mailbox, { messageId }) {
  const msg = await gmailGet(mailbox, `/messages/${messageId}`, { format: 'full' });
  const { body, attachments } = extractContent(msg.payload);
  return {
    ...summarizeMessage(mailbox, msg),
    cc: header(msg.payload?.headers, 'Cc'),
    body: truncate(body, MAX_BODY_CHARS),
    attachments: attachments.map(({ name, mimeType, size }) => ({ name, mimeType, size })),
  };
}

async function readThread(mailbox, { threadId }) {
  const thread = await gmailGet(mailbox, `/threads/${threadId}`, { format: 'full' });
  return {
    mailbox,
    threadId,
    messages: (thread.messages || []).map(msg => {
      const { body, attachments } = extractContent(msg.payload);
      return {
        ...summarizeMessage(mailbox, msg),
        body: truncate(body, MAX_THREAD_BODY_CHARS),
        attachments: attachments.map(a => a.name),
      };
    }),
  };
}

// Descarga un adjunto (buscado por nombre de archivo) para que la IA lo lea
async function getAttachment(mailbox, { messageId, filename }) {
  const msg = await gmailGet(mailbox, `/messages/${messageId}`, { format: 'full' });
  const { attachments } = extractContent(msg.payload);
  const wanted = String(filename || '').toLowerCase();
  const att = attachments.find(a => a.name.toLowerCase() === wanted)
    || attachments.find(a => a.name.toLowerCase().includes(wanted));
  if (!att) {
    throw new Error(`Attachment "${filename}" not found. Attachments in this email: ${attachments.map(a => a.name).join(', ') || 'none'}`);
  }
  let data = att.data;
  if (!data && att.attachmentId) {
    ({ data } = await gmailGet(mailbox, `/messages/${messageId}/attachments/${att.attachmentId}`));
  }
  return {
    name: att.name,
    mimeType: att.mimeType,
    buffer: Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
  };
}

// ---------------------------------------------------------------------------
// ✍️ Borradores (solo cuando el usuario confirma en el chat). Usa un cliente aparte con el scope
// gmail.compose, que hay que autorizar en Google Workspace (Seguridad → Controles de API →
// Delegación de todo el dominio). Si no está autorizado, la lectura sigue funcionando igual.
// ---------------------------------------------------------------------------
const COMPOSE_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const composeClients = new Map();

function getComposeClient(mailbox) {
  if (!composeClients.has(mailbox)) {
    const creds = getCredentials();
    composeClients.set(mailbox, new JWT({ email: creds.email, key: creds.key, scopes: [COMPOSE_SCOPE], subject: mailbox }));
  }
  return composeClients.get(mailbox);
}

// Encabezados con acentos/ñ (RFC 2047)
const encodeHeader = (text) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`);
const toBase64Url = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Crea un borrador en el buzón. Con replyToMessageId queda como respuesta dentro del mismo hilo.
 * Devuelve { draftId, threadId, openUrl }.
 */
async function createDraft(mailbox, { to, cc, subject, body, replyToMessageId }) {
  let threadId;
  let replyHeaders = [];
  let finalSubject = subject;
  if (replyToMessageId) {
    const original = await gmailGet(mailbox, `/messages/${replyToMessageId}`, {
      format: 'metadata',
      metadataHeaders: ['Message-ID', 'References', 'Subject'],
    });
    threadId = original.threadId;
    const messageIdHeader = header(original.payload?.headers, 'Message-ID');
    const references = header(original.payload?.headers, 'References');
    if (messageIdHeader) {
      replyHeaders = [`In-Reply-To: ${messageIdHeader}`, `References: ${[references, messageIdHeader].filter(Boolean).join(' ')}`];
    }
    if (!finalSubject) {
      const originalSubject = header(original.payload?.headers, 'Subject') || '';
      finalSubject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;
    }
  }

  const lines = [
    `From: ${mailbox}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    `Subject: ${encodeHeader(finalSubject || '')}`,
    ...replyHeaders,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(String(body || ''), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ];
  const raw = toBase64Url(Buffer.from(lines.join('\r\n'), 'utf8'));

  try {
    const { data } = await getComposeClient(mailbox).request({
      url: `${GMAIL_API}/drafts`,
      method: 'POST',
      data: { message: { raw, ...(threadId ? { threadId } : {}) } },
    });
    return {
      draftId: data.id,
      threadId: data.message?.threadId || threadId || null,
      openUrl: `https://mail.google.com/mail/u/${encodeURIComponent(mailbox)}/#drafts`,
    };
  } catch (err) {
    const detail = err.response?.data?.error_description || err.response?.data?.error?.message || err.message;
    if (/unauthorized_client|insufficient|scope/i.test(String(detail))) {
      throw new Error('Falta autorizar el permiso de borradores (gmail.compose) en Google Workspace. Pedile al administrador que lo habilite.');
    }
    throw new Error(`No se pudo crear el borrador: ${detail}`);
  }
}

module.exports = { isGmailConfigured, searchEmails, readEmail, readThread, getAttachment, createDraft };
