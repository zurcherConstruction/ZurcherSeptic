/**
 * 🔗 Notion — cliente de la API (integración interna)
 *
 * Variables de entorno:
 *  - NOTION_TOKEN:   token de la integración interna (notion.so/profile/integrations). Sin token, todo
 *                    lo de Notion queda apagado (las herramientas de ZurcherAI no aparecen y el cron no corre).
 *  - NOTION_VERSION: versión de la API (por defecto 2025-09-03, la de "data sources").
 *
 * La integración solo ve las páginas/bases que se compartieron con ella desde Notion
 * (menú ··· de la página → Conexiones → agregar la integración).
 */

const API = 'https://api.notion.com/v1';
const DEFAULT_VERSION = '2025-09-03';
const MAX_TEXT = 2000; // límite de Notion por cada fragmento de texto

function isNotionConfigured() {
  return Boolean(process.env.NOTION_TOKEN);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function notionRequest(method, path, body, attempt = 0) {
  if (!isNotionConfigured()) throw new Error('Notion no está configurado (falta NOTION_TOKEN)');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': process.env.NOTION_VERSION || DEFAULT_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Límite de pedidos (≈3 por segundo): esperar lo que indique Notion y reintentar
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * (attempt + 1);
    await sleep(wait);
    return notionRequest(method, path, body, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Notion ${res.status}: ${data.message || res.statusText}`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

// Recorre todas las páginas de un listado paginado (start_cursor / has_more)
async function paginate(fetchPage, limit = 1000) {
  const results = [];
  let cursor;
  do {
    const data = await fetchPage(cursor);
    results.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor && results.length < limit);
  return results;
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

const plain = (richText = []) => richText.map(t => t.plain_text ?? t.text?.content ?? '').join('');

function richText(value) {
  const text = String(value ?? '');
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length && chunks.length < 50; i += MAX_TEXT) {
    chunks.push({ type: 'text', text: { content: text.slice(i, i + MAX_TEXT) } });
  }
  return chunks;
}

const normalizeId = (value) => {
  const s = String(value || '').trim();
  const match = s.match(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})(?![0-9a-f])/i);
  if (!match) return null;
  const hex = match[1].replace(/-/g, '').toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// Título de una página (la propiedad de tipo "title", se llame como se llame)
function pageTitle(page) {
  const titleProp = Object.values(page?.properties || {}).find(p => p.type === 'title');
  if (titleProp) return plain(titleProp.title);
  return plain(page?.title) || '(sin título)';
}

// Valor legible de una propiedad cualquiera
function propertyValue(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case 'title': return plain(prop.title);
    case 'rich_text': return plain(prop.rich_text);
    case 'status': return prop.status?.name || null;
    case 'select': return prop.select?.name || null;
    case 'multi_select': return (prop.multi_select || []).map(o => o.name);
    case 'date': return prop.date?.start || null;
    case 'people': return (prop.people || []).map(p => p.name || p.person?.email || p.id);
    case 'number': return prop.number;
    case 'checkbox': return prop.checkbox;
    case 'url': return prop.url;
    case 'email': return prop.email;
    case 'phone_number': return prop.phone_number;
    case 'created_time': return prop.created_time;
    case 'last_edited_time': return prop.last_edited_time;
    case 'formula': return prop.formula?.[prop.formula?.type] ?? null;
    case 'relation': return (prop.relation || []).map(r => r.id);
    default: return null;
  }
}

// Bloques → texto (para que ZurcherAI lea el contenido de una página)
function blockText(block) {
  const data = block[block.type] || {};
  const text = plain(data.rich_text || []);
  switch (block.type) {
    case 'heading_1': return `# ${text}`;
    case 'heading_2': return `## ${text}`;
    case 'heading_3': return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do': return `- [${data.checked ? 'x' : ' '}] ${text}`;
    case 'quote': return `> ${text}`;
    case 'callout': return `> ${text}`;
    case 'code': return `\`\`\`\n${text}\n\`\`\``;
    case 'divider': return '---';
    case 'child_page': return `📄 Subpágina: ${data.title || ''} (id ${block.id})`;
    case 'child_database': return `🗂️ Base: ${data.title || ''} (id ${block.id})`;
    case 'bookmark': case 'embed': case 'link_preview': return data.url || '';
    case 'image': case 'file': case 'pdf': case 'video':
      return `[${block.type}${data.caption?.length ? `: ${plain(data.caption)}` : ''}]`;
    case 'table_row': return `| ${(data.cells || []).map(plain).join(' | ')} |`;
    default: return text;
  }
}

// Texto simple tipo markdown → bloques de Notion (títulos, viñetas, tareas, párrafos)
function textToBlocks(text) {
  const blocks = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    let type = 'paragraph';
    let content = line;
    let extra = {};
    if (/^###\s+/.test(line)) { type = 'heading_3'; content = line.replace(/^###\s+/, ''); }
    else if (/^##\s+/.test(line)) { type = 'heading_2'; content = line.replace(/^##\s+/, ''); }
    else if (/^#\s+/.test(line)) { type = 'heading_1'; content = line.replace(/^#\s+/, ''); }
    else if (/^\s*[-*]\s+\[( |x)\]\s+/i.test(line)) {
      type = 'to_do';
      extra = { checked: /\[x\]/i.test(line) };
      content = line.replace(/^\s*[-*]\s+\[( |x)\]\s+/i, '');
    }
    else if (/^\s*[-*•]\s+/.test(line)) { type = 'bulleted_list_item'; content = line.replace(/^\s*[-*•]\s+/, ''); }
    else if (/^\s*\d+[.)]\s+/.test(line)) { type = 'numbered_list_item'; content = line.replace(/^\s*\d+[.)]\s+/, ''); }
    else if (/^>\s?/.test(line)) { type = 'quote'; content = line.replace(/^>\s?/, ''); }
    content = content.replace(/\*\*(.+?)\*\*/g, '$1');
    blocks.push({ object: 'block', type, [type]: { rich_text: richText(content), ...extra } });
  }
  return blocks.slice(0, 100); // Notion acepta hasta 100 bloques por pedido
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

const getPage = (pageId) => notionRequest('GET', `/pages/${pageId}`);
const updatePage = (pageId, properties) => notionRequest('PATCH', `/pages/${pageId}`, { properties });
const appendBlocks = (blockId, children) => notionRequest('PATCH', `/blocks/${blockId}/children`, { children });

function createPage({ dataSourceId, parentPageId, properties, children }) {
  const parent = dataSourceId
    ? { type: 'data_source_id', data_source_id: dataSourceId }
    : { type: 'page_id', page_id: parentPageId };
  return notionRequest('POST', '/pages', { parent, properties, ...(children?.length ? { children } : {}) });
}

function queryDataSource(dataSourceId, { filter, sorts, limit = 1000 } = {}) {
  return paginate(cursor => notionRequest('POST', `/data_sources/${dataSourceId}/query`, {
    ...(filter ? { filter } : {}),
    ...(sorts ? { sorts } : {}),
    page_size: 100,
    ...(cursor ? { start_cursor: cursor } : {}),
  }), limit);
}

const getDataSource = (dataSourceId) => notionRequest('GET', `/data_sources/${dataSourceId}`);

async function getBlocks(blockId, limit = 300) {
  return paginate(cursor => notionRequest('GET', `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`), limit);
}

function search(query, { type, limit = 10 } = {}) {
  return notionRequest('POST', '/search', {
    query: String(query || ''),
    page_size: Math.min(limit, 25),
    ...(type ? { filter: { property: 'object', value: type } } : {}),
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
  });
}

// Usuarios del espacio (para vincular "Responsable" con los empleados por email). Se cachea 10 min.
let usersCache = { at: 0, users: [] };
async function listUsers() {
  if (Date.now() - usersCache.at < 10 * 60 * 1000) return usersCache.users;
  const users = await paginate(cursor => notionRequest('GET', `/users?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`), 500);
  usersCache = {
    at: Date.now(),
    users: users
      .filter(u => u.type === 'person')
      .map(u => ({ id: u.id, name: u.name, email: u.person?.email?.toLowerCase() || null })),
  };
  return usersCache.users;
}

module.exports = {
  isNotionConfigured,
  notionRequest,
  plain,
  richText,
  normalizeId,
  pageTitle,
  propertyValue,
  blockText,
  textToBlocks,
  getPage,
  updatePage,
  appendBlocks,
  createPage,
  queryDataSource,
  getDataSource,
  getBlocks,
  search,
  listUsers,
};
