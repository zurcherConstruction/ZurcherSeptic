/**
 * 📋 PDF del reporte semanal de seguimientos (Notion)
 * Una ficha por prospecto: estado, responsable, fechas, situación, próximo paso y
 * el ÚLTIMO SEGUIMIENTO con la nota que se dejó (fecha, autor y texto).
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO = path.join(__dirname, '../../assets/logo.png');
const NAVY = '#1a3a5c';
const GRAY = '#6b7280';
const TEXT = '#111827';
const RED = '#b91c1c';
const AMBER = '#92400e';

// pdfkit con Helvetica no dibuja emojis: se quitan de los textos
const plain = s => String(s ?? '')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/\s+\n/g, '\n')
  .trim();

const NOTE_TYPES = {
  initial_contact: 'Primer contacto', follow_up: 'Seguimiento', quote_sent: 'Cotización enviada',
  meeting: 'Reunión/visita', email: 'Email', phone_call: 'Llamada', no_answer: 'No contestó',
  problem: 'Problema/objeción', progress: 'Avance', status_change: 'Cambio de estado', other: 'Otro',
};

/**
 * @param {object} data { open, closedThisWeek, generatedAt, stats:{open,overdue,dueWeek,stale}, staleDays }
 *   cada prospecto: { contact, company, estado, estadoColor, responsibleText, nextDate, nextDateText,
 *   lastEditedText, overdue, stale, lastEditedDays, situation, nextStep, url, lastNote:{dateText, author, type, message} | null }
 * @returns {Promise<Buffer>}
 */
function generateNotionReportPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom;

    // --- Encabezado ---
    if (fs.existsSync(LOGO)) doc.image(LOGO, left, 40, { height: 42 });
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(17)
      .text('Seguimiento de prospectos', left, 44, { width, align: 'right' });
    doc.fillColor(GRAY).font('Helvetica').fontSize(9.5)
      .text(`Reporte semanal · ${data.generatedAt}`, left, 66, { width, align: 'right' });
    doc.moveTo(left, 94).lineTo(left + width, 94).lineWidth(1.5).strokeColor(NAVY).stroke();

    // --- Resumen ---
    const s = data.stats;
    const boxes = [
      [s.open, 'Abiertos', NAVY], [s.overdue, 'Seguimiento vencido', RED],
      [s.dueWeek, 'Para esta semana', '#2563eb'], [s.stale, `Sin actualizar +${data.staleDays} días`, AMBER],
    ];
    const bw = (width - 3 * 8) / 4;
    boxes.forEach(([n, label, color], i) => {
      const x = left + i * (bw + 8);
      doc.roundedRect(x, 106, bw, 46, 5).fillColor('#f3f4f6').fill();
      doc.fillColor(color).font('Helvetica-Bold').fontSize(17).text(String(n), x, 112, { width: bw, align: 'center' });
      doc.fillColor(GRAY).font('Helvetica').fontSize(8).text(label, x, 134, { width: bw, align: 'center' });
    });
    doc.y = 168;

    // --- Fichas ---
    const field = (label, value, opts = {}) => {
      if (!value) return;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text(`${label}: `, left + 10, doc.y, { continued: true, width: width - 20 });
      doc.font('Helvetica').fillColor(opts.color || '#374151').text(plain(value), { width: width - 20 });
      doc.moveDown(0.15);
    };

    const card = (p) => {
      const startY = doc.y;
      // Título + estado
      doc.font('Helvetica-Bold').fontSize(11.5).fillColor(TEXT)
        .text(plain(p.contact) || 'Sin nombre', left + 10, startY + 8, { width: width - 140, link: p.url, continued: !!p.company });
      if (p.company) doc.font('Helvetica').fillColor(GRAY).text(`  ·  ${plain(p.company)}`, { link: null });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(p.estadoColor)
        .text(plain(p.estado), left + width - 130, startY + 10, { width: 120, align: 'right' });
      doc.y = Math.max(doc.y, startY + 24);

      // Meta
      const flags = [p.overdue && 'SEGUIMIENTO VENCIDO', p.stale && `SIN ACTUALIZAR ${p.lastEditedDays} DÍAS`].filter(Boolean).join('   ');
      doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
        .text(`Responsable: ${plain(p.responsibleText)}    Próx. seguimiento: ${p.nextDateText}    Actualizado en Notion: ${p.lastEditedText}`, left + 10, doc.y + 2, { width: width - 20 });
      if (flags) doc.font('Helvetica-Bold').fontSize(8).fillColor(p.overdue ? RED : AMBER).text(flags, left + 10, doc.y + 2, { width: width - 20 });
      doc.moveDown(0.4);

      field('Situación', p.situation);
      field('Próximo paso', p.nextStep);

      // Último seguimiento (destacado)
      const noteY = doc.y + 2;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Último seguimiento', left + 18, noteY + 6, { width: width - 36 });
      if (p.lastNote) {
        const meta = [p.lastNote.dateText, p.lastNote.author, NOTE_TYPES[p.lastNote.type] || null].filter(Boolean).join(' · ');
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(meta, left + 18, doc.y + 1, { width: width - 36 });
        doc.font('Helvetica').fontSize(9).fillColor('#1f2937').text(plain(p.lastNote.message), left + 18, doc.y + 2, { width: width - 36 });
      } else {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRAY).text('Sin notas de seguimiento registradas.', left + 18, doc.y + 1, { width: width - 36 });
      }
      const noteEnd = doc.y + 6;
      doc.save().rect(left + 10, noteY, 3, noteEnd - noteY).fillColor(NAVY).fill().restore();
      doc.save().rect(left + 13, noteY, width - 23, noteEnd - noteY).fillOpacity(0.06).fillColor(NAVY).fill().restore();

      doc.y = noteEnd + 8;
      doc.roundedRect(left, startY, width, doc.y - startY, 6).lineWidth(0.7).strokeColor('#d1d5db').stroke();
      doc.y += 10;
    };

    // Altura aproximada de una ficha para no cortarla entre páginas
    const estimate = (p) => {
      doc.font('Helvetica').fontSize(9);
      const h = t => (t ? doc.heightOfString(plain(t), { width: width - 36 }) + 4 : 0);
      return 70 + h(p.situation) + h(p.nextStep) + h(p.lastNote?.message) + (p.overdue || p.stale ? 12 : 0);
    };

    const groups = data.groups?.length ? data.groups : [{ key: undefined, title: null }];
    for (const g of groups) {
      const list = data.open.filter(p => g.key === undefined || p.group === g.key);
      if (!list.length) continue;
      if (g.title) {
        // Encabezado de grupo, junto con la primera ficha (no queda solo al pie de una página)
        if (doc.y + 40 + estimate(list[0]) > bottom()) doc.addPage();
        const y = doc.y + 4;
        doc.rect(left, y, width, 34).fillColor('#eef2f7').fill();
        doc.rect(left, y + 32, width, 2).fillColor(NAVY).fill();
        doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(`${g.title} (${list.length})`, left + 10, y + 5, { width: width - 20 });
        if (g.subtitle) doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(g.subtitle, left + 10, y + 21, { width: width - 20 });
        doc.y = y + 44;
      }
      for (const p of list) {
        const need = estimate(p);
        if (doc.y + need > bottom() && need < bottom() - doc.page.margins.top) doc.addPage();
        card(p);
      }
    }
    if (!data.open.length) doc.font('Helvetica').fontSize(11).fillColor(GRAY).text('No hay prospectos abiertos.', left, doc.y, { width, align: 'center' });

    if (data.closedThisWeek.length) {
      if (doc.y + 50 > bottom()) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#166534')
        .text(`Cerrados esta semana (${data.closedThisWeek.length}): `, left, doc.y + 4, { continued: true, width });
      doc.font('Helvetica').text(data.closedThisWeek.map(p => plain(p.contact || p.company || 'Sin nombre')).join(', '));
    }

    // Pie con número de página
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const prevBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text(`Zurcher Septic · Seguimiento de prospectos · Página ${i + 1} de ${range.count}`, left, doc.page.height - 35, { width, align: 'center' });
      doc.page.margins.bottom = prevBottom;
    }
    doc.end();
  });
}

module.exports = { generateNotionReportPdf };
