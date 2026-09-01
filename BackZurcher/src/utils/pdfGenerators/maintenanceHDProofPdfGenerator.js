'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOGO_URL = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png';
const PRIMARY  = '#1e3a8a';
const GRAY     = '#64748b';
const LIGHT_BG = '#f1f5f9';
const BORDER   = '#cbd5e1';

async function downloadBuffer(url) {
  try {
    const res = await axios({ url, responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

function formatDate(dateInput) {
  if (!dateInput) return 'N/A';
  try {
    const d = new Date(typeof dateInput === 'string' ? dateInput + (dateInput.length === 10 ? 'T12:00:00' : '') : dateInput);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return 'N/A';
  }
}

/**
 * Generates a Notification Proof PDF (HD Proof) for a waived maintenance visit.
 */
async function generateMaintenanceHDProofPDF({ visit, clientEmail, clientName, propertyAddress, systemType }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

      const tempDir = path.join(__dirname, '../../uploads/temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const outPath = path.join(tempDir, `hd_proof_${visit.id}_${Date.now()}.pdf`);
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);

      const W = doc.page.width - 100;

      // ── HEADER ──────────────────────────────────────────────
      const logoBuffer = await downloadBuffer(LOGO_URL);
      if (logoBuffer) {
        doc.image(logoBuffer, 50, 40, { height: 44 });
      }

      doc.fontSize(9).fillColor(GRAY)
        .text('Zurcher Septic & Construction LLC', 0, 42, { align: 'right' })
        .text('CFC1433240', { align: 'right' })
        .text('admin@zurcherseptic.com', { align: 'right' });

      doc.moveTo(50, 95).lineTo(562, 95).lineWidth(1).strokeColor(BORDER).stroke();

      // ── TITLE ────────────────────────────────────────────────
      doc.moveDown(0.5);
      doc.fontSize(15).fillColor(PRIMARY).font('Helvetica-Bold')
        .text('MAINTENANCE NOTIFICATION PROOF', { align: 'center' });
      doc.fontSize(10).fillColor(GRAY).font('Helvetica')
        .text('Visit Waiver — Health Department Proof (HD)', { align: 'center' });
      doc.moveDown(1);

      // ── INFO BOX ─────────────────────────────────────────────
      const boxY = doc.y;
      doc.rect(50, boxY, W, 36).fillAndStroke(LIGHT_BG, BORDER);

      const lineY = boxY + 12;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('Address:', 65, lineY);
      doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(propertyAddress || 'N/A', 120, lineY, { width: 180, lineBreak: false });

      doc.font('Helvetica-Bold').fontSize(8).fillColor(GRAY).text('Visit No.:', 320, lineY);
      doc.font('Helvetica').fontSize(9).fillColor('#1e293b').text(String(visit.visitNumber || 'N/A'), 378, lineY, { width: 120, lineBreak: false });

      doc.y = boxY + 46;
      doc.moveDown(0.5);

      // ── NOTIFICATIONS TABLE ──────────────────────────────────
      doc.fontSize(11).fillColor(PRIMARY).font('Helvetica-Bold')
        .text('Notification History');
      doc.moveDown(0.3);

      const tY = doc.y;
      doc.rect(50, tY, W, 20).fillAndStroke(PRIMARY, PRIMARY);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
        .text('Notice #',    60,  tY + 6, { width: 80 })
        .text('Description', 145, tY + 6, { width: 200 })
        .text('Date Sent',   350, tY + 6, { width: 120 })
        .text('Status',      475, tY + 6, { width: 80 });

      const count    = visit.notificationCount || 0;
      const lastSent = visit.lastNotificationSentAt ? new Date(visit.lastNotificationSentAt) : null;

      for (let i = 1; i <= Math.max(count, 1); i++) {
        const rowTopY = tY + 20 + (i - 1) * 22;
        const bg = i % 2 === 0 ? LIGHT_BG : '#ffffff';
        doc.rect(50, rowTopY, W, 22).fillAndStroke(bg, BORDER);

        let dateStr = 'N/A';
        if (i === count && lastSent) {
          dateStr = formatDate(lastSent);
        } else if (i < count && lastSent) {
          const approx = new Date(lastSent);
          approx.setDate(approx.getDate() - (count - i) * 3);
          dateStr = `~${formatDate(approx)}`;
        }

        const sentLabel = i <= count ? 'Sent' : 'Not sent';
        const sentColor = i <= count ? '#16a34a' : '#dc2626';

        doc.fillColor('#1e293b').fontSize(9).font('Helvetica')
          .text(`Notice #${i}`, 60, rowTopY + 7, { width: 80 })
          .text(i === 1 ? '1st notice — 7 days before visit' :
                i === 2 ? '2nd notice — 4 days before visit' :
                          '3rd notice — 1 day before visit',  145, rowTopY + 7, { width: 200 })
          .text(dateStr, 350, rowTopY + 7, { width: 120 });

        doc.fillColor(sentColor).font('Helvetica-Bold')
          .text(sentLabel, 475, rowTopY + 7, { width: 80 });
      }

      doc.y = tY + 20 + Math.max(count, 1) * 22 + 8;
      doc.moveDown(0.5);

      // ── RESULT BOX ───────────────────────────────────────────
      const resY = doc.y;
      doc.rect(50, resY, W, 58).fillAndStroke('#fef9c3', '#fde047');

      doc.fillColor('#713f12').fontSize(10).font('Helvetica-Bold')
        .text('RESULT:', 65, resY + 10);
      doc.font('Helvetica').fontSize(9).fillColor('#713f12')
        .text(
          `${count} notification(s) were sent to the client (${clientEmail || 'no email on file'}) ` +
          `for maintenance visit No. ${visit.visitNumber} scheduled for ${formatDate(visit.scheduledDate)}. ` +
          `The client did not respond to any of the notices sent. ` +
          `In accordance with Health Department (HD) requirements, this visit is hereby waived.`,
          65, resY + 24, { width: W - 30, lineBreak: true }
        );

      doc.y = resY + 70;
      doc.moveDown(0.5);

      // ── WAIVER DATE ──────────────────────────────────────────
      const waiveDate = visit.clientRespondedAt || visit.updatedAt || new Date();
      doc.fontSize(10).fillColor('#1e293b').font('Helvetica')
        .text('Waiver Date: ', { continued: true })
        .font('Helvetica-Bold').text(formatDate(waiveDate));

      doc.moveDown(1);

      // ── FOOTER ───────────────────────────────────────────────
      doc.fontSize(8).fillColor(GRAY)
        .text(
          'This document is issued by Zurcher Septic as official proof of client notification.',
          50, doc.page.height - 60, { width: W, align: 'center' }
        );

      doc.end();
      stream.on('finish', () => resolve(outPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateMaintenanceHDProofPDF };
