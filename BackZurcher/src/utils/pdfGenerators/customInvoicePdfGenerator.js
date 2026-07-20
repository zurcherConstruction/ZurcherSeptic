const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const {
  NEW_PAGE_MARGIN,
  FONT_FAMILY_MONO,
  FONT_FAMILY_MONO_BOLD,
  COLOR_TEXT_DARK,
  COLOR_TEXT_MEDIUM,
  COLOR_TEXT_LIGHT,
  COLOR_BORDER_LIGHT,
  COLOR_BACKGROUND_TABLE_HEADER,
} = require('./shared/constants');

const { formatDateDDMMYYYY } = require('./shared/helpers');

const TYPE_LABELS = {
  INV: 'INVOICE',
  QUO: 'BUDGET',
  PRO: 'PROFORMA',
  CRN: 'CREDIT NOTE',
  REC: 'RECEIPT',
};

// ============================================================
// HEADER — company left, type/number/dates right,
// then divider, BILL TO | WORK LOCATION (same as budget)
// ============================================================
function _addHeader(doc, invoice) {
  const logoPath = path.join(__dirname, '../../assets/logo.png');
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  const headerY = NEW_PAGE_MARGIN;
  const leftW = contentWidth * 0.55;
  const rightX = NEW_PAGE_MARGIN + leftW + 10;
  const rightW = contentWidth - leftW - 10;

  // Left: logo + company
  let leftY = headerY;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, NEW_PAGE_MARGIN, leftY, { width: 70 });
    leftY += 80;
  }
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(12).fillColor(COLOR_TEXT_DARK)
    .text(invoice.companyName || 'ZURCHER CONSTRUCTION', NEW_PAGE_MARGIN, leftY, { width: leftW });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  if (invoice.companyAddress) doc.text(invoice.companyAddress, NEW_PAGE_MARGIN, doc.y, { width: leftW });
  if (invoice.companyEmail)   doc.text(invoice.companyEmail,   NEW_PAGE_MARGIN, doc.y, { width: leftW });
  if (invoice.companyPhone)   doc.text(invoice.companyPhone,   NEW_PAGE_MARGIN, doc.y, { width: leftW });
  const finalLeftY = doc.y;

  // Right: type, number, dates
  const typeLabel = TYPE_LABELS[invoice.invoiceType] || invoice.invoiceType;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(22).fillColor('#063260')
    .text(typeLabel, rightX, headerY, { width: rightW, align: 'right' });
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(13).fillColor(COLOR_TEXT_DARK)
    .text(`#${invoice.invoiceNumber}`, rightX, doc.y + 4, { width: rightW, align: 'right' });

  // Dates: lower (matching budget spacing), stacked label then value
  const dateTextStartX = rightX + 120;
  const dateTextWidth = rightW - 50;
  let dateY = doc.y + 45;
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  const dateStr = invoice.issueDate
    ? formatDateDDMMYYYY(invoice.issueDate.toString())
    : new Date().toLocaleDateString('en-US');
  doc.text('DATE:', dateTextStartX, dateY, { width: dateTextWidth, align: 'left' });
  dateY += doc.currentLineHeight() + 2;
  doc.text(dateStr, dateTextStartX, dateY, { width: dateTextWidth, align: 'left' });
  dateY += doc.currentLineHeight() + 4;
  if (invoice.dueDate) {
    doc.text('DUE DATE:', dateTextStartX, dateY, { width: dateTextWidth, align: 'left' });
    dateY += doc.currentLineHeight() + 2;
    doc.text(formatDateDDMMYYYY(invoice.dueDate.toString()), dateTextStartX, dateY, { width: dateTextWidth, align: 'left' });
    dateY += doc.currentLineHeight();
  }
  doc.y = dateY;
  const finalRightY = doc.y;

  doc.y = Math.max(finalLeftY, finalRightY) + 12;

  // Divider
  doc.moveTo(NEW_PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
  doc.moveDown(0.8);

  // Sub-header: 3 columns — same layout as budget invoice header
  const subY = doc.y;
  const colGap = 15;
  const colW3 = (contentWidth - 2 * colGap) / 3;
  const col2X = NEW_PAGE_MARGIN + colW3 + colGap;
  const col3X = col2X + colW3 + colGap;

  // Col 1: CUSTOMER INFO (name, company, email — no phone, matches budget)
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text('CUSTOMER INFO', NEW_PAGE_MARGIN, subY, { width: colW3 });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  doc.text((invoice.clientName || 'N/A').toUpperCase(), NEW_PAGE_MARGIN, doc.y + 2, { width: colW3 });
  if (invoice.clientCompany) doc.text(invoice.clientCompany.toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: colW3 });
  if (invoice.clientEmail)   doc.text(invoice.clientEmail.toLowerCase(),   NEW_PAGE_MARGIN, doc.y, { width: colW3 });
  const col1EndY = doc.y;

  // Col 2: WORK LOCATION
  doc.y = subY;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text('WORK LOCATION', col2X, subY, { width: colW3 });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  if (invoice.clientAddress) {
    doc.text(invoice.clientAddress.toUpperCase(), col2X, doc.y + 2, { width: colW3 });
  }
  const col2EndY = doc.y;

  // Col 3: INITIAL PAYMENT — always shown
  doc.y = subY;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text('INITIAL PAYMENT', col3X, subY, { width: colW3 });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  if (invoice.requirePayment) {
    const pct = parseFloat(invoice.paymentPercentage || 100);
    const total = parseFloat(invoice.total || 0);
    const payAmt = parseFloat(invoice.paymentAmount || (total * pct / 100));
    const pctLabel = pct >= 100 ? 'TOTAL' : `${pct}% REQUIRE TO START`;
    doc.text(pctLabel, col3X, doc.y + 2, { width: colW3 });
    doc.text(`$${payAmt.toFixed(2)}`, col3X, doc.y, { width: colW3 });
  } else {
    doc.text('NO PAYMENT REQUIRED', col3X, doc.y + 2, { width: colW3 });
  }
  const col3EndY = doc.y;

  doc.y = Math.max(col1EndY, col2EndY, col3EndY) + 12;
  doc.moveTo(NEW_PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
  doc.moveDown(0.8);
}

// ============================================================
// ITEMS TABLE — same column proportions as budget
// ============================================================
function _addItemsTable(doc, invoice) {
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  const pad = 4;

  const colName = contentWidth * 0.22;
  const colDesc = contentWidth * 0.38;
  const colQty  = contentWidth * 0.08;
  const colRate = contentWidth * 0.14;
  const colAmt  = contentWidth * 0.18;

  const xName = NEW_PAGE_MARGIN;
  const xDesc = xName + colName;
  const xQty  = xDesc + colDesc;
  const xRate = xQty  + colQty;
  const xAmt  = xRate + colRate;

  // Table header
  const headerY = doc.y;
  doc.rect(NEW_PAGE_MARGIN, headerY - 2, contentWidth, 18)
    .fillColor(COLOR_BACKGROUND_TABLE_HEADER).strokeColor(COLOR_BORDER_LIGHT).fillAndStroke();
  doc.fillColor(COLOR_TEXT_DARK).font(FONT_FAMILY_MONO_BOLD).fontSize(9);
  doc.text('INCLUDED',    xName + pad, headerY + 3, { width: colName - 2 * pad });
  doc.text('DESCRIPTION', xDesc + pad, headerY + 3, { width: colDesc - 2 * pad });
  doc.text('QTY',         xQty  + pad, headerY + 3, { width: colQty  - 2 * pad, align: 'right' });
  doc.text('UNIT PRICE',  xRate + pad, headerY + 3, { width: colRate - 2 * pad, align: 'right' });
  doc.text('AMOUNT',      xAmt  + pad, headerY + 3, { width: colAmt  - 2 * pad, align: 'right' });
  doc.y = headerY + 18;
  doc.moveDown(0.3);

  const checkPageBreak = (h = 40) => {
    if (doc.y + h > doc.page.height - NEW_PAGE_MARGIN - 20) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN;
    }
  };

  (invoice.items || []).forEach((item, i) => {
    const descH = item.description ? doc.heightOfString(item.description, { width: colDesc - 2 * pad }) : 0;
    const nameH = doc.heightOfString(item.name || '', { width: colName - 2 * pad });
    const rowH = Math.max(nameH, descH) + 14;
    checkPageBreak(rowH);

    const rowY = doc.y;
    if (i % 2 === 1) {
      doc.rect(NEW_PAGE_MARGIN, rowY - 2, contentWidth, rowH).fillColor('#fafafa').fill();
    }

    const qty  = parseFloat(item.quantity) || 1;
    const rate = parseFloat(item.unitPrice) || 0;
    const amt  = parseFloat(item.amount) || (qty * rate);
    const amtDisplay = item.amountDisplay || 'price';

    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
      .text((item.name || '').toUpperCase(), xName + pad, rowY, { width: colName - 2 * pad });
    doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM)
      .text(item.description || '', xDesc + pad, rowY, { width: colDesc - 2 * pad });
    doc.text(qty.toString(), xQty + pad, rowY, { width: colQty - 2 * pad, align: 'right' });

    if (amtDisplay === 'price') {
      doc.text(`$${rate.toFixed(2)}`, xRate + pad, rowY, { width: colRate - 2 * pad, align: 'right' });
      doc.font(FONT_FAMILY_MONO_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
        .text(`$${amt.toFixed(2)}`, xAmt + pad, rowY, { width: colAmt - 2 * pad, align: 'right' });
    } else {
      const label = amtDisplay === 'included' ? 'INCLUDED' : 'NOT INCLUDED';
      doc.font(FONT_FAMILY_MONO_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
        .text(label, xRate + pad, rowY, { width: colRate + colAmt - 2 * pad, align: 'right' });
    }

    doc.y = rowY + rowH;
  });

  doc.moveTo(NEW_PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.5).stroke();
  doc.moveDown(2);
}

// ============================================================
// TOTALS SECTION — payment info left, totals right (same as budget)
// ============================================================
function _addTotalsSection(doc, invoice) {
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  const cellPadding = 5;
  const payInfoW = contentWidth * 0.50;
  const totalsStartX = NEW_PAGE_MARGIN + contentWidth * 0.55;
  const totalsValueX = NEW_PAGE_MARGIN + contentWidth * 0.80;
  const rightEdge = doc.page.width - NEW_PAGE_MARGIN;

  // Ensure space for totals block
  if (doc.y + 200 > doc.page.height - NEW_PAGE_MARGIN) {
    doc.addPage();
    doc.y = NEW_PAGE_MARGIN + 10;
  }

  const sectionY = doc.y;

  // ---- LEFT: Thank you + Payment information ----
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_LIGHT)
    .text('Thank you for your business!', NEW_PAGE_MARGIN, sectionY, { width: payInfoW });
  doc.moveDown(1.5);

  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text('PAYMENT INFORMATION', NEW_PAGE_MARGIN, doc.y, { width: payInfoW });
  doc.moveDown(0.3);
  doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
  [
    'BANK: CHASE',
    'ACCOUNT NUMBER: 686125371',
    'ROUTING NUMBER: 267084131',
    'ZELLE: ZURCHERCONSTRUCTION.FL@GMAIL.COM',
    'CREDIT CARD + 3%',
    'ASK ABOUT PAYMENT METHODS',
  ].forEach(line => {
    doc.text(line, NEW_PAGE_MARGIN, doc.y, { width: payInfoW });
    doc.moveDown(0.3);
  });
  const afterPayInfoY = doc.y;

  // ---- RIGHT: Totals ----
  doc.y = sectionY;

  const sub   = parseFloat(invoice.subtotal || 0);
  const disc  = parseFloat(invoice.discountAmount || 0);
  const tax   = parseFloat(invoice.taxAmount || 0);
  const total = parseFloat(invoice.total || 0);
  const payAmt = parseFloat(invoice.paymentAmount || total);
  const pct = parseFloat(invoice.paymentPercentage || 100);

  const row = (label, value, { bold = false, red = false, bigTotal = false } = {}) => {
    const y = doc.y;
    const font = bold ? FONT_FAMILY_MONO_BOLD : FONT_FAMILY_MONO;
    const size = bigTotal ? 14 : (bold ? 11 : 11);
    const color = red ? '#DC2626' : (bold ? COLOR_TEXT_DARK : COLOR_TEXT_MEDIUM);
    doc.font(font).fontSize(size).fillColor(color)
      .text(label, totalsStartX, y, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
    doc.font(font).fontSize(size).fillColor(color)
      .text(value, totalsValueX, y, { width: rightEdge - totalsValueX, align: 'right' });
    doc.moveDown(0.6);
  };

  row('SUBTOTAL', `$${sub.toFixed(2)}`);

  if (disc > 0) {
    const discLabel = invoice.discountDescription ? invoice.discountDescription.toUpperCase() : 'DISCOUNT';
    row(discLabel, `-$${disc.toFixed(2)}`, { red: true });
  }

  if (tax > 0) {
    row(`TAX (${parseFloat(invoice.taxRate || 0)}%)`, `$${tax.toFixed(2)}`);
  }

  // Divider before total
  doc.moveTo(totalsStartX, doc.y).lineTo(rightEdge, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.8).stroke();
  doc.moveDown(0.5);

  row('TOTAL', `$${total.toFixed(2)}`, { bold: true, bigTotal: true });

  if (invoice.requirePayment && pct < 100) {
    doc.moveDown(0.3);
    row(`INITIAL PAYMENT (${pct}%)`, `$${payAmt.toFixed(2)}`, { bold: true });
  }

  doc.y = Math.max(afterPayInfoY, doc.y) + 15;
}

// ============================================================
// STRIPE BUTTON — centered, below totals
// ============================================================
async function _addStripeButton(doc, invoice) {
  if (!invoice.requirePayment || !process.env.STRIPE_SECRET_KEY) return;

  const payAmt = parseFloat(invoice.paymentAmount || invoice.total || 0);
  if (payAmt <= 0) return;

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const frontendUrl = (process.env.FRONTEND_URL || 'https://www.zurcherseptic.com').replace(/\/$/, '');
    const thankYouUrl = `${frontendUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&source=stripe`;
    const amountWithFee = Math.round(payAmt * 1.03 * 100);

    const product = await stripe.products.create({
      name: `${invoice.invoiceNumber} - ${invoice.clientName}`,
      metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
    });
    const price = await stripe.prices.create({
      product: product.id, unit_amount: amountWithFee, currency: 'usd',
    });
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      customer_creation: 'always',
      after_completion: { type: 'redirect', redirect: { url: thankYouUrl } },
      payment_intent_data: {
        description: `Payment for ${invoice.invoiceNumber}`,
        metadata: { custom_invoice_id: invoice.id, invoice_number: invoice.invoiceNumber },
      },
    });

    const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
    const btnW = 220;
    const btnH = 28;
    const btnX = NEW_PAGE_MARGIN + (contentWidth - btnW) / 2;

    if (doc.y + btnH + 30 > doc.page.height - NEW_PAGE_MARGIN) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN + 10;
    }
    doc.moveDown(1);
    const btnY = doc.y;

    doc.save();
    doc.roundedRect(btnX, btnY, btnW, btnH, 5).fillColor('#063260').fill();
    doc.fillColor('#FFFFFF').fontSize(9).font(FONT_FAMILY_MONO_BOLD)
      .text('Click Here to Pay Online', btnX, btnY + (btnH / 2) - 4, { width: btnW, align: 'center' });
    doc.restore();
    doc.link(btnX, btnY, btnW, btnH, paymentLink.url);
    doc.y = btnY + btnH + 4;
    doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_LIGHT)
      .text('Note: Online payments include a 3% processing fee.', btnX, doc.y, { width: btnW, align: 'center' });
    doc.moveDown(1);

    return paymentLink;
  } catch (err) {
    console.error('Stripe link error for custom invoice:', err.message);
  }
}

// ============================================================
// NOTES — below stripe button on main page
// ============================================================
function _addNotes(doc, notes) {
  if (!notes) return;
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  doc.moveDown(0.5);
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
    .text('NOTES', NEW_PAGE_MARGIN, doc.y, { width: contentWidth });
  doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM)
    .text(notes, NEW_PAGE_MARGIN, doc.y + 3, { width: contentWidth, align: 'justify' });
}

// ============================================================
// SIGNATURE BLOCK
// ============================================================
function _addSignatureBlock(doc) {
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  if (doc.y + 60 > doc.page.height - NEW_PAGE_MARGIN) {
    doc.addPage();
    doc.y = NEW_PAGE_MARGIN + 20;
  } else {
    doc.moveDown(2);
  }
  const sigW = (contentWidth / 2) - 10;
  const y = doc.y;
  doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_DARK);
  doc.text('Client Signature:', NEW_PAGE_MARGIN, y, { width: 80 });
  doc.moveTo(NEW_PAGE_MARGIN + 80, y + 8).lineTo(NEW_PAGE_MARGIN + 80 + sigW - 80, y + 8)
    .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
  doc.text('Date:', NEW_PAGE_MARGIN + sigW + 10, y, { width: 30 });
  doc.moveTo(NEW_PAGE_MARGIN + sigW + 40, y + 8)
    .lineTo(NEW_PAGE_MARGIN + sigW + 40 + (sigW - 110), y + 8)
    .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
  doc.y = y + 30;
}

// ============================================================
// T&C PAGE — separate page, same structure as budget T&C page
// ============================================================
function _addTermsPage(doc, invoice) {
  if (!invoice.termsAndConditions) return;

  doc.addPage();
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  const logoPath = path.join(__dirname, '../../assets/logo.png');
  const headerY = NEW_PAGE_MARGIN;
  const leftW = contentWidth * 0.50;
  const rightX = NEW_PAGE_MARGIN + leftW + 100;
  const rightW = contentWidth * 0.45;

  // Company info left
  let leftY = headerY;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, NEW_PAGE_MARGIN, leftY, { width: 60 });
    leftY += 70;
  }
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(11).fillColor(COLOR_TEXT_DARK)
    .text(invoice.companyName || 'ZURCHER CONSTRUCTION', NEW_PAGE_MARGIN, leftY, { width: leftW });
  doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
  if (invoice.companyAddress) doc.text(invoice.companyAddress, NEW_PAGE_MARGIN, doc.y, { width: leftW });
  if (invoice.companyEmail)   doc.text(invoice.companyEmail,   NEW_PAGE_MARGIN, doc.y, { width: leftW });
  if (invoice.companyPhone)   doc.text(invoice.companyPhone,   NEW_PAGE_MARGIN, doc.y, { width: leftW });
  const finalLeftY = doc.y;

  // Customer info + work location right
  let rightY = headerY + 60;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text('CUSTOMER INFO', rightX, rightY, { width: rightW });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  doc.text((invoice.clientName || 'N/A').toUpperCase(), rightX, doc.y + 2, { width: rightW });
  doc.moveDown(0.8);
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text('WORK LOCATION', rightX, doc.y, { width: rightW });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  if (invoice.clientAddress) {
    const addr = invoice.clientAddress.toUpperCase().replace(/,\s*/g, '\n');
    doc.text(addr, rightX, doc.y + 2, { width: rightW });
  }
  const finalRightY = doc.y;

  doc.y = Math.max(finalLeftY, finalRightY) + 8;

  doc.moveTo(NEW_PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
  doc.moveDown(0.8);

  // T&C title (same style as budget)
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
    .text('TERMS AND CONDITIONS', NEW_PAGE_MARGIN, doc.y, { width: contentWidth, underline: true });
  doc.moveDown(0.8);

  // Parse stored T&C and render each section with bold title + body (same as budget section style)
  const checkPageBreak = (h = 40) => {
    if (doc.y + h > doc.page.height - NEW_PAGE_MARGIN - 80) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN;
    }
  };

  const rawSections = invoice.termsAndConditions.split(/\n{2,}/);
  rawSections.forEach(section => {
    const trimmed = section.trim();
    if (!trimmed) return;

    const nlPos = trimmed.indexOf('\n');
    const title = nlPos > -1 ? trimmed.slice(0, nlPos).trim() : trimmed;
    const body  = nlPos > -1 ? trimmed.slice(nlPos + 1).trim() : '';

    const estimatedH = 20 + (body ? doc.heightOfString(body, { width: contentWidth }) : 0);
    checkPageBreak(estimatedH);

    // Title in bold (same as budget section titles)
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
      .text(title, NEW_PAGE_MARGIN, doc.y, { width: contentWidth });
    doc.moveDown(0.3);

    if (body) {
      doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM)
        .text(body, NEW_PAGE_MARGIN, doc.y, { width: contentWidth, align: 'justify' });
    }
    doc.moveDown(0.8);
  });

  // Signature block at end of T&C page (same as budget)
  if (invoice.requireSignature && invoice.status !== 'signed') {
    let sigY = doc.y + 20;
    if (sigY + 80 > doc.page.height - NEW_PAGE_MARGIN) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN;
      sigY = doc.y + 20;
    }
    doc.y = sigY;

    const sigFieldW = (contentWidth / 2) - 10;
    const lineW = sigFieldW - 80;
    const dateLineW = sigFieldW - 110;
    const y = doc.y;

    doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_DARK);
    doc.text('Client Signature:', NEW_PAGE_MARGIN, y, { width: 80 });
    doc.moveTo(NEW_PAGE_MARGIN + 80, y + 8).lineTo(NEW_PAGE_MARGIN + 80 + lineW, y + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
    doc.text('Date:', NEW_PAGE_MARGIN + sigFieldW + 10, y, { width: 30 });
    doc.moveTo(NEW_PAGE_MARGIN + sigFieldW + 40, y + 8)
      .lineTo(NEW_PAGE_MARGIN + sigFieldW + 40 + dateLineW, y + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
    doc.moveDown(2.5);

    const y2 = doc.y;
    doc.text('Provider Representative:', NEW_PAGE_MARGIN, y2, { width: 110 });
    doc.moveTo(NEW_PAGE_MARGIN + 110, y2 + 8)
      .lineTo(NEW_PAGE_MARGIN + 110 + (lineW - 30), y2 + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
    doc.text('Date:', NEW_PAGE_MARGIN + sigFieldW + 10, y2, { width: 30 });
    doc.moveTo(NEW_PAGE_MARGIN + sigFieldW + 40, y2 + 8)
      .lineTo(NEW_PAGE_MARGIN + sigFieldW + 40 + dateLineW, y2 + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
  }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================
async function generateCustomInvoicePdf(invoice) {
  return new Promise(async (resolve, reject) => {
    try {
      const uploadsDir = path.join(__dirname, '../../uploads/custom_invoices');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const safeNum = (invoice.invoiceNumber || invoice.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      const pdfPath = path.join(uploadsDir, `${safeNum}.pdf`);

      const doc = new PDFDocument({ autoFirstPage: false, margin: NEW_PAGE_MARGIN, size: 'A4' });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // ---- PAGE 1: invoice ----
      doc.addPage();
      _addHeader(doc, invoice);
      _addItemsTable(doc, invoice);
      _addTotalsSection(doc, invoice);
      await _addStripeButton(doc, invoice);
      _addNotes(doc, invoice.notes);

      // Signature on main page only when there's no T&C page
      if (invoice.requireSignature && invoice.status !== 'signed' && !invoice.termsAndConditions) {
        _addSignatureBlock(doc);
      }

      // ---- PAGE 2: T&C (if any) — same pattern as budget ----
      if (invoice.termsAndConditions) {
        _addTermsPage(doc, invoice);
      }

      doc.end();
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCustomInvoicePdf };
