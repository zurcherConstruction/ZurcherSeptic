const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Importar desde archivos compartidos
const {
  pageMargin,
  NEW_PAGE_MARGIN,
  FONT_FAMILY_REGULAR,
  FONT_FAMILY_BOLD,
  FONT_FAMILY_MONO,
  FONT_FAMILY_MONO_BOLD,
  COLOR_TEXT_DARK,
  COLOR_TEXT_MEDIUM,
  COLOR_TEXT_LIGHT,
  COLOR_BORDER_LIGHT,
  COLOR_BACKGROUND_TABLE_HEADER
} = require('./shared/constants');

const { formatDateDDMMYYYY } = require('./shared/helpers');
const { title } = require('process');
// === CONFIGURACIÓN DE ITEMS INCLUIDOS ===

// 1. Items que aparecen SIEMPRE en todos los presupuestos
const DEFAULT_INCLUDED_ITEMS = [
  {
    name: "WARRANTY",
    description: "1 YEAR MANUFACTURER'S WARRANTY",
    qty: "1",
    rate: 0.00,
    amount: "INCLUDED"
  }
];

// 2. Items que aparecen SÓLO si se cumple una condición
const CONDITIONAL_INCLUDED_ITEMS = {
  // La clave (ej: "ATU") es lo que buscaremos en el nombre del item "System Type"
  "ATU": [

     {
      name: "KIT TANK ATU",
      description: "TREATMENT SYSTEM PANEL CONTROL/BLOW AIR",
      qty: "1",
      rate: 0.00,
      amount: "INCLUDED"
    },
    
    {
      name: "SERVICE MAINTENANCE CONTRACT",
      description: "2 YEAR CONTRACT WITH SERVICE EVERY 6 MONTHS",
      qty: "1",
      rate: 0.00,
      amount: "INCLUDED"
    }
   
  ],
  // Puedes agregar más reglas aquí, por ejemplo:
  // "REGULAR TANK": [ { ... otro item ... } ]
};


/**
 * Genera la lista final de items "incluidos" para el PDF.
 * @param {Array} lineItems - Los items principales del presupuesto.
 * @returns {Array} - Una lista combinada de items por defecto y condicionales.
 */
function _generateIncludedItems(lineItems = []) {
  // Empezamos con los items que siempre deben estar
  let finalItems = [...DEFAULT_INCLUDED_ITEMS];
  
  // Revisamos los items del presupuesto para ver si activan alguna condición
  lineItems.forEach(lineItem => {
    // ✅ BÚSQUEDA MÁS FLEXIBLE: Buscar "ATU" en el NOMBRE del item, sin importar la categoría
    if (lineItem.name) {
      for (const key in CONDITIONAL_INCLUDED_ITEMS) {
        if (lineItem.name.toUpperCase().includes(key.toUpperCase())) {
          // Si la clave "ATU" se encuentra, agregamos todos sus items a la lista final
          finalItems.push(...CONDITIONAL_INCLUDED_ITEMS[key]);
        }
      }
    }
  });

  return finalItems;
}

// === FUNCIONES INTERNAS EXACTAS DEL ORIGINAL ===

function _addPageHeader_v2(doc, budgetData, pageType, documentIdOrTitle, formattedDate, formattedExpirationDate) {
  const logoPath = path.join(__dirname, '../../assets/logo.png');
  const headerStartY = NEW_PAGE_MARGIN;
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;

  const { applicantName, propertyAddress, Permit, status, invoiceNumber, idBudget } = budgetData;
  
  // 🆕 DETERMINAR SI ES DRAFT O INVOICE DEFINITIVO
  const isDraft = status === 'draft' || status === 'pending_review' || !invoiceNumber;
  const documentNumber = isDraft ? idBudget : invoiceNumber;
  const documentLabel = isDraft ? 'BUDGET' : 'INVOICE';

  if (pageType === "INVOICE") {
    // --- INVOICE HEADER LOGIC (EXACTO DEL ORIGINAL) ---
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

    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(12).fillColor(COLOR_TEXT_DARK)
      .text("ZURCHER CONSTRUCTION", companyInfoX, currentYLeft, { width: companyInfoWidth });
    doc.font(FONT_FAMILY_MONO).fontSize(12).fillColor(COLOR_TEXT_MEDIUM);
    doc.text("SEPTIC TANK DIVISION - CFC1433240", companyInfoX, doc.y, { width: companyInfoWidth });
    doc.text("admin@zurcherseptic.com", companyInfoX, doc.y, { width: companyInfoWidth });
    doc.text("+1 (954) 636-8200", companyInfoX, doc.y, { width: companyInfoWidth });
    const finalYLeftTop = doc.y;

    let currentYRight = headerStartY + 5;
    // 🆕 USAR documentLabel (BUDGET o INVOICE) y documentNumber
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(20).fillColor('#063260')
      .text(`${documentLabel} #${documentNumber}`, invoiceInfoX, currentYRight, { width: invoiceInfoWidth, align: 'right' });
    currentYRight = doc.y + 45;

    // ✅ ALINEACIÓN PERFECTA - TODOS LOS TEXTOS EMPIEZAN EN LA MISMA POSICIÓN X
    doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);

    // ✅ DEFINIR POSICIÓN X FIJA PARA QUE TODOS LOS TEXTOS EMPIECEN IGUAL
    const dateTextStartX = invoiceInfoX + 120; // ✅ POSICIÓN FIJA donde empiezan TODOS los textos
    const dateTextWidth = invoiceInfoWidth - 50; // ✅ ANCHO restante desde esa posición

    // ✅ LÍNEA 1: DATE: - empieza en dateTextStartX
    doc.text("DATE:", dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
    currentYRight += doc.currentLineHeight() + 2;

    // ✅ LÍNEA 2: 06/03/2025 - empieza en dateTextStartX (misma posición que DATE:)
    doc.text(formattedDate, dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
    currentYRight += doc.currentLineHeight() + 4;

    // ✅ LÍNEA 3: DUE DATE: - empieza en dateTextStartX (misma posición)
    if (formattedExpirationDate && formattedExpirationDate !== 'N/A') {
      doc.text("DUE DATE:", dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
      currentYRight += doc.currentLineHeight() + 2;

      // ✅ LÍNEA 4: 07/03/2025 - empieza en dateTextStartX (misma posición)
      doc.text(formattedExpirationDate, dateTextStartX, currentYRight, { width: dateTextWidth, align: 'left' });
      currentYRight += doc.currentLineHeight();
    }

    // ✅ ACTUALIZAR doc.y para continuar desde aquí
    doc.y = currentYRight;
    const finalYRightTop = doc.y;
    doc.y = Math.max(finalYLeftTop, finalYRightTop) + 15;
    
    // --- Línea Divisora para INVOICE (antes de Customer/Work/Initial Payment) ---
    doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
      .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
    doc.moveDown(1);

    // --- Parte Inferior del Encabezado para INVOICE (Info Cliente, Ubicación, Pago Inicial) ---
    const { initialPaymentPercentage, initialPayment } = budgetData;
    const subHeaderStartY_Invoice = doc.y;
    const columnGap_Invoice = 15;
    const columnWidth_Invoice = (contentWidth - (2 * columnGap_Invoice)) / 3;

    const customerInfoX_Invoice = NEW_PAGE_MARGIN;
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
      .text("CUSTOMER INFO", customerInfoX_Invoice, subHeaderStartY_Invoice, { width: columnWidth_Invoice });
    doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
    // ✅ CONVERTIR A MAYÚSCULAS
    doc.text((applicantName || 'N/A').toUpperCase(), customerInfoX_Invoice, doc.y + 2, { width: columnWidth_Invoice });
    if (Permit?.applicantEmail) {
      // ✅ CONVERTIR EMAIL A MAYÚSCULAS
      doc.text(Permit.applicantEmail.toUpperCase(), customerInfoX_Invoice, doc.y, { width: columnWidth_Invoice });
    }
    const finalYCol1_Invoice = doc.y;

    doc.y = subHeaderStartY_Invoice;
    const workLocationX_Invoice = customerInfoX_Invoice + columnWidth_Invoice + columnGap_Invoice;
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
      .text("WORK LOCATION", workLocationX_Invoice, subHeaderStartY_Invoice, { width: columnWidth_Invoice });
    doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
    doc.text((propertyAddress || 'N/A').toUpperCase(), workLocationX_Invoice, doc.y + 2, { width: columnWidth_Invoice });

    const finalYCol2_Invoice = doc.y;

    let finalYCol3_Invoice = subHeaderStartY_Invoice;
    doc.y = subHeaderStartY_Invoice;
    const additionalOffset = 20; // Ajusta este valor según qué tanto quieras moverlo a la derecha
    const initialPaymentX_Invoice = workLocationX_Invoice + columnWidth_Invoice + columnGap_Invoice + additionalOffset;
    if (initialPaymentPercentage !== undefined && initialPayment !== undefined) {
      doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
        .text("INITIAL PAYMENT", initialPaymentX_Invoice, subHeaderStartY_Invoice, { width: columnWidth_Invoice });
      doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
      const percentageText = parseFloat(initialPaymentPercentage) === 100 ? "TOTAL" : `${parseFloat(initialPaymentPercentage)}% REQUIRE TO START`;
      doc.text(percentageText, initialPaymentX_Invoice, doc.y + 2, { width: columnWidth_Invoice });
      doc.text(`$${parseFloat(initialPayment).toFixed(2)}`, initialPaymentX_Invoice, doc.y, { width: columnWidth_Invoice });
    }
    finalYCol3_Invoice = doc.y;

    doc.y = Math.max(finalYCol1_Invoice, finalYCol2_Invoice, finalYCol3_Invoice);
    //✅ AGREGAR LÍNEA DIVISORIA DEBAJO DE LAS TRES COLUMNAS
    doc.moveDown(1); // Espacio antes de la línea
    doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
      .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
    doc.moveDown(1); // Espacio después de la línea antes de la tabla

  } else if (pageType === "TERMS") {
    // ✅ AJUSTAR POSICIONES PARA ALINEACIÓN CORRECTA
    const leftBlockWidth_Terms = contentWidth * 0.50;  // Columna izquierda (empresa)
    const rightBlockX_Terms = NEW_PAGE_MARGIN + leftBlockWidth_Terms + 100; // ✅ ESPACIO CORRECTO
    const rightBlockWidth_Terms = contentWidth * 0.45; // ✅ ANCHO FIJO para el cliente

    // ✅ POSICIÓN ORIGINAL DE LA EMPRESA (MÁS ARRIBA)
    let currentYLeft_Terms = headerStartY; // ✅ EMPEZAR DESDE headerStartY (posición original)
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, NEW_PAGE_MARGIN, currentYLeft_Terms, { width: 70 });
      currentYLeft_Terms += 80; // ✅ ESPACIO DESPUÉS DEL LOGO
    } else {
      // Si no hay logo, empezar con el texto de la empresa
      currentYLeft_Terms = headerStartY;
    }

    // ✅ INFORMACIÓN DE LA EMPRESA (izquierda) - POSICIÓN ORIGINAL
    doc.font(FONT_FAMILY_BOLD).fontSize(12).fillColor(COLOR_TEXT_DARK) // ✅ TAMAÑO ORIGINAL
      .text("ZURCHER CONSTRUCTION", NEW_PAGE_MARGIN, currentYLeft_Terms, { width: leftBlockWidth_Terms });
    doc.font(FONT_FAMILY_REGULAR).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
    doc.text("SEPTIC TANK DIVISION - CFC1433240", NEW_PAGE_MARGIN, doc.y, { width: leftBlockWidth_Terms });
    doc.text("admin@zurcherseptic.com", NEW_PAGE_MARGIN, doc.y, { width: leftBlockWidth_Terms });
    doc.text("+1 (954) 636-8200", NEW_PAGE_MARGIN, doc.y, { width: leftBlockWidth_Terms });
    const finalYLeft_Terms = doc.y;

    // ✅ INFORMACIÓN DEL CLIENTE (derecha) - POSICIÓN ACTUAL CORRECTA
    let currentYRight_Terms = headerStartY + 60; // ✅ MANTENER POSICIÓN ACTUAL
    doc.font(FONT_FAMILY_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
      .text("CUSTOMER INFO", rightBlockX_Terms, currentYRight_Terms, { width: rightBlockWidth_Terms });
    doc.font(FONT_FAMILY_REGULAR).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
    
    // ✅ NOMBRE DEL CLIENTE
    doc.text((applicantName || 'N/A').toUpperCase(), rightBlockX_Terms, doc.y + 2, { 
      width: rightBlockWidth_Terms,
      continued: false
    });

    doc.moveDown(0.8); // Espacio entre Customer Info y Work Location

    // ✅ WORK LOCATION CON SALTO DE LÍNEA AUTOMÁTICO
    doc.font(FONT_FAMILY_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK)
      .text("WORK LOCATION", rightBlockX_Terms, doc.y, { width: rightBlockWidth_Terms });
    doc.font(FONT_FAMILY_REGULAR).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
    
    // ✅ DIRECCIÓN CON SALTO DE LÍNEA EN COMAS Y PUNTOS
    let formattedAddress = (propertyAddress || 'N/A').toUpperCase();
    
    // ✅ REEMPLAZAR COMAS Y PUNTOS CON SALTOS DE LÍNEA
    formattedAddress = formattedAddress
      .replace(/,\s*/g, '\n')  // Reemplazar comas (con o sin espacio) con salto de línea
      .replace(/\.\s*/g, '\n'); // Reemplazar puntos (con o sin espacio) con salto de línea
    
    doc.text(formattedAddress, rightBlockX_Terms, doc.y + 2, { 
      width: rightBlockWidth_Terms,
      continued: false
    });
    
    const finalYRight_Terms = doc.y;

    // ✅ USAR LA Y MÁS BAJA ENTRE LAS DOS COLUMNAS
    doc.y = Math.max(finalYLeft_Terms, finalYRight_Terms) + 2;

    // --- Línea Divisora para TERMS ---
    doc.moveDown(1);
    doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(doc.page.width - NEW_PAGE_MARGIN, doc.y)
      .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.7).stroke();
    doc.moveDown(1);

    // --- Título Principal para TERMS ---
    let termsPageTitle = "TERMS AND CONDITIONS ACCEPTANCE AGREEMENT FOR THE INSTALLATION OF A SEPTIC SYSTEM";
    if (documentIdOrTitle && documentIdOrTitle.includes("(Cont.)")) {
      termsPageTitle += " (Cont.)";
    }
    doc.font(FONT_FAMILY_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK)
      .text(termsPageTitle, NEW_PAGE_MARGIN, doc.y, {
        width: contentWidth,
        align: 'left',
        underline: true
      });
  }
  // Espacio común después del contenido del encabezado, antes de que comience el contenido principal de la página
  doc.moveDown(2);
}

async function _buildInvoicePage_v2(doc, budgetData, formattedDate, formattedExpirationDate, clientEmailFromPermit) {
  _addPageHeader_v2(doc, budgetData, "INVOICE", budgetData.idBudget, formattedDate, formattedExpirationDate);
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;
  const {
    lineItems = [],
    totalPrice,
    initialPaymentPercentage,
    initialPayment,
    discountAmount,
    discountDescription
  } = budgetData;

  // --- Item Table ---
  const tableTop = doc.y;
  const cellPadding = 5;

  const colIncludedW = contentWidth * 0.20;
  const colDescW = contentWidth * 0.40;
  const colQtyW = contentWidth * 0.08;
  const colRateW = contentWidth * 0.12;
  const colAmountW = contentWidth * 0.15;

  const xIncludedText = NEW_PAGE_MARGIN + cellPadding;
  const xDescText = NEW_PAGE_MARGIN + colIncludedW + cellPadding;
  const xQtyText = NEW_PAGE_MARGIN + colIncludedW + colDescW + cellPadding;
  const xRateText = NEW_PAGE_MARGIN + colIncludedW + colDescW + colQtyW + cellPadding;
  const xAmountText = NEW_PAGE_MARGIN + colIncludedW + colDescW + colQtyW + colRateW + cellPadding;

  const wIncluded = colIncludedW - (2 * cellPadding);
  const wDesc = colDescW - (2 * cellPadding);
  const wQty = colQtyW - (2 * cellPadding);
  const wRate = colRateW - (2 * cellPadding);
  const wAmount = colAmountW - (2 * cellPadding);
  const tableHeaderRightEdge = doc.page.width - NEW_PAGE_MARGIN;

  // Table Header
  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK);
  const headerY = tableTop;
  doc.rect(NEW_PAGE_MARGIN, headerY - 3, contentWidth, 18)
    .fillColor(COLOR_BACKGROUND_TABLE_HEADER).strokeColor(COLOR_BORDER_LIGHT).fillAndStroke();
  doc.fillColor(COLOR_TEXT_DARK);
  doc.text('INCLUDED', xIncludedText, headerY + 2, { width: wIncluded });
  doc.text('DESCRIPTION', xDescText, headerY + 2, { width: wDesc });
  doc.text('QTY', xQtyText, headerY + 2, { width: wQty, align: 'right' });
  doc.text('RATE', xRateText, headerY + 2, { width: wRate, align: 'right' });
  doc.text('AMOUNT', xAmountText, headerY + 2, { width: wAmount, align: 'right' });
  doc.font(FONT_FAMILY_MONO);
  doc.y = headerY + 18;
  doc.moveDown(0.5);

  doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);

  // FUNCIÓN CHECKPAGEBREAK OPTIMIZADA
  const checkPageBreak = (estimatedHeight = 50) => {
    const availableSpace = doc.page.height - NEW_PAGE_MARGIN - 25;
    if (doc.y + estimatedHeight > availableSpace) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN;
      doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
    }
  };

  let currentItemY;

  // ======================================================================
  // ▼▼▼ LÓGICA CORREGIDA ▼▼▼
  // ======================================================================

  // ✅ 1. MOSTRAR EL ITEM PRINCIPAL CON EL PRECIO TOTAL
  const mainItemName = "SEPTIC SYSTEM INSTALLATION";
  const mainItemDesc = "COMPLETE INSTALLATION OF THE SYSTEM (LABOR AND MATERIALS)";
  const mainItemQty = 1;
  const mainItemRate = parseFloat(totalPrice);

  currentItemY = doc.y;
  doc.text(mainItemName, xIncludedText, currentItemY, { width: wIncluded });
  doc.text(mainItemDesc, xDescText, currentItemY, { width: wDesc });
  doc.text(mainItemQty.toFixed(0), xQtyText, currentItemY, { width: wQty, align: 'right' });
  doc.text(`$${mainItemRate.toFixed(2)}`, xRateText, currentItemY, { width: wRate, align: 'right' });
  doc.text(`$${mainItemRate.toFixed(2)}`, xAmountText, currentItemY, { width: wAmount, align: 'right' });
  doc.moveDown(3.5);

  // ✅ 2. FUNCIÓN PARA ORDENAR ITEMS SEGÚN EL ORDEN DESEADO
  function getItemSortOrder(item) {
    const name = (item.name || '').toUpperCase();
    const category = (item.category || '').toUpperCase();
    
    // Orden específico para septic system
   
    if (name.includes('TANK') || category.includes('TANK')) return 1;
    if (name.includes('ATU') && (name.includes('KIT') || name.includes('TREATMENT'))) return 2;
    if (name.includes('CHAMBER') || category.includes('CHAMBER')) return 3;
    if (name.includes('SYSTEM PARTS') || name.includes('ELECTRICAL') || category.includes('ELECTRICAL')) return 4;
    if (name.includes('EXCAVATION') || category.includes('EXCAVATION')) return 5;
    if (name.includes('SAND') || category.includes('SAND')) return 6;
    if (name.includes('DIRT') || name.includes('COVER') || category.includes('DIRT')) return 7;
    if (name.includes('ROCK') || name.includes('REMOVAL') || category.includes('ROCK')) return 8;
    if (name.includes('INSPECTION') || category.includes('INSPECTION')) return 9;
    if (name.includes('WARRANTY') || category.includes('WARRANTY')) return 10;
    if (name.includes('SERVICE') || name.includes('MAINTENANCE') || category.includes('SERVICE')) return 11;
    
    // Cualquier otro item va al final
    return 99;
  }

  // 2. Render each line item in the correct order
  if (lineItems && lineItems.length > 0) {
    const filteredAndSortedItems = lineItems
      .filter(item => {
        const name = item.name?.toUpperCase() || '';
        return name !== 'ZURCHER CONSTRUCTION' && name !== 'LABOR FEE' && item.name !== 'END CAP';
      })
      .sort((a, b) => getItemSortOrder(a) - getItemSortOrder(b));

    filteredAndSortedItems.forEach((item) => {
      const itemQty = parseInt(item.quantity) || 1;
      let fullDescription = item.name || 'N/A';
      if (item.description && item.description.trim() !== '') {
        fullDescription += ` - ${item.description}`;
      }
      if (item.marca && item.marca.trim() !== '') {
        fullDescription += ` [Marca: ${item.marca}]`;
      }
      if (item.capacity && item.capacity.trim() !== '') {
        fullDescription += ` [Capacidad: ${item.capacity}]`;
      }
      const estimatedItemHeight = Math.max(doc.heightOfString(fullDescription, { width: wDesc }), 25);
      checkPageBreak(estimatedItemHeight);
      currentItemY = doc.y;
      doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
      doc.text((item.name || 'Component').toUpperCase(), xIncludedText, currentItemY, { width: wIncluded });
      const yBeforeDesc = doc.y;
      doc.text(item.description, xDescText, currentItemY, { width: wDesc });
      const yAfterDesc = doc.y;
      doc.text(itemQty.toString(), xQtyText, currentItemY, { width: wQty, align: 'right' });
      doc.text("$0.00", xRateText, currentItemY, { width: wRate, align: 'right' });
      doc.font(FONT_FAMILY_MONO_BOLD).text("INCLUDED", xAmountText, currentItemY, { width: wAmount, align: 'right' });
      doc.font(FONT_FAMILY_MONO);
      doc.y = yAfterDesc;
      doc.moveDown(3.0);

      // ✅ SI ES UN TANK ATU, INMEDIATAMENTE DESPUÉS RENDERIZAR EL KIT
      // ✅ COMPARACIÓN CASE-INSENSITIVE para category
      if (item.category && item.category.toUpperCase() === 'SYSTEM TYPE' && item.name && item.name.toUpperCase().includes('ATU')) {
        // Buscar el KIT en los items incluidos y renderizarlo aquí
        const kitItem = CONDITIONAL_INCLUDED_ITEMS["ATU"]?.find(conditionalItem => 
          conditionalItem.name.toUpperCase().includes('KIT')
        );
        
        if (kitItem) {
          const estimatedKitHeight = doc.heightOfString(kitItem.description, { width: wDesc });
          const estimatedRowHeight = Math.max(estimatedKitHeight + 20, 35);
          checkPageBreak(estimatedRowHeight);

          currentItemY = doc.y;
          doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
          doc.text(kitItem.name.toUpperCase(), xIncludedText, currentItemY, { width: wIncluded });
          
          const yBeforeKitDesc = doc.y;
          doc.text(kitItem.description, xDescText, currentItemY, { width: wDesc });
          const yAfterKitDesc = doc.y;

          doc.text(kitItem.qty.toString(), xQtyText, currentItemY, { width: wQty, align: 'right' });
          doc.text(`$${kitItem.rate.toFixed(2)}`, xRateText, currentItemY, { width: wRate, align: 'right' });
          doc.font(FONT_FAMILY_MONO_BOLD).text(kitItem.amount, xAmountText, currentItemY, { width: wAmount, align: 'right' });
          doc.font(FONT_FAMILY_MONO);

          doc.y = yAfterKitDesc;
          doc.moveDown(3.0);
        }
      }
    });
  }

  // ✅ 3. GENERAR Y MOSTRAR ITEMS INCLUIDOS ADICIONALES (Warranty, Service Maintenance, etc.)
  // PERO EXCLUIR SOLO EL KIT SI YA SE RENDERIZÓ CON EL TANK ATU
  const includedItems = _generateIncludedItems(budgetData.lineItems);
  // ✅ COMPARACIÓN CASE-INSENSITIVE para category
  const hasATUTank = budgetData.lineItems?.some(item => 
    item.category && item.category.toUpperCase() === 'SYSTEM TYPE' && item.name && item.name.toUpperCase().includes('ATU')
  );

  if (includedItems && includedItems.length > 0) {
    includedItems.forEach(item => {
      // ✅ SOLO SALTAR EL KIT (que ya se renderizó arriba), PERO NO EL SERVICE MAINTENANCE CONTRACT
      if (hasATUTank && item.name.toUpperCase().includes('KIT') && !item.name.toUpperCase().includes('SERVICE') && !item.name.toUpperCase().includes('MAINTENANCE')) {
        return; // Saltar solo el KIT TANK ATU
      }

      const estimatedDescHeight = doc.heightOfString(item.description, { width: wDesc });
      const estimatedRowHeight = Math.max(estimatedDescHeight + 20, 35);
      checkPageBreak(estimatedRowHeight);

      currentItemY = doc.y;
      doc.font(FONT_FAMILY_MONO).fontSize(10).fillColor(COLOR_TEXT_MEDIUM);
      doc.text(item.name.toUpperCase(), xIncludedText, currentItemY, { width: wIncluded });
      
      const yBeforeDesc = doc.y;
      doc.text(item.description, xDescText, currentItemY, { width: wDesc });
      const yAfterDesc = doc.y;

      doc.text(item.qty.toString(), xQtyText, currentItemY, { width: wQty, align: 'right' });
      doc.text(`$${item.rate.toFixed(2)}`, xRateText, currentItemY, { width: wRate, align: 'right' });
      doc.font(FONT_FAMILY_MONO_BOLD).text(item.amount, xAmountText, currentItemY, { width: wAmount, align: 'right' });
      doc.font(FONT_FAMILY_MONO);

      doc.y = yAfterDesc;
      doc.moveDown(3.0);
    });
  }

  // ======================================================================
  // ▲▲▲ FIN DE LA LÓGICA CORREGIDA ▲▲▲
  // ======================================================================

  // Línea final de la tabla
  doc.moveTo(NEW_PAGE_MARGIN, doc.y).lineTo(tableHeaderRightEdge, doc.y)
    .strokeColor(COLOR_BORDER_LIGHT).lineWidth(0.5).stroke();
  doc.moveDown(2.0);


  // ✅ VERIFICACIÓN ANTES DE SECCIÓN DE TOTALES
  const totalsSectionHeightEstimate = 200;
  if (doc.y + totalsSectionHeightEstimate > doc.page.height - NEW_PAGE_MARGIN - 30) {
    doc.addPage();
    doc.y = NEW_PAGE_MARGIN;
  }

  const thankYouAndPaymentInfoY = doc.y;
  const paymentInfoWidth = contentWidth * 0.55;

  doc.font(FONT_FAMILY_MONO_BOLD).fontSize(10).fillColor(COLOR_TEXT_LIGHT)
    .text("Thank you for your business!", NEW_PAGE_MARGIN, doc.y, { width: contentWidth, align: 'left' });
  doc.moveDown(1.8);

  // 🆕 DETERMINAR SI ES DRAFT O INVOICE (calcular antes de usar)
  const isDraft = budgetData.status === 'draft' || budgetData.status === 'pending_review' || !budgetData.invoiceNumber;

  // ✅ MOSTRAR PAYMENT INFORMATION SOLO SI YA ESTÁ APROBADO (NO ES DRAFT)
  if (!isDraft) {
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
    doc.moveDown(1.5);
  }

  const yAfterPaymentInfo = doc.y;

  doc.y = thankYouAndPaymentInfoY;

  // SECCIÓN DE TOTALES - ALINEACIÓN PERFECTA
  const totalsStartX = NEW_PAGE_MARGIN + contentWidth * 0.55; // ✅ POSICIÓN FIJA para TODAS las etiquetas
  const totalsValueX = NEW_PAGE_MARGIN + contentWidth * 0.78; // ✅ MOVIDO A LA IZQUIERDA para números grandes
  const totalsRightEdge = doc.page.width - NEW_PAGE_MARGIN;

  let currentTotalY = doc.y;

  const discountNum = parseFloat(discountAmount || 0);
  const priceAfterDiscountAlreadyApplied = parseFloat(totalPrice || 0);
  const subtotalBruto = priceAfterDiscountAlreadyApplied + discountNum;

  // ✅ SUBTOTAL - empieza en totalsStartX
  doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
  doc.text("SUBTOTAL", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
  doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
  doc.text(`$${subtotalBruto.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
  doc.moveDown(0.6);

  // ✅ DISCOUNT (si existe) - empieza en totalsStartX
  if (discountNum > 0) {
    currentTotalY = doc.y;
    doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor('#DC2626'); // 🔴 Rojo para el descuento
    const discountLabel = discountDescription ? `${discountDescription.toUpperCase()}` : "DISCOUNT";
    // Hacer wrap del label si es muy largo
    doc.text(discountLabel, totalsStartX, currentTotalY, {
      width: totalsValueX - totalsStartX - cellPadding,
      align: 'left',
      continued: false // Importante para que TAX y TOTAL bajen
    });
    // El monto siempre alineado a la derecha, en la misma línea que termina el label
    const discountLabelHeight = doc.heightOfString(discountLabel, { width: totalsValueX - totalsStartX - cellPadding });
    doc.text(`-$${discountNum.toFixed(2)}`, totalsValueX, currentTotalY, {
      width: totalsRightEdge - totalsValueX,
      align: 'right',
      continued: false
    });
    // Avanzar y dejar espacio después del label largo
    doc.y = currentTotalY + discountLabelHeight;
    doc.moveDown(0.2);
  }

  // ✅ TAX - empieza en totalsStartX
  currentTotalY = doc.y;
  doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
  doc.text("TAX", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
  doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
  doc.text(`$0.00`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
  doc.moveDown(0.6);

  // ✅ TOTAL - empieza en totalsStartX
  currentTotalY = doc.y;
  doc.font(FONT_FAMILY_MONO).fontSize(11).fillColor(COLOR_TEXT_MEDIUM);
  doc.text("TOTAL", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
  doc.font(FONT_FAMILY_MONO).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
  doc.text(`$${priceAfterDiscountAlreadyApplied.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
  doc.moveDown(0.8);

  // ✅ LÍNEA DIVISORIA - empieza en totalsStartX y va hasta el borde derecho
  const lineY = doc.y;
  doc.moveTo(totalsStartX, lineY)
    .lineTo(totalsRightEdge, lineY)
    .strokeColor(COLOR_BORDER_LIGHT)
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(1.2); // ✅ ESPACIO DESPUÉS DE LA LÍNEA

  // ✅ CALCULAR VALORES PARA INITIAL PAYMENT
  const initialPaymentPct = budgetData.initialPaymentPercentage || 100;
  const initialPaymentAmt = budgetData.initialPayment || priceAfterDiscountAlreadyApplied;
  const percentageText = parseFloat(initialPaymentPct) === 100 
    ? "INITIAL PAYMENT (TOTAL)" 
    : `INITIAL PAYMENT (${parseFloat(initialPaymentPct)}%)`;

  if (isDraft) {
    // ✅ EN BUDGET (DRAFT): BALANCE DUE ES PROMINENTE Y RESALTADO
    currentTotalY = doc.y;
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(12).fillColor(COLOR_TEXT_DARK);
    doc.text("BALANCE DUE", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(14).fillColor(COLOR_TEXT_DARK);
    doc.text(`$${priceAfterDiscountAlreadyApplied.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
    doc.moveDown(0.8);

    // ✅ INITIAL PAYMENT - TEXTO PEQUEÑO Y MENOS PROMINENTE
    currentTotalY = doc.y;
    doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
    doc.text(percentageText, totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
    doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
    doc.text(`$${parseFloat(initialPaymentAmt).toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
  } else {
    // ✅ EN INVOICE: BALANCE DUE ES TEXTO PEQUEÑO
    currentTotalY = doc.y;
    doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
    doc.text("BALANCE DUE", totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
    doc.font(FONT_FAMILY_MONO).fontSize(9).fillColor(COLOR_TEXT_MEDIUM);
    doc.text(`$${priceAfterDiscountAlreadyApplied.toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
    doc.moveDown(0.8);

    // ✅ INITIAL PAYMENT - PROMINENTE Y RESALTADO
    currentTotalY = doc.y;
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(12).fillColor(COLOR_TEXT_DARK);
    doc.text(percentageText, totalsStartX, currentTotalY, { width: totalsValueX - totalsStartX - cellPadding, align: 'left' });
    doc.font(FONT_FAMILY_MONO_BOLD).fontSize(14).fillColor(COLOR_TEXT_DARK);
    doc.text(`$${parseFloat(initialPaymentAmt).toFixed(2)}`, totalsValueX, currentTotalY, { width: totalsRightEdge - totalsValueX, align: 'right' });
  }

  const yAfterTotals = doc.y;
  doc.y = Math.max(yAfterPaymentInfo, yAfterTotals);
  doc.moveDown(2);

  // STRIPE PAYMENT BUTTON (con 3% fee) - SOLO PARA INVOICES DEFINITIVOS
  let paymentLinkUrl = null;
  const paymentAmountForStripe = parseFloat(initialPaymentAmt);
  const paymentAmountWithFee = Math.round(paymentAmountForStripe * 1.03 * 100); // suma el 3% y convierte a centavos

  if (!isDraft && paymentAmountForStripe > 0 && process.env.STRIPE_SECRET_KEY) {
    try {
      const frontendBaseUrl = (process.env.FRONTEND_URL || 'https://www.zurcherseptic.com').replace(/\/$/, '');
      const thankYouUrl = `${frontendBaseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}&source=stripe`;

      // Crear producto y precio en Stripe
      const product = await stripe.products.create({
        name: `Invoice #${budgetData.invoiceNumber || budgetData.idBudget} - ${budgetData.applicantName}`,
        metadata: { 
          internal_budget_id: budgetData.idBudget.toString(), 
          payment_type: 'invoice_payment',
          invoice_number: budgetData.invoiceNumber || budgetData.idBudget.toString()
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
          description: `Initial payment for Invoice #${budgetData.invoiceNumber || budgetData.idBudget}`,
          metadata: {
            internal_budget_id: budgetData.idBudget.toString(),
            payment_type: 'invoice_payment',
            invoice_number: budgetData.invoiceNumber || budgetData.idBudget.toString()
          }
        },
        metadata: { 
          internal_budget_id: budgetData.idBudget.toString(), 
          payment_type: 'invoice_payment',
          invoice_number: budgetData.invoiceNumber || budgetData.idBudget.toString()
        }
      });
      
      paymentLinkUrl = paymentLink.url;
    } catch (stripeError) {
      console.error("Stripe payment link creation error for invoice:", stripeError);
    }
  }

  if (paymentLinkUrl) {
    const buttonWidth = 200;
    const buttonHeight = 28;
    const buttonX = NEW_PAGE_MARGIN + (contentWidth - buttonWidth) / 2;
    let buttonY = doc.y;

    if (buttonY + buttonHeight + 40 > doc.page.height - NEW_PAGE_MARGIN) {
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
}

function _buildTermsAndConditionsPage_v2(doc, budgetData, formattedDate, formattedExpirationDate, isDraft = false) {
  _addPageHeader_v2(doc, budgetData, "TERMS", "TERMS_AND_CONDITIONS", formattedDate, formattedExpirationDate);
  const contentWidth = doc.page.width - NEW_PAGE_MARGIN * 2;

  // Texto inicial "Considering that:"
  doc.font(FONT_FAMILY_BOLD).fontSize(10).fillColor(COLOR_TEXT_DARK).text('Considering that:', NEW_PAGE_MARGIN, doc.y);
  doc.moveDown(0.5);
  doc.font(FONT_FAMILY_REGULAR).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
  const consideringText = `The Provider specializes in the installation of septic systems and offers these services in compliance with all applicable technical and legal regulations. The Client is interested in contracting the Provider for the installation of a septic system on the property located at: ${budgetData.propertyAddress || '____________________________'}. Both parties wish to formalize the terms and conditions under which the service will be provided.`;
  doc.text(consideringText, NEW_PAGE_MARGIN, doc.y, { width: contentWidth, align: 'justify' });
  doc.moveDown(1);

  // Texto "The following is hereby agreed:"
  doc.font(FONT_FAMILY_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK).text('The following is hereby agreed:', NEW_PAGE_MARGIN, doc.y);
  doc.moveDown(0.5);

  const termsSections = [
    {
      number: "1.",
      title: "Acceptance of Terms and Conditions",
      content: "The Client declares to have read, understood, and accepted the terms and conditions set forth in this agreement. Acceptance of these terms is mandatory for the provision of the septic system installation service."
    },
    {
      number: "2.",
      title: "Scope of Work:",
      subtitle: "The Provider agrees to:",
      bulletPoints: [
        "Install the septic system according to the approved plans and local regulatory standards.",
        "Supply all labor, materials, and equipment necessary for the installation.",
        "Conduct functionality tests upon completion to ensure the system operates correctly."
      ],
      subtitle2: "The Provider does not include, unless expressly agreed in writing:",
      bulletPoints2: [
        "Electrical work, landscaping, irrigation, fencing, or removal of trees/sod.",
        "Additional engineering tests (such as percolation or soil tests).",
        "Haul-off of debris beyond what is standard for the installation.",
        "Damage repairs to driveways, walkways, sprinklers, cables, or unmarked underground lines."
      ]
    },
    {
      number: "3.",
      title: "Client's Obligations:",
      subtitle: "The Client agrees to:",
      bulletPoints: [
        "Provide full access to the property and keep the area clear of debris or obstructions.",
        "Supply any required documents (e.g., site plan, floor plan) to facilitate permitting or inspection.",
        "Be responsible for any unmarked private underground lines.",
        "Obtain required permits, unless otherwise agreed in writing.",
        "Avoid parking or placing heavy loads on the system area after installation, as this may cause system failure and void the warranty."
      ]
    },
    {
      number: "4.",
      title: "Payment Terms:",
      bulletPoints: [
        "A 60% deposit is required prior to the start of work.",
        "The remaining 40% must be paid immediately after the initial inspection has been passed and the work has been covered by our team.",
        "Permit fees must be paid in advance and are non-refundable."
      ]
    },
    {
      number: "5.",
      title: "Execution Timeline:",
      content: "Work will begin on the agreed-upon date, subject to weather conditions or delays beyond the Provider's control. In the event of encountering unsuitable soil or rock conditions, additional charges may apply and will be discussed with the Client before proceeding."
    },
    {
      number: "6.",
      title: "Change Orders and Additional Work:",
      content: "Any changes to the scope of work requested by the Client must be agreed upon in writing through a Change Order. Additional work beyond the agreed scope will be billed at the Provider's standard rates."
    },
    {
      number: "7.",
      title: "Lift Station and Additional Costs:",
      bulletPoints: [
        "If a gravity flow system cannot be achieved and a lift station is required for the system installation, a lift station, pump, and audiovisual alarm will be installed for a cost of $2,750.",
        "This cost does not include sod installation or any electrical work required to power the lift station, if applicable.",
      ],
      subtitle2: "Price Changes and Notification:",
      bulletPoints2: [
        "Due to market volatility and material availability, prices are subject to change.",
        "If a price adjustment is necessary, a written notification will be provided prior to starting any additional work with the updated pricing.",
      ]
    },
    {
      number: "8.",
      title: "Warranty:",
      content: "The installation of the drainfield is covered by a one (1) year limited warranty from the date of the initial inspection, provided the system is used in accordance with the conditions established in the health department permit. Component parts are subject to the manufacturer's warranty. Damage caused by misuse, neglect, or unauthorized modifications will void the warranty."
    },
    {
      number: "9.",
      title: "Limitation of Liability:",
      subtitle: "The Provider is not responsible for:",
      bulletPoints: [
        "Any damage to landscaping, private utility lines, or other structures caused during standard installation work.",
        "Any direct, indirect, incidental, or consequential damages resulting from the use or misuse of the installed septic system.",
        "The system's performance if affected by external factors such as surface water, improper use, or lack of maintenance."
      ]
    },
    {
      number: "10.",
      title: "Contract Termination:",
      subtitle: "This agreement may be terminated:",
      bulletPoints: [
        "By mutual consent of both parties.",
        "By either party, in the event of material breach, with written notice.",
        "By the Client, at any time, with written notice; however, the Client shall be responsible for payment for all work completed and costs incurred up to the cancellation date."
      ]
    },
     {
      number: "11.",
      title: "Additional Material Costs (if not included)",
      content: "In the event that soil and sand are not included in this invoice, the Client understands and accepts that additional materials may be required to complete the work after the inspection. The estimated cost per truckload is as follows:",
      bulletPoints: [
        "Soil: between $250 and $300, depending on the location of the project.",
        "Sand: between $370 and $450, depending on the location of the project."
      ]
    },
    {
      title: "NOTE:",
      content: "Attorneys' Fees and Costs. In the event of any dispute, claim, or litigation arising out of, or related in any way to, this Agreement or the transaction contemplated herein, the prevailing party shall be entitled to recover from the non-prevailing party all attorneys' fees, court costs, expert witness fees, and expenses actually incurred, whether before or after the filing of a lawsuit, and including any appeals, arbitration, mediation, or bankruptcy proceedings."
    },
    { 
      // Este no tiene número, solo título y contenido.
      title: "Client Acknowledgment:",
      content: "By signing this agreement, the Client authorizes the Provider to proceed with the work and agrees to comply with all terms and conditions outlined herein."
    }
  ];

  const checkPageBreak = (estimatedHeight) => {
    if (doc.y + estimatedHeight > doc.page.height - NEW_PAGE_MARGIN - 100) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN;
      return true;
    }
    return false;
  };

  termsSections.forEach((section, index) => {
    let estimatedHeight = 40;
    if (section.content) estimatedHeight += doc.heightOfString(section.content, { width: contentWidth });
    if (section.bulletPoints) estimatedHeight += section.bulletPoints.length * 15; // Rough estimate
    if (section.bulletPoints2) estimatedHeight += section.bulletPoints2.length * 15; // Rough estimate

     checkPageBreak(estimatedHeight);

    doc.font(FONT_FAMILY_BOLD).fontSize(9).fillColor(COLOR_TEXT_DARK);
    // Imprime el número solo si existe en el objeto
    const titleText = section.number ? `${section.number} ${section.title}` : section.title;
    doc.text(titleText, NEW_PAGE_MARGIN, doc.y, { width: contentWidth });
    doc.moveDown(0.3);

    if (section.content) {
      doc.font(FONT_FAMILY_REGULAR).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
      doc.text(section.content, NEW_PAGE_MARGIN, doc.y, { width: contentWidth, align: 'justify' });
      doc.moveDown(0.8);
    }

    if (section.subtitle) {
      doc.font(FONT_FAMILY_BOLD).fontSize(8).fillColor(COLOR_TEXT_DARK);
      doc.text(section.subtitle, NEW_PAGE_MARGIN, doc.y, { width: contentWidth, underline: true });
      doc.moveDown(0.3);
    }

    if (section.bulletPoints) {
      doc.font(FONT_FAMILY_REGULAR).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
      section.bulletPoints.forEach(point => {
        const pointTextHeight = doc.heightOfString(point, { width: contentWidth - 15 });
        checkPageBreak(pointTextHeight + 5); // +5 for bullet and small margin

        const currentY = doc.y; // Guardar Y actual
        doc.text("•", NEW_PAGE_MARGIN, currentY, { width: 10, continued: false }); // Dibujar bullet
        doc.text(point, NEW_PAGE_MARGIN + 15, currentY, { width: contentWidth - 15, align: 'justify' }); // Dibujar texto en la misma Y
        // doc.y se actualiza automáticamente a después del texto más largo (el punto)
        doc.moveDown(0.4);
      });
      doc.moveDown(0.4);
    }

    if (section.subtitle2) {
      doc.font(FONT_FAMILY_BOLD).fontSize(8).fillColor(COLOR_TEXT_DARK);
      doc.text(section.subtitle2, NEW_PAGE_MARGIN, doc.y, { width: contentWidth, underline: true });
      doc.moveDown(0.3);
    }

    if (section.bulletPoints2) {
      doc.font(FONT_FAMILY_REGULAR).fontSize(8).fillColor(COLOR_TEXT_MEDIUM);
      section.bulletPoints2.forEach(point => {
        const pointTextHeight = doc.heightOfString(point, { width: contentWidth - 15 });
        checkPageBreak(pointTextHeight + 5);

        const currentY = doc.y; // Guardar Y actual
        doc.text("•", NEW_PAGE_MARGIN, currentY, { width: 10, continued: false }); // Dibujar bullet
        doc.text(point, NEW_PAGE_MARGIN + 15, currentY, { width: contentWidth - 15, align: 'justify' }); // Dibujar texto en la misma Y
        doc.moveDown(0.4);
      });
    }
    doc.moveDown(0.8);
  });

  // ✅ CÓDIGO REDUNDANTE ELIMINADO DE AQUÍ. El "Client Acknowledgment" ya se imprime con el bucle de arriba.

  // 🆕 SECCIÓN DE FIRMA: Solo mostrar si NO es draft
  if (!isDraft) {
    let signatureY = doc.y + 20;
    if (signatureY + 80 > doc.page.height - NEW_PAGE_MARGIN) {
      doc.addPage();
      doc.y = NEW_PAGE_MARGIN;
      signatureY = doc.y + 20;
    }
    doc.y = signatureY;

    const sigFieldWidth = (contentWidth / 2) - 10;
    const sigLineFullWidth = sigFieldWidth - 80;
    const dateLineFullWidth = sigFieldWidth - 110;

    doc.font(FONT_FAMILY_REGULAR).fontSize(8).fillColor(COLOR_TEXT_DARK);

    let currentLineY = doc.y;
    doc.text("Client Signature:", NEW_PAGE_MARGIN, currentLineY, { width: 75 });
    doc.moveTo(NEW_PAGE_MARGIN + 75, currentLineY + 8).lineTo(NEW_PAGE_MARGIN + 75 + sigLineFullWidth, currentLineY + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();

    doc.text("Date:", NEW_PAGE_MARGIN + sigFieldWidth + 10, currentLineY, { width: 30 });
    doc.moveTo(NEW_PAGE_MARGIN + sigFieldWidth + 10 + 30, currentLineY + 8)
      .lineTo(NEW_PAGE_MARGIN + sigFieldWidth + 10 + 30 + dateLineFullWidth, currentLineY + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
    doc.moveDown(2.5);

    currentLineY = doc.y;
    doc.text("Provider Representative:", NEW_PAGE_MARGIN, currentLineY, { width: 110 });
    doc.moveTo(NEW_PAGE_MARGIN + 110, currentLineY + 8)
      .lineTo(NEW_PAGE_MARGIN + 110 + (sigLineFullWidth - 30), currentLineY + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();

    doc.text("Date:", NEW_PAGE_MARGIN + sigFieldWidth + 10, currentLineY, { width: 30 });
    doc.moveTo(NEW_PAGE_MARGIN + sigFieldWidth + 10 + 30, currentLineY + 8)
      .lineTo(NEW_PAGE_MARGIN + sigFieldWidth + 10 + 30 + dateLineFullWidth, currentLineY + 8)
      .strokeColor(COLOR_TEXT_DARK).lineWidth(0.5).stroke();
    doc.moveDown(1.5);
  }
}

// --- FUNCIÓN PRINCIPAL ---
async function generateAndSaveBudgetPDF(budgetData) {
  return new Promise(async (resolve, reject) => {
    try {
      const { idBudget, date, expirationDate, Permit } = budgetData;
      const clientEmailFromPermit = Permit?.applicantEmail;
      const formattedDate = formatDateDDMMYYYY(date);
      const formattedExpirationDate = formatDateDDMMYYYY(expirationDate);

      const doc = new PDFDocument({ autoFirstPage: false, margin: pageMargin, size: 'A4' });
      const uploadsDir = path.join(__dirname, '../../uploads/budgets');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const pdfPath = path.join(uploadsDir, `budget_${idBudget}.pdf`);
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // --- PÁGINA 1: INVOICE ESTILIZADA ---
      doc.addPage();
      await _buildInvoicePage_v2(doc, budgetData, formattedDate, formattedExpirationDate, clientEmailFromPermit);

      // 🆕 Determinar si es DRAFT o INVOICE
      const isDraft = budgetData.status === 'draft' || budgetData.status === 'pending_review' || !budgetData.invoiceNumber;

      // --- PÁGINA 2: TÉRMINOS Y CONDICIONES ESTILIZADOS ---
      doc.addPage();
      _buildTermsAndConditionsPage_v2(doc, budgetData, formattedDate, formattedExpirationDate, isDraft);

      doc.end();

      stream.on('finish', () => {
        console.log(`PDF de paquete de presupuesto generado: ${pdfPath}`);
        resolve(pdfPath);
      });
      stream.on('error', (err) => {
        console.error("Error al escribir el stream del PDF del paquete de presupuesto:", err);
        reject(err);
      });

    } catch (error) {
      console.error("Error dentro de generateAndSaveBudgetPDF (multi-página):", error);
      reject(error);
    }
  });
}

module.exports = { generateAndSaveBudgetPDF };