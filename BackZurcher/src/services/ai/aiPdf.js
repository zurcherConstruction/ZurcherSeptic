/**
 * 📄 ZurcherAI — documentos PDF
 *
 * La IA llama a create_pdf con un título y el contenido en markdown (títulos, párrafos, listas, tablas).
 * Igual que el Excel, no se guarda ningún archivo: el contenido queda en el historial (bloque tool_use)
 * y el PDF se arma al descargarlo.
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');
const MARGIN = 50;
const BRAND = '#1D4ED8';

const CREATE_PDF_TOOL = {
  name: 'create_pdf',
  description: 'Create a downloadable PDF document (report, summary for a client, letter, list) with the company header. Use it whenever the user asks for a PDF or a document to send/print. Write the full final content yourself in markdown: headings (#, ##, ###), paragraphs, bullet or numbered lists, **bold**, and tables (| a | b | with a |---| separator row). The content must be only the document itself: no questions to the user, no notes about how it was made, no internal ids. The result contains a "link": include it in your answer exactly as a markdown link, e.g. [📄 Descargar PDF](link).',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Document title naming the topic (e.g. "Resumen de la obra 61 Hughes Ave"); also the file name.' },
      content: { type: 'string', description: 'Full document body in markdown.' },
    },
    required: ['title', 'content'],
  },
};

function prepareCreatePdf(input, toolUseId) {
  if (!String(input.title || '').trim() || !String(input.content || '').trim()) {
    throw new Error('title and content are required');
  }
  return { title: input.title, link: `#ai-export/${toolUseId}` };
}

// Fuentes estándar de PDF (WinAnsi): se normalizan comillas/guiones y se quitan emojis
function pdfSafe(text) {
  return String(text ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●]/g, '-')
    .replace(/[^\t\n -ÿ€]/g, '')
    .replace(/\s+$/g, '');
}

// Quita la sintaxis de links e imágenes: [texto](url) → texto
const stripLinks = (text) => text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

// Escribe una línea con **negritas** respetando el ajuste de línea
function writeRich(doc, text, { size = 10, color = '#1f2937', indent = 0, prefix = '' } = {}) {
  const parts = pdfSafe(stripLinks(prefix + text)).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  doc.fontSize(size).fillColor(color);
  const width = doc.page.width - MARGIN * 2 - indent;
  if (!parts.length) return;
  parts.forEach((part, i) => {
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    const options = { width, continued: i < parts.length - 1 };
    const clean = bold ? part.slice(2, -2) : part.replace(/[*_`]/g, '');
    if (i === 0) doc.text(clean, MARGIN + indent, doc.y, options);
    else doc.text(clean, options);
  });
}

function parseTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => pdfSafe(stripLinks(c.trim())).replace(/\*\*/g, ''));
}

function drawTable(doc, rows) {
  const [header, ...body] = rows;
  const cols = header.length;
  const tableWidth = doc.page.width - MARGIN * 2;
  // Ancho de cada columna según su contenido más largo (con mínimo y máximo)
  const lengths = header.map((h, c) => Math.min(Math.max(h.length, ...body.map(r => (r[c] || '').length), 4), 40));
  const total = lengths.reduce((a, b) => a + b, 0);
  const widths = lengths.map(l => (l / total) * tableWidth);
  const pad = 4;

  const rowHeight = (cells, font) => {
    doc.font(font).fontSize(8);
    return Math.max(...cells.map((t, c) => doc.heightOfString(t || '', { width: widths[c] - pad * 2 }))) + pad * 2;
  };

  const drawRow = (cells, { isHeader = false, shaded = false } = {}) => {
    const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
    const h = rowHeight(cells, font);
    if (doc.y + h > doc.page.height - MARGIN) {
      doc.addPage();
      if (!isHeader) drawRow(header, { isHeader: true });
    }
    const y = doc.y;
    if (isHeader) doc.rect(MARGIN, y, tableWidth, h).fill(BRAND);
    else if (shaded) doc.rect(MARGIN, y, tableWidth, h).fill('#f3f4f6');
    let x = MARGIN;
    for (let c = 0; c < cols; c++) {
      doc.font(font).fontSize(8).fillColor(isHeader ? '#ffffff' : '#1f2937')
        .text(cells[c] || '', x + pad, y + pad, { width: widths[c] - pad * 2 });
      x += widths[c];
    }
    doc.y = y + h;
  };

  drawRow(header, { isHeader: true });
  body.forEach((r, i) => drawRow(r, { shaded: i % 2 === 1 }));
  doc.x = MARGIN;
  doc.moveDown(0.8);
}

function renderMarkdown(doc, markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { doc.moveDown(0.4); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      doc.moveDown(0.3);
      doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor('#d1d5db').stroke();
      doc.moveDown(0.5);
      continue;
    }

    // Tabla: filas que empiezan con "|" y una fila separadora |---|
    if (trimmed.startsWith('|') && /^\|?\s*:?-{3,}/.test((lines[i + 1] || '').trim())) {
      const rows = [parseTableRow(trimmed)];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(parseTableRow(lines[i++]));
      i -= 1;
      drawTable(doc, rows);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      doc.moveDown(level <= 2 ? 0.6 : 0.3);
      doc.font('Helvetica-Bold').fontSize(level === 1 ? 15 : level === 2 ? 13 : 11).fillColor(level <= 2 ? BRAND : '#111827')
        .text(pdfSafe(stripLinks(heading[2])).replace(/[*_`]/g, ''), MARGIN, doc.y, { width: doc.page.width - MARGIN * 2 });
      doc.moveDown(0.3);
      continue;
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bullet) {
      writeRich(doc, bullet[2], { indent: 12 + Math.min(bullet[1].length, 8) * 3, prefix: '-  ' });
      continue;
    }
    const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      writeRich(doc, numbered[3], { indent: 12 + Math.min(numbered[1].length, 8) * 3, prefix: `${numbered[2]}.  ` });
      continue;
    }
    if (trimmed.startsWith('>')) {
      writeRich(doc, trimmed.replace(/^>\s?/, ''), { indent: 12, color: '#4b5563' });
      continue;
    }

    writeRich(doc, trimmed);
    doc.moveDown(0.2);
  }
}

function buildPdf(input) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, MARGIN, MARGIN - 10, { width: 55 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#6b7280')
      .text('ZURCHER SEPTIC', MARGIN, MARGIN, { align: 'right' })
      .font('Helvetica').text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }), { align: 'right' });
    doc.y = MARGIN + 55;
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#111827')
      .text(pdfSafe(input.title), MARGIN, doc.y, { width: doc.page.width - MARGIN * 2 });
    doc.moveDown(0.3);
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).lineWidth(2).strokeColor(BRAND).stroke().lineWidth(1);
    doc.moveDown(0.8);

    renderMarkdown(doc, input.content);

    // Número de página
    const range = doc.bufferedPageRange();
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc.page.margins.bottom = 0; // escribir en el pie sin que pdfkit agregue una página
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text(`${p + 1} / ${range.count}`, MARGIN, doc.page.height - MARGIN + 15, { width: doc.page.width - MARGIN * 2, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

async function buildPdfDocument(input) {
  const buffer = await buildPdf(input);
  const fileName = `${String(input.title || 'Documento').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'Documento'}.pdf`;
  return { buffer, fileName };
}

module.exports = { CREATE_PDF_TOOL, prepareCreatePdf, buildPdfDocument };
