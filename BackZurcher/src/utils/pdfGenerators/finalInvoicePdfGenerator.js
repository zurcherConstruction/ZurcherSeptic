const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Importar desde archivos compartidos
const {
 
  NEW_PAGE_MARGIN,
  FONT_FAMILY_MONO,
  FONT_FAMILY_MONO_BOLD,
  COLOR_TEXT_DARK,
  COLOR_TEXT_MEDIUM,
  COLOR_TEXT_LIGHT,
  COLOR_BORDER_LIGHT,
  COLOR_BACKGROUND_TABLE_HEADER
} = require('./shared/constants');

const { formatDateDDMMYYYY } = require('./shared/helpers');

// === FUNCIÓN DE ENCABEZADO ESTILIZADO ===
function _addFinalInvoiceHeader(doc, invoiceData, workData, budgetData, formattedDate, invoiceNumber) {
  const logoPath = path.join(__dirname, '../../assets/logo.png');
  const headerStartY = NEW_PAGE_MARGIN;
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;

  const companyInfoX = NEW_PAGE_MARGIN;
  const companyInfoWidth = contentWidth * 0.55;
  const invoiceInfoX = NEW_PAGE_MARGIN + companyInfoWidth + 10;
  const invoiceInfoWidth = contentWidth - companyInfoWidth - 10;

  let currentYLeft = headerStartY;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, companyInfoX, currentYLeft, { width: 70 });
    currentYLeft += 30 + 40; // Espacio ajustado para el logo
  } else {
    currentYLeft = headerStartY;
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(14).fillColor(COLOR_TEXT_DARK)
      .text("ZURCHER CONSTRUCTION", companyInfoX, currentYLeft, { width: companyInfoWidth });
    currentYLeft += doc.currentLineHeight() + 2;
  }

  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(11).fillColor(COLOR_TEXT_DARK)
    .text("ZURCHER CONSTRUCTION", companyInfoX, currentYLeft, { width: companyInfoWidth });
  doc.font(FONT_FAMILY_MONO).fontSize(12).fillColor(COLOR_TEXT_MEDIUM);
  doc.text("SEPTIC TANK DIVISION - CFC1433240", companyInfoX, doc.y, { width: companyInfoWidth });
  doc.text("admin@zurcherseptic.com", companyInfoX, doc.y, { width: companyInfoWidth });
  doc.text("+1 (954) 636-8200", companyInfoX, doc.y, { width: companyInfoWidth });
  const finalYLeftTop = doc.y;

  let currentYRight = headerStartY + 5;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(20).fillColor('#063260')
    .text(`FINAL INVOICE #${invoiceNumber}`, invoiceInfoX, currentYRight, { width: invoiceInfoWidth, align: 'right' });
  currentYRight = doc.y + 45;

  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);

  const dateTextStartX = invoiceInfoX + 120;
  const dateTextWidth = invoiceInfoWidth - 50;

  doc.text("DATE:", dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
  currentYRight += doc.currentLineHeight() + 2;

  doc.text(formattedDate, dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
  currentYRight += doc.currentLineHeight() + 4;

  if (invoiceData.status === 'paid' && invoiceData.paymentDate) {
    doc.text("PAID ON:", dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
    currentYRight += doc.currentLineHeight() + 2;
    doc.text(formatDateDDMMYYYY(invoiceData.paymentDate), dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
    currentYRight += doc.currentLineHeight();
  }

  doc.y = currentYRight;
  const finalYRightTop = doc.y;
  doc.y = Math.max(finalYLeftTop, finalYRightTop) + 15;
  
  doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
  doc.moveDown(1);

  const { propertyAddress } = workData;
  const clientName = budgetData?.applicantName || "Valued Customer";
  const clientEmail = budgetData?.Permit?.applicantEmail || budgetData?.applicantEmail;

  const subHeaderStartY = doc.y;
  const columnGap = 15;
  const columnWidth = (contentWidth - (2 * columnGap)) / 3;

  const customerInfoX = NEW_PAGE_MARGIN;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text("CUSTOMER INFO", customerInfoX, subHeaderStartY, { width: columnWidth });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  doc.text((clientName || 'N/A').toUpperCase(), customerInfoX, doc.y + 2, { width: columnWidth });
  if (clientEmail) {
    doc.text(clientEmail.toUpperCase(), customerInfoX, doc.y, { width: columnWidth });
  }
  const finalYCol1 = doc.y;

  doc.y = subHeaderStartY;
  const workLocationX = customerInfoX + columnWidth + columnGap;
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text("WORK LOCATION", workLocationX, subHeaderStartY, { width: columnWidth });
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  doc.text((propertyAddress || 'N/A').toUpperCase(), workLocationX, doc.y + 2, { width: columnWidth });
  const finalYCol2 = doc.y;

  doc.y = subHeaderStartY;
  const additionalOffset = 20;
  const paymentInfoX = workLocationX + columnWidth + columnGap + additionalOffset;
  
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
    .text("PAYMENT", paymentInfoX, subHeaderStartY, { width: columnWidth });
  
  const initialPercentage = parseFloat(budgetData?.initialPaymentPercentage || 0);
  const finalPercentage = 100 - initialPercentage;
  const paymentText = `FINAL ${finalPercentage}% BALANCE DUE UPON RECEIPT OF THIS INVOICE.`;
  
  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
  doc.text(paymentText.toUpperCase(), paymentInfoX, doc.y + 2, { width: columnWidth });
  const finalYCol3 = doc.y;

  doc.y = Math.max(finalYCol1, finalYCol2, finalYCol3);
  doc.moveDown(1);
  doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
  doc.moveDown(1);
}

async function generateAndSaveFinalInvoicePDF(invoiceData) {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        id: invoiceId, invoiceDate, originalBudgetTotal, initialPaymentMade,
        subtotalExtras, discount, discountReason, finalAmountDue, status: invoiceStatus, Work: workData,
        extraItems = []
      } = invoiceData;

      if (!workData) throw new Error('No se encontraron datos de trabajo (Work) en la factura');
      
      const { budget: budgetData } = workData;
      const formattedInvoiceDate = formatDateDDMMYYYY(invoiceDate);
      const invoiceNumber = invoiceData.invoiceNumber || invoiceId?.toString().substring(0, 8) || 'UNKNOWN';
      const clientName = budgetData?.applicantName || "Valued Customer";
      const clientEmail = budgetData?.Permit?.applicantEmail || budgetData?.applicantEmail;

      const doc = new PDFDocument({ autoFirstPage: false, margin: NEW_PAGE_MARGIN, size: 'A4' });
      const uploadsDir = path.join(__dirname, '../../uploads/final_invoices');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      
      const pdfPath = path.join(uploadsDir, `final_invoice_${invoiceNumber}.pdf`);
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      doc.addPage();
      _addFinalInvoiceHeader(doc, invoiceData, workData, budgetData, formattedInvoiceDate, invoiceNumber);

      const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
      const tableTop = doc.y;
      const cellPadding = 5;

      const colIncludedW = contentWidth * 0.35;
      const colDescW = contentWidth * 0.45;
      const colAmountW = contentWidth * 0.20;

      const xIncludedText = NEW_PAGE_MARGIN + cellPadding;
      const xDescText = NEW_PAGE_MARGIN + colIncludedW + cellPadding;
      const xAmountText = NEW_PAGE_MARGIN + colIncludedW + colDescW + cellPadding;

      const wIncluded = colIncludedW - (2 * cellPadding);
      const wDesc = colDescW - (2 * cellPadding);
      const wAmount = colAmountW - (2 * cellPadding);

      // Table Header
      doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK);
      const headerY = tableTop;
      doc.rect(NEW_PAGE_MARGIN, headerY - 3, contentWidth, 18)
        .fillColor(COLOR_BACKGROUND_TABLE_HEADER).strokeColor(COLOR_BORDER_LIGHT).fillAndStroke();
      doc.fillColor(COLOR_TEXT_DARK);
      
      doc.text('INCLUDED', xIncludedText, headerY + 2, { width: wIncluded });
      doc.text('DESCRIPTION', xDescText, headerY + 2, { width: wDesc });
      doc.text('AMOUNT', xAmountText, headerY + 2, { width: wAmount, align: 'right' });
      
      doc.font(FONT_FAMILY_MONO);
      doc.y = headerY + 18;
      doc.moveDown(1);
      doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);

      // --- Fila del Saldo del Presupuesto ---
      const initialPercentage = parseFloat(budgetData?.initialPaymentPercentage || 0);
      const finalPercentage = 100 - initialPercentage;
      const remainingBudgetAmount = parseFloat(originalBudgetTotal || 0) - parseFloat(initialPaymentMade || 0);
      
      const budgetIncludedText = `FINAL ${finalPercentage}% COMPLETE INSTALLATION OF SEPTIC TANK SYSTEM`;
      const budgetDescriptionText = `LABOR, EQUIPMENT, AND MATERIALS FOR THE COMPLETE INSTALLATION OF A CONVENTIONAL SEPTIC TANK AND DRAINFIELD SYSTEM, INCLUDING EXCAVATION, TANK PLACEMENT, PIPE INSTALLATION, AND SYSTEM BACKFILL, IN COMPLIANCE WITH COUNTY HEALTH DEPARTMENT REQUIREMENTS.`;

      const budgetRowY = doc.y;
      doc.text(budgetIncludedText.toUpperCase(), xIncludedText, budgetRowY, { width: wIncluded });
      doc.text(budgetDescriptionText.toUpperCase(), xDescText, budgetRowY, { width: wDesc });
      doc.text(`$${remainingBudgetAmount.toFixed(2)}`, xAmountText, budgetRowY, { width: wAmount, align: 'right' });

      const budgetDescHeight = doc.heightOfString(budgetDescriptionText.toUpperCase(), { width: wDesc });
      doc.y = budgetRowY + budgetDescHeight + doc.currentLineHeight() * 1.5;

      // --- Filas de los Change Orders ---
      if (extraItems && extraItems.length > 0) {
        extraItems.forEach(item => {
          const itemAmount = parseFloat(item.lineTotal || 0);
          const changeOrderRowY = doc.y;
          const includedText = "CHANGE ORDER";
          
          let dynamicDescription = '';
          const originalDescription = (item.description || '').toUpperCase();
          const quantity = parseFloat(item.quantity || 0).toFixed(2);

          if (originalDescription.includes('SAND')) {
            dynamicDescription = `SAND ${quantity} TRUCKS`;
          } else if (originalDescription.includes('DIRT')) {
            dynamicDescription = `DIRT ${quantity} TRUCKS`;
          } else if (originalDescription.includes('ROCK REMOVAL')) {
            dynamicDescription = `ROCK REMOVAL ${quantity} HOURS`;
          } else {
            dynamicDescription = item.description || 'Additional Work';
          }

          doc.text(includedText, xIncludedText, changeOrderRowY, { width: wIncluded });
          doc.text(dynamicDescription.toUpperCase(), xDescText, changeOrderRowY, { width: wDesc });
          doc.text(`$${itemAmount.toFixed(2)}`, xAmountText, changeOrderRowY, { width: wAmount, align: 'right' });

          const includedHeight = doc.heightOfString(includedText, { width: wIncluded });
          const descriptionHeight = doc.heightOfString(dynamicDescription.toUpperCase(), { width: wDesc });
          const rowHeight = Math.max(includedHeight, descriptionHeight);
          
          doc.y = changeOrderRowY + rowHeight + doc.currentLineHeight() * 1.5;
        });
      }
      
      doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
        .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.5).stroke();
      doc.moveDown(2.0);

      // === SECCIÓN DE TOTALES Y PAGO ===
      const thankYouAndPaymentInfoY = doc.y;
      const paymentInfoWidth = contentWidth * 0.55;

      doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_LIGHT)
        .text("Thank you for your business!", NEW_PAGE_MARGIN, doc.y, { width: contentWidth, align: 'left' });
      doc.moveDown(1.8);

      doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
          .text("PAYMENT INFORMATION", NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.3);
        doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
        doc.text("BANK: CHASE".toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.3);
        doc.text("ACCOUNT NUMBER: 686125371".toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.3);
        doc.text("ROUTING NUMBER: 267084131".toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.5);
        doc.text("Zelle: zurcherconstruction.fl@gmail.com".toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.3);
        doc.text("CREDIT CARD + 3%".toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.3);
        doc.text("ASK ABOUT PAYMENT METHODS. ".toUpperCase(), NEW_PAGE_MARGIN, doc.y, { width: paymentInfoWidth });
        doc.moveDown(0.3);
      

      const yAfterPaymentInfo = doc.y;
      doc.y = thankYouAndPaymentInfoY;

      const totalsStartX = NEW_PAGE_MARGIN + contentWidth * 0.55;
      const totalsValueX = NEW_PAGE_MARGIN + contentWidth * 0.78; // ✅ MOVIDO A LA IZQUIERDA para números grandes
      const totalsRightEdge = doc.page.width - NEW_PAGE_MARGIN;
      let currentTotalY = doc.y;

      const totalExtras = extraItems.reduce((acc, item) => acc + parseFloat(item.lineTotal || 0), 0);
      const discountAmount = parseFloat(discount || 0);
      const subtotal = remainingBudgetAmount + totalExtras - discountAmount;
      const tax = 0.00;
      const total = subtotal + tax;

      doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
      doc.text("SUBTOTAL", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
      doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
      doc.text(`$${(remainingBudgetAmount + totalExtras).toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
      doc.moveDown(0.6);

      // 🆕 DESCUENTO (si existe)
      if (discountAmount > 0) {
        currentTotalY = doc.y;
        doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor('#DC2626'); // 🔴 Rojo para el descuento
        doc.text("DISCOUNT", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
        doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor('#DC2626'); // 🔴 Rojo también para el monto
        doc.text(`-$${discountAmount.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
        
        // Si hay razón del descuento, mostrarla
        if (discountReason && discountReason.trim()) {
          doc.moveDown(0.3);
          doc.font(FONT_FAMILY_MONO).fontSize(7).fillColor('#DC2626'); // 🔴 Rojo también para la razón
          doc.text(`(${discountReason.trim()})`, totalsStartX, doc.y, { 
            width: totalsRightEdge - totalsStartX, 
            align: 'left' 
          });
        }
        doc.moveDown(0.6);
      }

      currentTotalY = doc.y;
      doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
      doc.text("TAX", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
      doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
      doc.text(`$${tax.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
      doc.moveDown(0.6);

      currentTotalY = doc.y;
      doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
      doc.text("TOTAL", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
      doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
      doc.text(`$${total.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
      doc.moveDown(0.8);

      const lineY = doc.y;
      doc.moveTo(totalsStartX, lineY)
        .lineTo(totalsRightEdge, lineY)
        .strokeColor(COLOR_BORDER_LIGHT)
        .lineWidth(0.8)
        .stroke();
      doc.moveDown(1.2);

      currentTotalY = doc.y;
      if (invoiceStatus === 'paid') {
        doc.font(FONT_FAMILY_MONO_BOLD).fontSize(14).fillColor('green');
        doc.text("PAID IN FULL", totalsStartX, currentTotalY, { width: totalsRightEdge - totalsStartX, align: 'center' });
      } else {
        doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_DARK);
        doc.text("BALANCE DUE", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
        doc.font(FONT_FAMILY_MONO_BOLD).fontSize(14).fillColor(COLOR_TEXT_DARK);
        doc.text(`$${total.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
      }

      const yAfterTotals = doc.y;
      doc.y = Math.max(yAfterPaymentInfo, yAfterTotals);
      doc.moveDown(2);

      // ✅ INICIO: Lógica del botón de pago de Stripe
      let paymentLinkUrl = null;
      const paymentAmountForStripe = total;
      const paymentAmountWithFee = Math.round(paymentAmountForStripe * 1.03 * 100); // suma el 3% y convierte a centavos

      if (invoiceStatus !== 'paid' && paymentAmountForStripe > 0 && process.env.STRIPE_SECRET_KEY) {
        try {
          const frontendBaseUrl = (process.env.FRONTEND_URL || 'https://www.zurcherseptic.com').replace(/\/$/, '');
          const thankYouUrl = `${frontendBaseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&source=stripe`;

          // Crear producto y precio en Stripe
          const product = await stripe.products.create({
            name: `Final Invoice #${invoiceNumber} - ${clientName}`,
            metadata: { 
              final_invoice_id: invoiceId,
              work_id: workData?.idWork || null,
              budget_id: budgetData?.idBudget || null,
              payment_type: 'final_invoice_payment',
              invoice_number: invoiceNumber
            }
          });

          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: paymentAmountWithFee,
            currency: 'usd',
          });

          // Crear Payment Link (permite expiración > 24 horas)
          const paymentLink = await stripe.paymentLinks.create({
            line_items: [{ price: price.id, quantity: 1 }],
            customer_creation: 'always',
            after_completion: {
              type: 'redirect',
              redirect: { url: thankYouUrl }
            },
            payment_intent_data: {
              description: `Final payment for Invoice #${invoiceNumber}`,
              metadata: {
                final_invoice_id: invoiceId,
                work_id: workData?.idWork || null,
                budget_id: budgetData?.idBudget || null,
                payment_type: 'final_invoice_payment',
                invoice_number: invoiceNumber
              }
            },
            metadata: { 
              final_invoice_id: invoiceId,
              work_id: workData?.idWork || null,
              budget_id: budgetData?.idBudget || null,
              payment_type: 'final_invoice_payment',
              invoice_number: invoiceNumber
            }
          });
          
          paymentLinkUrl = paymentLink.url;
        } catch (stripeError) {
          console.error("Stripe session creation error for final invoice:", stripeError);
        }
      }

      if (paymentLinkUrl) {
        const buttonWidth = 200;
        const buttonHeight = 28;
        let buttonY = doc.y;
        const buttonX = NEW_PAGE_MARGIN + (contentWidth - buttonWidth) / 2;

        if (buttonY + buttonHeight + 20 > doc.page.height - NEW_PAGE_MARGIN) {
          doc.addPage();
          buttonY = doc.y + 20;
        }
        doc.y = buttonY;

        doc.save();
        doc.roundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 5).fillColor('#063260').fill();
        doc.fillColor('#FFFFFF').fontSize(9).font(FONT_FAMILY_MONO_BOLD);
        doc.text('Click Here to Pay Online', buttonX, buttonY + (buttonHeight / 2) - 4, { width: buttonWidth, align: 'center' });
        doc.restore();
        doc.link(buttonX, buttonY, buttonWidth, buttonHeight, paymentLinkUrl);
        doc.y = buttonY + buttonHeight + 5;

        // Agregar aclaración del 3% fee debajo del botón
        doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
        doc.text('Note: Online payments via this button include a 3% processing fee.', buttonX, doc.y, { width: buttonWidth, align: 'center' });
        doc.y += 5;
      }
      // ✅ FIN: Lógica del botón de pago de Stripe

      doc.end();

      stream.on('finish', () => {
        console.log(`Final Invoice PDF generado: ${pdfPath}`);
        resolve(pdfPath);
      });
      stream.on('error', (err) => {
        console.error("Error al escribir el stream del PDF de Final Invoice:", err);
        reject(err);
      });

    } catch (error) {
      console.error("Error dentro de generateAndSaveFinalInvoicePDF:", error);
      reject(error);
    }
  });
}

module.exports = { generateAndSaveFinalInvoicePDF };