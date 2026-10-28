// 🤖 ZurcherAI — utilidades del chat: exportar respuestas (PDF / Excel) y voz (dictado / lectura)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Exportar una respuesta ya renderizada (elemento DOM del mensaje)
// ---------------------------------------------------------------------------

// jsPDF con la fuente estándar solo soporta Latin-1: se reemplazan comillas tipográficas y se quitan emojis
function pdfSafe(text) {
  return String(text || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●]/g, '-')
    .replace(/[^\t\n -ÿ]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function fileBaseName(title) {
  const clean = String(title || 'ZurcherAI')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
    .slice(0, 60);
  return `${clean || 'ZurcherAI'}_${new Date().toISOString().slice(0, 10)}`;
}

export function exportAnswerToPdf(element, { question } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (text, { size = 10, bold = false, color = 30, gap = 6 } = {}) => {
    const safe = pdfSafe(text);
    if (!safe) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    const lineHeight = size * 1.3;
    for (const line of doc.splitTextToSize(safe, width)) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y + size);
      y += lineHeight;
    }
    y += gap;
  };

  writeText('Zurcher Septic - ZurcherAI', { size: 14, bold: true, color: 20, gap: 2 });
  writeText(new Date().toLocaleString(), { size: 8, color: 120, gap: 8 });
  if (question) writeText(question, { size: 11, bold: true, color: 40, gap: 10 });

  for (const node of Array.from(element.children)) {
    const table = node.tagName === 'TABLE' ? node : node.querySelector('table');
    if (table) {
      autoTable(doc, {
        html: table,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [29, 78, 216] },
        didParseCell: data => { data.cell.text = data.cell.text.map(pdfSafe); },
      });
      y = doc.lastAutoTable.finalY + 12;
      continue;
    }
    const isHeading = /^H[1-6]$/.test(node.tagName);
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      Array.from(node.children).forEach((li, i) => {
        writeText(`${node.tagName === 'OL' ? `${i + 1}.` : '-'} ${li.innerText}`, { gap: 2 });
      });
      y += 4;
    } else {
      writeText(node.innerText, { size: isHeading ? 12 : 10, bold: isHeading });
    }
  }

  doc.save(`${fileBaseName(question)}.pdf`);
}

export function answerHasTables(element) {
  return !!element?.querySelector('table');
}

export function exportAnswerToExcel(element, { question } = {}) {
  const tables = Array.from(element.querySelectorAll('table'));
  if (!tables.length) return;
  const workbook = XLSX.utils.book_new();
  tables.forEach((table, i) => {
    const sheet = XLSX.utils.table_to_sheet(table, { raw: false });
    XLSX.utils.book_append_sheet(workbook, sheet, tables.length > 1 ? `Tabla ${i + 1}` : 'Datos');
  });
  XLSX.writeFile(workbook, `${fileBaseName(question)}.xlsx`);
}

// ---------------------------------------------------------------------------
// Voz
// ---------------------------------------------------------------------------

export const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : undefined;

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Texto plano para leer en voz alta (sin markdown, sin emojis, sin links)
export function markdownToSpeech(markdown) {
  return String(markdown || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/[#*_`>~]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\n{2,}/g, '.\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function detectLang(text) {
  const sample = ` ${String(text).toLowerCase().slice(0, 600)} `;
  const es = (sample.match(/[áéíóúñ¿¡]| (el|la|los|las|de|que|y|en|para|con|está|hay) /g) || []).length;
  const en = (sample.match(/ (the|and|of|to|is|are|for|with|this|that) /g) || []).length;
  return es >= en ? 'es-US' : 'en-US';
}

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2);
  return voices.find(v => v.lang === lang)
    || voices.find(v => v.lang.startsWith(prefix) && /google|microsoft|natural/i.test(v.name))
    || voices.find(v => v.lang.startsWith(prefix));
}

/**
 * Lee el texto en voz alta. Chrome corta las frases muy largas, por eso se encola por oraciones.
 * onEnd se llama al terminar o al cancelar.
 */
export function speak(markdown, { onEnd } = {}) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const text = markdownToSpeech(markdown);
  const lang = detectLang(text);
  const voice = pickVoice(lang);
  const chunks = (text.match(/[^.!?\n]+[.!?\n]*/g) || [text]).map(c => c.trim()).filter(Boolean);
  if (!chunks.length) return onEnd?.();
  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    if (i === chunks.length - 1) {
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();
    }
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}
