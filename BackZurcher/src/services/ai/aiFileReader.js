/**
 * 📎 ZurcherAI — lectura de archivos (PDFs, imágenes, planillas, texto)
 *
 * Convierte un archivo en bloques de contenido que Claude puede leer dentro de un tool_result:
 *  - PDF          → bloque "document" (Claude lee texto y páginas escaneadas)
 *  - Imágenes     → bloque "image" (se reducen a máx. 1568px en JPEG con sharp)
 *  - Excel / CSV  → texto CSV por hoja
 *  - Texto / JSON → texto
 *
 * Solo se descargan archivos de la cuenta de Cloudinary de la empresa (evita SSRF).
 */
const axios = require('axios');
const sharp = require('sharp');
const XLSX = require('xlsx');

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 60000;
const IMAGE_MAX_SIDE = 1568;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp'];
const SHEET_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

function guessMimeType(name = '', fallback = 'application/octet-stream') {
  const ext = String(name).toLowerCase().split('.').pop();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    bmp: 'image/bmp',
    xlsx: SHEET_TYPES[0],
    xls: SHEET_TYPES[1],
    csv: 'text/csv',
    txt: 'text/plain',
    json: 'application/json',
  };
  return map[ext] || fallback;
}

function truncate(text) {
  return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + `\n…[truncated, ${text.length - MAX_TEXT_CHARS} more chars]` : text;
}

/**
 * @returns {Array} bloques de contenido para un tool_result
 */
async function fileToContentBlocks({ buffer, mimeType, name }) {
  let type = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (!type || type === 'application/octet-stream' || type === 'binary/octet-stream') type = guessMimeType(name);
  const label = `File: ${name || 'unnamed'} (${type}, ${Math.round(buffer.length / 1024)} KB)`;

  if (type === 'application/pdf') {
    if (buffer.length > MAX_PDF_BYTES) throw new Error(`PDF too large to read (${Math.round(buffer.length / 1048576)} MB, max 15 MB)`);
    return [
      { type: 'text', text: label },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') }, title: name || 'document.pdf' },
    ];
  }

  if (IMAGE_TYPES.includes(type)) {
    let jpeg;
    try {
      jpeg = await sharp(buffer).rotate().resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    } catch (err) {
      throw new Error(`Could not process image ${name || ''} (${type}): ${err.message}`);
    }
    return [
      { type: 'text', text: label },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
    ];
  }

  if (SHEET_TYPES.includes(type)) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheets = wb.SheetNames.slice(0, 10).map(sheetName => `### Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(wb.Sheets[sheetName])}`);
    return [{ type: 'text', text: `${label}\n\n${truncate(sheets.join('\n\n'))}` }];
  }

  if (type.startsWith('text/') || type === 'application/json' || type === 'application/xml') {
    return [{ type: 'text', text: `${label}\n\n${truncate(buffer.toString('utf8'))}` }];
  }

  return [{ type: 'text', text: `${label}\n\nThis file type cannot be read (only PDF, images, Excel/CSV and text files are supported). Tell the user to open it in the system.` }];
}

// --- Archivos guardados en Cloudinary (PDFs de permisos, inspecciones, fotos, comprobantes) ---

function assertCompanyFileUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !cloud || !parsed.pathname.startsWith(`/${cloud}/`)) {
    throw new Error('Only files stored in the company Cloudinary account (URLs found in system records) can be read');
  }
  return parsed;
}

async function readCompanyFile({ url }) {
  const parsed = assertCompanyFileUrl(url);
  const name = decodeURIComponent(parsed.pathname.split('/').pop() || 'file');

  const response = await axios.get(parsed.toString(), {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxRedirects: 0,
  });
  const buffer = Buffer.from(response.data);
  return fileToContentBlocks({ buffer, mimeType: guessMimeType(name, response.headers['content-type']), name });
}

module.exports = { fileToContentBlocks, readCompanyFile };
