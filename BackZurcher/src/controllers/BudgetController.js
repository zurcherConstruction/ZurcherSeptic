const { Budget, Permit, Work, Income, BudgetItem, BudgetLineItem, Receipt, Staff, BudgetNote, conn, sequelize } = require('../data');
const { Op, literal } = require('sequelize'); 
const { cloudinary } = require('../utils/cloudinaryConfig.js');
const { sendNotifications } = require('../utils/notifications/notificationManager.js');
const { createDepositTransaction } = require('../utils/bankTransactionHelper');
const fs = require('fs');
const multer = require('multer');
const upload = multer();
const path = require('path');
const { sendEmail } = require('../utils/notifications/emailService.js');
const { generateAndSaveBudgetPDF } = require('../utils/pdfGenerators');
const SignNowService = require('../services/ServiceSignNow');
const DocuSignService = require('../services/ServiceDocuSign'); // 🆕 DOCUSIGN
const { getNextInvoiceNumber } = require('../utils/invoiceNumberManager'); // 🆕 HELPER DE NUMERACIÓN UNIFICADA
const ExcelJS = require('exceljs'); // 🆕 Para exportar a Excel
require('dotenv').config();

// 🆕 Variable de configuración para elegir servicio de firma
const USE_DOCUSIGN = process.env.USE_DOCUSIGN === 'true'; // true = DocuSign, false = SignNow

// AGREGAR esta función auxiliar después de los imports:
function getPublicPdfUrl(localPath, req) {
  if (!localPath) return null;



  // Extraer la parte relativa de la ruta
  const relativePath = localPath.replace(path.join(__dirname, '../'), '');

  // ✅ USAR API_URL en lugar de BACKEND_URL
  const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
  const publicUrl = `${baseUrl}/${relativePath.replace(/\\/g, '/')}`;



  return publicUrl;
}

const BudgetController = {
  async createBudget(req, res) {
    const transaction = await conn.transaction();
    let newBudgetId = null; // Variable para guardar el ID fuera del try/catch principal

    try {
      console.log("--- Iniciando createBudget (Backend PDF Gen) ---");
      // ... (Extracción de req.body, validaciones, búsqueda de Permit) ...
      const {
        permitId, date, expirationDate, status = 'draft', discountDescription,
        discountAmount = 0, generalNotes, initialPaymentPercentage: initialPaymentPercentageInput, lineItems,
        leadSource, createdByStaffId, // 🆕 Campos de origen y vendedor interno
        externalReferralName, externalReferralEmail, externalReferralPhone, // 🆕 Campos de referido externo
        externalReferralCompany, customCommissionAmount // 🆕 Empresa y comisión personalizada
      } = req.body;

      if (!permitId) throw new Error('permitId es requerido.');
      if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
        throw new Error('Se requiere al menos un item en lineItems.');
      }

      console.log(`[createBudget] Buscando Permit ID: ${permitId}`);
      const permit = await Permit.findByPk(permitId, {
        attributes: ['idPermit', 'propertyAddress', 'applicantEmail', 'applicantName', 'lot', 'block'], // Incluir campos necesarios
        transaction
      });
      if (!permit) throw new Error(`Permit con ID ${permitId} no encontrado.`);

      // --- Procesar Items y Calcular Subtotal ---
      let calculatedSubtotal = 0;
      const lineItemsDataForCreation = [];
      for (const incomingItem of lineItems) {
        console.log("Procesando incomingItem:", incomingItem);
        const quantityNum = parseFloat(incomingItem.quantity);
        if (isNaN(quantityNum) || quantityNum <= 0) {
          console.error("Error de validación de cantidad:", incomingItem);
          throw new Error(`Item inválido: quantity (${incomingItem.quantity}) debe ser un número positivo.`);
        }
        let itemDataForCreation = {
          quantity: quantityNum,
          notes: incomingItem.notes || null,
          marca: incomingItem.marca || null,
          capacity: incomingItem.capacity || null,
          description: null,
          supplierName: incomingItem.supplierName || null, // ✅ AGREGAR SUPPLIERNAME
        };
        let priceAtTime = 0;
        if (incomingItem.budgetItemId) {
          console.log(`[createBudget] Buscando BudgetItem ID: ${incomingItem.budgetItemId}`);
          const budgetItemDetails = await BudgetItem.findByPk(incomingItem.budgetItemId, { transaction });
          if (!budgetItemDetails || !budgetItemDetails.isActive) throw new Error(`Item base ID ${incomingItem.budgetItemId} no encontrado o inactivo.`);
          priceAtTime = parseFloat(budgetItemDetails.unitPrice);
          itemDataForCreation.budgetItemId = incomingItem.budgetItemId;
          itemDataForCreation.name = incomingItem.name || budgetItemDetails.name;
          itemDataForCreation.category = incomingItem.category || budgetItemDetails.category;
          itemDataForCreation.description = incomingItem.description || budgetItemDetails.description || null;
          // ✅ Priorizar supplierName del incoming (puede ser seleccionado manualmente), sino del catálogo
          if (incomingItem.supplierName) {
            itemDataForCreation.supplierName = incomingItem.supplierName;
          } else if (budgetItemDetails.supplierName) {
            itemDataForCreation.supplierName = budgetItemDetails.supplierName;
          }
        } else if (incomingItem.name && incomingItem.category && incomingItem.unitPrice !== undefined) {
          const manualPrice = parseFloat(incomingItem.unitPrice);
          if (isNaN(manualPrice) || manualPrice < 0) throw new Error(`Item manual inválido (${incomingItem.name}): unitPrice debe ser un número no negativo.`);
          priceAtTime = manualPrice;
          itemDataForCreation.budgetItemId = null;
          itemDataForCreation.name = incomingItem.name;
          itemDataForCreation.category = incomingItem.category;
          itemDataForCreation.description = incomingItem.description || null;
        } else {
          console.error("Datos insuficientes para item:", incomingItem);
          throw new Error(`Item inválido: falta info (budgetItemId o name/category/unitPrice).`);
        }
        itemDataForCreation.unitPrice = priceAtTime;
        itemDataForCreation.priceAtTimeOfBudget = priceAtTime;
        itemDataForCreation.lineTotal = priceAtTime * itemDataForCreation.quantity;
        calculatedSubtotal += parseFloat(itemDataForCreation.lineTotal || 0);
        lineItemsDataForCreation.push(itemDataForCreation);
      }
      console.log(`${lineItemsDataForCreation.length} items procesados. Subtotal calculado: ${calculatedSubtotal}`);
      const finalDiscount = parseFloat(discountAmount) || 0;
      const finalTotal = calculatedSubtotal - finalDiscount;

      let actualPercentage = 60;
      if (initialPaymentPercentageInput === 'total') {
        actualPercentage = 100;
      } else {
        const parsedPercentage = parseFloat(initialPaymentPercentageInput);
        if (!isNaN(parsedPercentage)) {
          actualPercentage = parsedPercentage;
        }
      }
      console.log(`Porcentaje de pago inicial interpretado: ${actualPercentage}%`);
      const calculatedInitialPayment = finalTotal * (actualPercentage / 100);
      console.log(`Totales calculados: Subtotal=${calculatedSubtotal}, Total=${finalTotal}, InitialPayment=${calculatedInitialPayment}`);

     let commission = 0;
     let finalTotalWithCommission = finalTotal;

if (leadSource === 'sales_rep' && createdByStaffId) {
  // Usar comisión manual si fue enviada desde el frontend, sino leer del staff, sino $500
  if (customCommissionAmount !== undefined && customCommissionAmount !== null && parseFloat(customCommissionAmount) >= 0) {
    commission = parseFloat(customCommissionAmount);
  } else {
    const salesRep = await Staff.findByPk(createdByStaffId, { attributes: ['salesRepCommission'], transaction });
    commission = parseFloat(salesRep?.salesRepCommission) || 500;
  }
  finalTotalWithCommission = finalTotal + commission;
  console.log(`Presupuesto con vendedor interno - Trabajo: $${finalTotal} + Comisión: $${commission} = Total cliente: $${finalTotalWithCommission}`);
} else if (leadSource === 'external_referral') {
  // Referido externo - monto variable
  commission = parseFloat(customCommissionAmount) || 0;
  finalTotalWithCommission = finalTotal + commission;
  console.log(`Presupuesto con referido externo - Trabajo: $${finalTotal} + Comisión: $${commission} = Total cliente: $${finalTotalWithCommission}`);
}

      console.log(`[createBudget] Intentando Budget.create, status: "${status}", leadSource: "${leadSource}"`);
      const newBudget = await Budget.create({
        PermitIdPermit: permit.idPermit,
        date: date || new Date().toISOString().split('T')[0],
        expirationDate: expirationDate || null,
        status,
        discountDescription,
        discountAmount: finalDiscount,
        generalNotes,
        initialPaymentPercentage: actualPercentage,
        applicantName: permit.applicantName,
        applicantEmail: permit.applicantEmail, // 🆕 Copiar email desde Permit
        contactCompany: req.body.contactCompany || null, // 🆕 Empresa/contacto referente
        propertyAddress: permit.propertyAddress,
        subtotalPrice: calculatedSubtotal,
        totalPrice: finalTotalWithCommission,
        initialPayment: finalTotalWithCommission * (actualPercentage / 100),
        leadSource: leadSource || 'web',
        createdByStaffId: createdByStaffId || null,
        // 🆕 Campos de referido externo
        externalReferralName: leadSource === 'external_referral' ? externalReferralName : null,
        externalReferralEmail: leadSource === 'external_referral' ? externalReferralEmail : null,
        externalReferralPhone: leadSource === 'external_referral' ? externalReferralPhone : null,
        externalReferralCompany: leadSource === 'external_referral' ? externalReferralCompany : null,
        salesCommissionAmount: commission, // ✅ FIX: Guardar comisión para ambos tipos (sales_rep: 500, external: customCommissionAmount)
        clientTotalPrice: finalTotalWithCommission,
        commissionAmount: commission, // Universal para ambos tipos
        commissionPaid: false,
      }, { transaction });
      newBudgetId = newBudget.idBudget;
      console.log(`Budget base creado con ID: ${newBudgetId}. Estado: ${status}`);

      // --- Crear BudgetLineItems ---
      const createdLineItemsForPdf = [];
      for (const itemDataForCreation of lineItemsDataForCreation) {
        itemDataForCreation.budgetId = newBudgetId;
        const createdItem = await BudgetLineItem.create(itemDataForCreation, { transaction });
        createdLineItemsForPdf.push(createdItem.toJSON());
      }
      console.log(`${lineItemsDataForCreation.length} BudgetLineItems creados.`);

      await transaction.commit();
      console.log(`--- Transacción principal para crear Budget ID ${newBudgetId} confirmada. ---`);

      // ✅ RESPONDER INMEDIATAMENTE AL FRONTEND SIN ESPERAR PDF NI EMAILS
      // Volver a buscar para obtener los datos completos para la respuesta
      const finalBudgetResponseData = await Budget.findByPk(newBudgetId, {
        include: [
          { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] },
          { model: BudgetLineItem, as: 'lineItems' }
        ]
      });

      if (!finalBudgetResponseData) {
        throw new Error('No se pudo recuperar el presupuesto recién creado para la respuesta.');
      }

      const responseData = finalBudgetResponseData.toJSON();
      
      // Añadir URLs dinámicas
      if (responseData.Permit) {
        const baseUrl = `${req.protocol}://${req.get('host')}/permits`;
        responseData.Permit.pdfDataUrl = `${baseUrl}/${responseData.Permit.idPermit}/view/pdf`;
        responseData.Permit.optionalDocsUrl = `${baseUrl}/${responseData.Permit.idPermit}/view/optional`;
      }

      // ✅ RESPONDER INMEDIATAMENTE - PDF se generará en background
      console.log(`Enviando respuesta exitosa para Budget ID ${newBudgetId} - PDF se generará en background`);
      res.status(201).json({
        ...responseData,
        message: 'Presupuesto creado exitosamente. El PDF se está generando en segundo plano.',
        budgetPdfUrl: `${req.protocol}://${req.get('host')}/budgets/${newBudgetId}/pdf`
      });

      // ✅ GENERAR PDF Y ENVIAR NOTIFICACIONES EN BACKGROUND (NO BLOQUEAR RESPUESTA)
      setImmediate(async () => {
          try {
            console.log(`🔄 Iniciando proceso en background para Budget ID ${newBudgetId}...`);
          
          // Necesitamos los datos completos del budget recién creado
          const budgetForPdf = await Budget.findByPk(newBudgetId, {
            attributes: [
              'idBudget', 'propertyAddress', 'applicantName', 'date', 'expirationDate',
              'initialPayment', 'status', 'paymentInvoice', 'paymentProofType',
              'discountDescription', 'discountAmount', 'subtotalPrice', 'totalPrice',
              'generalNotes', 'pdfPath', 'PermitIdPermit', 'createdAt', 'updatedAt',
              'initialPaymentPercentage'
            ],
            include: [
              { 
                model: Permit, 
                attributes: [
                  'idPermit', 'propertyAddress', 'applicantEmail', 'applicantName', 
                  'permitNumber', 'lot', 'block', 
                  'ppiCloudinaryUrl', 'ppiGeneratedPath', 'ppiInspectorType', // 🆕 Campos PPI
                  'ppiSignatureStatus', 'ppiSignedAt', 'ppiSignedPdfUrl', 'ppiSignedPdfPublicId' // 🆕 Campos PPI firmado
                ] 
              }
            ]
          });

          if (!budgetForPdf) {
            throw new Error("No se encontró el budget para generar PDF en background.");
          }

          const budgetDataForPdf = {
            ...budgetForPdf.toJSON(),
            lineItems: createdLineItemsForPdf
          };

          console.log(`📄 Generando PDF para Budget ID ${newBudgetId}...`);
          const generatedPdfPath = await generateAndSaveBudgetPDF(budgetDataForPdf);
          
          // ✅ CONVERTIR RUTA LOCAL A URL PÚBLICA
          const pdfPublicUrl = getPublicPdfUrl(generatedPdfPath, req);
          console.log(`✅ PDF generado: ${generatedPdfPath}`);
          console.log(`🔗 URL pública: ${pdfPublicUrl}`);

          // Actualizar el registro Budget con la URL pública
          await budgetForPdf.update({ pdfPath: pdfPublicUrl });
          console.log(`💾 Ruta del PDF actualizada para Budget ID ${newBudgetId}`);

          // ✅ PREPARAR Y ENVIAR NOTIFICACIONES
          const attachments = [];
          const attachmentsForClient = []; // 🆕 Separar adjuntos para cliente
          let ppiPath = null; // 🆕 Declarar aquí para disponibilidad posterior
          const permit = budgetForPdf.Permit; // 🆕 Obtener Permit desde budgetForPdf
          
          if (generatedPdfPath && fs.existsSync(generatedPdfPath)) {
            const budgetAttachment = {
              filename: `Budget_${newBudgetId}.pdf`,
              path: generatedPdfPath,
              contentType: 'application/pdf'
            };
            attachments.push(budgetAttachment); // Para notificaciones internas
            attachmentsForClient.push(budgetAttachment); // 🆕 Para cliente también
          }
          
          // 🆕 Adjuntar PPI solo para notificaciones internas (NO para cliente)
          if (permit) {
            const ppiUrl = permit.ppiCloudinaryUrl || permit.ppiGeneratedPath;
            if (ppiUrl) {
              ppiPath = null; // Reinicializar
              
              // Si es URL de Cloudinary, descargar temporalmente
              if (ppiUrl.startsWith('http')) {
                console.log(`☁️  Descargando PPI desde Cloudinary para notificación INTERNA: ${ppiUrl}`);
                const axios = require('axios');
                const path = require('path');
                const uploadsDir = path.join(__dirname, '../uploads/temp');
                
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }
                
                try {
                  const response = await axios.get(ppiUrl, { responseType: 'arraybuffer' });
                  ppiPath = path.join(uploadsDir, `ppi_notification_${permit.idPermit}_${Date.now()}.pdf`);
                  fs.writeFileSync(ppiPath, response.data);
                  console.log(`✅ PPI descargado para notificación INTERNA: ${ppiPath}`);
                } catch (downloadError) {
                  console.error(`❌ Error descargando PPI:`, downloadError.message);
                }
              } else if (fs.existsSync(ppiUrl)) {
                ppiPath = ppiUrl;
              }
              
              if (ppiPath) {
                const ppiFilename = `PPI_${permit.ppiInspectorType || 'inspection'}_Permit_${permit.idPermit}.pdf`;
                // ✅ SOLO agregar a notificaciones internas, NO a cliente
                attachments.push({
                  filename: ppiFilename,
                  path: ppiPath,
                  contentType: 'application/pdf'
                });
                console.log(`📎 PPI adjuntado SOLO para notificaciones INTERNAS: ${ppiFilename}`);
                console.log(`ℹ️  PPI NO se enviará al cliente (solo Budget PDF)`);
              }
            }
          }

          const budgetLink = "https://www.zurcherseptic.com/budgets";
          const notificationDetails = {
            propertyAddress: permit?.propertyAddress || budgetForPdf.propertyAddress,
            idBudget: newBudgetId,
            applicantEmail: permit?.applicantEmail || null,
            budgetLink,
            attachments
          };

          console.log(`📧 Enviando notificaciones para Budget ID ${newBudgetId}...`);
          await sendNotifications('budgetCreated', notificationDetails, null, req.io);
          console.log(`✅ Proceso en background completado para Budget ID ${newBudgetId}`);

          // 🆕 Limpiar archivo PPI temporal si existe
          if (ppiPath && ppiPath.includes('/temp/') && fs.existsSync(ppiPath)) {
            try {
              fs.unlinkSync(ppiPath);
              console.log(`🗑️  PPI temporal eliminado: ${ppiPath}`);
            } catch (cleanupError) {
              console.warn(`⚠️  No se pudo eliminar PPI temporal:`, cleanupError.message);
            }
          }

        } catch (backgroundError) {
          console.error(`❌ Error en proceso background para Budget ID ${newBudgetId}:`, backgroundError);
          
          // ✅ ENVIAR NOTIFICACIÓN DE ERROR AL STAFF
          try {
            const errorNotificationDetails = {
              propertyAddress: permit.propertyAddress,
              idBudget: newBudgetId,
              error: backgroundError.message,
              applicantEmail: permit.applicantEmail || null
            };
            await sendNotifications('budgetPdfError', errorNotificationDetails, null, req.io);
          } catch (notifError) {
            console.error(`❌ Error enviando notificación de error:`, notifError);
          }
        }
      });

    } catch (error) {
      console.error("Error FATAL durante createBudget:", error.message);
      console.error("[createBudget] Error code:", error.original?.code || error.code);
      console.error("[createBudget] Error detail:", error.original?.detail || error.detail);
      console.error("[createBudget] Stack:", error.stack?.split('\n').slice(0, 5).join('\n'));
      // Revertir si la transacción principal no terminó
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
          console.log("Transacción principal de createBudget revertida.");
        } catch (rollbackError) {
          console.error("Error al intentar revertir la transacción:", rollbackError);
        }
      }
      const errorMessage = error.errors?.map(e => e.message).join(', ') || error.message || 'Error al crear el presupuesto.';
      res.status(400).json({ error: errorMessage });
    }
  },

  async sendBudgetToSignNow(req, res) {
    const { idBudget } = req.params;
    const transaction = await conn.transaction();

    try {
      console.log('\n🚀 === INICIANDO ENVÍO DE BUDGET A SIGNNOW ===');
      console.log(`📋 ID Presupuesto: ${idBudget}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log(`👤 Usuario solicitante: ${req.user?.email || 'No identificado'}`);

      // Buscar el presupuesto con información del solicitante
      console.log('🔍 Buscando presupuesto en la base de datos...');
      const budget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['applicantEmail', 'applicantName', 'propertyAddress']
        }],
        transaction
      });

      if (!budget) {
        console.error(`❌ ERROR: Presupuesto ${idBudget} no encontrado`);
        await transaction.rollback();
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      console.log('✅ Presupuesto encontrado:');
      console.log(`   - ID: ${budget.idBudget}`);
      console.log(`   - PDF Path: ${budget.pdfPath}`);
      console.log(`   - Status: ${budget.status}`);
      console.log(`   - Permit Data:`, budget.Permit);

      // Verificar que el PDF existe
      if (!budget.pdfPath) {
        console.error('❌ ERROR: No hay PDF generado para este presupuesto');
        await transaction.rollback();
        return res.status(400).json({
          error: true,
          message: 'No hay PDF generado para este presupuesto. Genere el PDF primero.'
        });
      }

      let localPdfPath;
      if (budget.pdfPath.startsWith('http')) {
        const pdfFileName = budget.pdfPath.split('/').pop();
        // Asumiendo que los PDFs de presupuestos se guardan en 'uploads/budgets'
        localPdfPath = path.join(__dirname, '..', 'uploads', 'budgets', pdfFileName);
        console.log(`ℹ️  URL de PDF convertida a ruta local: ${localPdfPath}`);
      } else {
        localPdfPath = budget.pdfPath; // Ya es una ruta local
        console.log(`ℹ️  Usando ruta de PDF local existente: ${localPdfPath}`);
      }

      // Verificar que el archivo PDF existe físicamente, si no, generarlo
      if (!fs.existsSync(localPdfPath)) {
        console.warn(`⚠️  ADVERTENCIA: Archivo PDF no existe en la ruta: ${localPdfPath}`);
        console.log('🔄 Generando PDF antes de enviar a SignNow...');
        
        try {
          const regeneratedPdfPath = await generateAndSaveBudgetPDF(budget.toJSON());
          console.log(`✅ PDF regenerado exitosamente: ${regeneratedPdfPath}`);
          
          // Actualizar la ruta del PDF en la base de datos
          await budget.update({ pdfPath: regeneratedPdfPath }, { transaction });
          
          // Actualizar localPdfPath para usarlo en SignNow
          if (regeneratedPdfPath.startsWith('http')) {
            const newPdfFileName = regeneratedPdfPath.split('/').pop();
            localPdfPath = path.join(__dirname, '..', 'uploads', 'budgets', newPdfFileName);
          } else {
            localPdfPath = regeneratedPdfPath;
          }
        } catch (pdfError) {
          console.error('❌ ERROR al generar PDF:', pdfError);
          await transaction.rollback();
          return res.status(500).json({
            error: true,
            message: 'Error al generar el archivo PDF para firma'
          });
        }
      }

      console.log(`✅ Archivo PDF existe, tamaño: ${fs.statSync(localPdfPath).size} bytes`);

      // Verificar que existe información del solicitante
      if (!budget.Permit?.applicantEmail) {
        console.error('❌ ERROR: No se encontró email del solicitante');
        console.log('Datos del Permit:', budget.Permit);
        await transaction.rollback();
        return res.status(400).json({
          error: true,
          message: 'No se encontró email del solicitante en el permiso asociado'
        });
      }

      console.log('✅ Información del firmante:');
      console.log(`   - Email: ${budget.Permit.applicantEmail}`);
      console.log(`   - Nombre: ${budget.Permit.applicantName}`);
      console.log(`   - Dirección: ${budget.Permit.propertyAddress}`);

      // 🆕 PREPARAR ATTACHMENTS PARA EMAIL AL CLIENTE
      const attachmentsForClient = [];
      if (fs.existsSync(localPdfPath)) {
        const budgetAttachment = {
          filename: `Budget_${idBudget}.pdf`,
          path: localPdfPath,
          contentType: 'application/pdf'
        };
        attachmentsForClient.push(budgetAttachment);
      }

      // 📧 ENVIAR EMAIL AL CLIENTE CON PDF Y LINK DE PAGO
      console.log('📧 Enviando email al cliente con presupuesto y link de pago...');
      
      if (budget.Permit.applicantEmail.includes('@')) {
        const clientMailOptions = {
          to: budget.Permit.applicantEmail,
          subject: `Budget Proposal #${idBudget} for ${budget.Permit.propertyAddress || budget.propertyAddress}`,
          text: `Dear ${budget.Permit.applicantName || 'Customer'},\n\nPlease find attached the budget proposal #${idBudget} for the property located at ${budget.Permit.propertyAddress || budget.propertyAddress}.\n\nExpiration Date: ${budget.expirationDate ? new Date(budget.expirationDate).toLocaleDateString() : 'N/A'}\nTotal Amount: $${parseFloat(budget.totalPrice || 0).toFixed(2)}\nInitial Payment (${budget.initialPaymentPercentage || 60}%): $${parseFloat(budget.initialPayment || 0).toFixed(2)}\n\n${budget.generalNotes ? 'Notes:\n' + budget.generalNotes + '\n\n' : ''}NEXT STEPS:\n- Review the attached PDF carefully\n- You will receive a separate email from SignNow to digitally sign the document\n- After signing, you can proceed with the initial payment\n- If you have any questions, please contact us\n\nBest regards,\nZurcher Construction`,
          html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a365d; margin-bottom: 20px;">Budget Proposal Ready for Review</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Dear ${budget.Permit?.applicantName || 'Valued Customer'},
          </p>
          
          <p style="margin-bottom: 20px;">
            Please find attached your budget proposal <strong>#${idBudget}</strong> for the property located at <strong>${budget.Permit?.propertyAddress || budget.propertyAddress}</strong>.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">Budget Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Expiration Date:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${budget.expirationDate ? new Date(budget.expirationDate).toLocaleDateString() : 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Total Amount:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right; color: #28a745; font-weight: bold;">$${parseFloat(budget.totalPrice || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Initial Payment (${budget.initialPaymentPercentage || 60}%):</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #007bff; font-weight: bold;">$${parseFloat(budget.initialPayment || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          ${budget.generalNotes ? `
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <h4 style="color: #856404; margin-top: 0;">Additional Notes:</h4>
            <p style="margin-bottom: 0; color: #856404;">${budget.generalNotes}</p>
          </div>
          ` : ''}
          
          <div style="background-color: #e6f3ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #007bff;">
            <h3 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">📋 Next Steps:</h3>
            <div style="margin-bottom: 12px;">
              <span style="display: inline-block; width: 20px; color: #007bff;">1.</span>
              <strong>Review the attached PDF carefully</strong>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="display: inline-block; width: 20px; color: #007bff;">2.</span>
              <strong>Click the button below to digitally sign the document</strong>
            </div>
            <div style="margin-bottom: 12px;">
              <span style="display: inline-block; width: 20px; color: #007bff;">3.</span>
              <strong>After signing, you can proceed with the initial payment</strong>
            </div>
            <div style="margin-bottom: 0;">
              <span style="display: inline-block; width: 20px; color: #007bff;">4.</span>
              <strong>Contact us</strong> if you have any questions
            </div>
          </div>
          
          <!-- ✅ Botones de Acción -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.API_URL || 'https://zurcherapi.up.railway.app'}/budgets/${idBudget}/sign" 
               style="display: inline-block; background-color: #007bff; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px; font-size: 16px;">
              ✍️ Sign Document
            </a>
          </div>
          
          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
            💡 <strong>Note:</strong> The signature link is valid for 365 days. You can sign at your convenience.
          </p>
          
          <p style="margin-top: 30px; margin-bottom: 30px;">
            Thank you for choosing <strong>Zurcher Construction</strong>!
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #dee2e6; text-align: center;">
            <div style="color: #6c757d; font-size: 14px;">
              <strong style="color: #1a365d;">Zurcher Septic</strong><br>
              SEPTIC TANK DIVISION - CFC1433240<br>
              📧 Contact: [admin@zurcherseptic.com] | 📞 [+1 (407) 419-4495]<br>
              🌐 Professional Septic Installation & Maintenance
            </div>
          </div>
        </div>
      </div>
    `,
          // 🆕 Usar attachmentsForClient (solo Budget PDF, SIN PPI)
          attachments: attachmentsForClient,
        };

        try {
          console.log(`📧 Enviando email al cliente: ${budget.Permit.applicantEmail}`);
          console.log(`   ✅ Adjuntos: SOLO Budget PDF (${attachmentsForClient.length} archivo)`);
          console.log(`   ⛔ PPI NO incluido (solo se envía en notificaciones internas)`);
          const clientEmailResult = await sendEmail(clientMailOptions);
          
          if (clientEmailResult.success) {
            console.log(`✅ Email enviado exitosamente al cliente en ${clientEmailResult.duration}ms`);
          } else {
            console.error(`❌ Error al enviar email al cliente: ${clientEmailResult.error}`);
          }
        } catch (clientEmailError) {
          console.error(`❌ Error al enviar email al cliente ${budget.Permit.applicantEmail}:`, clientEmailError);
          // No fallar la operación, continuar con servicio de firma
        }
      }

      // 🆕 Inicializar servicio de firma (SignNow o DocuSign según configuración)
      const serviceName = USE_DOCUSIGN ? 'DocuSign' : 'SignNow';
      console.log(`🔧 Inicializando servicio ${serviceName}...`);
      
      const signatureService = USE_DOCUSIGN ? new DocuSignService() : new SignNowService();

      // Preparar información para el documento
      const propertyAddress = budget.Permit?.propertyAddress || budget.propertyAddress || 'Property';
      
      // ✅ USAR INVOICE NUMBER SI EXISTE, sino usar idBudget
      const documentIdentifier = budget.invoiceNumber 
        ? `Invoice_${budget.invoiceNumber}` 
        : `Budget_${budget.idBudget}`;
      
      const fileName = `${documentIdentifier}_${propertyAddress.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      console.log(`📁 Nombre del archivo para ${serviceName}: ${fileName}`);
      console.log(`📋 Tipo de documento: ${budget.invoiceNumber ? `Invoice #${budget.invoiceNumber}` : `Budget #${budget.idBudget}`}`);
      console.log(`📧 Cliente: ${budget.Permit.applicantEmail} - ${budget.Permit.applicantName}`);

      // Preparar subject y message para DocuSign
      const emailSubject = budget.invoiceNumber 
        ? `Please sign Invoice #${budget.invoiceNumber} - ${propertyAddress}`
        : `Please sign Budget for ${propertyAddress}`;
      
      const emailMessage = `Dear ${budget.Permit.applicantName || 'Valued Client'},\n\n` +
        `Please review and sign the attached ${budget.invoiceNumber ? 'invoice' : 'budget'} document.\n\n` +
        `${budget.generalNotes ? budget.generalNotes + '\n\n' : ''}` +
        `If you have any questions, please contact us.\n\n` +
        `Best regards,\nZurcher Construction`;

      // Enviar documento para firma (ambos servicios tienen el mismo método)
      console.log(`📤 Enviando documento a ${serviceName}...`);
      const signatureResult = USE_DOCUSIGN
        ? await signatureService.sendBudgetForSignature(
            localPdfPath,
            budget.Permit.applicantEmail,
            budget.Permit.applicantName || 'Valued Client',
            fileName,
            emailSubject,
            emailMessage
          )
        : await signatureService.sendBudgetForSignature(
            localPdfPath,
            fileName,
            budget.Permit.applicantEmail,
            budget.Permit.applicantName || 'Valued Client'
          );

      console.log(`✅ Resultado exitoso de ${serviceName}:`);
      console.log(JSON.stringify(signatureResult, null, 2));

      // Actualizar presupuesto con información del servicio de firma
      console.log('💾 Actualizando presupuesto en la base de datos...');
      const updateData = {
        signatureDocumentId: USE_DOCUSIGN ? signatureResult.envelopeId : signatureResult.documentId,
        signNowDocumentId: USE_DOCUSIGN ? null : signatureResult.documentId, // Mantener compatibilidad
        docusignEnvelopeId: USE_DOCUSIGN ? signatureResult.envelopeId : null, // 🆕 Guardar envelope ID específico
        signatureMethod: USE_DOCUSIGN ? 'docusign' : 'signnow',
        status: 'sent_for_signature',
        sentForSignatureAt: new Date()
      };

      console.log('Datos a actualizar:', updateData);

      await budget.update(updateData, { transaction });
      await transaction.commit();
      console.log('✅ Transacción confirmada');

      // Enviar notificación interna de que se envió para firma
      try {
        await sendNotifications('budgetSentToSignNow', {
          propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
          applicantEmail: budget.Permit.applicantEmail,
          applicantName: budget.Permit.applicantName,
          idBudget: budget.idBudget,
          documentId: updateData.signatureDocumentId,
          service: serviceName
        }, null, req.io, { userId: req.user?.id });
        console.log('📧 Notificaciones internas enviadas');
      } catch (notificationError) {
        console.log('⚠️ Error enviando notificaciones internas:', notificationError.message);
        // No fallar la operación principal por esto
      }

      const responseData = {
        error: false,
        message: `Presupuesto enviado a ${serviceName} exitosamente. El cliente recibirá un email para firmar el documento.`,
        data: {
          budgetId: budget.idBudget,
          documentId: updateData.signatureDocumentId,
          inviteId: USE_DOCUSIGN ? null : signatureResult.inviteId,
          envelopeId: USE_DOCUSIGN ? signatureResult.envelopeId : null,
          status: 'sent_for_signature',
          signerEmail: budget.Permit.applicantEmail,
          signerName: budget.Permit.applicantName,
          fileName: fileName,
          signatureMethod: updateData.signatureMethod,
          service: serviceName,
          sentAt: new Date().toISOString()
        }
      };

      console.log('📤 Enviando respuesta exitosa:');
      console.log(JSON.stringify(responseData, null, 2));
      console.log('=== FIN EXITOSO DE ENVÍO A SIGNNOW ===\n');

      res.status(200).json(responseData);

    } catch (error) {
      await transaction.rollback();
      console.log('\n💥 === ERROR FATAL EN ENVÍO A SIGNNOW ===');
      console.error('Error completo:', error);
      console.error('Stack trace:', error.stack);
      console.log('================================\n');

      res.status(500).json({
        error: true,
        message: 'Error interno del servidor',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // Verificar estado de firma del presupuesto
  async checkSignatureStatus(req, res) {
    const { idBudget } = req.params;

    try {
      console.log(`--- Verificando estado de firma para presupuesto ${idBudget} ---`);

      // Buscar el presupuesto
      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      // Verificar si tiene documento de firma (nuevo campo genérico o viejo SignNow)
      const documentId = budget.signatureDocumentId || budget.signNowDocumentId;
      
      if (!documentId) {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no ha sido enviado para firma',
          data: {
            budgetId: budget.idBudget,
            status: budget.status,
            isSigned: false
          }
        });
      }

      // 🆕 Determinar qué servicio usar según signatureMethod
      const isDocuSign = budget.signatureMethod === 'docusign';
      const serviceName = isDocuSign ? 'DocuSign' : 'SignNow';
      
      console.log(`🔍 Verificando en ${serviceName}...`);
      console.log(`📋 Document ID: ${documentId}`);

      // Inicializar el servicio correspondiente
      const signatureService = isDocuSign ? new DocuSignService() : new SignNowService();

      // Verificar estado del documento
      const signatureStatus = await signatureService.isDocumentSigned(documentId);

      console.log(`📊 Estado de firma en ${serviceName}:`, signatureStatus);

      // ✅ Si está firmado, descargar PDF y subir a Cloudinary (como hace el cron job)
      const isSigned = isDocuSign ? signatureStatus.signed : signatureStatus.isSigned;
      
      if (isSigned && budget.status !== 'signed' && budget.status !== 'approved') {
        console.log(`✅ Documento firmado detectado! Descargando y procesando...`);

        try {
          // 1. Descargar PDF firmado
          const path = require('path');
          const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'signed-budgets');
          
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const signedFileName = `Budget_${budget.idBudget}_signed_${Date.now()}.pdf`;
          const signedFilePath = path.join(uploadsDir, signedFileName);

          console.log(`📥 Descargando PDF firmado de ${serviceName}...`);
          await signatureService.downloadSignedDocument(documentId, signedFilePath);
          console.log(`✅ PDF descargado: ${signedFilePath}`);

          // 2. Subir a Cloudinary
          console.log(`☁️  Subiendo PDF firmado a Cloudinary...`);
          const cloudinary = require('cloudinary').v2;
          
          const uploadResult = await cloudinary.uploader.upload(signedFilePath, {
            folder: 'budgets/signed',
            resource_type: 'raw',
            public_id: `budget_${budget.idBudget}_signed`,
            overwrite: true
          });

          console.log(`✅ PDF subido a Cloudinary: ${uploadResult.secure_url}`);

          // 3. Actualizar presupuesto con URL de Cloudinary y estado
          await budget.update({
            status: 'signed',
            signedAt: new Date(),
            signedPdfPath: uploadResult.secure_url,
            signedPdfPublicId: uploadResult.public_id
          });

          console.log(`✅ Presupuesto ${budget.idBudget} actualizado a 'signed'`);

          // 4. Eliminar archivo local temporal
          try {
            fs.unlinkSync(signedFilePath);
            console.log(`🗑️  Archivo temporal eliminado`);
          } catch (cleanupError) {
            console.warn(`⚠️  No se pudo eliminar archivo temporal:`, cleanupError.message);
          }

          // 5. Enviar notificaciones
          try {
            await sendNotifications('budgetSigned', {
              idBudget: budget.idBudget,
              propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
              applicantName: budget.Permit?.applicantName || budget.applicantName,
              service: serviceName
            }, null, req.io);
            console.log(`📧 Notificaciones enviadas`);
          } catch (notifError) {
            console.warn(`⚠️  Error enviando notificaciones:`, notifError.message);
          }

        } catch (downloadError) {
          console.error(`❌ Error procesando documento firmado:`, downloadError);
          // Continuar y devolver respuesta aunque falle el procesamiento
        }
      }

      res.status(200).json({
        error: false,
        message: isSigned 
          ? 'Documento firmado detectado y procesado exitosamente' 
          : 'Estado de firma obtenido exitosamente',
        data: {
          budgetId: budget.idBudget,
          documentId: documentId,
          signatureMethod: budget.signatureMethod,
          service: serviceName,
          isSigned: isSigned,
          status: signatureStatus.status,
          signatures: signatureStatus.signatures || null,
          invites: signatureStatus.invites || null,
          statusDateTime: signatureStatus.statusDateTime || null,
          completedDateTime: signatureStatus.completedDateTime || null,
          currentBudgetStatus: isSigned ? 'signed' : budget.status,
          signedPdfPath: isSigned ? budget.signedPdfPath : null
        }
      });

    } catch (error) {
      console.error('❌ Error verificando estado de firma:', error);

      res.status(500).json({
        error: true,
        message: 'Error verificando estado de firma',
        details: error.message
      });
    }
  },

  // ✅ NUEVA FUNCIONALIDAD: Reenviar/Regenerar enlace de firma cuando expire
  async resendSignatureLink(req, res) {
    const { idBudget } = req.params;

    try {
      console.log('\n🔄 === REGENERANDO ENLACE DE FIRMA ===');
      console.log(`📋 ID Presupuesto: ${idBudget}`);

      // Buscar el presupuesto con información del solicitante
      const budget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['applicantEmail', 'applicantName', 'propertyAddress']
        }]
      });

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      // Verificar que tiene documento de firma
      const documentId = budget.signatureDocumentId || budget.signNowDocumentId;
      const envelopeId = budget.docusignEnvelopeId;
      
      if (!documentId && !envelopeId) {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no ha sido enviado para firma'
        });
      }

      // Solo funciona con DocuSign
      if (budget.signatureMethod !== 'docusign') {
        return res.status(400).json({
          error: true,
          message: 'La regeneración de enlace solo está disponible para documentos enviados con DocuSign. Para SignNow, el enlace en el correo original sigue siendo válido.'
        });
      }

      console.log(`📧 Cliente: ${budget.Permit?.applicantEmail} - ${budget.Permit?.applicantName}`);
      console.log(`📋 Envelope ID: ${envelopeId || documentId}`);

      // Inicializar servicio DocuSign
      const docuSignService = new DocuSignService();

      // Regenerar enlace de firma
      const result = await docuSignService.regenerateSigningLink(
        envelopeId || documentId,
        budget.Permit?.applicantEmail,
        budget.Permit?.applicantName || 'Valued Client'
      );

      console.log('✅ Enlace regenerado exitosamente');

      res.status(200).json({
        error: false,
        message: 'Enlace de firma regenerado exitosamente. El nuevo enlace es válido por 5-15 minutos desde el primer acceso.',
        data: {
          budgetId: budget.idBudget,
          envelopeId: result.envelopeId,
          status: result.status,
          signingUrl: result.signingUrl,
          signerEmail: budget.Permit?.applicantEmail,
          signerName: budget.Permit?.applicantName,
          expiresIn: result.expiresIn,
          regeneratedAt: result.regeneratedAt,
          note: 'Este enlace expirará después de 5-15 minutos de inactividad una vez abierto. Si expira nuevamente, puede regenerar el enlace cuantas veces sea necesario.'
        }
      });

    } catch (error) {
      console.error('❌ Error regenerando enlace de firma:', error);

      // Manejo específico para documentos enviados por email tradicional
      if (error.message && error.message.includes('email tradicional')) {
        return res.status(400).json({
          error: true,
          code: 'TRADITIONAL_EMAIL_ENVELOPE',
          message: 'No se puede regenerar el enlace de este documento',
          details: error.message,
          solution: 'El enlace original enviado por email de DocuSign es permanente y no expira. Por favor, revise su bandeja de entrada (o spam) y use el enlace del email de DocuSign.'
        });
      }

      res.status(500).json({
        error: true,
        message: 'Error al regenerar enlace de firma',
        details: error.message
      });
    }
  },

  // ✅ NUEVO: Verificar si un envelope soporta regeneración de enlace (tiene clientUserId)
  async checkEnvelopeSupport(req, res) {
    const { idBudget } = req.params;

    try {
      console.log('\n🔍 === VERIFICANDO SOPORTE DE ENVELOPE ===');
      console.log(`📋 ID Presupuesto: ${idBudget}`);

      const budget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['applicantEmail', 'applicantName']
        }]
      });

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      const envelopeId = budget.docusignEnvelopeId || budget.signatureDocumentId;
      
      if (!envelopeId || budget.signatureMethod !== 'docusign') {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no usa DocuSign'
        });
      }

      // Inicializar servicio DocuSign
      const docuSignService = new DocuSignService();
      await docuSignService.getAccessToken();

      // Obtener información del envelope
      const docusign = require('docusign-esign');
      const envelopesApi = new docusign.EnvelopesApi(docuSignService.apiClient);
      
      const envelope = await envelopesApi.getEnvelope(docuSignService.accountId, envelopeId);
      const recipients = await envelopesApi.listRecipients(docuSignService.accountId, envelopeId);
      
      const signer = recipients.signers?.find(s => 
        s.email.toLowerCase() === budget.Permit?.applicantEmail?.toLowerCase()
      );

      const supportsRegeneration = !!(signer && signer.clientUserId);

      console.log(`📊 Estado: ${envelope.status}`);
      console.log(`🔑 ClientUserId: ${signer?.clientUserId || 'NO CONFIGURADO'}`);
      console.log(`✅ Soporta regeneración: ${supportsRegeneration ? 'SÍ' : 'NO'}`);

      res.status(200).json({
        error: false,
        data: {
          budgetId: budget.idBudget,
          envelopeId: envelopeId,
          status: envelope.status,
          supportsRegeneration: supportsRegeneration,
          hasClientUserId: !!signer?.clientUserId,
          signerEmail: signer?.email,
          signerName: signer?.name,
          signerStatus: signer?.status,
          sentAt: envelope.sentDateTime,
          message: supportsRegeneration 
            ? 'Este documento soporta regeneración de enlaces' 
            : 'Este documento fue enviado con sistema antiguo. Use el enlace del email original o reenvíe con sistema nuevo.'
        }
      });

    } catch (error) {
      console.error('❌ Error verificando soporte de envelope:', error);
      res.status(500).json({
        error: true,
        message: 'Error al verificar envelope',
        details: error.message
      });
    }
  },

  // ✅ NUEVO: Reenviar documento con firma embebida (para documentos antiguos sin clientUserId)
  async resendWithEmbeddedSigning(req, res) {
    const { idBudget } = req.params;

    try {
      console.log('\n🔄 === REENVIANDO DOCUMENTO CON FIRMA EMBEBIDA ===');
      console.log(`📋 ID Presupuesto: ${idBudget}`);

      const budget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['applicantEmail', 'applicantName', 'propertyAddress']
        }]
      });

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      if (!budget.Permit?.applicantEmail) {
        return res.status(400).json({
          error: true,
          message: 'El presupuesto no tiene email del cliente'
        });
      }

      // Generar PDF del presupuesto
      console.log('📄 Generando PDF del presupuesto...');
      const pdfPath = await generateAndSaveBudgetPDF(budget.toJSON());

      // Enviar con DocuSign usando sistema de firma embebida
      console.log('📤 Enviando documento con firma embebida...');
      const docuSignService = new DocuSignService();

      const fileName = `Budget_${budget.invoiceNumber || budget.idBudget}.pdf`;
      const emailSubject = `Please sign your ${budget.invoiceNumber ? 'invoice' : 'budget'} - Zurcher Construction`;
      const emailMessage = `Dear ${budget.Permit.applicantName || 'Valued Client'},\n\n` +
        `Please review and sign the attached ${budget.invoiceNumber ? 'invoice' : 'budget'} document.\n\n` +
        `Best regards,\nZurcher Construction`;

      const signatureResult = await docuSignService.sendBudgetForSignature(
        pdfPath,
        budget.Permit.applicantEmail,
        budget.Permit.applicantName || 'Valued Client',
        fileName,
        emailSubject,
        emailMessage,
        false // ✅ Remote signing con clientUserId (soporta regeneración)
      );

      console.log('✅ Documento enviado exitosamente');

      // Actualizar presupuesto con nuevo envelope ID
      await budget.update({
        signatureDocumentId: signatureResult.envelopeId,
        docusignEnvelopeId: signatureResult.envelopeId,
        signatureMethod: 'docusign',
        signatureSentAt: new Date(),
        signatureStatus: 'pending'
      });

      console.log('💾 Presupuesto actualizado con nuevo envelope');

      // Enviar correo con botón de firma
      console.log('📧 Enviando correo con enlace de firma...');
      const EmailService = require('../services/EmailService');
      const frontendUrl = process.env.FRONTEND_URL || 'https://zurcher-construction.vercel.app';
      const signButtonUrl = `${frontendUrl}/sign-budget/${budget.idBudget}`;

      await EmailService.sendEmail({
        to: budget.Permit.applicantEmail,
        subject: emailSubject,
        html: `
          <h2>Please Sign Your ${budget.invoiceNumber ? 'Invoice' : 'Budget'}</h2>
          <p>Dear ${budget.Permit.applicantName || 'Valued Client'},</p>
          <p>Your ${budget.invoiceNumber ? 'invoice' : 'budget'} is ready for signature.</p>
          <p><strong>Budget Number:</strong> ${budget.invoiceNumber || budget.idBudget}</p>
          <p>Click the button below to review and sign:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signButtonUrl}" 
               style="background-color: #4CAF50; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 4px; display: inline-block; 
                      font-size: 16px;">
              📝 Sign Document
            </a>
          </div>
          <p>This link will remain valid and you can access it anytime you need.</p>
          <p>Best regards,<br>Zurcher Construction Team</p>
        `
      });

      console.log('✅ Correo enviado exitosamente');

      res.status(200).json({
        error: false,
        message: 'Documento reenviado exitosamente con sistema de firma embebida',
        data: {
          budgetId: budget.idBudget,
          envelopeId: signatureResult.envelopeId,
          status: signatureResult.status,
          signerEmail: budget.Permit.applicantEmail,
          signerName: budget.Permit.applicantName,
          sentAt: new Date().toISOString(),
          note: 'El nuevo documento soporta regeneración de enlaces. El cliente puede hacer clic en el enlace múltiples veces.',
          signButtonUrl: signButtonUrl
        }
      });

    } catch (error) {
      console.error('❌ Error reenviando documento:', error);
      res.status(500).json({
        error: true,
        message: 'Error al reenviar documento',
        details: error.message
      });
    }
  },

  // ✅ NUEVO: Generar enlace de firma on-demand y redirigir (para usar en correos)
  async getSigningLinkAndRedirect(req, res) {
    const { idBudget } = req.params;

    try {
      console.log('\n🔗 === GENERANDO ENLACE DE FIRMA ON-DEMAND ===');
      console.log(`📋 ID Presupuesto: ${idBudget}`);

      // Buscar el presupuesto con información del solicitante
      const budget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['applicantEmail', 'applicantName', 'propertyAddress']
        }]
      });

      if (!budget) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>❌ Documento no encontrado</h1>
              <p>El presupuesto solicitado no existe.</p>
            </body>
          </html>
        `);
      }

      // Verificar que tiene documento de firma
      const envelopeId = budget.docusignEnvelopeId || budget.signatureDocumentId;
      
      if (!envelopeId) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>⚠️ Documento no disponible</h1>
              <p>Este presupuesto aún no ha sido enviado para firma.</p>
            </body>
          </html>
        `);
      }

      // Verificar que sea DocuSign
      if (budget.signatureMethod !== 'docusign') {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>⚠️ Método no soportado</h1>
              <p>Este documento no usa DocuSign. Por favor use el enlace en el correo original.</p>
            </body>
          </html>
        `);
      }

      // Verificar si ya está firmado
      if (budget.status === 'signed' || budget.status === 'approved') {
        return res.status(200).send(`
          <html>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>✅ Documento ya firmado</h1>
              <p>Este presupuesto ya ha sido firmado exitosamente.</p>
              <p>Estado: ${budget.status === 'approved' ? 'Aprobado' : 'Firmado'}</p>
            </body>
          </html>
        `);
      }

      console.log(`📧 Cliente: ${budget.Permit?.applicantEmail} - ${budget.Permit?.applicantName}`);
      console.log(`📋 Envelope ID: ${envelopeId}`);

      // Inicializar servicio DocuSign
      const docuSignService = new DocuSignService();

      // Generar enlace de firma en este momento
      const result = await docuSignService.regenerateSigningLink(
        envelopeId,
        budget.Permit?.applicantEmail,
        budget.Permit?.applicantName || 'Valued Client'
      );

      console.log('✅ Enlace generado, redirigiendo a DocuSign...');
      console.log(`🔗 URL: ${result.signingUrl}`);

      // Redirigir directamente a DocuSign
      res.redirect(result.signingUrl);

    } catch (error) {
      console.error('❌ Error generando enlace de firma:', error);

      res.status(500).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Error al generar enlace</h1>
            <p>Ocurrió un error al generar el enlace de firma.</p>
            <p style="color: #666; font-size: 14px;">${error.message}</p>
            <p>Por favor contacte con soporte.</p>
          </body>
        </html>
      `);
    }
  },


  // Descargar documento firmado
  async downloadSignedBudget(req, res) {
    const { idBudget } = req.params;

    try {
      console.log(`--- Descargando documento firmado para presupuesto ${idBudget} ---`);

      // Buscar el presupuesto
      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      // Verificar si tiene documento de firma
      const documentId = budget.signatureDocumentId || budget.signNowDocumentId;
      
      if (!documentId) {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no ha sido enviado para firma'
        });
      }

      // 🆕 Determinar qué servicio usar
      const isDocuSign = budget.signatureMethod === 'docusign';
      const serviceName = isDocuSign ? 'DocuSign' : 'SignNow';
      
      console.log(`📥 Descargando desde ${serviceName}...`);

      // Inicializar servicio correspondiente
      const signatureService = isDocuSign ? new DocuSignService() : new SignNowService();

      // Verificar si está firmado
      const signatureStatus = await signatureService.isDocumentSigned(documentId);
      const isSigned = isDocuSign ? signatureStatus.signed : signatureStatus.isSigned;

      if (!isSigned) {
        return res.status(400).json({
          error: true,
          message: 'El documento aún no ha sido firmado',
          data: {
            budgetId: budget.idBudget,
            status: signatureStatus.status,
            service: serviceName
          }
        });
      }

      // Crear path para el archivo firmado
      const path = require('path');
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'signed-budgets');

      // Crear directorio si no existe
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const signedFileName = `Budget_${budget.idBudget}_signed.pdf`;
      const signedFilePath = path.join(uploadsDir, signedFileName);

      // Descargar documento firmado desde el servicio correspondiente
      await signatureService.downloadSignedDocument(documentId, signedFilePath);

      // ✅ Actualizar a 'signed' (el hook del modelo lo pasará a 'approved' si tiene pago)
      await budget.update({
        signedPdfPath: signedFilePath,
        status: 'signed',
        signedAt: new Date()
      });

      // Enviar archivo al cliente
      res.download(signedFilePath, signedFileName, (err) => {
        if (err) {
          console.error('Error enviando archivo:', err);
          res.status(500).json({
            error: true,
            message: 'Error descargando archivo firmado'
          });
        }
      });

    } catch (error) {
      console.error('❌ Error descargando documento firmado:', error);

      res.status(500).json({
        error: true,
        message: 'Error descargando documento firmado',
        details: error.message
      });
    }
  },

  // 🆕 Nuevo método para VISUALIZAR (no descargar) el PDF firmado de SignNow
  async viewSignedBudget(req, res) {
    const { idBudget } = req.params;

    try {
      console.log(`--- Visualizando documento firmado para presupuesto ${idBudget} ---`);

      // Buscar el presupuesto
      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      // Si ya existe el archivo localmente, servirlo directamente
      if (budget.signedPdfPath && fs.existsSync(budget.signedPdfPath)) {
        console.log(`✅ Sirviendo PDF firmado existente: ${budget.signedPdfPath}`);
        
        // Establecer headers ANTES de enviar el archivo
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline'); // ← inline para visualizar, no descargar
        
        // Leer y enviar el archivo
        const fileStream = fs.createReadStream(budget.signedPdfPath);
        return fileStream.pipe(res);
      }

      // Si no existe localmente, descargarlo de SignNow
      // Validar que exista un documento para firma
      if (!budget.signatureDocumentId && !budget.signNowDocumentId) {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no tiene documento firmado disponible'
        });
      }

      // Detectar qué servicio se usó basado en signatureMethod
      const isDocuSign = budget.signatureMethod === 'docusign';
      const isSignNow = budget.signatureMethod === 'signnow' || budget.signNowDocumentId;
      const serviceName = isDocuSign ? 'DocuSign' : 'SignNow';
      const documentId = budget.signatureDocumentId || budget.signNowDocumentId;

      console.log(`📋 Visualizando documento de ${serviceName} (ID: ${documentId})...`);

      // Inicializar servicio apropiado
      const signatureService = isDocuSign ? new DocuSignService() : new SignNowService();

      // Verificar si está firmado
      const signatureStatus = await signatureService.isDocumentSigned(documentId);

      if (!signatureStatus.isSigned && !signatureStatus.signed) {
        return res.status(400).json({
          error: true,
          message: 'El documento aún no ha sido firmado'
        });
      }

      // Crear path para el archivo firmado
      const path = require('path');
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'signed-budgets');

      // Crear directorio si no existe
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const signedFileName = `Budget_${budget.idBudget}_signed.pdf`;
      const signedFilePath = path.join(uploadsDir, signedFileName);

      // Descargar documento firmado del servicio apropiado
      await signatureService.downloadSignedDocument(documentId, signedFilePath);

      // Actualizar presupuesto con path del archivo firmado
      await budget.update({
        signedPdfPath: signedFilePath
      });

      // Establecer headers ANTES de enviar el archivo
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline'); // ← inline para visualizar, no descargar
      
      // Leer y enviar el archivo
      const fileStream = fs.createReadStream(signedFilePath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('❌ Error visualizando documento firmado:', error);

      res.status(500).json({
        error: true,
        message: 'Error visualizando documento firmado',
        details: error.message
      });
    }
  },

  // 🆕 Método para visualizar PDF firmado manualmente (proxy de Cloudinary)
  async viewManualSignedBudget(req, res) {
    const { idBudget } = req.params;

    try {
      console.log(`--- Visualizando documento manual para presupuesto ${idBudget} ---`);

      // Buscar el presupuesto
      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      if (!budget.manualSignedPdfPath) {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no tiene PDF firmado manual'
        });
      }

      console.log(`📄 Descargando PDF manual desde Cloudinary: ${budget.manualSignedPdfPath}`);

      // Descargar el PDF desde Cloudinary usando axios
      const axios = require('axios');
      const cloudinaryResponse = await axios.get(budget.manualSignedPdfPath, {
        responseType: 'arraybuffer'
      });

      if (cloudinaryResponse.status !== 200) {
        throw new Error(`Error descargando de Cloudinary: ${cloudinaryResponse.statusText}`);
      }

      // Obtener el buffer del PDF
      const pdfBuffer = Buffer.from(cloudinaryResponse.data);

      // Establecer headers para visualización inline
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline'); // ← inline para visualizar
      res.setHeader('Content-Length', pdfBuffer.length);

      // Enviar el PDF
      res.send(pdfBuffer);

    } catch (error) {
      console.error('❌ Error visualizando documento manual:', error);

      res.status(500).json({
        error: true,
        message: 'Error visualizando documento manual',
        details: error.message
      });
    }
  },


  // Asegúrate de que getBudgetById incluya los lineItems:
  async getBudgetById(req, res) {
    try {
      const { idBudget } = req.params;
      console.log(`Buscando Budget con ID: ${idBudget}`);

      const budget = await Budget.findByPk(idBudget, {
        include: [
          {
            model: Permit,
            attributes: [
              'idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'systemType', 
              'drainfieldDepth', 'excavationRequired', 'lot', 'block', 
              'expirationDate', 'applicantPhone', 'applicantName',
              // ✅ URLs de Cloudinary (prioridad)
              'permitPdfUrl', 'permitPdfPublicId',
              'optionalDocsUrl', 'optionalDocsPublicId',
              // ✅ PPI fields (Cloudinary URLs)
              'ppiGeneratedPath', 'ppiDocusignEnvelopeId', 
              'ppiCloudinaryUrl', 'ppiCloudinaryPublicId',
              'ppiSignatureStatus', 'ppiSignedAt',
              'ppiSignedPdfUrl', 'ppiSignedPdfPublicId',
              'applicant',
              // ✅ Flags virtuales para saber si existen PDFs (Cloudinary o BLOB legacy)
              [sequelize.literal('CASE WHEN "Permit"."permitPdfUrl" IS NOT NULL OR "Permit"."pdfData" IS NOT NULL THEN true ELSE false END'), 'hasPermitPdfData'],
              [sequelize.literal('CASE WHEN "Permit"."optionalDocsUrl" IS NOT NULL OR "Permit"."optionalDocs" IS NOT NULL THEN true ELSE false END'), 'hasOptionalDocs']
            ],
          },
          {
            model: BudgetLineItem,
            as: 'lineItems',
            separate: true, // OPTIMIZACIÓN: Previene duplicación de filas y mejora performance
            include: [
              {
                model: BudgetItem,
                as: 'itemDetails',
                attributes: ['id', 'name', 'category', 'marca', 'capacity', 'unitPrice', 'description'],
              },
            ],
          },
        ],
        timeout: 30000, //  OPTIMIZACIÓN: Aumentar timeout a 30 segundos para Railway
      });

      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Convertir el presupuesto y sus relaciones a objetos planos
      const budgetData = budget.toJSON();

      // Mapear los datos de itemDetails directamente en los lineItems
      budgetData.lineItems = budgetData.lineItems.map(lineItem => ({
        ...lineItem,
        name: lineItem.name || lineItem.itemDetails?.name || null,
        category: lineItem.category || lineItem.itemDetails?.category || null,
        marca: lineItem.marca || lineItem.itemDetails?.marca || null,
        capacity: lineItem.capacity || lineItem.itemDetails?.capacity || null,
        unitPrice: lineItem.unitPrice || lineItem.itemDetails?.unitPrice || null,
        description: lineItem.description || lineItem.itemDetails?.description || null,
      }));

      // *** CAMBIO 2: Añadir URLs dinámicamente si el Permit existe ***
      // Añadir URLs dinámicamente si el Permit existe
      if (budgetData.Permit) {
        const baseUrl = `${req.protocol}://${req.get('host')}/permits`;
        budgetData.Permit.pdfDataUrl = `${baseUrl}/${budgetData.Permit.idPermit}/view/pdf`;
        budgetData.Permit.optionalDocsUrl = `${baseUrl}/${budgetData.Permit.idPermit}/view/optional`;
      }

      res.status(200).json(budgetData);
    } catch (error) {
      console.error(`Error al obtener el presupuesto ID: ${req.params.idBudget}:`, error);
      res.status(500).json({ error: 'Error interno del servidor al obtener el presupuesto.' });
    }
  },



async getBudgets(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const { search, status, month, year, signatureMethod } = req.query;

    // 🆕 WHERE CLAUSE BASE (sin filtro de status, para estadísticas globales)
    const baseWhereClause = {};
    const whereClause = {};

    // ✅ EXCLUIR budgets con status 'legacy_maintenance' y 'archived'
    // Estos budgets NO deben aparecer en la gestión normal
    baseWhereClause.status = { [Op.notIn]: ['legacy_maintenance', 'archived'] };
    whereClause.status = { [Op.notIn]: ['legacy_maintenance', 'archived'] };

    // 🔍 Condición de búsqueda SOLO para la query principal (no para stats)
    if (search && search.trim()) {
      const searchCondition = {
        [Op.or]: [
          { applicantName: { [Op.iLike]: `%${search.trim()}%` } },
          { propertyAddress: { [Op.iLike]: `%${search.trim()}%` } },
          { applicantEmail: { [Op.iLike]: `%${search.trim()}%` } }, // 🚀 Sin JOIN - campo desnormalizado
          { contactCompany: { [Op.iLike]: `%${search.trim()}%` } }  // 🆕 Búsqueda por empresa
        ]
      };
      // Solo aplicar a whereClause (query principal), NO a baseWhereClause (stats)
      whereClause[Op.or] = searchCondition[Op.or];
    }

    // Filtro por mes (aplicar a ambos whereClause)
    if (month && month !== 'all') {
      const monthNum = parseInt(month);
      // ✅ El frontend envía 0-11, necesitamos convertir a 1-12 para SQL EXTRACT(MONTH)
      if (monthNum >= 0 && monthNum <= 11) {
        const sqlMonth = monthNum + 1; // Convertir de 0-11 a 1-12
        const monthCondition = literal(`EXTRACT(MONTH FROM CAST("Budget"."date" AS DATE)) = ${sqlMonth}`);
        
        baseWhereClause[Op.and] = baseWhereClause[Op.and] || [];
        baseWhereClause[Op.and].push(monthCondition);
        
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(monthCondition);
      }
    }

    // Filtro por año (aplicar a ambos whereClause)
    if (year && year !== 'all') {
      const yearNum = parseInt(year);
      if (yearNum > 2020 && yearNum <= new Date().getFullYear() + 1) {
        const yearCondition = literal(`EXTRACT(YEAR FROM CAST("Budget"."date" AS DATE)) = ${yearNum}`);
        
        baseWhereClause[Op.and] = baseWhereClause[Op.and] || [];
        baseWhereClause[Op.and].push(yearCondition);
        
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push(yearCondition);
      }
    }

    // 🎯 Filtro por status SOLO para whereClause (no para estadísticas)
    if (status && status !== 'all') {
      // ✅ "draft" - Borradores + creados (antiguos, ya no se usa)
      if (status === 'draft') {
        // Mantener el filtro de legacy_maintenance usando Op.and
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({ 
          status: { [Op.in]: ['draft', 'created'] }
        });
      }
      // ✅ "en_revision" o "en_seguimiento" (alias) - Todos los estados intermedios (esperando firma)
      else if (status === 'en_revision' || status === 'en_seguimiento') {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          status: {
            [Op.in]: ['send', 'pending_review', 'client_approved', 'notResponded', 'sent_for_signature']
          }
        });
      }
      // ✅ "signed" - Firmados (Signow o manual) pero SIN pago (excluye legacy)
      else if (status === 'signed') {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          status: 'signed',
          isLegacy: { [Op.or]: [false, null] }
        });
      }
      // ✅ "approved" - COMPLETOS: Firmados CON pago (listos para Work, excluye legacy)
      else if (status === 'approved') {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({
          status: 'approved',
          isLegacy: { [Op.or]: [false, null] }
        });
      }
      // ✅ "legacy" - Presupuestos antiguos (ya vienen completos)
      else if (status === 'legacy') {
        whereClause[Op.and] = whereClause[Op.and] || [];
        whereClause[Op.and].push({ isLegacy: true });
      }
      // 🛡️ Validar que el status es un valor válido del ENUM antes de usarlo
      else {
        const validStatuses = ['draft', 'pending_review', 'client_approved', 'created', 'send', 
                               'sent_for_signature', 'signed', 'approved', 'notResponded', 'rejected'];
        
        if (validStatuses.includes(status)) {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push({ status: status });
        } else {
          // Si el status no es válido, ignorarlo y no aplicar filtro
          console.warn(`⚠️ Status inválido recibido: "${status}". Ignorando filtro.`);
        }
      }
    }

    // 🆕 Filtro por método de firma
    if (signatureMethod && signatureMethod !== 'all') {
      if (signatureMethod === 'none') {
        // Sin firmar: signatureMethod es null, 'none', o vacío
        const noneConditions = [
          { signatureMethod: null },
          { signatureMethod: 'none' },
          { signatureMethod: '' }
        ];
        
        // Si ya existe un Op.or, combinarlo; si no, crear uno nuevo
        if (whereClause[Op.or]) {
          whereClause[Op.and] = whereClause[Op.and] || [];
          whereClause[Op.and].push({
            [Op.or]: noneConditions
          });
        } else {
          whereClause[Op.or] = noneConditions;
        }
      } else if (signatureMethod === 'legacy') {
        // Legacy: isLegacy=true
        whereClause.isLegacy = true;
      } else {
        // SignNow, DocuSign o Manual: filtrar por signatureMethod exacto
        whereClause.signatureMethod = signatureMethod;
      }
    }

    const { rows: budgetsInstances, count: totalBudgets } = await Budget.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Permit,
          attributes: [
            'idPermit', 'propertyAddress', 'systemType', 'expirationDate', 'applicantEmail',  
            'applicantPhone', 'applicantName', 'permitNumber', 'lot', 'block',
            // ✅ URLs de Cloudinary (prioridad)
            'permitPdfUrl', 'permitPdfPublicId',
            'optionalDocsUrl', 'optionalDocsPublicId',
            // 🆕 Campos PPI para firma con DocuSign
            'ppiGeneratedPath', 'ppiDocusignEnvelopeId', 'ppiSentForSignatureAt', 'ppiSignatureStatus',
            'ppiCloudinaryUrl', 'ppiCloudinaryPublicId', 'ppiInspectorType',
            'ppiSignatureStatus', 'ppiSignedAt', 'ppiSignedPdfUrl', 'ppiSignedPdfPublicId',
            // ✅ Flags virtuales para saber si existen PDFs (fallback a BLOB legacy)
            [sequelize.literal('CASE WHEN "Permit"."permitPdfUrl" IS NOT NULL OR "Permit"."pdfData" IS NOT NULL THEN true ELSE false END'), 'hasPermitPdfData'],
            [sequelize.literal('CASE WHEN "Permit"."optionalDocsUrl" IS NOT NULL OR "Permit"."optionalDocs" IS NOT NULL THEN true ELSE false END'), 'hasOptionalDocs']
          ],
        },
        // 🔔 LEFT JOIN a BudgetNotes para obtener alertas próximas
        {
          model: BudgetNote,
          as: 'notes',
          required: false, // LEFT JOIN - no excluir budgets sin alertas
          where: {
            isReminderActive: true,
            reminderDate: {
              [Op.gte]: new Date(),
              [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Próximos 7 días
            },
            reminderCompletedAt: null
          },
          attributes: ['id', 'reminderDate', 'priority'],
          separate: true // Query separada para evitar problemas con GROUP BY
        }
      ],
      order: [['idBudget', 'DESC']], // Ordenar por ID descendente
      limit: pageSize,
      offset,
      attributes: [
        'idBudget', 'date', 'expirationDate', 'status', 'applicantName', 'applicantEmail', 'contactCompany', 'propertyAddress',
        'subtotalPrice', 'totalPrice', 'initialPayment', 'initialPaymentPercentage', 'pdfPath',
        'generalNotes',
        'paymentInvoice',
        'paymentProofAmount',
        'paymentProofType',
        'isLegacy',
        'legacySignedPdfUrl',
        'legacySignedPdfPublicId',
        'invoiceNumber',
        'reviewedAt',
        'convertedToInvoiceAt',
        'sentForReviewAt',
        'signatureMethod',
        'signatureDocumentId', // 🆕 Envelope ID para DocuSign/SignNow
        'docusignEnvelopeId', // 🆕 Envelope ID específico de DocuSign
        'signNowDocumentId', // Ya existía
        'manualSignedPdfPath',
        'manualSignedPdfPublicId',
        'signedPdfPath',
        'requiresFollowUp', // ✅ Incluir para mostrar el estado de la campana en BudgetList
        'leadSource',
        'createdByStaffId',
        'salesCommissionAmount'
      ]
    });

    // 🆕 CALCULAR ESTADÍSTICAS GLOBALES usando baseWhereClause (SIN filtro de status NI búsqueda)
    // Las estadísticas NO dependen de la búsqueda, solo de filtros de mes/año
    const allBudgetsForStats = await Budget.findAll({
      where: baseWhereClause,
      attributes: ['status', 'signatureMethod', 'manualSignedPdfPath', 'isLegacy', 'paymentProofAmount']
    });

    const stats = {
      total: allBudgetsForStats.length,
      // ✅ Draft + created (antiguos, ya no se usa)
      draft: allBudgetsForStats.filter(b => ['draft', 'created'].includes(b.status)).length,
      // ✅ En revisión - Esperando firma
      en_revision: allBudgetsForStats.filter(b => 
        ['send', 'pending_review', 'client_approved', 'notResponded', 'sent_for_signature'].includes(b.status)
      ).length,
      // ✅ Firmados SIN pago (esperando pago)
      signed: allBudgetsForStats.filter(b => b.status === 'signed' && !b.isLegacy).length,
      // ✅ COMPLETOS: Firmados CON pago (listos para Work)
      approved: allBudgetsForStats.filter(b => b.status === 'approved' && !b.isLegacy).length,
      // ✅ Legacy (antiguos, ya vienen completos)
      legacy: allBudgetsForStats.filter(b => b.isLegacy === true).length,
      rejected: allBudgetsForStats.filter(b => b.status === 'rejected').length,
      // Estados individuales (para compatibilidad)
      pending_review: allBudgetsForStats.filter(b => b.status === 'pending_review').length,
      client_approved: allBudgetsForStats.filter(b => b.status === 'client_approved').length,
      created: allBudgetsForStats.filter(b => b.status === 'created').length,
      send: allBudgetsForStats.filter(b => b.status === 'send').length,
      notResponded: allBudgetsForStats.filter(b => b.status === 'notResponded').length,
      sent_for_signature: allBudgetsForStats.filter(b => b.status === 'sent_for_signature').length,
      // 🆕 Estadísticas por método de firma
      signatureStats: {
        signnow: allBudgetsForStats.filter(b => b.signatureMethod === 'signnow').length,
        docusign: allBudgetsForStats.filter(b => b.signatureMethod === 'docusign').length,
        manual: allBudgetsForStats.filter(b => b.signatureMethod === 'manual').length,
        legacy: allBudgetsForStats.filter(b => b.isLegacy === true).length,
        none: allBudgetsForStats.filter(b => !b.signatureMethod || b.signatureMethod === 'none' || b.signatureMethod === '').length
      }
    };
    
    const budgetsWithDetails = budgetsInstances.map(budgetInstance => {
      const budgetJson = budgetInstance.toJSON();

        // Calcular y añadir estado de expiración del Permit si existe
        if (budgetJson.Permit && budgetJson.Permit.expirationDate) {
          let permitExpirationStatus = "valid";
          let permitExpirationMessage = "";
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const expirationDateString = typeof budgetJson.Permit.expirationDate === 'string'
            ? budgetJson.Permit.expirationDate.split('T')[0]
            : new Date(budgetJson.Permit.expirationDate).toISOString().split('T')[0];

          const expDateParts = expirationDateString.split('-');
          const year = parseInt(expDateParts[0], 10);
          const month = parseInt(expDateParts[1], 10) - 1;
          const day = parseInt(expDateParts[2], 10);

          if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const expDate = new Date(year, month, day);
            expDate.setHours(0, 0, 0, 0);

            if (!isNaN(expDate.getTime())) {
              if (expDate < today) {
                permitExpirationStatus = "expired";
                permitExpirationMessage = `Permiso asociado expiró el ${expDate.toLocaleDateString()}.`;
              } else {
                const thirtyDaysFromNow = new Date(today);
                thirtyDaysFromNow.setDate(today.getDate() + 30);
                if (expDate <= thirtyDaysFromNow) {
                  permitExpirationStatus = "soon_to_expire";
                  permitExpirationMessage = `Permiso asociado expira el ${expDate.toLocaleDateString()} (pronto a vencer).`;
                }
              }
            } else {
              console.warn(`Fecha de expiración de permiso inválida (post-parse) para budget ${budgetJson.idBudget}, permit ${budgetJson.Permit.idPermit}: ${expirationDateString}`);
            }
          } else {
            console.warn(`Formato de fecha de expiración de permiso inválido para budget ${budgetJson.idBudget}, permit ${budgetJson.Permit.idPermit}: ${expirationDateString}`);
          }
          budgetJson.Permit.expirationStatus = permitExpirationStatus;
          budgetJson.Permit.expirationMessage = permitExpirationMessage;
        } else if (budgetJson.Permit) {
          budgetJson.Permit.expirationStatus = "valid";
          budgetJson.Permit.expirationMessage = "";
        }

  // ✅ Los flags hasPermitPdfData y hasOptionalDocs ya vienen calculados desde el query SQL
  // No necesitamos calcularlos aquí ni eliminar campos BLOB (ya no los traemos)

  if (budgetJson.isLegacy) {
    budgetJson.hasLegacySignedPdf = !!budgetJson.legacySignedPdfUrl;
  }

        if (budgetJson.pdfPath) {
        budgetJson.budgetPdfUrl = `${req.protocol}://${req.get('host')}/budgets/${budgetJson.idBudget}/pdf`;
      } else {
        budgetJson.budgetPdfUrl = null;
      }
      return budgetJson;
    });

    res.status(200).json({
      budgets: budgetsWithDetails,
      total: totalBudgets,
      page,
      pageSize,
      stats
    });

  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({ error: 'Error al obtener los presupuestos.' });
  }
},

async permitPdf(req, res) {
  try {
    const { idBudget } = req.params;
    const budget = await Budget.findByPk(idBudget, {
      include: [{ model: Permit, attributes: ['permitPdfUrl', 'pdfData', 'idPermit', 'isLegacy'] }],
      attributes: ['idBudget', 'isLegacy']
    });

    if (!budget || !budget.Permit) {
      return res.status(404).json({ error: 'Presupuesto o permiso no encontrado.' });
    }

    // ✅ PRIORIZAR permitPdfUrl (Cloudinary), fallback a pdfData (BLOB legacy)
    const permitPdfUrl = budget.Permit.permitPdfUrl;
    const pdfData = budget.Permit.pdfData;
    
    // Si tenemos URL de Cloudinary, redirigir directamente
    if (permitPdfUrl) {
      console.log(`🔗 Redirigiendo a Cloudinary URL para Permit PDF: ${permitPdfUrl}`);
      return res.redirect(permitPdfUrl);
    }
    
    // Fallback a BLOB legacy
    if (!pdfData) {
      return res.status(404).json({ error: 'No hay PDF de permiso asociado a este presupuesto.' });
    }

    // --- DETECTAR SI ES RUTA DE ARCHIVO (LEGACY) O BLOB (NORMAL) ---
    const isLegacy = budget.isLegacy || budget.Permit.isLegacy;
    
    // DEBUG: Log para permitPdf
    console.log(`🔍 DEBUG permitPdf Budget ${budget.idBudget}:`, {
      isLegacy,
      pdfDataType: typeof pdfData,
      pdfDataPreview: typeof pdfData === 'string' ? pdfData.substring(0, 100) : 'BUFFER_OR_OTHER'
    });
    
    // ✅ DETECTAR URLs de Cloudinary (pueden estar como string O Buffer) - NO requiere isLegacy
    let cloudinaryUrl = null;
    
    if (typeof pdfData === 'string' && pdfData.includes('cloudinary.com')) {
      cloudinaryUrl = pdfData;
    } else if (Buffer.isBuffer(pdfData)) {
      // Convertir Buffer a string para ver si es una URL de Cloudinary
      const bufferString = pdfData.toString('utf8');
      if (bufferString.includes('cloudinary.com')) {
        cloudinaryUrl = bufferString;
      }
    }
    
    if (cloudinaryUrl) {
      console.log(`🔗 Redirigiendo a Cloudinary URL para permitPdf: ${cloudinaryUrl}`);
      return res.redirect(cloudinaryUrl);
    }
    
    if (isLegacy && typeof pdfData === 'string' && !pdfData.startsWith('data:')) {
      // Es un legacy budget con ruta de archivo
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Construir la ruta completa del archivo
        const fullPath = path.resolve(pdfData);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: 'Archivo PDF no encontrado en el sistema.' });
        }
        
        // Leer el archivo y enviarlo
        const fileBuffer = fs.readFileSync(fullPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="permit_${budget.idBudget}.pdf"`);
        return res.send(fileBuffer);
        
      } catch (fileError) {
        console.error('Error al leer archivo PDF:', fileError);
        return res.status(500).json({ error: 'Error al acceder al archivo PDF.' });
      }
    }
    
    // --- LÓGICA PARA BUDGETS NORMALES (BLOB) ---
    // Determinar el tipo de dato y devolver como PDF
    let buffer;
    if (Buffer.isBuffer(pdfData)) {
      buffer = pdfData;
    } else if (pdfData.type === 'Buffer' && Array.isArray(pdfData.data)) {
      buffer = Buffer.from(pdfData.data);
    } else if (typeof pdfData === 'string') {
      buffer = Buffer.from(pdfData, 'base64');
    } else {
      return res.status(500).json({ error: 'Formato de PDF no soportado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="permit_${budget.Permit.idPermit}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al servir el PDF de permiso:', error);
    res.status(500).json({ error: 'Error interno al servir el PDF de permiso.' });
  }
},

// Descargar los documentos opcionales del permiso asociado a un presupuesto
async optionalDocs(req, res) {
  try {
    const { idBudget } = req.params;
    const budget = await Budget.findByPk(idBudget, {
      include: [{ model: Permit, attributes: ['optionalDocsUrl', 'optionalDocs', 'idPermit', 'isLegacy'] }],
      attributes: ['idBudget', 'isLegacy']
    });

    if (!budget || !budget.Permit) {
      return res.status(404).json({ error: 'Presupuesto o permiso no encontrado.' });
    }

    // ✅ PRIORIZAR optionalDocsUrl (Cloudinary), fallback a optionalDocs (BLOB legacy)
    const optionalDocsUrl = budget.Permit.optionalDocsUrl;
    const optionalDocs = budget.Permit.optionalDocs;
    
    // Si tenemos URL de Cloudinary, redirigir directamente
    if (optionalDocsUrl) {
      console.log(`🔗 Redirigiendo a Cloudinary URL para Optional Docs: ${optionalDocsUrl}`);
      return res.redirect(optionalDocsUrl);
    }
    
    // Fallback a BLOB legacy
    if (!optionalDocs) {
      return res.status(404).json({ error: 'No hay documentos opcionales asociados a este presupuesto.' });
    }

    // --- DETECTAR SI ES RUTA DE ARCHIVO (LEGACY) O BLOB (NORMAL) ---
    const isLegacy = budget.isLegacy || budget.Permit.isLegacy;
    
    // DEBUG: Log para optionalDocs
    console.log(`🔍 DEBUG optionalDocs Budget ${budget.idBudget}:`, {
      isLegacy,
      optionalDocsType: typeof optionalDocs,
      optionalDocsPreview: typeof optionalDocs === 'string' ? optionalDocs.substring(0, 100) : 'BUFFER_OR_OTHER',
      optionalDocsValue: optionalDocs,
      isCloudinaryString: typeof optionalDocs === 'string' && optionalDocs.includes('cloudinary.com')
    });
    
    // ✅ DETECTAR URLs de Cloudinary (pueden estar como string O Buffer) - NO requiere isLegacy
    let cloudinaryUrl = null;
    
    if (typeof optionalDocs === 'string' && optionalDocs.includes('cloudinary.com')) {
      cloudinaryUrl = optionalDocs;
    } else if (Buffer.isBuffer(optionalDocs)) {
      // Convertir Buffer a string para ver si es una URL de Cloudinary
      const bufferString = optionalDocs.toString('utf8');
      if (bufferString.includes('cloudinary.com')) {
        cloudinaryUrl = bufferString;
      }
    }
    
    if (cloudinaryUrl) {
      console.log(`🔗 Redirigiendo a Cloudinary URL para optionalDocs: ${cloudinaryUrl}`);
      return res.redirect(cloudinaryUrl);
    }
    
    if (isLegacy && typeof optionalDocs === 'string' && !optionalDocs.startsWith('data:')) {
      // Es un legacy budget con información JSON de archivos
      const fs = require('fs');
      const path = require('path');
      
      try {
        // optionalDocs contiene un JSON string: [{ name, path, type }]
        const optionalDocsArray = JSON.parse(optionalDocs);
        
        // Por simplicidad, tomar el primer documento (puedes expandir para múltiples)
        const firstDoc = optionalDocsArray[0];
        if (!firstDoc || !firstDoc.path) {
          return res.status(404).json({ error: 'No hay documentos opcionales válidos.' });
        }
        
        // Construir la ruta completa del archivo
        const fullPath = path.resolve(firstDoc.path);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: 'Archivo PDF opcional no encontrado en el sistema.' });
        }
        
        // Leer el archivo y enviarlo
        const fileBuffer = fs.readFileSync(fullPath);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${firstDoc.name || `optional_${budget.idBudget}.pdf`}"`);
        return res.send(fileBuffer);
        
      } catch (fileError) {
        console.error('Error al leer archivo PDF opcional:', fileError);
        return res.status(500).json({ error: 'Error al acceder al archivo PDF opcional.' });
      }
    }
    
    // --- LÓGICA PARA BUDGETS NORMALES (BLOB) ---

    // Determinar el tipo de dato y devolver como PDF
    let buffer;
    if (Buffer.isBuffer(optionalDocs)) {
      buffer = optionalDocs;
    } else if (optionalDocs.type === 'Buffer' && Array.isArray(optionalDocs.data)) {
      buffer = Buffer.from(optionalDocs.data);
    } else if (typeof optionalDocs === 'string') {
      buffer = Buffer.from(optionalDocs, 'base64');
    } else {
      return res.status(500).json({ error: 'Formato de PDF no soportado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="optional_docs_${budget.Permit.idPermit}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al servir los documentos opcionales:', error);
    res.status(500).json({ error: 'Error interno al servir los documentos opcionales.' });
  }
},


  async updateBudget(req, res) {
    const { idBudget } = req.params;
    const transaction = await conn.transaction();
    let generatedPdfPath = null;

    try {
      console.log(`--- Iniciando actualización para Budget ID: ${idBudget} ---`);
      console.log("Datos recibidos en req.body:", JSON.stringify(req.body, null, 2));

      // --- 1. Buscar el Budget Existente ---
      const budget = await Budget.findByPk(idBudget, {
        include: [
          {
            model: Permit,
            attributes: ['idPermit', 'propertyAddress', 'applicantEmail', 'applicantName', 'applicantPhone', 'permitNumber', 'lot', 'block', 'expirationDate'] // Incluir campos necesarios para PDF
          },
          {
            model: BudgetLineItem, // Incluir para recalcular y generar PDF
            as: 'lineItems'
          }
        ],
        transaction
      });

      if (!budget) {
        await transaction.rollback();
        console.error(`Error: Presupuesto ID ${idBudget} no encontrado.`);
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }
      console.log(`Presupuesto ID ${idBudget} encontrado.`);

      // --- 2. Extraer Datos de la Solicitud ---
      const {
        date,
        expirationDate,
        status,
        applicantName,
        applicantEmail,
        applicantPhone,
        propertyAddress,
        discountDescription,
        discountAmount,
        generalNotes,
        initialPaymentPercentage: initialPaymentPercentageInput,
        contactCompany, // 🆕 Empresa/contacto referente
        lineItems,
        paymentMethod, // 🆕 Extraer método de pago
        // 🆕 Campos de comisiones
        leadSource,
        createdByStaffId,
        externalReferralName,
        externalReferralEmail,
        externalReferralPhone,
        externalReferralCompany,
        salesCommissionAmount
      } = req.body;

      // --- 3. Validaciones Preliminares ---
      const hasGeneralUpdates = date || expirationDate !== undefined || status || applicantName || applicantEmail || applicantPhone || propertyAddress || discountDescription !== undefined || discountAmount !== undefined || generalNotes !== undefined || initialPaymentPercentageInput !== undefined; // Corregido: initialPaymentPercentageInput
      const hasLineItemUpdates = lineItems && Array.isArray(lineItems);

      if (!hasGeneralUpdates && !hasLineItemUpdates) {
        await transaction.rollback();
        console.warn(`Advertencia: No se proporcionaron campos ni items para actualizar Budget ID ${idBudget}.`);
        return res.status(400).json({ error: 'No se proporcionaron campos o items para actualizar' });
      }

      if (status === "approved" && !budget.paymentInvoice) {
        await transaction.rollback();
        console.error(`Error: Intento de aprobar Budget ID ${idBudget} sin comprobante de pago.`);
        return res.status(400).json({ error: 'Debe cargar el comprobante de pago antes de aprobar el presupuesto.' });
      }

      // --- 4. Actualizar Campos Generales del Budget ---
      console.log("Actualizando campos generales...");
      const generalUpdateData = {};
      if (date) generalUpdateData.date = date;
      // Manejar expirationDate: si no viene, no se cambia; si viene null/vacío, se pone null
      if (expirationDate !== undefined) generalUpdateData.expirationDate = expirationDate || null;
      if (status) generalUpdateData.status = status;
      if (applicantName) generalUpdateData.applicantName = applicantName;
      if (propertyAddress) generalUpdateData.propertyAddress = propertyAddress;
      if (contactCompany !== undefined) generalUpdateData.contactCompany = contactCompany; // 🆕 Guardar contacto
      if (discountDescription !== undefined) generalUpdateData.discountDescription = discountDescription;
      // Asegurar que discountAmount sea numérico
      if (discountAmount !== undefined) generalUpdateData.discountAmount = parseFloat(discountAmount) || 0;
      if (generalNotes !== undefined) generalUpdateData.generalNotes = generalNotes;
      
      // 🆕 Actualizar campos de comisiones
      if (leadSource !== undefined) generalUpdateData.leadSource = leadSource;
      if (createdByStaffId !== undefined) generalUpdateData.createdByStaffId = createdByStaffId || null;
      if (externalReferralName !== undefined) generalUpdateData.externalReferralName = leadSource === 'external_referral' ? externalReferralName : null;
      if (externalReferralEmail !== undefined) generalUpdateData.externalReferralEmail = leadSource === 'external_referral' ? externalReferralEmail : null;
      if (externalReferralPhone !== undefined) generalUpdateData.externalReferralPhone = leadSource === 'external_referral' ? externalReferralPhone : null;
      if (externalReferralCompany !== undefined) generalUpdateData.externalReferralCompany = leadSource === 'external_referral' ? externalReferralCompany : null;
      
      // Calcular y guardar salesCommissionAmount basado en el tipo de comisión
      // ✅ Actualizar si cambia leadSource O si cambia createdByStaffId en sales_rep
      const shouldUpdateCommission = leadSource !== undefined || (budget.leadSource === 'sales_rep' && createdByStaffId !== undefined);
      
      if (shouldUpdateCommission) {
        const currentLeadSource = leadSource !== undefined ? leadSource : budget.leadSource;
        const currentStaffId = createdByStaffId !== undefined ? createdByStaffId : budget.createdByStaffId;
        
        if (currentLeadSource === 'sales_rep' && currentStaffId) {
          // Usar comisión manual si fue enviada, sino leer del staff, sino $500
          if (salesCommissionAmount !== undefined && salesCommissionAmount !== null && parseFloat(salesCommissionAmount) >= 0) {
            generalUpdateData.salesCommissionAmount = parseFloat(salesCommissionAmount);
          } else {
            const salesRep = await Staff.findByPk(currentStaffId, { attributes: ['salesRepCommission'] });
            generalUpdateData.salesCommissionAmount = parseFloat(salesRep?.salesRepCommission) || 500;
          }
          console.log(`💰 Comisión actualizada para Staff ${currentStaffId}: $${generalUpdateData.salesCommissionAmount}`);
        } else if (currentLeadSource === 'external_referral' && salesCommissionAmount !== undefined) {
          generalUpdateData.salesCommissionAmount = parseFloat(salesCommissionAmount) || 0;
        } else {
          generalUpdateData.salesCommissionAmount = 0; // Sin comisión
        }
      }
      
      // Asegurar que initialPaymentPercentage sea numérico
      let actualPercentageForUpdate = undefined; // Solo actualiza si viene en el input
      if (initialPaymentPercentageInput !== undefined) {
        if (initialPaymentPercentageInput === 'total') {
          actualPercentageForUpdate = 100;
        } else {
          const parsedPercentage = parseFloat(initialPaymentPercentageInput);
          if (!isNaN(parsedPercentage)) {
            actualPercentageForUpdate = parsedPercentage;
          } else {
            actualPercentageForUpdate = 60; // Default si viene algo inválido que no sea 'total'
          }
        }
        generalUpdateData.initialPaymentPercentage = actualPercentageForUpdate; // Añadir al objeto de actualización
        console.log(`Porcentaje de pago inicial para actualizar: ${actualPercentageForUpdate}%`);
      }

      // Aplicar actualizaciones generales al objeto budget en memoria (importante para cálculos posteriores)
      Object.assign(budget, generalUpdateData);
      // Guardar actualizaciones generales en la BD
      await budget.update(generalUpdateData, { transaction });
      console.log(`Campos generales para Budget ID ${idBudget} actualizados en BD.`);

      // --- 4.5. Actualizar Permit asociado si es necesario ---
      if (applicantName || applicantEmail || applicantPhone || propertyAddress) {
        const permitUpdateData = {};
        if (applicantName) permitUpdateData.applicantName = applicantName;
        if (applicantEmail) permitUpdateData.applicantEmail = applicantEmail;
        if (applicantPhone) permitUpdateData.applicantPhone = applicantPhone;
        if (propertyAddress) permitUpdateData.propertyAddress = propertyAddress;

        // Buscar el Permit asociado si no está incluido en el budget
        if (!budget.Permit) {
          const budgetWithPermit = await Budget.findByPk(idBudget, {
            include: [{ model: Permit }],
            transaction
          });
          budget.Permit = budgetWithPermit?.Permit;
        }

        if (budget.Permit && Object.keys(permitUpdateData).length > 0) {
          await budget.Permit.update(permitUpdateData, { transaction });
          console.log(`✅ Permit ${budget.Permit.idPermit} actualizado desde updateBudget:`, permitUpdateData);
        }
      }

      // --- 5. Sincronizar BudgetLineItems (Eliminar y Recrear si se enviaron nuevos) ---
      let calculatedSubtotal = 0;
      let finalLineItemsForPdf = []; // Array para guardar los items que irán al PDF

      if (hasLineItemUpdates) {
        await BudgetLineItem.destroy({ where: { budgetId: idBudget }, transaction });

        const createdLineItems = [];
        for (const incomingItem of lineItems) {

          let priceAtTime = 0;
          let itemDataForCreation = {
            budgetId: idBudget,
            quantity: parseFloat(incomingItem.quantity) || 0,
            notes: incomingItem.notes || null,
            marca: incomingItem.marca || null,
            capacity: incomingItem.capacity || null,
            description: null,
          };

          // Validar quantity
          if (isNaN(itemDataForCreation.quantity) || itemDataForCreation.quantity <= 0) {
            console.error("Error: Item inválido encontrado:", incomingItem);
            throw new Error(`Item inválido: quantity debe ser un número positivo.`);
          }

          if (incomingItem.budgetItemId) {
            // Item del catálogo
            const budgetItemDetails = await BudgetItem.findByPk(incomingItem.budgetItemId, { transaction });

            if (!budgetItemDetails || !budgetItemDetails.isActive) {
              console.error("❌ Error: Item base no encontrado o inactivo:", incomingItem.budgetItemId);
              throw new Error(`El item base con ID ${incomingItem.budgetItemId} no se encontró o no está activo.`);
            }

            priceAtTime = parseFloat(budgetItemDetails.unitPrice);
            itemDataForCreation.budgetItemId = incomingItem.budgetItemId;
            itemDataForCreation.name = incomingItem.name || budgetItemDetails.name;
            itemDataForCreation.category = incomingItem.category || budgetItemDetails.category;
            itemDataForCreation.description = incomingItem.description || budgetItemDetails.description || null;
            itemDataForCreation.supplierName = incomingItem.supplierName || budgetItemDetails.supplierName || null; // ✅ AGREGAR SUPPLIERNAME
          } else if (incomingItem.name && incomingItem.category && incomingItem.unitPrice !== undefined) {
            // Item manual
            const manualPrice = parseFloat(incomingItem.unitPrice);
            if (isNaN(manualPrice) || manualPrice < 0) {
              console.error("Error: Precio inválido para item manual:", incomingItem);
              throw new Error(`Item manual inválido: unitPrice debe ser un número no negativo.`);
            }
            priceAtTime = manualPrice;
            itemDataForCreation.budgetItemId = null;
            itemDataForCreation.name = incomingItem.name;
            itemDataForCreation.category = incomingItem.category;
            itemDataForCreation.description = incomingItem.description || null;
            itemDataForCreation.supplierName = incomingItem.supplierName || null; // ✅ AGREGAR SUPPLIERNAME PARA ITEMS MANUALES
          } else {
            // Item inválido
            console.error("Error: Item inválido, falta información:", incomingItem);
            throw new Error(`Item inválido: debe tener 'budgetItemId' o ('name', 'category', 'unitPrice').`);
          }

          // Asignar precios y calcular total de línea
          itemDataForCreation.unitPrice = priceAtTime;
          itemDataForCreation.priceAtTimeOfBudget = priceAtTime;
          itemDataForCreation.lineTotal = priceAtTime * itemDataForCreation.quantity;

          const newItem = await BudgetLineItem.create(itemDataForCreation, { transaction });

          calculatedSubtotal += parseFloat(newItem.lineTotal || 0);
          createdLineItems.push(newItem);
        }

        finalLineItemsForPdf = createdLineItems.map(item => item.toJSON());
      } else {
        // ✅ CORRECCIÓN: Si no hay cambios en items, calcular desde items existentes
        console.log("No hay cambios en items, calculando subtotal desde items existentes...");
        const existingLineItems = await BudgetLineItem.findAll({
          where: { budgetId: idBudget },
          transaction
        });

        calculatedSubtotal = existingLineItems.reduce((sum, item) => {
          return sum + parseFloat(item.lineTotal || 0);
        }, 0);

        finalLineItemsForPdf = existingLineItems.map(item => item.toJSON());
        console.log(`Subtotal calculado desde ${existingLineItems.length} items existentes: ${calculatedSubtotal}`);
      }

      // --- 6. Recalcular y Actualizar Totales Finales y Pago Inicial en el Budget ---
      console.log("Recalculando totales finales...");
      // Usar los valores actualizados en el objeto 'budget' en memoria
      const finalDiscount = parseFloat(budget.discountAmount) || 0;
      
      // 🆕 Calcular comisión según el tipo
      let commission = 0;
      const currentLeadSource = budget.leadSource || 'web';
      if (currentLeadSource === 'sales_rep' && budget.createdByStaffId) {
        // Usar el salesCommissionAmount ya guardado en el budget (incluye override manual)
        commission = parseFloat(budget.salesCommissionAmount) || 500;
        console.log(`💰 Comisión de Sales Rep: $${commission} (Staff ID: ${budget.createdByStaffId})`);
      } else if (currentLeadSource === 'external_referral' && budget.salesCommissionAmount) {
        commission = parseFloat(budget.salesCommissionAmount) || 0;
        console.log(`💰 Comisión de Referido Externo: $${commission}`);
      } else {
        console.log(`💰 Sin comisión (Lead Source: ${currentLeadSource})`);
      }
      
      const finalTotal = calculatedSubtotal - finalDiscount + commission;
      // *** CORRECCIÓN: Usar el porcentaje actualizado en memoria para el cálculo ***
      const percentageForCalculation = parseFloat(budget.initialPaymentPercentage) || 60; // Lee el valor ya actualizado (o el original si no se actualizó)
      const calculatedInitialPayment = finalTotal * (percentageForCalculation / 100);
      // *** FIN CORRECCIÓN ***

      // ...

      // Actualizar el objeto budget en memoria con los nuevos totales
      Object.assign(budget, {
        subtotalPrice: calculatedSubtotal,
        totalPrice: finalTotal,
        initialPayment: calculatedInitialPayment, // Este es el initialPayment calculado
        commissionAmount: commission // 🆕 Guardar el monto de comisión calculado
      });

      // Guardar los nuevos totales en la BD (sin pdfPath aún)
      await budget.update({
        subtotalPrice: calculatedSubtotal,
        totalPrice: finalTotal,
        initialPayment: calculatedInitialPayment,
        commissionAmount: commission // 🆕 Guardar comisión en BD
      }, { transaction });
      console.log(`Totales finales para Budget ID ${idBudget} actualizados: Subtotal=${calculatedSubtotal}, Total=${finalTotal}, InitialPayment=${calculatedInitialPayment}`);

      // --- 7. Lógica Condicional por Estado ---
      // --- NUEVO: 7. Generar/Regenerar PDF SIEMPRE que haya cambios ---

      const updateKeys = Object.keys(req.body).filter(key => key !== 'lineItems');
      // Verificamos si la única clave presente es 'generalNotes'.
      const isOnlyGeneralNotesUpdate = updateKeys.length === 1 && updateKeys[0] === 'generalNotes';
      if ((hasGeneralUpdates || hasLineItemUpdates) && !isOnlyGeneralNotesUpdate) {
        console.log("Detectados cambios (no solo notas). Regenerando PDF...");
        try {
          const budgetDataForPdf = {
            ...budget.toJSON(), // Usar datos actualizados en memoria
            initialPaymentPercentage: budget.initialPaymentPercentage, // Asegurarse que esté
            lineItems: finalLineItemsForPdf
          };

          console.log("Datos para PDF:", JSON.stringify(budgetDataForPdf, null, 2));
          generatedPdfPath = await generateAndSaveBudgetPDF(budgetDataForPdf);

          // ✅ CONVERTIR RUTA LOCAL A URL PÚBLICA
          const pdfPublicUrl = getPublicPdfUrl(generatedPdfPath, req);

          console.log(`PDF regenerado en ruta local: ${generatedPdfPath}`);
          console.log(`PDF regenerado y ruta actualizada en BD para Budget ID ${idBudget}: ${pdfPublicUrl}`);

          // Actualizar la ruta del PDF en la BD DENTRO de la transacción
          await budget.update({ pdfPath: pdfPublicUrl }, { transaction });
          console.log(`PDF regenerado y ruta actualizada en BD para Budget ID ${idBudget}: ${generatedPdfPath}`);

        } catch (pdfError) {
          console.error(`Error CRÍTICO al regenerar PDF para Budget ID ${idBudget}:`, pdfError);
          // Lanzar error para revertir la transacción si la generación del PDF falla
          throw new Error(`Error al regenerar PDF: ${pdfError.message}`);
        }
      } else if (isOnlyGeneralNotesUpdate) {
        // Si solo cambiaron las notas, no regeneramos PDF y mantenemos la ruta existente.
        console.log("Solo se actualizaron las notas generales. Omitiendo regeneración de PDF.");
        generatedPdfPath = budget.pdfPath; // Usar la ruta existente
      } else {
        // Si no hubo ningún cambio detectado (ni general ni items)
        console.log("No hubo cambios relevantes, no se regenera el PDF.");
        generatedPdfPath = budget.pdfPath; // Usar la ruta existente
      }

      // --- 7a. Lógica si el estado es 'send' (Genera PDF y envía correo) ---
      if (req.body.status === 'send') {
        console.log("El estado es 'send'. Procesando envío de correo y SignNow...");

        // --- Enviar Correo (Usa generatedPdfPath o budget.pdfPath actualizado) ---
        const pdfPathForEmail = generatedPdfPath; // Usar la ruta (nueva o existente)

        if (!pdfPathForEmail || !fs.existsSync(pdfPathForEmail)) {
          console.error(`Error: No se encontró el archivo PDF en ${pdfPathForEmail} para enviar por correo (Budget ID: ${idBudget}).`);
          await transaction.rollback();
          return res.status(500).json({ error: 'Error interno: No se pudo encontrar el PDF para enviar.' });
        } else {
          console.log(`Usando PDF en ${pdfPathForEmail} para enviar correo...`);
          if (!budget.Permit?.applicantEmail || !budget.Permit.applicantEmail.includes('@')) {
            console.warn(`Advertencia: Cliente para Budget ID ${idBudget} sin correo válido. No se enviará email.`);
          } else {
            // ✅ Email con información sobre SignNow
            const clientMailOptions = {
              to: budget.Permit.applicantEmail,
              subject: `Budget Proposal #${idBudget} for ${budget.propertyAddress}`,
              text: `Dear ${budget.applicantName || 'Customer'},\n\nPlease find attached the budget proposal #${idBudget} for the property located at ${budget.propertyAddress}.\n\nExpiration Date: ${budget.expirationDate ? new Date(budget.expirationDate).toLocaleDateString() : 'N/A'}\nTotal Amount: $${parseFloat(budget.totalPrice || 0).toFixed(2)}\nInitial Payment (${budget.initialPaymentPercentage || 60}%): $${parseFloat(budget.initialPayment || 0).toFixed(2)}\n\n${budget.generalNotes ? 'Notes:\n' + budget.generalNotes + '\n\n' : ''}NEXT STEPS:\n- Review the attached PDF carefully\n- You will receive a separate email from SignNow to digitally sign the document once approved\n- If you have any questions, please contact us\n\nBest regards,\nZurcher Construction`,
              html: `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1a365d; margin-bottom: 20px;">Budget Proposal Ready for Review</h2>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Dear ${budget.Permit?.applicantName || budget.applicantName || 'Valued Customer'},
              </p>
              
              <p style="margin-bottom: 20px;">
                Please find attached your budget proposal <strong>#${idBudget}</strong> for the property located at <strong>${budget.propertyAddress}</strong>.
              </p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">Budget Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Expiration Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right;">${budget.expirationDate ? new Date(budget.expirationDate).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Total Amount:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; text-align: right; color: #28a745; font-weight: bold;">$${parseFloat(budget.totalPrice || 0).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Initial Payment (${budget.initialPaymentPercentage || 60}%):</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #007bff; font-weight: bold;">$${parseFloat(budget.initialPayment || 0).toFixed(2)}</td>
                  </tr>
                </table>
              </div>
              
              ${budget.generalNotes ? `
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <h4 style="color: #856404; margin-top: 0;">Additional Notes:</h4>
                <p style="margin-bottom: 0; color: #856404;">${budget.generalNotes}</p>
              </div>
              ` : ''}
              
              <div style="background-color: #e6f3ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #007bff;">
                <h3 style="color: #1a365d; margin-top: 0; margin-bottom: 15px;">📋 Next Steps:</h3>
                <div style="margin-bottom: 12px;">
                  <span style="display: inline-block; width: 20px; color: #007bff;">1.</span>
                  <strong>Review the attached PDF carefully</strong>
                </div>
                <div style="margin-bottom: 12px;">
                  <span style="display: inline-block; width: 20px; color: #007bff;">2.</span>
                  <strong>You will receive a separate email from SignNow</strong> to digitally sign the document once approved
                </div>
                <div style="margin-bottom: 0;">
                  <span style="display: inline-block; width: 20px; color: #007bff;">3.</span>
                  <strong>Contact us</strong> if you have any questions
                </div>
              </div>
              
              <p style="margin-top: 30px; margin-bottom: 30px;">
                Thank you for choosing <strong>Zurcher Construction</strong>!
              </p>
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #dee2e6; text-align: center;">
                <div style="color: #6c757d; font-size: 14px;">
                  <strong style="color: #1a365d;">Zurcher Septic</strong><br>
                  SEPTIC TANK DIVISION - CFC1433240<br>
                  📧 Contact: [admin@zurcherseptic.com] | 📞 [+1 (407) 419-4495]<br>
                  🌐 Professional Septic Installation & Maintenance
                </div>
              </div>
            </div>
          </div>
        `,
              attachments: [{
                filename: `budget_${idBudget}.pdf`,
                path: pdfPathForEmail,
                contentType: 'application/pdf'
              }],
            };

            try {
              console.log(`Intentando enviar correo con PDF e información de SignNow al cliente: ${budget.Permit.applicantEmail}`);
              const clientEmailResult = await sendEmail(clientMailOptions);
              
              if (clientEmailResult.success) {
                console.log(`✅ Correo con PDF e información de SignNow enviado exitosamente al cliente en ${clientEmailResult.duration}ms.`);
              } else {
                console.error(`❌ Error al enviar correo con PDF al cliente: ${clientEmailResult.error}`);
              }
            } catch (clientEmailError) {
              console.error(`❌ Error al enviar correo con PDF al cliente ${budget.Permit.applicantEmail}:`, clientEmailError);
            }
          }
        }

        // --- ✅ NUEVO: Enviar automáticamente a SignNow después del email ---
        console.log('\n🔄 === INICIANDO ENVÍO AUTOMÁTICO A SIGNNOW ===');

        try {
          // Verificar que existe información del solicitante para SignNow
          if (!budget.Permit?.applicantEmail) {
            console.error('❌ ERROR: No se encontró email del solicitante para SignNow');
            // No hacer rollback aquí, el email ya se envió exitosamente
            console.log('⚠️ Continuando sin envío a SignNow debido a falta de email');
          } else {
            console.log('✅ Información del firmante para SignNow:');
            console.log(`   - Email: ${budget.Permit.applicantEmail}`);
            console.log(`   - Nombre: ${budget.Permit.applicantName}`);
            console.log(`   - Dirección: ${budget.Permit.propertyAddress}`);

            // Inicializar servicio de firma (DocuSign o SignNow)
            const serviceName = USE_DOCUSIGN ? 'DocuSign' : 'SignNow';
            console.log(`🔧 Inicializando servicio ${serviceName} desde updateBudget...`);
            const signatureService = USE_DOCUSIGN ? new DocuSignService() : new SignNowService();

            // 🆕 Normalizar email a minúsculas para evitar problemas de deliverability
            const clientEmail = (budget.Permit.applicantEmail || '').toLowerCase().trim();
            const clientName = budget.Permit.applicantName || 'Valued Client';

            // Preparar información para el documento
            const propertyAddress = budget.Permit?.propertyAddress || budget.propertyAddress || 'Property';
            const fileName = `Budget_${budget.idBudget}_${propertyAddress.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

            console.log(`📁 Nombre del archivo para ${serviceName}: ${fileName}`);
            console.log(`📧 Email normalizado: ${clientEmail} (desde ${budget.Permit.applicantEmail})`);

            // Convertir URL pública a ruta local para SignNow
            let localPdfPath = null;

            if (pdfPathForEmail && (pdfPathForEmail.includes('/uploads/budgets/') || pdfPathForEmail.startsWith('http'))) {
              // Extraer nombre del archivo de la URL
              const pdfFileName = pdfPathForEmail.split('/').pop();
              localPdfPath = path.join(__dirname, '../uploads/budgets', pdfFileName);

              // Verificar que el archivo existe
              if (!fs.existsSync(localPdfPath)) {
                console.error(`❌ PDF no encontrado en ruta local: ${localPdfPath}`);
                localPdfPath = null;
              } else {
                console.log(`✅ PDF encontrado para ${serviceName}: ${localPdfPath}`);
              }
            }

            if (localPdfPath) {
              // Preparar parámetros según el servicio
              const emailSubject = `Please sign Budget for ${propertyAddress}`;
              const emailMessage = `Dear ${clientName},\n\n` +
                `Please review and sign the attached budget document.\n\n` +
                `If you have any questions, please contact us.\n\n` +
                `Best regards,\nZurcher Construction`;

              // Enviar documento para firma
              console.log(`📤 Enviando documento a ${serviceName} desde updateBudget...`);
              const signatureResult = USE_DOCUSIGN
                ? await signatureService.sendBudgetForSignature(
                    localPdfPath,
                    clientEmail,
                    clientName,
                    fileName,
                    emailSubject,
                    emailMessage
                  )
                : await signatureService.sendBudgetForSignature(
                    localPdfPath,
                    fileName,
                    clientEmail,
                    clientName
                  );

              console.log(`✅ Resultado exitoso de ${serviceName} desde updateBudget:`);
              console.log(JSON.stringify(signatureResult, null, 2));

              // Obtener document ID según el servicio
              const documentId = USE_DOCUSIGN ? signatureResult.envelopeId : signatureResult.documentId;

              // Actualizar presupuesto con información del servicio de firma
              console.log(`💾 Actualizando presupuesto con datos de ${serviceName}...`);
              await budget.update({
                signatureDocumentId: documentId,
                signNowDocumentId: USE_DOCUSIGN ? null : signatureResult.documentId, // Mantener compatibilidad
                docusignEnvelopeId: USE_DOCUSIGN ? signatureResult.envelopeId : null, // 🆕 Guardar envelope ID específico
                signatureMethod: USE_DOCUSIGN ? 'docusign' : 'signnow',
                status: 'sent_for_signature',
                sentForSignatureAt: new Date()
              }, { transaction });

              console.log(`✅ Budget actualizado con datos de ${serviceName}`);

              // Notificar al staff interno que se envió para firma
              try {
                await sendNotifications('budgetSentToSignNow', {
                  propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
                  applicantEmail: budget.Permit.applicantEmail,
                  applicantName: budget.Permit.applicantName,
                  idBudget: budget.idBudget,
                  documentId: documentId,
                  service: serviceName
                }, null, req.io);
                console.log(`📧 Notificaciones internas de ${serviceName} enviadas`);
              } catch (notificationError) {
                console.log(`⚠️ Error enviando notificaciones internas de ${serviceName}:`, notificationError.message);
                // No fallar la operación principal por esto
              }

              console.log(`🎉 === ENVÍO AUTOMÁTICO A ${serviceName.toUpperCase()} COMPLETADO ===\n`);
            } else {
              console.log(`⚠️ No se pudo obtener ruta local del PDF para ${serviceName}`);
            }
          }
        } catch (signatureServiceError) {
          console.error(`❌ ERROR enviando a ${USE_DOCUSIGN ? 'DocuSign' : 'SignNow'}:`, signatureServiceError);
          console.error('   - Mensaje:', signNowError.message);
          console.error('   - Stack:', signNowError.stack);

          console.log('⚠️ Continuando sin envío a SignNow debido a error');
          console.log('📧 El email fue enviado exitosamente, pero SignNow falló');
        }

        // Notificar al staff interno (siempre se notifica que se marcó como 'send')
        await sendNotifications('budgetSent', {
          propertyAddress: budget.propertyAddress,
          applicantEmail: budget.Permit?.applicantEmail,
          idBudget: budget.idBudget,
        }, null, req.io);
        console.log(`Notificaciones internas 'budgetSent' enviadas.`);

      } // --- Fin Lógica if (status === 'send') ---

      // --- 7b. Lógica si el estado es 'approved' ---
      if (budget.status === "approved") {
        console.log("El estado es 'approved'. Procesando creación/actualización de Work/Income...");

        // Determinar el monto real del pago inicial a usar
        let actualInitialPaymentAmount = parseFloat(budget.initialPayment); // Fallback al calculado
        if (budget.paymentProofAmount !== null && budget.paymentProofAmount !== undefined && !isNaN(parseFloat(budget.paymentProofAmount))) {
          actualInitialPaymentAmount = parseFloat(budget.paymentProofAmount);
          console.log(`Usando paymentProofAmount (${actualInitialPaymentAmount}) para Work/Income.`);
        } else {
          console.log(`Usando initialPayment calculado (${actualInitialPaymentAmount}) para Work/Income (paymentProofAmount no disponible o inválido).`);
        }

        let workRecord;
        const existingWork = await Work.findOne({ where: { idBudget: budget.idBudget }, transaction });

        if (!existingWork) {
          // --- Crear Nuevo Work y Nuevo Income ---
          console.log(`Creando nuevo Work para Budget ID: ${budget.idBudget}`);
          workRecord = await Work.create({
            propertyAddress: budget.propertyAddress,
            status: 'pending',
            idBudget: budget.idBudget,
            notes: `Work creado automáticamente al aprobar presupuesto N° ${budget.idBudget}`,
            initialPayment: actualInitialPaymentAmount,
            staffId: req.user?.id  // Agregar staffId
          }, { transaction });

          try {
            console.log(`Creando nuevo Income para Work ID: ${workRecord.idWork}`);
            console.log('👤 Usuario autenticado (req.user):', req.user?.id, req.user?.name);
            const now = new Date();
            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const createdIncome = await Income.create({
              date: localDate,
              amount: actualInitialPaymentAmount,
              typeIncome: 'Factura Pago Inicial Budget',
              notes: `Pago inicial registrado al aprobar Budget #${budget.idBudget}`,
              workId: workRecord.idWork,
              staffId: req.user?.id,  // ✅ Usuario autenticado que aprueba el Budget
              paymentMethod: budget.paymentProofMethod || paymentMethod || null, // 🆕 Usar método del Budget
              verified: false // 🆕 Por defecto no verificado
            }, { transaction });
            console.log(`Nuevo Income creado exitosamente con datos:`, {
              idIncome: createdIncome.idIncome,
              amount: createdIncome.amount,
              staffId: createdIncome.staffId,
              paymentMethod: createdIncome.paymentMethod,
              verified: createdIncome.verified
            });
            
            // 🏦 AUTO-CREAR BANK TRANSACTION
            try {
              await createDepositTransaction({
                paymentMethod: createdIncome.paymentMethod,
                amount: createdIncome.amount,
                date: createdIncome.date,
                description: `Pago Inicial Budget #${budget.idBudget} - Work #${workRecord.idWork.slice(0, 8)}`,
                relatedIncomeId: createdIncome.idIncome,
                notes: createdIncome.notes,
                createdByStaffId: createdIncome.staffId,
                transaction
              });
            } catch (bankError) {
              console.error('❌ Error creando transacción bancaria en Budget approval:', bankError.message);
              // No hacer rollback, continuar con el proceso
            }
            
            // 🚀 NOTIFICACIÓN DE INGRESO DESDE BUDGET
            setImmediate(async () => {
              try {
                const notificationData = {
                  ...createdIncome.toJSON(),
                  propertyAddress: budget.propertyAddress || workRecord.propertyAddress || 'Obra no especificada',
                  Staff: { name: 'Sistema - Aprobación Budget' }
                };
                await sendNotifications('incomeRegistered', notificationData);
                console.log(`✅ Notificación de pago inicial enviada: $${actualInitialPaymentAmount} - Budget #${budget.idBudget}`);
              } catch (notificationError) {
                console.error('❌ Error enviando notificación de pago inicial:', notificationError.message);
              }
            });
          } catch (incomeError) {
            console.error(`Error CRÍTICO al crear Income para nuevo Work ID ${workRecord.idWork}:`, incomeError);
            throw new Error("Fallo al crear el registro de ingreso asociado al nuevo Work.");
          }
        } else {
          // --- Work Existente: Verificar/Actualizar Work y Verificar/Crear/Actualizar Income ---
          console.log(`Work ya existente (ID: ${existingWork.idWork}) para Budget ID: ${budget.idBudget}. Verificando/Actualizando...`);
          workRecord = existingWork;

          if (parseFloat(workRecord.initialPayment) !== actualInitialPaymentAmount) {
            console.log(`Actualizando initialPayment en Work existente ${workRecord.idWork} de ${workRecord.initialPayment} a ${actualInitialPaymentAmount}`);
            await workRecord.update({ initialPayment: actualInitialPaymentAmount }, { transaction });
          }

          const existingIncome = await Income.findOne({
            where: { workId: workRecord.idWork, typeIncome: 'Factura Pago Inicial Budget' },
            transaction
          });

          if (!existingIncome) {
            console.warn(`Advertencia: Work ${workRecord.idWork} existía pero no se encontró Income inicial. Creando ahora.`);
            console.log('👤 Usuario autenticado (req.user):', req.user?.id, req.user?.name);
            try {
              const now = new Date();
              const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const createdLateIncome = await Income.create({
                date: localDate,
                amount: actualInitialPaymentAmount,
                typeIncome: 'Factura Pago Inicial Budget',
                notes: `Pago inicial (tardío) registrado al aprobar Budget #${budget.idBudget}`,
                workId: workRecord.idWork,
                staffId: req.user?.id, // ✅ Usuario autenticado que aprueba el Budget
                paymentMethod: budget.paymentProofMethod || paymentMethod || null, // 🆕 Usar método del Budget
                verified: false // 🆕 Por defecto no verificado
              }, { transaction });
              console.log(`Income (tardío) creado exitosamente con staffId:`, createdLateIncome.staffId);
              
              // 🏦 AUTO-CREAR BANK TRANSACTION
              try {
                await createDepositTransaction({
                  paymentMethod: createdLateIncome.paymentMethod,
                  amount: createdLateIncome.amount,
                  date: createdLateIncome.date,
                  description: `Pago Inicial (tardío) Budget #${budget.idBudget} - Work #${workRecord.idWork.slice(0, 8)}`,
                  relatedIncomeId: createdLateIncome.idIncome,
                  notes: createdLateIncome.notes,
                  createdByStaffId: createdLateIncome.staffId,
                  transaction
                });
              } catch (bankError) {
                console.error('❌ Error creando transacción bancaria en late Income:', bankError.message);
              }
              
              // 🚀 NOTIFICACIÓN DE INGRESO TARDÍO DESDE BUDGET
              setImmediate(async () => {
                try {
                  const notificationData = {
                    ...createdLateIncome.toJSON(),
                    propertyAddress: budget.propertyAddress || workRecord.propertyAddress || 'Obra no especificada',
                    Staff: { name: 'Sistema - Budget Tardío' }
                  };
                  await sendNotifications('incomeRegistered', notificationData);
                  console.log(`✅ Notificación de pago tardío enviada: $${actualInitialPaymentAmount} - Budget #${budget.idBudget}`);
                } catch (notificationError) {
                  console.error('❌ Error enviando notificación de pago tardío:', notificationError.message);
                }
              });
            } catch (lateIncomeError) {
              console.error(`Error CRÍTICO al crear Income (tardío) para Work ID ${workRecord.idWork}:`, lateIncomeError);
              throw new Error("Fallo al crear el registro de ingreso (tardío) asociado.");
            }
          } else {
            console.log(`Income inicial ya existente para Work ID: ${workRecord.idWork}. Verificando monto...`);
            if (parseFloat(existingIncome.amount) !== actualInitialPaymentAmount) {
              console.log(`Actualizando monto en Income existente ${existingIncome.id} de ${existingIncome.amount} a ${actualInitialPaymentAmount}`);
              await existingIncome.update({ amount: actualInitialPaymentAmount }, { transaction });
            }
          }
        }

        console.log("Preparando datos para notificación 'incomeCreated'...");
        const notificationDataForIncome = {
          amount: actualInitialPaymentAmount, // Usar monto determinado
          propertyAddress: budget.propertyAddress,
          budgetTotal: budget.totalPrice,
          budgetInitialPercentage: budget.initialPaymentPercentage
        };
        console.log("Datos para notificación:", notificationDataForIncome);
        await sendNotifications('incomeCreated', notificationDataForIncome, null, req.io, { userId: req.user?.id });
        console.log("Notificación 'incomeCreated' enviada.");

      }
      // --- 8. Confirmar Transacción ---
      await transaction.commit();
      console.log(`--- Transacción para Budget ID: ${idBudget} confirmada exitosamente. ---`);

      // --- 9. Responder al Frontend ---
      // Volver a buscar el budget fuera de la transacción para obtener el estado final MÁS actualizado
      const finalBudgetResponseData = await Budget.findByPk(idBudget, {
        include: [
          { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] },
          { model: BudgetLineItem, as: 'lineItems' } // Incluir items actualizados
        ]
      });

      if (!finalBudgetResponseData) {
        // Esto sería muy raro si la transacción se confirmó, pero por seguridad
        console.error(`Error: No se pudo encontrar el Budget ID ${idBudget} después de confirmar la transacción.`);
        return res.status(404).json({ error: 'Presupuesto no encontrado después de la actualización.' });
      }

      const responseData = finalBudgetResponseData.toJSON();
      // Añadir URLs dinámicas
      if (responseData.Permit) {
        const baseUrl = `${req.protocol}://${req.get('host')}/permits`;
        responseData.Permit.pdfDataUrl = `${baseUrl}/${responseData.Permit.idPermit}/view/pdf`;
        responseData.Permit.optionalDocsUrl = `${baseUrl}/${responseData.Permit.idPermit}/view/optional`;
      }
      // Añadir URL del PDF del budget si existe
      if (responseData.pdfPath && fs.existsSync(responseData.pdfPath)) {
        responseData.budgetPdfUrl = `${req.protocol}://${req.get('host')}/budgets/${idBudget}/pdf`; // Asegúrate que la ruta /budgets/:id/pdf exista y sirva el archivo
      }

      console.log(`Enviando respuesta exitosa para Budget ID: ${idBudget}`);
      res.status(200).json(responseData);

    } catch (error) {
      // --- Manejo de Errores y Rollback ---
      console.error(`Error FATAL durante la actualización del Budget ID ${idBudget}:`, error);
      // Asegurarse de hacer rollback si la transacción no ha terminado
      if (transaction && typeof transaction.rollback === 'function' && !transaction.finished) {
        try {
          await transaction.rollback();
          console.log(`Transacción para Budget ID ${idBudget} revertida debido a error.`);
        } catch (rollbackError) {
          console.error(`Error al intentar revertir la transacción para Budget ID ${idBudget}:`, rollbackError);
        }
      }
      // Devolver un error genérico o el mensaje específico si es seguro
      res.status(400).json({ error: error.message || 'Error interno al actualizar el presupuesto.' });
    }

  },
  async uploadInvoice(req, res) {
    const transaction = await conn.transaction();

    try {
      const { idBudget } = req.params;
      const { uploadedAmount, paymentMethod } = req.body; // 🆕 Agregar paymentMethod

      // Verificar si el archivo fue recibido
      console.log("ID del presupuesto recibido:", idBudget);
      console.log("Archivo recibido:", req.file);
      console.log("Monto del comprobante recibido (uploadedAmount):", uploadedAmount); // <--- Nuevo log
      console.log("Método de pago recibido (paymentMethod):", paymentMethod); // 🆕 Nuevo log

      if (!req.file) {
        await transaction.rollback();
        return res.status(400).json({ error: 'No se recibió ningún archivo de comprobante' });
      }

      let parsedUploadedAmount = null;
      if (uploadedAmount !== undefined && uploadedAmount !== null && String(uploadedAmount).trim() !== '') {
        parsedUploadedAmount = parseFloat(uploadedAmount);
        if (isNaN(parsedUploadedAmount) || parsedUploadedAmount < 0) {
          await transaction.rollback();
          console.error("Monto del comprobante inválido:", uploadedAmount);
          return res.status(400).json({ error: 'El monto del comprobante proporcionado no es un número válido o es negativo.' });
        }
      }

      // --- 1. Determinar el tipo de archivo ---
      let proofType;
      if (req.file.mimetype.startsWith('image/')) {
        proofType = 'image';
      } else if (req.file.mimetype === 'application/pdf') {
        proofType = 'pdf';
      } else {
        console.log("Tipo de archivo no soportado:", req.file.mimetype);
        return res.status(400).json({ error: 'Tipo de archivo de comprobante no soportado (PDF o Imagen requeridos)' });
      }
      console.log("Tipo de archivo determinado:", proofType);
      // --- Fin Determinar tipo ---

      const buffer = req.file.buffer;
      const fileName = `payment_proof_${idBudget}_${Date.now()}`;
      const folderName = 'payment_proofs';
      console.log("Nombre del archivo:", fileName);
      console.log("Carpeta de destino en Cloudinary:", folderName);

      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: proofType === 'pdf' ? 'raw' : 'image',
            folder: folderName,
            public_id: fileName,
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary error:', error);
              reject(error);
            } else {
              console.log("Resultado de la subida a Cloudinary:", result);
              resolve(result);
            }
          }
        ).end(buffer);
      });

      // Buscar presupuesto con Permit incluido
      console.log("Buscando presupuesto con ID:", idBudget);
      const budget = await Budget.findByPk(idBudget, { 
        include: [{ model: Permit }],
        transaction 
      });
      if (!budget) {
        console.log("Presupuesto no encontrado. Eliminando archivo de Cloudinary...");
        try {
          await cloudinary.uploader.destroy(uploadResult.public_id, {
            resource_type: uploadResult.resource_type || (proofType === 'pdf' ? 'raw' : 'image')
          });
        } catch (e) {
          console.error("Error al eliminar archivo de Cloudinary:", e);
        }
        await transaction.rollback();
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // ✅ VALIDAR: Estados permitidos para carga de comprobante de pago inicial
      const allowedStatesForPayment = [
        'created',
        'send',
        'sent_for_signature',
        'signed',
        'client_approved',
        'pending_review'
      ];

      if (!allowedStatesForPayment.includes(budget.status)) {
        console.warn(`Intento de cargar comprobante en estado no permitido: ${budget.status}`);
        try {
          await cloudinary.uploader.destroy(uploadResult.public_id, {
            resource_type: uploadResult.resource_type || (proofType === 'pdf' ? 'raw' : 'image')
          });
        } catch (e) {
          console.error("Error al eliminar archivo de Cloudinary:", e);
        }
        await transaction.rollback();
        return res.status(400).json({ 
          error: `No se puede cargar el comprobante de pago en el estado actual: "${budget.status}". Estados permitidos: ${allowedStatesForPayment.join(', ')}` 
        });
      }
      console.log(`✅ Estado del presupuesto válido para carga de pago: ${budget.status}`);

      // ✅ PERMITIR: Eliminar comprobante anterior de Cloudinary si existe
      if (budget.paymentInvoice) {
        console.log("Comprobante anterior encontrado, eliminando de Cloudinary...");
        // Extraer public_id del URL anterior
        const oldPublicId = budget.paymentInvoice.split('/').pop().split('.')[0];
        try {
          await cloudinary.uploader.destroy(`payment_proofs/${oldPublicId}`, {
            resource_type: budget.paymentProofType === 'pdf' ? 'raw' : 'image'
          });
          console.log("Comprobante anterior eliminado de Cloudinary");
        } catch (e) {
          console.warn("Error al eliminar comprobante anterior de Cloudinary:", e);
        }
      }

      // Guardar URL, TIPO y MONTO DEL COMPROBANTE
      budget.paymentInvoice = uploadResult.secure_url;
      budget.paymentProofType = proofType;
      if (parsedUploadedAmount !== null) {
        budget.paymentProofAmount = parsedUploadedAmount;
        console.log(`Budget #${budget.idBudget}: Comprobante guardado - Monto: $${parsedUploadedAmount}`);
      }
      // 🆕 GUARDAR MÉTODO DE PAGO
      if (paymentMethod) {
        budget.paymentProofMethod = paymentMethod;
      }
      
      await budget.save({ transaction });
      
      // ✅ RECARGAR el budget desde la BD para obtener el estado REAL después del hook
      await budget.reload({ transaction });

      // ✅ LÓGICA UNIVERSAL: SIEMPRE crear/actualizar Work + Income cuando hay pago inicial
      // No importa el estado - si hay pago, debe haber Work + Income
      const amountForIncome = parsedUploadedAmount || budget.initialPayment;
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 🆕 BUSCAR O CREAR WORK PRIMERO
      let existingWork = await Work.findOne({
        where: { idBudget: budget.idBudget },
        transaction
      });
      
      if (!existingWork) {
        existingWork = await Work.create({
          propertyAddress: budget.propertyAddress,
          idPermit: budget.PermitIdPermit, // ✅ Agregar idPermit para nueva FK
          status: 'pending',
          idBudget: budget.idBudget,
          notes: `Work creado al registrar pago inicial de Budget #${budget.idBudget}`,
          initialPayment: amountForIncome,
          staffId: req.user?.id
        }, { transaction });
        console.log(`✅ Work creado para Budget #${budget.idBudget} - ID: ${existingWork.idWork}`);
      } else {
        // Actualizar monto si cambió Y asegurar que tenga idPermit
        const updates = {};
        if (parseFloat(existingWork.initialPayment) !== parseFloat(amountForIncome)) {
          updates.initialPayment = amountForIncome;
        }
        if (!existingWork.idPermit && budget.PermitIdPermit) {
          updates.idPermit = budget.PermitIdPermit; // ✅ Poblar idPermit si falta
        }
        
        if (Object.keys(updates).length > 0) {
          await existingWork.update(updates, { transaction });
          console.log(`Work #${existingWork.idWork} actualizado:`, updates);
        }
      }

      // BUSCAR O CREAR INCOME asociado al Work
      let existingIncome = await Income.findOne({
        where: {
          workId: existingWork.idWork,
          typeIncome: 'Factura Pago Inicial Budget'
        },
        transaction
      });
      
      if (existingIncome) {
        // Actualizar Income existente
        await existingIncome.update({
          amount: amountForIncome,
          paymentMethod: paymentMethod || existingIncome.paymentMethod,
          notes: `Pago inicial actualizado para Budget #${budget.idBudget}`,
          staffId: req.user?.id
        }, { transaction });
        console.log(`Income #${existingIncome.idIncome} actualizado - $${amountForIncome}`);
      } else {
        // Crear nuevo Income
        existingIncome = await Income.create({
          date: localDate,
          amount: amountForIncome,
          typeIncome: 'Factura Pago Inicial Budget',
          notes: `Pago inicial para Budget #${budget.idBudget}`,
          workId: existingWork.idWork,
          staffId: req.user?.id,
          paymentMethod: paymentMethod || null,
          verified: false
        }, { transaction });
        console.log(`✅ Income creado para Budget #${budget.idBudget} - ID: ${existingIncome.idIncome} - $${amountForIncome}`);
        
        // 🏦 AUTO-CREAR BANK TRANSACTION
        try {
          await createDepositTransaction({
            paymentMethod: existingIncome.paymentMethod,
            amount: existingIncome.amount,
            date: existingIncome.date,
            description: `Pago Inicial Budget #${budget.idBudget} - Work #${existingWork.idWork.slice(0, 8)}`,
            relatedIncomeId: existingIncome.idIncome,
            notes: existingIncome.notes,
            createdByStaffId: existingIncome.staffId,
            transaction
          });
        } catch (bankError) {
          console.error('❌ Error creando transacción bancaria en Budget payment:', bankError.message);
        }
        
        // 🚀 Notificación de Income inmediata
        setImmediate(async () => {
          try {
            const notificationData = {
              ...existingIncome.toJSON(),
              propertyAddress: budget.propertyAddress,
              Staff: req.user ? { name: req.user.name } : { name: 'Sistema' }
            };
            await sendNotifications('incomeRegistered', notificationData);
          } catch (notificationError) {
            console.error('❌ Error enviando notificación de pago inicial:', notificationError.message);
          }
        });
      }

      // ✅ Crear/Actualizar Receipt para el Income
      if (existingIncome && uploadResult?.secure_url) {
        let existingReceipt = await Receipt.findOne({
          where: {
            relatedModel: 'Income',
            relatedId: existingIncome.idIncome
          },
          transaction
        });

        const receiptData = {
          fileUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          mimeType: req.file?.mimetype || 'application/pdf',
          originalName: req.file?.originalname || 'comprobante_pago_inicial.pdf',
          staffId: req.user?.id
        };

        if (existingReceipt) {
          await existingReceipt.update({
            ...receiptData,
            notes: `Comprobante actualizado para Budget #${budget.idBudget}`
          }, { transaction });
        } else {
          await Receipt.create({
            relatedModel: 'Income',
            relatedId: existingIncome.idIncome,
            type: 'Factura Pago Inicial Budget',
            notes: `Comprobante de pago inicial para Budget #${budget.idBudget}`,
            ...receiptData
          }, { transaction });
        }
      }

      await transaction.commit();

      res.status(200).json({
        message: 'Comprobante de pago cargado exitosamente',
        cloudinaryUrl: uploadResult.secure_url,
        proofType: proofType,
        uploadedAmount: budget.paymentProofAmount,
        reupload: !!budget.paymentInvoice // ✅ Indicar si fue una recarga
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Error al subir el comprobante de pago:', error);
      res.status(500).json({ error: error.message });
    }
  },



  async deleteBudget(req, res) {
    const transaction = await conn.transaction();
    
    try {
      const { idBudget } = req.params;

      // Diferir la verificación de constraints FK hasta el commit
      await conn.query('SET CONSTRAINTS ALL DEFERRED', { transaction });

      // Buscar el presupuesto con todas sus relaciones incluyendo Permit
      const budget = await Budget.findByPk(idBudget, {
        include: [
          { model: BudgetLineItem, as: 'lineItems' },
          { model: Work },
          { model: Permit, as: 'Permit' } // 🆕 Incluir Permit
        ],
        transaction
      });

      if (!budget) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // 🆕 VALIDACIÓN: Si tiene Works asociados, NO permitir eliminación directa
      if (budget.Works && budget.Works.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'No se puede eliminar el presupuesto porque tiene proyectos (Works) asociados',
          message: 'Para eliminar este presupuesto, primero debes eliminar todos los proyectos (Works) asociados a él.',
          workCount: budget.Works.length,
          works: budget.Works.map(w => ({
            idWork: w.idWork,
            address: w.address,
            status: w.status
          }))
        });
      }

      console.log(`🗑️ Eliminando Budget #${idBudget}...`);

      // 1. Eliminar PDFs de Cloudinary si existen
      const cloudinaryDeletes = [];
      
      if (budget.legacySignedPdfPublicId) {
        console.log(`Eliminando PDF legacy de Cloudinary: ${budget.legacySignedPdfPublicId}`);
        cloudinaryDeletes.push(
          cloudinary.uploader.destroy(budget.legacySignedPdfPublicId, { resource_type: 'raw' })
            .catch(err => console.warn(`Error eliminando PDF legacy:`, err.message))
        );
      }

      // 2. Eliminar comprobante de pago inicial de Cloudinary si existe
      if (budget.paymentInvoice && budget.paymentInvoice.includes('cloudinary')) {
        const publicId = budget.paymentInvoice.split('/').slice(-2).join('/').split('.')[0];
        console.log(`Eliminando comprobante de pago de Cloudinary: ${publicId}`);
        cloudinaryDeletes.push(
          cloudinary.uploader.destroy(publicId, { 
            resource_type: budget.paymentProofType === 'pdf' ? 'raw' : 'image' 
          }).catch(err => console.warn(`Error eliminando comprobante:`, err.message))
        );
      }

      // 🆕 3. Eliminar PDFs del Permit de Cloudinary si existen (si es legacy)
      if (budget.Permit && budget.Permit.isLegacy) {
        if (budget.Permit.pdfPublicId) {
          console.log(`Eliminando PDF del Permit de Cloudinary: ${budget.Permit.pdfPublicId}`);
          cloudinaryDeletes.push(
            cloudinary.uploader.destroy(budget.Permit.pdfPublicId, { resource_type: 'raw' })
              .catch(err => console.warn(`Error eliminando PDF del Permit:`, err.message))
          );
        }
        if (budget.Permit.optionalDocsPublicId) {
          console.log(`Eliminando OptionalDocs del Permit de Cloudinary: ${budget.Permit.optionalDocsPublicId}`);
          cloudinaryDeletes.push(
            cloudinary.uploader.destroy(budget.Permit.optionalDocsPublicId, { resource_type: 'raw' })
              .catch(err => console.warn(`Error eliminando OptionalDocs del Permit:`, err.message))
          );
        }
      }

      await Promise.all(cloudinaryDeletes);

      // 4. Eliminar archivos locales si existen
      if (budget.pdfPath && fs.existsSync(budget.pdfPath)) {
        fs.unlinkSync(budget.pdfPath);
        console.log(`Archivo local eliminado: ${budget.pdfPath}`);
      }

      if (budget.signedPdfPath && fs.existsSync(budget.signedPdfPath)) {
        fs.unlinkSync(budget.signedPdfPath);
        console.log(`PDF firmado eliminado: ${budget.signedPdfPath}`);
      }

      // 🆕 5. Guardar el ID del Permit para eliminarlo después
      const permitIdToDelete = budget.PermitIdPermit;

      // 6. Eliminar el Budget primero (trigger CASCADE para BudgetLineItems)
      // Nota: Esto NO eliminará Works porque Work.idBudget tiene ON DELETE SET NULL
      await budget.destroy({ transaction });
      console.log(`✅ Budget #${idBudget} eliminado`);

      // 7. Eliminar el Permit ahora que el Budget ya no existe
      if (permitIdToDelete) {
        console.log(`Eliminando Permit asociado: ${permitIdToDelete}`);
        await Permit.destroy({
          where: { idPermit: permitIdToDelete },
          transaction
        });
        console.log(`✅ Permit ${permitIdToDelete} eliminado exitosamente`);
      }

      await transaction.commit();
      console.log(`✅ Budget #${idBudget} y Permit eliminados exitosamente`);
      
      res.status(200).json({ 
        success: true, 
        message: `Presupuesto #${idBudget} eliminado junto con ${budget.lineItems?.length || 0} items${permitIdToDelete ? ' y su Permit asociado' : ''}` 
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error al eliminar el presupuesto:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async downloadBudgetPDF(req, res) {
    try {
      const { idBudget } = req.params;
      console.log(`Solicitud para descargar PDF de Budget ID: ${idBudget}`);

      const budget = await Budget.findByPk(idBudget, { attributes: ['pdfPath'] });

      if (!budget || !budget.pdfPath) {
        console.log(`PDF no encontrado en BD para Budget ID: ${idBudget}`);
        return res.status(404).send('PDF no encontrado para este presupuesto.');
      }

      // ✅ CONVERTIR URL PÚBLICA A RUTA LOCAL
      let localPdfPath;

      if (budget.pdfPath.startsWith('http')) {
        // Es una URL pública, convertir a ruta local
        const fileName = budget.pdfPath.split('/').pop(); // Extraer 'budget_X.pdf'
        localPdfPath = path.join(__dirname, '../uploads/budgets', fileName);
        console.log(`Convertido URL pública a ruta local: ${budget.pdfPath} -> ${localPdfPath}`);
      } else {
        // Es una ruta local directa (para compatibility con PDFs antiguos)
        localPdfPath = budget.pdfPath;
      }

      // Verificar si el archivo existe en el sistema de archivos
      if (!fs.existsSync(localPdfPath)) {
        console.error(`Error: Archivo PDF no encontrado en la ruta física: ${localPdfPath}`);

        // 🔧 INTENTAR REGENERAR EL PDF SI NO EXISTE
        console.log(`Intentando regenerar PDF para Budget ID: ${idBudget}`);
        try {
          // Obtener todos los datos del budget para regenerar el PDF
          const fullBudget = await Budget.findByPk(idBudget, {
            include: [
              { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] },
              { model: BudgetLineItem, as: 'lineItems' }
            ]
          });

          if (!fullBudget) {
            return res.status(404).send('Presupuesto no encontrado.');
          }

          // Regenerar el PDF
          const { generateAndSaveBudgetPDF } = require('../utils/pdfGenerators');
          const regeneratedPdfPath = await generateAndSaveBudgetPDF(fullBudget.toJSON());

          // Actualizar la ruta en la base de datos
          const pdfPublicUrl = getPublicPdfUrl(regeneratedPdfPath, req);
          await fullBudget.update({ pdfPath: pdfPublicUrl });

          console.log(`PDF regenerado exitosamente: ${regeneratedPdfPath}`);
          localPdfPath = regeneratedPdfPath;

        } catch (regenerationError) {
          console.error(`Error al regenerar PDF:`, regenerationError);
          return res.status(500).send('Error al regenerar el archivo PDF.');
        }
      }

      // Usar res.download() para forzar la descarga con el nombre original
      const filename = path.basename(localPdfPath); // Extrae 'budget_XX.pdf' de la ruta completa
      console.log(`Intentando descargar archivo: ${localPdfPath} como ${filename}`);

      res.download(localPdfPath, filename, (err) => {
        if (err) {
          console.error(`Error al enviar el archivo PDF (${filename}):`, err);
          if (!res.headersSent) {
            res.status(500).send('Error al descargar el archivo PDF.');
          }
        } else {
          console.log(`PDF ${filename} descargado exitosamente.`);
        }
      });

    } catch (error) {
      console.error(`Error general en downloadBudgetPDF para ID ${req.params.idBudget}:`, error);
      if (!res.headersSent) {
        res.status(500).send('Error interno al procesar la solicitud del PDF.');
      }
    }
  },

  async uploadBudgetPDF(req, res) {
    try {
      const { idBudget } = req.params;

      // Verificar si el archivo fue recibido
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
      }

      // Buscar el presupuesto
      const budget = await Budget.findByPk(idBudget);
      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Verificar si la carpeta 'uploads' existe, si no, crearla
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Guardar el archivo en el sistema de archivos
      const pdfPath = path.join(uploadsDir, `budget_${idBudget}.pdf`);
      fs.writeFileSync(pdfPath, req.file.buffer);

      // Actualizar el presupuesto con la ruta del PDF
      budget.pdfPath = pdfPath; // Asignar el valor al modelo
      await budget.save(); // Guardar los cambios en la base de datos

      res.status(200).json({ message: 'PDF subido y asociado al presupuesto exitosamente', pdfPath });
    } catch (error) {
      console.error('Error al subir el PDF:', error);
      res.status(500).json({ error: 'Error interno al subir el PDF' });
    }
  },
  async viewBudgetPDF(req, res) {
    try {
      const { idBudget } = req.params;
      console.log(`Solicitud para ver PDF de Budget ID: ${idBudget}`);

      const budget = await Budget.findByPk(idBudget, { attributes: ['pdfPath'] });

      if (!budget || !budget.pdfPath) {
        console.log(`PDF no encontrado en BD para Budget ID: ${idBudget}`);
        return res.status(404).send('PDF no encontrado para este presupuesto.');
      }

      // ✅ CONVERTIR URL PÚBLICA A RUTA LOCAL
      let localPdfPath;

      if (budget.pdfPath.startsWith('http')) {
        // Es una URL pública, convertir a ruta local
        const fileName = budget.pdfPath.split('/').pop(); // Extraer 'budget_X.pdf'
        localPdfPath = path.join(__dirname, '../uploads/budgets', fileName);
        console.log(`Convertido URL pública a ruta local para vista: ${budget.pdfPath} -> ${localPdfPath}`);
      } else {
        // Es una ruta local directa (para compatibility con PDFs antiguos)
        localPdfPath = budget.pdfPath;
      }

      // Verificar si el archivo existe
      if (!fs.existsSync(localPdfPath)) {
        console.error(`Error: Archivo PDF no encontrado en la ruta física: ${localPdfPath}`);

        // 🔧 INTENTAR REGENERAR EL PDF SI NO EXISTE
        console.log(`Intentando regenerar PDF para visualización - Budget ID: ${idBudget}`);
        try {
          // Obtener todos los datos del budget para regenerar el PDF
          const fullBudget = await Budget.findByPk(idBudget, {
            include: [
              { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] },
              { model: BudgetLineItem, as: 'lineItems' }
            ]
          });

          if (!fullBudget) {
            return res.status(404).send('Presupuesto no encontrado.');
          }

          // Regenerar el PDF
          const { generateAndSaveBudgetPDF } = require('../utils/pdfGenerators');
          const regeneratedPdfPath = await generateAndSaveBudgetPDF(fullBudget.toJSON());

          // Actualizar la ruta en la base de datos
          const pdfPublicUrl = getPublicPdfUrl(regeneratedPdfPath, req);
          await fullBudget.update({ pdfPath: pdfPublicUrl });

          console.log(`PDF regenerado exitosamente para visualización: ${regeneratedPdfPath}`);
          localPdfPath = regeneratedPdfPath;

        } catch (regenerationError) {
          console.error(`Error al regenerar PDF para visualización:`, regenerationError);
          return res.status(500).send('Error al regenerar el archivo PDF.');
        }
      }

      // *** Establecer cabeceras mejoradas para visualización inline y compatibilidad con Chrome ***
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="budget_' + idBudget + '.pdf"');
      res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '-1');

      // Cabeceras CORS para evitar bloqueos
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');

      // Leer el archivo y enviarlo como stream
      const stat = fs.statSync(localPdfPath);
      res.setHeader('Content-Length', stat.size);

      // Crear stream de lectura y enviarlo
      const fileStream = fs.createReadStream(localPdfPath);

      fileStream.on('error', (err) => {
        console.error(`Error en el stream del PDF para visualización (ID ${idBudget}):`, err);
        if (!res.headersSent) {
          res.status(500).send('Error al leer el archivo PDF.');
        }
      });

      fileStream.pipe(res);

    } catch (error) {
      console.error(`Error general en viewBudgetPDF para ID ${req.params.idBudget}:`, error);
      if (!res.headersSent) {
        res.status(500).send('Error interno al procesar la solicitud del PDF.');
      }
    }
  },



  async previewBudgetPDF(req, res) {
    const { idBudget } = req.params;

    try {
      // 1. Buscar el presupuesto con TODOS los datos necesarios para el PDF
      const budget = await Budget.findByPk(idBudget, {
        include: [
          { model: Permit, as: 'Permit' },
          { model: BudgetLineItem, as: 'lineItems' }
        ]
      });

      if (!budget) {
        return res.status(404).json({ error: true, message: 'Presupuesto no encontrado.' });
      }

      // 2. Generar el PDF al momento
      const { generateAndSaveBudgetPDF } = require('../utils/pdfGenerators');
      const tempPdfPath = await generateAndSaveBudgetPDF(budget.toJSON());

      // 3. Establecer cabeceras para mostrar el PDF inline
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="preview_budget_${idBudget}.pdf"`);

      // 4. Enviar el archivo
      res.sendFile(tempPdfPath, (err) => {
        if (err) {
          console.error('Error enviando PDF:', err);
          if (!res.headersSent) {
            res.status(500).send('Error al enviar el PDF.');
          }
        }

        // 5. Limpiar el archivo temporal
        setTimeout(() => {
          if (fs.existsSync(tempPdfPath)) {
            fs.unlink(tempPdfPath, (unlinkErr) => {
              if (unlinkErr) console.error('Error eliminando archivo temporal:', unlinkErr);
            });
          }
        }, 1000);
      });

    } catch (error) {
      console.error('Error al generar la vista previa del PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: 'Error interno al generar la vista previa del PDF.' });
      }
    }
  },

  // ✅ MÉTODO DE DIAGNÓSTICO PARA SMTP EN PRODUCCIÓN
  // async diagnoseEmail(req, res) {
  //   try {
  //     console.log('🔍 Iniciando diagnóstico de email...');
      
  //     // ✅ VERIFICAR VARIABLES DE ENTORNO
  //     const smtpConfig = {
  //       host: process.env.SMTP_HOST,
  //       port: process.env.SMTP_PORT,
  //       secure: process.env.SMTP_SECURE,
  //       user: process.env.SMTP_USER ? '***configurado***' : 'NO CONFIGURADO',
  //       pass: process.env.SMTP_PASSWORD ? '***configurado***' : 'NO CONFIGURADO',
  //       from: process.env.SMTP_FROM,
  //       nodeEnv: process.env.NODE_ENV
  //     };
      
  //     console.log('📋 Configuración SMTP:', smtpConfig);
      
  //     // ✅ PROBAR CONEXIÓN
  //     const { sendEmail } = require('../utils/notifications/emailService');
      
  //     const testEmail = {
  //       to: process.env.OWNER_EMAIL || 'damian@zurcherseptic.com', // Email corporativo del owner
  //       subject: 'Test de diagnóstico SMTP - ZurcherAPI',
  //       text: `Test de diagnóstico realizado en ${new Date().toISOString()}\n\nConfiguración:\n${JSON.stringify(smtpConfig, null, 2)}`,
  //       html: `
  //         <h2>🔧 Test de Diagnóstico SMTP</h2>
  //         <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
  //         <p><strong>Entorno:</strong> ${process.env.NODE_ENV}</p>
  //         <p><strong>Host:</strong> ${process.env.SMTP_HOST}</p>
  //         <p><strong>Puerto:</strong> ${process.env.SMTP_PORT}</p>
  //         <p><strong>Seguro:</strong> ${process.env.SMTP_SECURE}</p>
  //       `
  //     };
      
  //     console.log('📤 Enviando email de prueba...');
  //     const result = await sendEmail(testEmail);
      
  //     if (result.success) {
  //       console.log('✅ Email de diagnóstico enviado exitosamente');
  //       res.json({
  //         success: true,
  //         message: 'Diagnóstico completado exitosamente',
  //         config: smtpConfig,
  //         testResult: result
  //       });
  //     } else {
  //       console.error('❌ Falló el email de diagnóstico:', result.error);
  //       res.status(500).json({
  //         success: false,
  //         message: 'Falló el envío del email de diagnóstico',
  //         config: smtpConfig,
  //         error: result.error
  //       });
  //     }
      
  //   } catch (error) {
  //     console.error('❌ Error en diagnóstico de email:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Error en diagnóstico',
  //       error: error.message
  //     });
  //   }
  // }

  // ========== NUEVOS MÉTODOS PARA EDITAR DATOS DE CLIENTE ==========

  /**
   * Método para actualizar datos de cliente en Budget y Permit asociado
   * PATCH /api/budgets/:idBudget/client-data
   */
  async updateClientData(req, res) {
    const transaction = await conn.transaction();
    
    try {
      const { idBudget } = req.params;
      const { applicantName, applicantEmail, applicantPhone, propertyAddress, contactCompany } = req.body;

      // Validaciones básicas
      if (!applicantName && !applicantEmail && !applicantPhone && !propertyAddress && !contactCompany) {
        return res.status(400).json({
          error: true,
          message: 'Se requiere al menos un campo para actualizar (applicantName, applicantEmail, applicantPhone, propertyAddress, contactCompany)'
        });
      }

      // Buscar el Budget con su Permit asociado
      const budget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['idPermit', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress']
        }],
        transaction
      });

      if (!budget) {
        await transaction.rollback();
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      // Preparar datos para actualizar en Budget
      const budgetUpdateData = {};
      if (applicantName) budgetUpdateData.applicantName = applicantName;
      if (propertyAddress) budgetUpdateData.propertyAddress = propertyAddress;
      if (contactCompany !== undefined) budgetUpdateData.contactCompany = contactCompany; // 🆕 NUEVO

      // Preparar datos para actualizar en Permit
      const permitUpdateData = {};
      if (applicantName) permitUpdateData.applicantName = applicantName;
      if (applicantEmail) permitUpdateData.applicantEmail = applicantEmail;
      if (applicantPhone) permitUpdateData.applicantPhone = applicantPhone;
      if (propertyAddress) permitUpdateData.propertyAddress = propertyAddress;

      // Actualizar Budget si es necesario
      if (Object.keys(budgetUpdateData).length > 0) {
        await budget.update(budgetUpdateData, { transaction });
        console.log(`✅ Budget ${idBudget} actualizado:`, budgetUpdateData);
      }

      // Actualizar Permit si es necesario y existe
      if (budget.Permit && Object.keys(permitUpdateData).length > 0) {
        await budget.Permit.update(permitUpdateData, { transaction });
        console.log(`✅ Permit ${budget.Permit.idPermit} actualizado:`, permitUpdateData);
      }

      await transaction.commit();

      // Obtener el budget actualizado con los datos del permit
      const updatedBudget = await Budget.findByPk(idBudget, {
        include: [{
          model: Permit,
          attributes: ['idPermit', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress', 'permitNumber']
        }]
      });

      res.status(200).json({
        success: true,
        message: 'Datos de cliente actualizados correctamente',
        data: {
          budget: {
            idBudget: updatedBudget.idBudget,
            applicantName: updatedBudget.applicantName,
            propertyAddress: updatedBudget.propertyAddress,
            contactCompany: updatedBudget.contactCompany // 🆕 NUEVO
          },
          permit: updatedBudget.Permit ? {
            idPermit: updatedBudget.Permit.idPermit,
            applicantName: updatedBudget.Permit.applicantName,
            applicantEmail: updatedBudget.Permit.applicantEmail,
            applicantPhone: updatedBudget.Permit.applicantPhone,
            propertyAddress: updatedBudget.Permit.propertyAddress
          } : null
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error al actualizar datos de cliente:', error);
      res.status(500).json({
        error: true,
        message: 'Error interno del servidor al actualizar datos de cliente',
        details: error.message
      });
    }
  },

  /**
   * Método para obtener datos actuales de cliente de un Budget
   * GET /api/budgets/:idBudget/client-data
   */
  async getClientData(req, res) {
    try {
      const { idBudget } = req.params;

      const budget = await Budget.findByPk(idBudget, {
        attributes: ['idBudget', 'applicantName', 'propertyAddress', 'status', 'date', 'contactCompany'], // 🆕 AGREGADO contactCompany
        include: [{
          model: Permit,
          attributes: ['idPermit', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress', 'permitNumber']
        }]
      });

      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          budget: {
            idBudget: budget.idBudget,
            applicantName: budget.applicantName,
            propertyAddress: budget.propertyAddress,
            contactCompany: budget.contactCompany, // 🆕 AGREGADO
            status: budget.status,
            date: budget.date
          },
          permit: budget.Permit ? {
            idPermit: budget.Permit.idPermit,
            applicantName: budget.Permit.applicantName,
            applicantEmail: budget.Permit.applicantEmail,
            applicantPhone: budget.Permit.applicantPhone,
            propertyAddress: budget.Permit.propertyAddress,
            permitNumber: budget.Permit.permitNumber
          } : null
        }
      });

    } catch (error) {
      console.error('❌ Error al obtener datos de cliente:', error);
      res.status(500).json({
        error: true,
        message: 'Error interno del servidor al obtener datos de cliente',
        details: error.message
      });
    }
  },

  // === 📥 IMPORTAR TRABAJO EXISTENTE (SIMPLIFICADO) ===
  async createLegacyBudget(req, res) {
    // Usar la función simplificada del ImportWorkController
    const { importExistingWork } = require('./ImportWorkController');
    return await importExistingWork(req, res);
  },

  // 🆕 FUNCIÓN LEGACY ANTERIOR (por si acaso se necesita)
  async createLegacyBudgetOLD(req, res) {
    const transaction = await conn.transaction();
    
    try {
      console.log("--- Iniciando createLegacyBudget (Migración de trabajos antiguos) ---");
      
      // Manejar archivos subidos y guardarlos temporalmente en disco
      const fs = require('fs');
      const path = require('path');
      
      const uploadedFiles = {
        permitPdf: req.files?.permitPdf?.[0] || null,
        budgetPdf: req.files?.budgetPdf?.[0] || null,
        optionalDocs: req.files?.optionalDocs?.[0] || null
      };
      
      console.log("📁 Archivos recibidos:", {
        permitPdf: !!uploadedFiles.permitPdf,
        budgetPdf: !!uploadedFiles.budgetPdf,
        optionalDocs: !!uploadedFiles.optionalDocs
      });
      
      // Función para guardar archivo de memoria a disco
      const saveBufferToFile = (file, subfolder) => {
        if (!file || !file.buffer) return null;
        
        const uploadsDir = path.join(__dirname, '../uploads/legacy', subfolder);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${timestamp}_${sanitizedName}`;
        const filepath = path.join(uploadsDir, filename);
        
        fs.writeFileSync(filepath, file.buffer);
        return filepath;
      };
      
      // Guardar archivos en disco y generar rutas
      const filePaths = {
        permitPdfPath: uploadedFiles.permitPdf ? saveBufferToFile(uploadedFiles.permitPdf, 'permits') : null,
        budgetPdfPath: uploadedFiles.budgetPdf ? saveBufferToFile(uploadedFiles.budgetPdf, 'budgets') : null,
        optionalDocsPath: uploadedFiles.optionalDocs ? saveBufferToFile(uploadedFiles.optionalDocs, 'optional') : null
      };
      
      console.log("📁 Rutas de archivos generadas:", filePaths);
      
      const {
        // Datos del Permit
        permitNumber,
        propertyAddress,
        applicantName,
        applicantEmail,
        applicantPhone,
        lot,
        block,
        systemType,
        
        // Datos del Budget
        date,
        expirationDate,
        status = 'signed', // Por defecto firmado
        discountDescription,
        discountAmount = 0,
        generalNotes,
        initialPaymentPercentage = 60,
        lineItems,
        
        // 🆕 MODALIDAD SIMPLE (Presupuesto Firmado)
        isSimpleMode = false, // true = solo datos básicos, false = completo con items
        manualBudgetNumber, // Numeración manual para presupuestos firmados
        totalAmount, // Monto total cuando no hay line items
        
        // 🆕 CAMPOS PARA CONTINUAR EL FLUJO
        paymentProofAmount, // Monto ya pagado por el cliente
        paymentInvoice, // URL del comprobante de pago (opcional)
        paymentProofType, // 'pdf' o 'image'
        
        // Metadata de migración
        legacyId, // ID del sistema anterior (opcional)
        migrationNotes, // Notas sobre la migración
        isCompleted = false, // Si el trabajo ya fue completado
        
        // 🆕 ESTADO DEL TRABAJO (para trabajos en progreso)
        workStatus, // Estado del work si ya está en progreso
        workStartDate, // Fecha de inicio del trabajo (si aplica)
        workEndDate, // Fecha de finalización (si aplica)
        workNotes, // Notas específicas del trabajo
        
        // 🆕 CAMPOS PARA DOCUMENTOS LEGACY
        legacyPdfPath, // Ruta del PDF del presupuesto original
        legacyPermitPdfPath, // Ruta del PDF del permit
        legacyOptionalDocs // Array de documentos opcionales
      } = req.body;

      // Validaciones básicas
      if (!permitNumber) throw new Error('Número de permiso es requerido para trabajos legacy');
      if (!propertyAddress) throw new Error('Dirección de propiedad es requerida');
      if (!applicantName) throw new Error('Nombre del solicitante es requerido');
      
      // Validaciones según modalidad
      if (isSimpleMode) {
        // Modalidad simple: solo requiere monto total
        if (!totalAmount || parseFloat(totalAmount) <= 0) {
          throw new Error('Monto total es requerido para modalidad simple');
        }
      } else {
        // Modalidad completa: requiere line items
        if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
          throw new Error('Se requiere al menos un item en lineItems para modalidad completa');
        }
      }

      console.log("✅ Validaciones básicas pasadas");

      // 1. Subir PDFs a Cloudinary ANTES de crear Permit
      let permitPdfUrl = null;
      let permitPdfPublicId = null;
      let optionalDocsUrl = null;
      let optionalDocsPublicId = null;

      if (uploadedFiles.permitPdf) {
        console.log('📤 Subiendo Permit PDF a Cloudinary...');
        const permitUpload = await cloudinary.uploader.upload(filePaths.permitPdfPath, {
          folder: 'permits',
          resource_type: 'raw',
          format: 'pdf'
        });
        permitPdfUrl = permitUpload.secure_url;
        permitPdfPublicId = permitUpload.public_id;
        console.log('✅ Permit PDF subido:', permitPdfUrl);
      }

      if (uploadedFiles.optionalDocs) {
        console.log('📤 Subiendo Optional Docs a Cloudinary...');
        const optionalUpload = await cloudinary.uploader.upload(filePaths.optionalDocsPath, {
          folder: 'permits/optional',
          resource_type: 'raw',
          format: 'pdf'
        });
        optionalDocsUrl = optionalUpload.secure_url;
        optionalDocsPublicId = optionalUpload.public_id;
        console.log('✅ Optional Docs subido:', optionalDocsUrl);
      }

      // 2. Crear el Permit con URLs de Cloudinary
      const newPermit = await Permit.create({
        permitNumber,
        propertyAddress,
        applicantName,
        applicantEmail: applicantEmail || '',
        applicantPhone: applicantPhone || '',
        lot: lot || '',
        block: block || '',
        systemType: systemType || 'Legacy System',
        // ✅ URLs de Cloudinary (nuevo sistema)
        permitPdfUrl,
        permitPdfPublicId,
        optionalDocsUrl,
        optionalDocsPublicId,
        // Campos específicos para migración
        isLegacy: true,
        migrationDate: new Date(),
        migrationNotes: migrationNotes || 'Migrado desde sistema anterior'
      }, { transaction });

      console.log("✅ Permit legacy creado con Cloudinary URLs:", newPermit.idPermit);

      // 3. Calcular totales según modalidad
      let subtotalPrice = 0;
      let totalPrice = 0;
      let processedLineItems = [];

      if (isSimpleMode) {
        // 📄 MODALIDAD SIMPLE: usar monto total directo
        const discountAmountNum = parseFloat(discountAmount) || 0;
        subtotalPrice = parseFloat(totalAmount);
        totalPrice = subtotalPrice - discountAmountNum;
        processedLineItems = []; // Sin line items en modalidad simple
        
        console.log("✅ Modalidad Simple - Cálculos:", { subtotalPrice, totalPrice, discount: discountAmountNum });
      } else {
        // 📋 MODALIDAD COMPLETA: calcular desde line items  
        for (const item of lineItems) {
          const quantity = parseInt(item.quantity) || 0;
          const unitPrice = parseFloat(item.unitPrice) || 0;
          const lineTotal = quantity * unitPrice;
          subtotalPrice += lineTotal;

          processedLineItems.push({
            ...item,
            quantity,
            unitPrice,
            lineTotal
          });
        }

        const discountAmountNum = parseFloat(discountAmount) || 0;
        totalPrice = subtotalPrice - discountAmountNum;
        
        console.log("✅ Modalidad Completa - Cálculos:", { subtotalPrice, totalPrice, itemsCount: processedLineItems.length });
      }

      const initialPaymentNum = (totalPrice * (parseFloat(initialPaymentPercentage) / 100));
      const discountAmountNum = parseFloat(discountAmount) || 0; // Definir aquí para ambas modalidades

      // 3. Crear el Budget con datos de pago si existen
      const newBudget = await Budget.create({
        PermitIdPermit: newPermit.idPermit,
        propertyAddress,
        applicantName,
        date: date || new Date().toISOString().split('T')[0],
        expirationDate: expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 días por defecto
        status,
        discountDescription: discountDescription || '',
        discountAmount: discountAmountNum,
        generalNotes: generalNotes || '',
        initialPaymentPercentage: parseFloat(initialPaymentPercentage),
        subtotalPrice,
        totalPrice,
        initialPayment: initialPaymentNum,
        
        // 🆕 CAMPOS DE PAGO PARA CONTINUAR EL FLUJO
        paymentProofAmount: parseFloat(paymentProofAmount) || null,
        paymentInvoice: paymentInvoice || null,
        paymentProofType: paymentProofType || null,
        
        // Usar campo existente para PDF del budget
        pdfPath: filePaths.budgetPdfPath,
        
        // Campos específicos para migración
        isLegacy: true,
        legacyId: legacyId || null,
        migrationDate: new Date(),
        migrationNotes: migrationNotes || 'Presupuesto migrado desde sistema anterior',
        
        // 🆕 NUMERACIÓN MANUAL (no afecta consecutivo)
        manualBudgetNumber: manualBudgetNumber || null
      }, { transaction });

      console.log("✅ Budget legacy creado:", newBudget.idBudget);

      // 4. Crear los BudgetLineItems (solo en modalidad completa)
      if (!isSimpleMode && processedLineItems.length > 0) {
        for (const item of processedLineItems) {
          await BudgetLineItem.create({
            budgetId: newBudget.idBudget,
            budgetItemId: item.budgetItemId || null, // Puede ser null para items legacy
            quantity: item.quantity,
            priceAtTimeOfBudget: item.unitPrice,
            notes: item.notes || '',
            // Para items legacy sin budgetItemId, guardar la info directamente
            legacyItemName: item.budgetItemId ? null : item.name,
            legacyItemDescription: item.budgetItemId ? null : item.description,
            legacyItemCategory: item.budgetItemId ? null : item.category
          }, { transaction });
        }
        console.log("✅ Line items creados (modalidad completa)");
      } else {
        console.log("✅ Sin line items (modalidad simple)");
      }

      // 5. Crear Work record según el estado del trabajo
      let newWork = null;
      if (isCompleted || workStatus) {
        // Determinar el estado del work
        let workStatusFinal = 'paymentReceived'; // Por defecto completado (usando estado válido del enum)
        
        if (workStatus) {
          // Si se especifica un estado particular, usarlo
          workStatusFinal = workStatus;
        }
        
        newWork = await Work.create({
          budgetId: newBudget.idBudget,
          propertyAddress,
          workDescription: workNotes || `Trabajo legacy - ${applicantName}`,
          startDate: workStartDate || date || new Date(),
          endDate: workEndDate || (isCompleted ? new Date() : null),
          status: workStatusFinal,
          isLegacy: true,
          migrationNotes: migrationNotes || 'Trabajo migrado desde sistema anterior'
        }, { transaction });

        console.log("✅ Work record creado:", {
          idWork: newWork.idWork,
          status: workStatusFinal,
          isCompleted: isCompleted
        });
      }

      await transaction.commit();
      console.log("✅ Transacción completada exitosamente");

      // 6. 🆕 DETERMINAR PRÓXIMOS PASOS EN EL FLUJO
      const nextSteps = [];
      const canGenerateFinalInvoice = paymentProofAmount && paymentProofAmount >= initialPaymentNum;
      
      if (status === 'signed' && !paymentProofAmount) {
        nextSteps.push('Cargar comprobante de pago inicial');
      }
      
      if (canGenerateFinalInvoice && !newWork) {
        nextSteps.push('Crear registro de trabajo (Work)');
      }
      
      if (newWork && newWork.status === 'completed' && canGenerateFinalInvoice) {
        nextSteps.push('Generar factura final (Final Invoice)');
      }
      
      if (newWork && ['pending', 'assigned', 'inProgress'].includes(newWork.status)) {
        nextSteps.push(`Continuar trabajo desde estado: ${newWork.status}`);
      }

      // 7. Respuesta con los datos creados y próximos pasos
      const responseData = {
        success: true,
        message: isCompleted ? 
          'Trabajo legacy creado exitosamente como completado' : 
          'Presupuesto legacy creado exitosamente',
        data: {
          budget: {
            idBudget: newBudget.idBudget,
            permitId: newPermit.idPermit,
            applicantName,
            propertyAddress,
            status,
            totalPrice,
            initialPayment: initialPaymentNum,
            paymentProofAmount: parseFloat(paymentProofAmount) || null,
            isLegacy: true,
            migrationDate: newBudget.migrationDate
          },
          permit: {
            idPermit: newPermit.idPermit,
            permitNumber,
            propertyAddress,
            applicantName,
            applicantEmail,
            applicantPhone,
            isLegacy: true
          },
          work: newWork ? {
            idWork: newWork.idWork,
            status: newWork.status,
            message: `Trabajo creado con estado: ${newWork.status}`
          } : null,
          
          // 🆕 INFORMACIÓN DEL FLUJO
          flowStatus: {
            canGenerateFinalInvoice,
            hasInitialPayment: !!paymentProofAmount,
            readyForWork: status === 'signed' && paymentProofAmount >= initialPaymentNum,
            nextSteps
          }
        }
      };

      console.log("🎉 Legacy budget/work creado exitosamente");
      res.status(201).json(responseData);

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en createLegacyBudget:', error);
      
      res.status(500).json({
        error: true,
        message: 'Error al crear presupuesto/trabajo legacy',
        details: error.message
      });
    }
  },

  // === 🆕 MÉTODO PARA MOSTRAR PDF DEL PRESUPUESTO LEGACY ===
  async legacyBudgetPdf(req, res) {
    try {
      const { idBudget } = req.params;
      
      console.log(`🔍 DEBUG legacyBudgetPdf Budget ${idBudget}:`);

      // Buscar el presupuesto legacy
      const budget = await Budget.findByPk(idBudget);
      
      if (!budget) {
        return res.status(404).json({
          error: true,
          message: 'Presupuesto no encontrado'
        });
      }

      if (!budget.isLegacy) {
        return res.status(400).json({
          error: true,
          message: 'Este presupuesto no es legacy. Use la ruta normal de PDF.'
        });
      }

      console.log({
        isLegacy: budget.isLegacy,
        legacySignedPdfUrl: budget.legacySignedPdfUrl,
        hasCloudinaryUrl: !!budget.legacySignedPdfUrl
      });

      // Verificar que tenga la URL del PDF
      if (!budget.legacySignedPdfUrl) {
        return res.status(404).json({
          error: true,
          message: 'Este presupuesto legacy no tiene PDF firmado cargado'
        });
      }

      // Redirigir directamente a la URL de Cloudinary
      console.log(`🔗 Redirigiendo a URL de Cloudinary: ${budget.legacySignedPdfUrl}`);
      res.redirect(budget.legacySignedPdfUrl);

    } catch (error) {
      console.error('❌ Error al obtener PDF legacy:', error);
      res.status(500).json({
        error: true,
        message: 'Error al cargar el PDF del presupuesto legacy',
        details: error.message
      });
    }
  },

  // ========== 🆕 MÉTODOS PARA WORKFLOW DE REVISIÓN PREVIA ==========

  /**
   * Obtener detalles del presupuesto para revisión (endpoint público)
   * GET /api/budgets/:idBudget/review/:reviewToken
   */
  async getBudgetForReview(req, res) {
    try {
      const { idBudget, reviewToken } = req.params;
      
      console.log(`🔍 Cliente consultando presupuesto ${idBudget} para revisión...`);

      const budget = await Budget.findByPk(idBudget, {
        include: [
          { 
            model: Permit, 
            attributes: ['idPermit', 'propertyAddress', 'applicantEmail', 'applicantName', 'lot', 'block'] 
          },
          { model: BudgetLineItem, as: 'lineItems' }
        ]
      });

      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Validar token
      if (budget.reviewToken !== reviewToken) {
        return res.status(403).json({ error: 'Enlace de revisión inválido o expirado' });
      }

      // No exponer datos sensibles
      const budgetData = budget.toJSON();
      delete budgetData.reviewToken;
      delete budgetData.signNowDocumentId;
      delete budgetData.signedPdfPath;

      // Aplanar datos del Permit para facilitar acceso en el frontend
      if (budgetData.Permit) {
        budgetData.propertyAddress = budgetData.Permit.propertyAddress;
        budgetData.applicantName = budgetData.Permit.applicantName;
        budgetData.applicantEmail = budgetData.Permit.applicantEmail;
      }

      res.json(budgetData);

    } catch (error) {
      console.error('❌ Error al obtener presupuesto para revisión:', error);
      res.status(500).json({ 
        error: 'Error al cargar el presupuesto',
        details: error.message 
      });
    }
  },

  /**
   * Ver PDF del presupuesto (endpoint público con token)
   * GET /api/budgets/:idBudget/view-pdf/:reviewToken
   */
  async viewBudgetPDFPublic(req, res) {
    try {
      const { idBudget, reviewToken } = req.params;

      console.log(`📄 Cliente solicitando PDF del presupuesto ${idBudget}...`);

      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Validar token de revisión
      if (budget.reviewToken !== reviewToken) {
        return res.status(403).json({ error: 'Token de revisión inválido' });
      }

      // Verificar que el PDF existe
      if (!budget.pdfPath) {
        return res.status(404).json({ error: 'PDF no encontrado' });
      }

      // ✅ Convertir URL pública a ruta local
      let localPdfPath;
      if (budget.pdfPath.startsWith('http')) {
        const pdfFileName = budget.pdfPath.split('/').pop();
        localPdfPath = path.join(__dirname, '..', 'uploads', 'budgets', pdfFileName);
        console.log(`🔄 Convertido URL a ruta local: ${localPdfPath}`);
      } else {
        localPdfPath = budget.pdfPath;
      }

      // Verificar que el archivo existe físicamente
      if (!fs.existsSync(localPdfPath)) {
        console.error(`❌ PDF no encontrado en: ${localPdfPath}`);
        return res.status(404).json({ error: 'Archivo PDF no encontrado en el servidor' });
      }

      console.log(`✅ Enviando PDF: ${localPdfPath}`);

      // Enviar el archivo PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Budget_${budget.idBudget}.pdf"`);
      
      const fileStream = fs.createReadStream(localPdfPath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('❌ Error al visualizar PDF público:', error);
      res.status(500).json({ 
        error: 'Error al cargar el PDF',
        details: error.message 
      });
    }
  },

  /**
   * Enviar presupuesto para revisión del cliente (sin firma, solo lectura)
   * POST /api/budgets/:idBudget/send-for-review
   */
  async sendBudgetForReview(req, res) {
    let pdfPath; // ✅ Declarar aquí para disponibilidad en finally (patrón Change Order)
    let ppiPath; // 🆕 Declarar aquí para disponibilidad en finally
    try {
      const { idBudget } = req.params;
      
      console.log(`📧 === INICIANDO ENVÍO DE PRESUPUESTO PARA REVISIÓN ===`);
      console.log(`📋 Budget ID: ${idBudget}`);
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

      // Buscar el presupuesto con sus datos completos
      const budget = await Budget.findByPk(idBudget, {
        include: [
          { 
            model: Permit, 
            attributes: [
              'idPermit', 'propertyAddress', 'applicantEmail', 'applicantName', 
              'lot', 'block', 'notificationEmails',
              'ppiCloudinaryUrl', 'ppiGeneratedPath', 'ppiInspectorType', // 🆕 Campos PPI
              'ppiSignatureStatus', 'ppiSignedAt', 'ppiSignedPdfUrl', 'ppiSignedPdfPublicId' // 🆕 Campos PPI firmado
            ] 
          },
          { model: BudgetLineItem, as: 'lineItems' }
        ]
      });

      if (!budget) {
        console.error(`❌ Presupuesto ${idBudget} no encontrado`);
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      console.log(`✅ Presupuesto encontrado:`, {
        idBudget: budget.idBudget,
        status: budget.status,
        applicantEmail: budget.Permit?.applicantEmail,
        hasPdfPath: !!budget.pdfPath
      });

      // ✅ Validaciones - Permitir reenvío de presupuestos en varios estados
      const allowedStatuses = ['created', 'draft', 'rejected', 'pending_review', 'send', 'client_approved', 'sent_for_signature'];
      if (!allowedStatuses.includes(budget.status)) {
        return res.status(400).json({ 
          error: `No se puede enviar para revisión un presupuesto con estado "${budget.status}". Solo presupuestos en estado "created", "draft", "pending_review", "send", "client_approved", "sent_for_signature" o "rejected" pueden enviarse para revisión.`,
          details: `Por favor, verifica:
- El presupuesto tiene PDF generado
- El email del cliente es válido
- La conexión con el servidor`
        });
      }

      if (!budget.Permit?.applicantEmail) {
        return res.status(400).json({ 
          error: 'El presupuesto no tiene un email de cliente asociado'
        });
      }

      // Generar token único para revisión (si no existe o si es reenvío)
      const crypto = require('crypto');
      const isResend = ['rejected', 'pending_review', 'send', 'client_approved', 'sent_for_signature'].includes(budget.status); // Detectar si es un reenvío
      const reviewToken = budget.reviewToken || crypto.randomBytes(32).toString('hex');

      console.log(`🔄 Tipo de envío: ${isResend ? 'REENVÍO' : 'PRIMER ENVÍO'}`);
      console.log(`🔑 Review Token: ${reviewToken.substring(0, 10)}...`);

      // Actualizar presupuesto
      await budget.update({
        status: 'pending_review',
        reviewToken: reviewToken,
        sentForReviewAt: new Date()
      });

      // ✅ GENERAR PDF USANDO LA FUNCIÓN EXISTENTE (patrón Budget/Change Order)
      console.log(`📄 Generando PDF del presupuesto ${idBudget}...`);
      pdfPath = await generateAndSaveBudgetPDF(budget.toJSON());

      if (!pdfPath || !fs.existsSync(pdfPath)) {
        throw new Error('No se pudo generar el PDF del presupuesto');
      }

      console.log(`✅ PDF generado exitosamente: ${pdfPath}`);

      // 🆕 Verificar si existe PPI generado para este Permit
      ppiPath = null; // Inicializar
      let ppiUrl = budget.Permit.ppiCloudinaryUrl || budget.Permit.ppiGeneratedPath;
      
      if (ppiUrl) {
        // Si es URL de Cloudinary, descargar temporalmente
        if (ppiUrl.startsWith('http')) {
          console.log(` Descargando PPI desde Cloudinary: ${ppiUrl}`);
          const axios = require('axios');
          const path = require('path');
          const uploadsDir = path.join(__dirname, '../uploads/temp');
          
          // Crear directorio temporal si no existe
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          try {
            const response = await axios.get(ppiUrl, { responseType: 'arraybuffer' });
            ppiPath = path.join(uploadsDir, `ppi_${budget.Permit.idPermit}_${Date.now()}.pdf`);
            fs.writeFileSync(ppiPath, response.data);
            console.log(` PPI descargado temporalmente: ${ppiPath}`);
          } catch (downloadError) {
            console.error(` Error descargando PPI desde Cloudinary:`, downloadError.message);
            ppiPath = null;
          }
        } else if (fs.existsSync(ppiUrl)) {
          // Es ruta local y existe
          ppiPath = ppiUrl;
          console.log(` PPI encontrado localmente: ${ppiPath}`);
        }
      }
      
      if (!ppiPath) {
        console.log(`ℹ No se encontró PPI generado para este Permit`);
      }

      // Construir URL pública para revisión
      const frontendUrl = process.env.FRONTEND_URL || 'https://zurcherseptic.com';
      const reviewUrl = `${frontendUrl}/budget-review/${idBudget}/${reviewToken}`;

      // 🆕 Obtener y parsear emails adicionales del Permit
      let notificationEmails = budget.Permit.notificationEmails || [];
      
      // 🔧 PARSEAR correctamente si viene como JSON string
      if (Array.isArray(notificationEmails) && notificationEmails.length > 0) {
        // Si el primer elemento es un string que parece JSON, parsearlo
        if (typeof notificationEmails[0] === 'string' && notificationEmails[0].trim().startsWith('[')) {
          try {
            notificationEmails = JSON.parse(notificationEmails[0]);
          } catch (e) {
            console.warn('⚠️  No se pudo parsear notificationEmails del array:', e.message);
          }
        }
      } else if (typeof notificationEmails === 'string' && notificationEmails.trim().startsWith('[')) {
        // Si es un string directamente
        try {
          notificationEmails = JSON.parse(notificationEmails);
        } catch (e) {
          console.warn('⚠️  No se pudo parsear notificationEmails del string:', e.message);
          notificationEmails = [];
        }
      }
      
      // Asegurar que sea un array válido y limpiar valores
      if (!Array.isArray(notificationEmails)) {
        notificationEmails = [];
      }
      
      // Limpiar cada email (remover comillas, espacios, etc.)
      notificationEmails = notificationEmails
        .map(email => typeof email === 'string' ? email.trim().replace(/^["'\[]|["'\]]$/g, '') : email)
        .filter(email => email && email.includes('@'));
      
      const hasNotificationEmails = notificationEmails.length > 0;
      
      console.log(`📋 Datos del Permit:`, {
        applicantEmail: budget.Permit.applicantEmail,
        notificationEmails: notificationEmails,
        hasNotificationEmails: hasNotificationEmails,
        totalEmails: hasNotificationEmails ? 1 + notificationEmails.length : 1
      });

      // ✅ CONSTRUIR EMAIL HTML - Diferente si es reenvío
      const emailSubject = isResend 
        ? `Updated Budget for Review - ${budget.Permit.propertyAddress}` 
        : `Budget Proposal for Review - ${budget.Permit.propertyAddress}`;
      
      // 🆕 FUNCIÓN HELPER: Generar HTML del email
      const generateEmailHtml = (includeActionButtons = true) => `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; padding: 16px 32px; text-align: center; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; letter-spacing: 1px; margin: 10px; }
            .btn-approve { background-color: #28a745; color: white; }
            .btn-reject { background-color: #dc3545; color: white; }
            .btn-approve-top { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; box-shadow: 0 6px 20px rgba(40, 167, 69, 0.5); transform: scale(1); transition: all 0.3s ease; }
            .btn-approve-top:hover { transform: scale(1.05); box-shadow: 0 8px 25px rgba(40, 167, 69, 0.6); }
            .details { background-color: white; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .resend-notice { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .info-notice { background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 ${isResend ? 'Updated Budget for Review' : 'Budget Proposal for Review'}</h1>
            </div>
            
            ${includeActionButtons ? `
            <!-- 🆕 BOTÓN DE APROBAR PRINCIPAL - TOP -->
            <div style="background: linear-gradient(135deg, #f0fff4 0%, #e6f7ed 100%); padding: 30px 25px; margin: 20px 0; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.2);">
              <div style="text-align: center;">
                <p style="font-size: 22px; font-weight: bold; color: #155724; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">
                  ✅ Ready to Approve?
                </p>
                <p style="font-size: 16px; color: #155724; margin: 0 0 25px 0;">
                  Click below to approve this budget and move forward!<br/>
                  <span style="font-size: 15px;">¡Haz clic abajo para aprobar este presupuesto!</span>
                </p>
                <a href="${reviewUrl}?action=approve" class="btn-approve-top" style="display: inline-block; width: 85%; max-width: 480px; padding: 24px 30px; text-align: center; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 22px; letter-spacing: 1.5px; color: white; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); box-shadow: 0 6px 20px rgba(40, 167, 69, 0.5);">
                  ✅ APPROVE BUDGET NOW<br/>
                  <span style="font-size: 18px; font-weight: normal; margin-top: 8px; display: block;">APROBAR PRESUPUESTO AHORA</span>
                </a>
              </div>
            </div>
            ` : ''}
            
            <div class="content">
              ${includeActionButtons ? `
              <p>Dear <strong>${budget.Permit.applicantName}</strong>,</p>
              ` : `
              <p>Hello,</p>
              <div class="info-notice">
                <p><strong>ℹ️ This is a notification copy for your information.</strong></p>
                <p>The client (${budget.Permit.applicantEmail}) has received this budget for review and approval.</p>
              </div>
              `}
              
              ${isResend && includeActionButtons ? `
              <div class="resend-notice">
                <p><strong>🔄 This is an updated version of the budget.</strong></p>
                <p>We have reviewed your feedback and made the necessary adjustments. Please review the updated proposal below.</p>
              </div>
              ` : ''}
              
              <p>${includeActionButtons ? 'Please find attached the' : 'Attached is the'} ${isResend ? 'updated ' : ''}budget estimate for ${includeActionButtons ? 'your project' : 'the project'} at <strong>${budget.Permit.propertyAddress}</strong> ${includeActionButtons ? 'for your review' : 'for reference'}.</p>
              
              <div class="details">
                <h3>Budget Details:</h3>
                <p><strong>Budget ID:</strong> #${budget.idBudget}</p>
                <p><strong>Property Address:</strong> ${budget.Permit.propertyAddress}</p>
                <p><strong>Total:</strong> $${parseFloat(budget.totalPrice).toFixed(2)}</p>
                <p><strong>Initial Payment (${budget.initialPaymentPercentage}%):</strong> $${parseFloat(budget.initialPayment).toFixed(2)}</p>
                ${budget.expirationDate ? `<p><strong>Valid Until:</strong> ${new Date(budget.expirationDate).toLocaleDateString()}</p>` : ''}
              </div>
              
              ${includeActionButtons ? `
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 24px; margin: 30px 0; border-radius: 4px;">
                <h3 style="color: #856404; margin-top: 0; font-size: 20px;">📋 Please Review and Choose an Option:</h3>
                <p style="margin: 12px 0; font-size: 16px; line-height: 1.6;"><strong>English:</strong> Please review the attached budget carefully. Once you approve, we will send you the official invoice for payment and a SignNow email for digital signature. After the initial payment is received and the document is signed, your property will be added to our schedule/calendar.</p>
                <p style="margin: 12px 0; font-size: 16px; line-height: 1.6;"><strong>Español:</strong> Por favor revise el presupuesto adjunto cuidadosamente. Una vez que lo apruebe, le enviaremos el invoice oficial de pago y un correo de SignNow para firma digital. Una vez recibido el pago inicial y firmado el documento, su propiedad ingresará a nuestro calendario.</p>
              </div>
              
              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 24px; margin: 30px 0; border-radius: 4px;">
                <h3 style="color: #721c24; margin-top: 0; font-size: 20px;">⚠️ Important - Importante:</h3>
                <p style="margin: 12px 0; font-size: 16px; line-height: 1.6;"><strong>English:</strong> If there are any errors or incorrect information in the budget, please click "Provide Feedback" and let us know what needs to be corrected. Thank you!</p>
                <p style="margin: 12px 0; font-size: 16px; line-height: 1.6;"><strong>Español:</strong> Si hay datos erróneos o información incorrecta en el presupuesto, por favor haga clic en "Proporcionar Comentarios" e indíquenos qué se debe corregir. ¡Gracias!</p>
              </div>
              
              <div style="text-align: center; margin: 40px 0;">
                <div style="margin-bottom: 30px;">
                  <a href="${reviewUrl}?action=approve" class="button btn-approve" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4); transform: scale(1.05); font-size: 20px; padding: 20px 40px; color: white; text-decoration: none; display: inline-block; border-radius: 6px; font-weight: bold;">
                    ✅ APPROVE BUDGET<br/>
                    <span style="font-size: 16px; font-weight: normal; color: white;">APROBAR PRESUPUESTO</span>
                  </a>
                </div>
                <div>
                  <a href="${reviewUrl}?action=reject" class="button btn-reject" style="background-color: #dc3545; font-size: 17px; padding: 16px 32px; opacity: 0.9; color: white; text-decoration: none; display: inline-block; border-radius: 6px; font-weight: bold;">
                    💬 PROVIDE FEEDBACK<br/>
                    <span style="font-size: 15px; font-weight: normal; color: white;">PROPORCIONAR COMENTARIOS</span>
                  </a>
                </div>
              </div>
              
              <div style="background-color: #d1ecf1; border-left: 4px solid #0c5460; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #0c5460; font-size: 18px;"><strong>📌 Next Steps After Approval / Próximos Pasos Después de Aprobar:</strong></p>
                <p style="margin: 12px 0; color: #0c5460; font-size: 16px; line-height: 1.6;">
                  <strong>English:</strong> 1️⃣ You will receive an official invoice for payment. 2️⃣ You will receive a SignNow email for digital signature. 3️⃣ Once paid and signed, your property will be scheduled.
                </p>
                <p style="margin: 12px 0; color: #0c5460; font-size: 16px; line-height: 1.6;">
                  <strong>Español:</strong> 1️⃣ Recibirá un invoice oficial para el pago. 2️⃣ Recibirá un correo de SignNow para firma digital. 3️⃣ Una vez pagado y firmado, su propiedad será programada.
                </p>
              </div>
              ` : `
              <p><em>This is an informational copy only. The client will review and approve the budget.</em></p>
              `}
            </div>
            
            <div class="footer">
              <p><strong>Zurcher Septic</strong></p>
              <p><strong>Professional Septic Installation & Maintenance | License CFC1433240</p>
              <p>📧 admin@zurcherseptic.com | 📞 +1 (407) 419-4495</p>
              <p style="margin-top: 10px; font-size: 12px;">For any questions, please contact us by replying to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // ✅ ENVIAR EMAIL AL CLIENTE PRINCIPAL CON BOTONES DE ACCIÓN
      console.log(`📧 Enviando email principal a ${budget.Permit.applicantEmail} con botones de acción...`);
      
      // 🆕 Preparar adjuntos separados: Cliente vs Notificaciones Internas
      const attachmentsForClient = [
        { 
          filename: `Budget_${budget.idBudget}.pdf`, 
          path: pdfPath 
        }
      ];
      
      const attachmentsForNotifications = [
        { 
          filename: `Budget_${budget.idBudget}.pdf`, 
          path: pdfPath 
        }
      ];
      
      // ✅ SOLO agregar PPI a notificaciones internas, NO al cliente
      if (ppiPath) {
        const ppiFilename = `PPI_${budget.Permit.ppiInspectorType || 'inspection'}_Permit_${budget.Permit.idPermit}.pdf`;
        attachmentsForNotifications.push({
          filename: ppiFilename,
          path: ppiPath
        });
        console.log(`📎 PPI adjuntado SOLO para notificaciones INTERNAS: ${ppiFilename}`);
        console.log(`ℹ️  PPI NO se enviará al cliente (solo Budget PDF)`);
      }
      
      await sendEmail({
        to: budget.Permit.applicantEmail,
        subject: emailSubject,
        html: generateEmailHtml(true), // CON botones de aprobación
        text: `Alternative text: ${emailSubject}`,
        attachments: attachmentsForClient // 🆕 Solo Budget PDF para cliente
      });

      console.log(`✅ Email principal enviado a ${budget.Permit.applicantEmail}`);
      console.log(`   ✅ Adjuntos: SOLO Budget PDF (${attachmentsForClient.length} archivo)`);
      console.log(`   ⛔ PPI NO incluido para el cliente`);

      // 🆕 ENVIAR EMAILS INFORMATIVOS A EMAILS ADICIONALES (SIN BOTONES, CON PPI)
      if (hasNotificationEmails) {
        console.log(`📧 Enviando emails informativos a ${notificationEmails.length} email(s) adicional(es)...`);
        
        const emailSubjectNotification = `[Info] ${emailSubject}`;
        
        for (const email of notificationEmails) {
          try {
            // Preparar adjuntos para emails adicionales
            const notificationAttachments = [
              { 
                filename: `Budget_${budget.idBudget}.pdf`, 
                path: pdfPath 
              }
            ];
            
            if (ppiPath) {
              const ppiFilename = `PPI_${budget.Permit.ppiInspectorType || 'inspection'}_Permit_${budget.Permit.idPermit}.pdf`;
              notificationAttachments.push({
                filename: ppiFilename,
                path: ppiPath
              });
            }
            
            await sendEmail({
              to: email,
              subject: emailSubjectNotification,
              html: generateEmailHtml(false), // SIN botones de aprobación
              text: `Alternative text: ${emailSubjectNotification}`,
              attachments: notificationAttachments
            });
            console.log(`✅ Email informativo enviado a ${email}`);
          } catch (emailError) {
            console.error(`❌ Error al enviar email a ${email}:`, emailError.message);
            // Continuar con los demás emails aunque uno falle
          }
        }
        
        console.log(`✅ Todos los emails informativos enviados`);
      }

      console.log(`✅ Proceso de envío completo`);
      console.log(`📧 Email principal: ${budget.Permit.applicantEmail} (con botones de acción)`);
      if (hasNotificationEmails) {
        console.log(`📧 Emails adicionales (${notificationEmails.length}): ${notificationEmails.join(', ')} (solo información)`);
      }

      // Notificar al equipo interno
      await sendNotifications('budgetSentForReview', {
        idBudget: budget.idBudget,
        propertyAddress: budget.Permit.propertyAddress,
        applicantName: budget.Permit.applicantName,
        applicantEmail: budget.Permit.applicantEmail,
        notificationEmails: notificationEmails,
        isResend: isResend // 🆕 Indicar si es un reenvío
      }, null, req.io, { userId: req.user?.id });

      // 🆕 Construir mensaje de respuesta detallado
      let responseMessage = isResend 
        ? `Presupuesto actualizado y reenviado para revisión a ${budget.Permit.applicantEmail}`
        : `Presupuesto enviado para revisión a ${budget.Permit.applicantEmail}`;
      
      if (hasNotificationEmails) {
        responseMessage += ` y ${notificationEmails.length} email(s) adicional(es) como copia informativa`;
      }

      res.json({
        success: true,
        message: responseMessage,
        budget: {
          idBudget: budget.idBudget,
          status: 'pending_review',
          sentForReviewAt: budget.sentForReviewAt,
          reviewUrl,
          isResend: isResend,
          emailsSent: {
            primary: budget.Permit.applicantEmail,
            additional: notificationEmails,
            total: 1 + notificationEmails.length
          }
        }
      });

    } catch (error) {
      console.error('❌ Error al enviar presupuesto para revisión:', error);
      res.status(500).json({ 
        error: 'Error al enviar el presupuesto para revisión',
        details: error.message 
      });
    } finally {
      // ✅ LIMPIAR PDF TEMPORAL (patrón exacto de Change Order)
      if (pdfPath && fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
          console.log(`🗑️  PDF temporal eliminado: ${pdfPath}`);
        } catch (cleanupError) {
          console.warn(`⚠️  No se pudo eliminar el PDF temporal: ${cleanupError.message}`);
        }
      }
      
      // 🆕 LIMPIAR PPI TEMPORAL descargado de Cloudinary
      if (ppiPath && ppiPath.includes('/temp/') && fs.existsSync(ppiPath)) {
        try {
          fs.unlinkSync(ppiPath);
          console.log(`🗑️  PPI temporal eliminado: ${ppiPath}`);
        } catch (cleanupError) {
          console.warn(`⚠️  No se pudo eliminar el PPI temporal: ${cleanupError.message}`);
        }
      }
    }
  },

  /**
   * Cliente aprueba el presupuesto (endpoint público)
   * POST /api/budgets/:idBudget/approve-review/:reviewToken
   */
  async approveReview(req, res) {
    const transaction = await conn.transaction();
    
    try {
      const { idBudget, reviewToken } = req.params;
      const { convertToInvoice = true } = req.body; // Por defecto, convertir a invoice
      
      console.log(`✅ Cliente aprobando presupuesto ${idBudget}...`);

      const budget = await Budget.findByPk(idBudget, {
        include: [{ model: Permit, attributes: ['applicantName', 'propertyAddress', 'applicantEmail'] }],
        transaction
      });

      if (!budget) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Validar token
      if (budget.reviewToken !== reviewToken) {
        await transaction.rollback();
        return res.status(403).json({ error: 'Token de revisión inválido' });
      }

      // Validar estado - Si ya está aprobado, devolver éxito (idempotente)
      if (budget.status !== 'pending_review') {
        await transaction.rollback();
        
        // ✅ Si ya está aprobado/convertido a invoice, es válido (usuario hizo clic doble o refresco)
        if (['client_approved', 'created', 'sent'].includes(budget.status)) {
          console.log(`ℹ️ Presupuesto ${idBudget} ya fue aprobado previamente (estado: ${budget.status}). Retornando éxito.`);
          return res.status(200).json({ 
            success: true,
            message: 'Este presupuesto ya fue aprobado anteriormente',
            budget: {
              id: budget.id,
              status: budget.status,
              invoiceNumber: budget.invoiceNumber,
              reviewedAt: budget.reviewedAt
            }
          });
        }
        
        // Estados inválidos (rechazado, cancelado, etc.)
        return res.status(400).json({ 
          error: `Este presupuesto ya no está disponible para revisión (estado actual: ${budget.status})`
        });
      }

      // 🆕 SI SE SOLICITA, CONVERTIR AUTOMÁTICAMENTE A INVOICE
      let invoiceNumber = null;
      if (convertToInvoice) {
        // ✅ MANTENER invoice number existente o generar uno nuevo
        if (budget.invoiceNumber) {
          // Ya tiene invoice number, mantenerlo (caso de re-aprobación después de edición)
          invoiceNumber = budget.invoiceNumber;
          console.log(`♻️  Manteniendo Invoice Number existente: ${invoiceNumber}`);
        } else {
          // Primera vez que se aprueba, generar nuevo invoice number
          invoiceNumber = await getNextInvoiceNumber(transaction);
          console.log(`📋 Asignando nuevo Invoice Number: ${invoiceNumber} (numeración unificada)`);
        }

        // Actualizar presupuesto con invoice number
        await budget.update({
          status: 'created', // Estado de invoice definitivo
          reviewedAt: new Date(),
          invoiceNumber: invoiceNumber,
          convertedToInvoiceAt: budget.convertedToInvoiceAt || new Date() // Mantener fecha original si existe
        }, { transaction });

      } else {
        // Solo aprobar sin convertir a invoice
        await budget.update({
          status: 'client_approved',
          reviewedAt: new Date()
        }, { transaction });
      }

      await transaction.commit();
      console.log(`✅ Presupuesto ${idBudget} aprobado por el cliente${invoiceNumber ? ` y convertido a Invoice #${invoiceNumber}` : ''}`);

      // 🆕 REGENERAR PDF Y ENVIAR A SIGNNOW AUTOMÁTICAMENTE SI SE CONVIRTIÓ A INVOICE
      if (invoiceNumber) {
        setImmediate(async () => {
          try {
            console.log(`📄 Regenerando PDF para Invoice #${invoiceNumber}...`);
            
            const updatedBudget = await Budget.findByPk(idBudget, {
              // No especificar attributes para traer todos los campos del budget incluyendo idPermit
              include: [
                { 
                  model: Permit, 
                  attributes: [
                    'idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block',
                    // 🆕 PPI fields para envío automático
                    'ppiInspectorType', 'ppiCloudinaryUrl', 'ppiGeneratedPath', 'ppiDocusignEnvelopeId', 'ppiSignatureStatus'
                  ]
                },
                { model: BudgetLineItem, as: 'lineItems' }
              ]
            });

            if (!updatedBudget) {
              console.error(`❌ No se pudo encontrar el budget ${idBudget} para regenerar PDF`);
              return;
            }

            const budgetDataForPdf = updatedBudget.toJSON();
            const newPdfPath = await generateAndSaveBudgetPDF(budgetDataForPdf);
            
            if (newPdfPath) {
              await updatedBudget.update({ pdfPath: newPdfPath });
              console.log(`✅ PDF regenerado exitosamente: ${newPdfPath}`);

              // 🆕 ENVIAR AUTOMÁTICAMENTE A SERVICIO DE FIRMA Y EMAIL CON BOTÓN DE PAGO
              // 🔧 Definir serviceName fuera del try para usarlo en catch
              const serviceName = USE_DOCUSIGN ? 'DocuSign' : 'SignNow';
              
              try {
                console.log(`📤 Enviando Invoice #${invoiceNumber} a ${serviceName} automáticamente...`);
                
                const signatureService = USE_DOCUSIGN ? new DocuSignService() : new SignNowService();
                const propertyAddress = updatedBudget.Permit?.propertyAddress || 'Property';
                const fileName = `Invoice_${invoiceNumber}_${propertyAddress.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

                // 🆕 Normalizar email a minúsculas para evitar problemas de deliverability
                const clientEmail = (updatedBudget.Permit.applicantEmail || '').toLowerCase().trim();
                const clientName = updatedBudget.Permit.applicantName || 'Valued Client';

                // Preparar parámetros según el servicio
                const emailSubject = `Please sign Invoice #${invoiceNumber} - ${propertyAddress}`;
                const emailMessage = `Dear ${clientName},\n\n` +
                  `Please review and sign the attached invoice document.\n\n` +
                  `If you have any questions, please contact us.\n\n` +
                  `Best regards,\nZurcher Construction`;

                console.log(`📧 Enviando a: ${clientEmail} (normalizado desde ${updatedBudget.Permit.applicantEmail})`);

                // ✅ ENVIAR SOLO EL INVOICE (El PPI se enviará después en un envelope separado)
                let signatureResult = null;
                
                signatureResult = USE_DOCUSIGN
                  ? await signatureService.sendBudgetForSignature(
                      newPdfPath,
                      clientEmail,
                      clientName,
                      fileName,
                      emailSubject,
                      emailMessage,
                      false // ✅ NO generar URL ahora, se genera on-demand cuando cliente hace clic
                    )
                  : await signatureService.sendBudgetForSignature(
                      newPdfPath,
                      fileName,
                      clientEmail,
                      clientName
                    );

                // ✅ Validar respuesta según el servicio
                const documentId = USE_DOCUSIGN ? signatureResult.envelopeId : signatureResult.documentId;
                if (!documentId) {
                  throw new Error(`${serviceName} no devolvió un ${USE_DOCUSIGN ? 'envelopeId' : 'documentId'} válido`);
                }

                // 🔗 Obtener URL de firma si está disponible (DocuSign)
                const signingUrl = signatureResult.signingUrl || null;
                if (signingUrl) {
                  console.log(`✅ URL de firma generada: ${signingUrl.substring(0, 50)}...`);
                }

                console.log(`✅ Invoice #${invoiceNumber} enviado a ${serviceName} exitosamente con ${USE_DOCUSIGN ? 'envelopeId' : 'documentId'}: ${documentId}`);

                // Actualizar con campos genéricos
                await updatedBudget.update({
                  signatureDocumentId: documentId,
                  signNowDocumentId: USE_DOCUSIGN ? null : signatureResult.documentId, // Mantener compatibilidad
                  docusignEnvelopeId: USE_DOCUSIGN ? signatureResult.envelopeId : null, // 🆕 Guardar envelope ID específico
                  signatureMethod: USE_DOCUSIGN ? 'docusign' : 'signnow',
                  status: 'sent_for_signature',
                  sentForSignatureAt: new Date()
                });

                // 🆕 ENVIAR EMAIL ADICIONAL CON PDF Y BOTÓN DE PAGO
                // Preparar datos que se usarán tanto para el cliente como para finance
                const pdfAttachment = {
                  filename: fileName,
                  path: newPdfPath,
                  contentType: 'application/pdf'
                };

                const totalAmount = parseFloat(updatedBudget.totalPrice || 0);
                const initialPaymentPercentage = parseFloat(updatedBudget.initialPaymentPercentage || 100);
                const initialPaymentAmount = parseFloat(updatedBudget.initialPayment || totalAmount);
                const hasInitialPayment = initialPaymentPercentage < 100;

                // 📧 ENVIAR EMAIL AL CLIENTE
                try {
                  console.log(`📧 Enviando email adicional con botón de pago a ${clientEmail}...`);

                  // ✅ Construir enlace de firma on-demand
                  const apiUrl = process.env.API_URL || 'https://zurcherapi.up.railway.app';
                  const signatureLinkOnDemand = `${apiUrl}/budgets/${updatedBudget.idBudget}/sign`;
                  
                  // Construir sección de botón de firma
                  const signatureButtonHtml = `
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${signatureLinkOnDemand}" 
                         style="display: inline-block; background-color: #4CAF50; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
                        📝 Sign Document Now
                      </a>
                      <p style="margin-top: 10px; font-size: 13px; color: #666;">
                        Click the button above to sign your invoice electronically
                      </p>
                      <p style="margin-top: 5px; font-size: 12px; color: #28a745; font-weight: 500;">
                        💡 You can click this button multiple times - it works whenever you're ready!
                      </p>
                    </div>
                  `;

                  // Construir sección de montos
                  let paymentInfoHtml = '';
                  if (hasInitialPayment) {
                    paymentInfoHtml = `
                      <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                          <strong>Invoice Total:</strong> $${totalAmount.toFixed(2)}
                        </p>
                        <p style="margin: 0; font-size: 18px; color: #2c5f2d;">
                          <strong>Initial Payment Required (${initialPaymentPercentage}%):</strong><br>
                          <span style="font-size: 24px; font-weight: bold;">$${initialPaymentAmount.toFixed(2)}</span>
                        </p>
                        <p style="margin: 10px 0 0 0; font-size: 13px; color: #666; font-style: italic;">
                          Remaining balance of $${(totalAmount - initialPaymentAmount).toFixed(2)} due upon completion
                        </p>
                      </div>
                    `;
                  } else {
                    paymentInfoHtml = `
                      <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">
                          <strong>Invoice Total:</strong>
                        </p>
                        <p style="margin: 0; font-size: 26px; color: #2c5f2d; font-weight: bold;">
                          $${totalAmount.toFixed(2)}
                        </p>
                      </div>
                    `;
                  }

                  await sendEmail({
                    to: clientEmail,
                    subject: `Invoice #${invoiceNumber} - Sign & Payment - ${propertyAddress}`,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2c5f2d;">✅ Your Budget Has Been Approved!</h2>
                        
                        <p>Dear ${clientName},</p>
                        
                        <p>Thank you for approving your budget! We have now generated the official <strong>Invoice #${invoiceNumber}</strong> for your project at:</p>
                        
                        <p style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2c5f2d;">
                          📍 <strong>${propertyAddress}</strong>
                        </p>

                        ${paymentInfoHtml}

                        ${signatureButtonHtml}

                        <h3 style="color: #2c5f2d;">📋 Next Steps:</h3>
                        
                        <ol style="line-height: 1.8;">
                          <li><strong>Sign the Document:</strong> Click the green button above to sign digitally (link valid for 365 days).</li>
                          <li><strong>Make Payment:</strong> Use the payment link in the attached PDF to proceed with ${hasInitialPayment ? 'the initial payment' : 'payment'}.</li>
                        </ol>

                        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
                          The complete invoice document is attached to this email. You can find the payment link within the PDF.
                        </p>

                        <p style="margin-top: 20px;">
                          If you have any questions, please don't hesitate to contact us.
                        </p>

                        <p style="margin-top: 30px;">
                          Best regards,<br>
                          <strong>Zurcher Septic</strong><br>
                          📞 Phone: +1 (954) 636-8200<br>
                          📧 Email: admin@zurcherseptic.com
                        </p>
                      </div>
                    `,
                    attachments: [pdfAttachment]
                  });

                  console.log(`✅ Email con botón de pago enviado exitosamente`);

                  // 💰 ENVIAR COPIA DEL INVOICE AL EQUIPO DE FINANZAS
                  try {
                    console.log(`💰 Enviando copia del Invoice #${invoiceNumber} al equipo de finanzas...`);
                    
                    // Obtener staff con role 'finance'
                    const { Staff } = require('../data');
                    
                    const financeStaff = await Staff.findAll({
                      where: {
                        role: 'finance',
                        email: {
                          [Op.ne]: null,
                          [Op.ne]: ''
                        }
                      },
                      attributes: ['email', 'name']
                    });

                    if (financeStaff && financeStaff.length > 0) {
                      const financeEmailAddresses = financeStaff.map(staff => staff.email);
                      
                      console.log(`📧 Enviando a ${financeEmailAddresses.length} miembro(s) del equipo de finanzas:`, financeEmailAddresses);

                      // Email para el equipo de finanzas con el mismo PDF que recibió el cliente
                      await sendEmail({
                        to: financeEmailAddresses.join(', '), // ✅ Convertir array a string separado por comas
                        subject: `[Accounts Receivable] Invoice #${invoiceNumber} - ${propertyAddress}`,
                        html: `
                          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background-color: #1a365d; color: white; padding: 20px; text-align: center;">
                              <h2 style="margin: 0;">💰 New Account Receivable</h2>
                            </div>
                            
                            <div style="padding: 20px; background-color: #f9fafb;">
                              <p>A new invoice has been generated and sent to the client for approval and payment.</p>
                              
                              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a365d;">
                                <h3 style="margin-top: 0; color: #1a365d;">Invoice Details</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                  <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Invoice Number:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">#${invoiceNumber}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Property Address:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${propertyAddress}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Client Name:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${updatedBudget.Permit.applicantName || 'N/A'}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Client Email:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${updatedBudget.Permit.applicantEmail}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Total Amount:</strong></td>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #2563eb; font-weight: bold; font-size: 18px;">$${totalAmount.toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 8px 0;"><strong>Initial Payment (${initialPaymentPercentage}%):</strong></td>
                                    <td style="padding: 8px 0; text-align: right; color: #059669; font-weight: bold; font-size: 16px;">$${initialPaymentAmount.toFixed(2)}</td>
                                  </tr>
                                </table>
                              </div>

                              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                                <p style="margin: 0; color: #92400e;">
                                  <strong>⚠️ Action Required:</strong> This invoice has been sent to the client for signature and payment. Please track this account receivable and follow up if payment is not received within the expected timeframe.
                                </p>
                              </div>

                              <div style="margin: 30px 0;">
                                <h4 style="color: #1a365d; margin-bottom: 10px;">Client Actions:</h4>
                                <ul style="line-height: 1.8; color: #4b5563;">
                                  <li>✅ Client approved the budget</li>
                                  <li>📧 Digital signature request sent via SignNow</li>
                                  <li>💳 Payment link included in the invoice PDF</li>
                                  <li>📄 Invoice attached to this email for your records</li>
                                </ul>
                              </div>

                              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                                The complete invoice document is attached to this email for your records. The client has also received this document with payment instructions.
                              </p>

                              <p style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
                                This is an automated notification from Zurcher Septic Management System
                              </p>
                            </div>
                          </div>
                        `,
                        attachments: [pdfAttachment]
                      });

                      console.log(`✅ Invoice enviado al equipo de finanzas (${financeEmailAddresses.length} destinatario(s))`);
                    } else {
                      console.warn(`⚠️ No se encontraron usuarios con role 'finance' para notificar`);
                    }

                  } catch (financeEmailError) {
                    console.error(`⚠️ Error al enviar email al equipo de finanzas:`, financeEmailError);
                    // No fallar el proceso principal
                  }

                } catch (emailError) {
                  console.error(`⚠️ Error al enviar email con botón de pago:`, emailError);
                  // No fallar el proceso principal
                }

                // Notificar al equipo
                await sendNotifications('budgetSentToSignNow', {
                  propertyAddress: updatedBudget.Permit?.propertyAddress,
                  applicantEmail: updatedBudget.Permit.applicantEmail,
                  applicantName: updatedBudget.Permit.applicantName,
                  idBudget: updatedBudget.idBudget,
                  documentId: documentId,
                  invoiceNumber: invoiceNumber,
                  service: serviceName
                });

                console.log(`✅ Proceso completo: Invoice #${invoiceNumber} aprobado, PDF regenerado, enviado a ${serviceName}, email con pago enviado al cliente y notificación enviada al equipo de finanzas`);

                // 🆕 ENVIAR PPI A DOCUSIGN AUTOMÁTICAMENTE SI EXISTE
                console.log('\n🔍 === VERIFICANDO SI ENVIAR PPI AUTOMÁTICAMENTE ===');
                console.log(`USE_DOCUSIGN: ${USE_DOCUSIGN}, hasPermit: ${!!updatedBudget.Permit}, PermitIdPermit: ${updatedBudget.PermitIdPermit}`);
                
                if (USE_DOCUSIGN && updatedBudget.Permit && updatedBudget.PermitIdPermit) {
                  try {
                    console.log('📋 === ENVIANDO PPI A DOCUSIGN AUTOMÁTICAMENTE ===');
                    
                    const permitForPPI = await Permit.findByPk(updatedBudget.PermitIdPermit);
                    
                    // Verificar que tenga PPI generado y email del cliente
                    if (permitForPPI && permitForPPI.applicantEmail && (permitForPPI.ppiCloudinaryUrl || permitForPPI.ppiGeneratedPath)) {
                      const ppiUrl = permitForPPI.ppiCloudinaryUrl || permitForPPI.ppiGeneratedPath;
                      let ppiTempPath = null;
                      
                      console.log(`📧 Enviando PPI a: ${permitForPPI.applicantEmail}`);
                      console.log(`📄 PPI URL: ${ppiUrl.substring(0, 80)}...`);
                      
                      // Descargar PPI si es URL de Cloudinary
                      if (ppiUrl.startsWith('http')) {
                        console.log(`☁️  Descargando PPI desde Cloudinary...`);
                        const axios = require('axios');
                        const uploadsDir = path.join(__dirname, '../uploads/temp');
                        
                        if (!fs.existsSync(uploadsDir)) {
                          fs.mkdirSync(uploadsDir, { recursive: true });
                        }
                        
                        const response = await axios.get(ppiUrl, { responseType: 'arraybuffer' });
                        ppiTempPath = path.join(uploadsDir, `ppi_auto_${permitForPPI.idPermit}_${Date.now()}.pdf`);
                        fs.writeFileSync(ppiTempPath, response.data);
                        console.log(`✅ PPI descargado: ${ppiTempPath}`);
                      } else if (fs.existsSync(ppiUrl)) {
                        ppiTempPath = ppiUrl;
                      }
                      
                      if (ppiTempPath) {
                        // Preparar información
                        const propertyAddress = permitForPPI.propertyAddress || 'Property';
                        const fileName = `PPI_${permitForPPI.ppiInspectorType || 'Inspection'}_Permit_${permitForPPI.idPermit}.pdf`;
                        
                        // Enviar PPI a DocuSign usando el método específico para PPI (2 firmas)
                        const ppiSignatureResult = await signatureService.sendPPIForSignature(
                          ppiTempPath,
                          clientEmail, // Usar el mismo email normalizado
                          clientName,
                          permitForPPI.applicant || permitForPPI.applicantName || clientName, // 🆕 Pasar applicant
                          fileName,
                          `🚨 IMPORTANT: PPI Signature Required - ${propertyAddress}`,
                          `The owner's signature is required for the inspection document..`,
                          false // On-demand signing
                        );
                        
                        console.log(`✅ PPI enviado a DocuSign con 2 firmas (Envelope: ${ppiSignatureResult.envelopeId})`);
                        
                        // Actualizar permit con info de DocuSign
                        await permitForPPI.update({
                          ppiDocusignEnvelopeId: ppiSignatureResult.envelopeId,
                          ppiSentForSignatureAt: new Date(),
                          ppiSignatureStatus: 'sent'
                        });
                        
                        // 📧 ENVIAR CORREO PERSONALIZADO DEL PPI
                        console.log('📧 Enviando correo personalizado del PPI al cliente...');
                        
                        await sendEmail({
                          to: clientEmail,
                          subject: `🚨 IMPORTANT: Property Owner Signature Required - PPI for ${propertyAddress}`,
                          html: `
                            <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
                              
                              <div style="background: linear-gradient(135deg, #ff4757 0%, #ff6348 100%); color: white; padding: 15px; text-align: center; font-size: 18px; font-weight: bold;">
                                ⚠️ PROPERTY OWNER ACTION REQUIRED
                              </div>
                              
                              <div style="padding: 30px; background-color: #ffffff;">
                                <p>Dear ${clientName},</p>
                                
                                <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); border-left: 6px solid #ff6b35; padding: 20px; margin: 25px 0; border-radius: 8px;">
                                  <h3 style="color: #ff6b35; margin-top: 0;">(PPI) Signature Required</h3>
                                  <p style="margin: 0;">Property: <strong>${propertyAddress}</strong></p>
                                </div>
                                
                                <div style="background: linear-gradient(135deg, #fee 0%, #fdd 100%); border: 3px solid #ff4757; padding: 20px; margin: 25px 0; border-radius: 10px;">
                                  <h3 style="color: #c23616; margin-top: 0;">⚠️ CRITICAL REQUIREMENT</h3>
                                  <p style="font-size: 16px; line-height: 1.8;">
                                    This inspection form (PPI) <strong style="text-decoration: underline;">MUST be signed by the owner </strong> in order for us to inspect the work performed. Without it, we cannot proceed.
                                  </p>
                                </div>
                                
                                <h3 style="color: #2c5f2d;">📝 How to Sign:</h3>
                                <ol style="line-height: 1.8; font-size: 15px;">
                                  <li>Click the orange button below to access the PPI document</li>
                                  <li>Review the PPI form</li>
                                  <li>Sign electronically as the Property Owner</li>
                                  <li>Submit your signature to complete the process</li>
                                </ol>
                                
                                <div style="text-align: center; margin: 35px 0;">
                                  <a href="${process.env.API_URL || 'https://zurcherapi.up.railway.app'}/ppi/${permitForPPI.idPermit}/sign" 
                                     style="display: inline-block; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 18px 45px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);">
                                    📝 SIGN PPI NOW
                                  </a>
                                  <p style="margin-top: 15px; font-size: 13px; color: #666;">
                                    This link is always active - click whenever you're ready to sign
                                  </p>
                                </div>
                                
                                <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
                                  <h4 style="color: #1a365d; margin-top: 0;">ℹ️ Important Information:</h4>
                                  <ul style="line-height: 1.8; color: #4b5563; margin: 0;">
                                    <li>You've also received your Invoice #${invoiceNumber} for signature</li>
                                    <li>Both documents (Invoice + PPI) must be signed</li>
                                   <li>The PPI is required for Job Approval</li>
                                    <li>The signature link never expires</li>
                                  </ul>
                                </div>
                                
                                <p style="margin-top: 30px;">
                                  If you have any questions, please don't hesitate to contact us.
                                </p>
                                
                                <p style="margin-top: 30px;">
                                  Best regards,<br>
                                  <strong>Zurcher Septic</strong><br>
                                  📞 Phone: +1 (954) 636-8200<br>
                                  📧 Email: admin@zurcherseptic.com
                                </p>
                              </div>
                            </div>
                          `
                        });
                        
                        console.log(`✅ Correo personalizado del PPI enviado`);
                        
                        // Limpiar archivo temporal
                        if (ppiTempPath && ppiUrl.startsWith('http')) {
                          try {
                            fs.unlinkSync(ppiTempPath);
                            console.log(`🗑️  PPI temporal eliminado`);
                          } catch (cleanupError) {
                            console.error('Error limpiando PPI temporal:', cleanupError);
                          }
                        }
                        
                        console.log(`✅ PPI enviado exitosamente a ${clientEmail}`);
                      } else {
                        console.warn('⚠️ No se pudo acceder al archivo PPI');
                      }
                    } else {
                      console.log('ℹ️ PPI no disponible o sin email de cliente - omitiendo envío automático');
                    }
                    
                  } catch (ppiError) {
                    console.error('❌ Error al enviar PPI automáticamente:', ppiError);
                    // No fallar todo el proceso
                  }
                }

              } catch (signatureServiceError) {
                console.error(`❌ Error al enviar Invoice #${invoiceNumber} a ${serviceName}:`, signatureServiceError);
                // No fallar todo el proceso, el admin puede reenviar manualmente
              }
            }

          } catch (pdfError) {
            console.error(`❌ Error al regenerar PDF para Invoice #${invoiceNumber}:`, pdfError);
          }
        });
      }

      // Notificar al equipo
      await sendNotifications('budgetApprovedByClient', {
        idBudget: budget.idBudget,
        propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
        applicantName: budget.Permit?.applicantName || budget.applicantName,
        invoiceNumber: invoiceNumber
      });

      // 🆕 El email al cliente ya se envía automáticamente en el proceso de background
      // cuando se convierte a invoice y se envía a SignNow (con PDF adjunto y info de pago)

      res.json({
        success: true,
        message: `Presupuesto aprobado exitosamente${invoiceNumber ? ` y convertido a Invoice #${invoiceNumber}` : ''}`,
        budget: {
          idBudget: budget.idBudget,
          status: invoiceNumber ? 'created' : 'client_approved',
          reviewedAt: budget.reviewedAt,
          invoiceNumber: invoiceNumber
        }
      });

    } catch (error) {
      console.error('❌ Error al aprobar presupuesto:', error);
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      res.status(500).json({ 
        error: 'Error al aprobar el presupuesto',
        details: error.message 
      });
    }
  },

  /**
   * Cliente rechaza el presupuesto (endpoint público)
   * POST /api/budgets/:idBudget/reject-review/:reviewToken
   */
  async rejectReview(req, res) {
    try {
      const { idBudget, reviewToken } = req.params;
      const { reason } = req.body;
      
      console.log(`❌ Cliente rechazando presupuesto ${idBudget}...`);

      const budget = await Budget.findByPk(idBudget, {
        include: [{ model: Permit, attributes: ['applicantName', 'propertyAddress', 'applicantEmail'] }]
      });

      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Validar token
      if (budget.reviewToken !== reviewToken) {
        return res.status(403).json({ error: 'Token de revisión inválido' });
      }

      // Validar estado
      if (budget.status !== 'pending_review') {
        return res.status(400).json({ 
          error: `Este presupuesto ya no está en revisión (estado actual: ${budget.status})`
        });
      }

      // Actualizar presupuesto
      await budget.update({
        status: 'rejected',
        reviewedAt: new Date(),
        generalNotes: budget.generalNotes 
          ? `${budget.generalNotes}\n\nRazón de rechazo (cliente): ${reason || 'No especificada'}`
          : `Razón de rechazo (cliente): ${reason || 'No especificada'}`
      });

      console.log(`❌ Presupuesto ${idBudget} rechazado por el cliente`);

      // Notificar al equipo
      await sendNotifications('budgetRejectedByClient', {
        idBudget: budget.idBudget,
        propertyAddress: budget.Permit?.propertyAddress || budget.propertyAddress,
        applicantName: budget.Permit?.applicantName || budget.applicantName,
        reason: reason || 'No especificada'
      });

      // Email de confirmación al cliente
      await sendEmail({
        to: budget.Permit?.applicantEmail || budget.applicantEmail,
        subject: `Budget Proposal Feedback Received - ${budget.Permit?.propertyAddress || budget.propertyAddress}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Thank You for Your Feedback</h1>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <p style="font-size: 16px; color: #333;">Dear ${budget.Permit?.applicantName || 'Valued Customer'},</p>
              
              <p style="font-size: 16px; color: #333;">
                We have received your decision regarding Budget Proposal <strong>#${budget.idBudget}</strong> for 
                <strong>${budget.Permit?.propertyAddress || budget.propertyAddress}</strong>.
              </p>
              
              ${reason ? `
              <div style="background: white; padding: 20px; border-left: 4px solid #dc2626; margin: 20px 0;">
                <p style="margin: 0; color: #666;"><strong>Your Feedback:</strong></p>
                <p style="margin: 10px 0 0 0; color: #333;">${reason}</p>
              </div>
              ` : ''}
              
              <p style="font-size: 16px; color: #333;">
                Your feedback is valuable to us. Our team will review your comments and reach out to discuss possible 
                modifications or alternative solutions that better meet your needs.
              </p>
              
              <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 8px;">
                <h3 style="color: #1e3a8a; margin-top: 0;">Contact Us</h3>
                <p style="margin: 5px 0;">📧 Email: <a href="mailto:admin@zurcherseptic.com">admin@zurcherseptic.com</a></p>
                <p style="margin: 5px 0;">📞 Phone: <a href="tel:+14074194495">+1 (407) 419-4495</a></p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                <strong>Zurcher Septic</strong><br>
                Professional Septic Installation & Maintenance<br>
                License CFC1433240
              </p>
            </div>
          </div>
        `
      });

      res.json({
        success: true,
        message: 'Presupuesto rechazado',
        budget: {
          idBudget: budget.idBudget,
          status: 'rejected',
          reviewedAt: budget.reviewedAt
        }
      });

    } catch (error) {
      console.error('❌ Error al rechazar presupuesto:', error);
      res.status(500).json({ 
        error: 'Error al rechazar el presupuesto',
        details: error.message 
      });
    }
  },

  // ========== 🆕 NUEVO: CONVERTIR DRAFT A INVOICE DEFINITIVO ==========

  /**
   * Convierte un presupuesto Draft a Invoice definitivo
   * Asigna número de invoice, regenera PDF, y cambia el estado
   * POST /api/budgets/:idBudget/convert-to-invoice
   */
  async convertDraftToInvoice(req, res) {
    const transaction = await conn.transaction();
    let generatedPdfPath = null;

    try {
      const { idBudget } = req.params;
      
      console.log(`🔄 Iniciando conversión de Draft a Invoice para Budget ID: ${idBudget}`);

      // 1. Buscar el presupuesto
      const budget = await Budget.findByPk(idBudget, {
        include: [
          { 
            model: Permit, 
            attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] 
          },
          { model: BudgetLineItem, as: 'lineItems' }
        ],
        transaction
      });

      if (!budget) {
        await transaction.rollback();
        return res.status(404).json({ 
          error: 'Presupuesto no encontrado' 
        });
      }

      // 2. Validar que sea un Draft
      if (budget.status !== 'draft' && budget.status !== 'pending_review' && budget.status !== 'client_approved') {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'Solo se pueden convertir presupuestos en estado draft, pending_review o client_approved',
          currentStatus: budget.status
        });
      }

      // 3. Validar que no tenga ya un invoiceNumber
      if (budget.invoiceNumber) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'Este presupuesto ya tiene un número de invoice asignado',
          invoiceNumber: budget.invoiceNumber
        });
      }

      // 4. Obtener el siguiente número de invoice disponible
      // 🔄 USAR NUMERACIÓN UNIFICADA (compartida con FinalInvoices)
      const nextInvoiceNumber = await getNextInvoiceNumber(transaction);
      
      console.log(`📋 Asignando Invoice Number: ${nextInvoiceNumber} (numeración unificada)`);

      // 5. Actualizar el presupuesto
      await budget.update({
        invoiceNumber: nextInvoiceNumber,
        status: 'created', // Cambiar a estado "created" (invoice definitivo)
        convertedToInvoiceAt: new Date()
      }, { transaction });

      await transaction.commit();
      console.log(`✅ Budget ${idBudget} convertido a Invoice #${nextInvoiceNumber}`);

      // 6. Regenerar el PDF con el nuevo número de invoice (en background)
      setImmediate(async () => {
        try {
          console.log(`📄 Regenerando PDF para Invoice #${nextInvoiceNumber}...`);
          
          // Volver a buscar el budget actualizado con todos los datos
          const updatedBudget = await Budget.findByPk(idBudget, {
            include: [
              { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] },
              { model: BudgetLineItem, as: 'lineItems' }
            ]
          });

          if (!updatedBudget) {
            console.error(`❌ No se pudo encontrar el budget ${idBudget} para regenerar PDF`);
            return;
          }

          const budgetDataForPdf = updatedBudget.toJSON();
          const newPdfPath = await generateAndSaveBudgetPDF(budgetDataForPdf);
          
          if (newPdfPath) {
            await updatedBudget.update({ pdfPath: newPdfPath });
            console.log(`✅ PDF regenerado exitosamente: ${newPdfPath}`);
          }

        } catch (pdfError) {
          console.error(`❌ Error al regenerar PDF para Invoice #${nextInvoiceNumber}:`, pdfError);
        }
      });

      // 7. Responder inmediatamente
      const responseData = await Budget.findByPk(idBudget, {
        include: [
          { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName', 'lot', 'block'] },
          { model: BudgetLineItem, as: 'lineItems' }
        ]
      });

      res.status(200).json({
        success: true,
        message: `Presupuesto convertido exitosamente a Invoice #${nextInvoiceNumber}`,
        budget: responseData,
        invoiceNumber: nextInvoiceNumber,
        convertedAt: budget.convertedToInvoiceAt
      });

    } catch (error) {
      console.error('❌ Error al convertir Draft a Invoice:', error);
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      res.status(500).json({ 
        error: 'Error al convertir el presupuesto',
        details: error.message 
      });
    }
  },

  // 📤 SUBIR PDF FIRMADO MANUALMENTE (manual signature upload)
  async uploadManualSignedPdf(req, res) {
    try {
      const { idBudget } = req.params;
      console.log(`📤 Iniciando carga manual de PDF firmado para Budget ${idBudget}`);

      // 1. Validar que se envió un archivo
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No se proporcionó ningún archivo PDF' 
        });
      }

      // 2. Validar que el archivo es PDF
      const allowedMimeTypes = ['application/pdf'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: 'El archivo debe ser un PDF',
          mimeTypeReceived: req.file.mimetype
        });
      }

      // 3. Buscar el Budget con información del Permit
      const budget = await Budget.findByPk(idBudget, {
        include: [{ 
          model: Permit, 
          attributes: ['propertyAddress', 'permitNumber'] 
        }]
      });

      if (!budget) {
        return res.status(404).json({ 
          error: 'Presupuesto no encontrado' 
        });
      }

      // 4. Crear identificador único con invoice# y dirección (si existe)
      const invoiceTag = budget.invoiceNumber 
        ? `invoice-${budget.invoiceNumber}` 
        : `budget-${idBudget}`;
      
      const normalizedAddress = budget.Permit?.propertyAddress
        ? budget.Permit.propertyAddress.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
        : 'no-address';
      
      const propertyTag = `property-${normalizedAddress}`;

      // 5. Responder inmediatamente al usuario (antes de subir a Cloudinary)
      res.status(202).json({
        success: true,
        message: 'PDF recibido, procesando en segundo plano...',
        budget: {
          idBudget: budget.idBudget,
          invoiceNumber: budget.invoiceNumber,
          status: 'processing'
        }
      });

      // 6. Procesar la subida a Cloudinary de forma asíncrona (en background)
      (async () => {
        try {
          // Eliminar el PDF firmado anterior de Cloudinary (si existe)
          if (budget.manualSignedPdfPublicId) {
            console.log(`🗑️ Eliminando PDF manual anterior: ${budget.manualSignedPdfPublicId}`);
            try {
              await cloudinary.uploader.destroy(budget.manualSignedPdfPublicId);
              console.log('✅ PDF anterior eliminado de Cloudinary');
            } catch (deleteError) {
              console.warn('⚠️ No se pudo eliminar el PDF anterior:', deleteError.message);
            }
          }

          // Subir el nuevo PDF a Cloudinary
          console.log('☁️ Subiendo PDF firmado manualmente a Cloudinary (asíncrono)...');
          
          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'signed_budgets',
                resource_type: 'raw',
                public_id: `budget-${idBudget}-manual-signed-${Date.now()}`,
                tags: [invoiceTag, propertyTag, 'manual-signature', 'signed-budget'],
                context: {
                  budget_id: idBudget,
                  invoice_number: budget.invoiceNumber || 'N/A',
                  property_address: budget.Permit?.propertyAddress || 'N/A',
                  uploaded_by: req.user?.email || 'unknown',
                  signature_method: 'manual'
                }
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );

            uploadStream.end(req.file.buffer);
          });

          console.log('✅ PDF subido exitosamente a Cloudinary:', uploadResult.secure_url);

          // Actualizar el Budget con los datos del PDF manual
          await budget.update({
            signatureMethod: 'manual',
            manualSignedPdfPath: uploadResult.secure_url,
            manualSignedPdfPublicId: uploadResult.public_id,
            status: 'signed' // El hook beforeUpdate pasará a 'approved' si tiene pago
          });

          console.log(`✅ Budget ${idBudget} actualizado con PDF firmado manual (status: ${budget.status})`);

        } catch (uploadError) {
          console.error(`❌ Error en subida asíncrona de PDF para Budget ${idBudget}:`, uploadError);
        }
      })();

    } catch (error) {
      console.error('❌ Error al subir PDF firmado manual:', error);
      res.status(500).json({ 
        error: 'Error al subir el PDF firmado',
        details: error.message 
      });
    }
  },

  // 🆕 EXPORTAR BUDGETS A EXCEL
  async exportBudgetsToExcel(req, res) {
    try {
      console.log('📊 Iniciando exportación de budgets a Excel...');

      // 🆕 Obtener filtros de query params (igual que fetchBudgets)
      const { search, status, signatureMethod, month, year } = req.query;
      
      console.log('📋 Filtros aplicados:', { search, status, signatureMethod, month, year });

      // Construir condiciones WHERE dinámicamente
      const whereConditions = {};
      
      // ✅ EXCLUIR budgets archivados y legacy_maintenance de la exportación
      whereConditions.status = { [Op.notIn]: ['archived', 'legacy_maintenance'] };
      
      // 🎯 Filtro por estado (con lógica de agrupación)
      if (status && status !== 'all') {
        // ✅ Caso especial: "approved" incluye status='approved' O isLegacy=true
        if (status === 'approved') {
          whereConditions[Op.or] = whereConditions[Op.or] || [];
          whereConditions[Op.or].push(
            { status: 'approved' },
            { isLegacy: true }
          );
        }
        // ✅ Caso especial: "signed" = Firmados sin pago (excluye legacy y approved)
        else if (status === 'signed') {
          whereConditions[Op.and] = whereConditions[Op.and] || [];
          whereConditions[Op.and].push({
            isLegacy: { [Op.or]: [false, null] },
            status: { [Op.ne]: 'approved' }, // Excluir los ya aprobados
            [Op.or]: [
              { 
                status: 'signed',
                paymentProofAmount: { [Op.or]: [null, 0] }
              },
              { 
                signatureMethod: 'manual',
                manualSignedPdfPath: { [Op.ne]: null },
                paymentProofAmount: { [Op.or]: [null, 0] }
              }
            ]
          });
        } 
        // 🆕 Caso especial: "en_revision" = Enviados en seguimiento
        else if (status === 'en_revision') {
          whereConditions.status = {
            [Op.in]: ['send', 'pending_review', 'client_approved', 'notResponded', 'sent_for_signature']
          };
        }
        else {
          whereConditions.status = status;
        }
      }
      
      // Filtro por mes
      if (month && month !== 'all') {
        whereConditions[Op.and] = whereConditions[Op.and] || [];
        whereConditions[Op.and].push(
          literal(`EXTRACT(MONTH FROM CAST("Budget"."date" AS DATE)) = ${parseInt(month) + 1}`)
        );
      }
      
      // Filtro por año
      if (year && year !== 'all') {
        whereConditions[Op.and] = whereConditions[Op.and] || [];
        whereConditions[Op.and].push(
          literal(`EXTRACT(YEAR FROM CAST("Budget"."date" AS DATE)) = ${parseInt(year)}`)
        );
      }
      
      // Filtro por búsqueda (cliente, dirección o email)
      if (search && search.trim()) {
        whereConditions[Op.or] = [
          { applicantName: { [Op.iLike]: `%${search}%` } },
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { '$Permit.applicantEmail$': { [Op.iLike]: `%${search}%` } }
        ];
      }

      // 🆕 Filtro por método de firma
      if (signatureMethod && signatureMethod !== 'all') {
        if (signatureMethod === 'none') {
          // Sin firmar: signatureMethod es null, 'none', o vacío
          whereConditions[Op.or] = whereConditions[Op.or] || [];
          whereConditions[Op.or].push(
            { signatureMethod: null },
            { signatureMethod: 'none' },
            { signatureMethod: '' }
          );
        } else if (signatureMethod === 'legacy') {
          // Legacy: isLegacy=true
          whereConditions.isLegacy = true;
        } else {
          // SignNow o Manual: filtrar por signatureMethod exacto
          whereConditions.signatureMethod = signatureMethod;
        }
      }

      // Obtener budgets con filtros aplicados
      const budgets = await Budget.findAll({
        where: whereConditions,
        include: [
          {
            model: Permit,
            attributes: ['propertyAddress', 'systemType', 'applicantName', 'applicantEmail', 'applicantPhone']
          },
          {
            model: Work,
            attributes: ['idWork', 'status']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      console.log(`📋 Se encontraron ${budgets.length} budgets para exportar (con filtros aplicados)`);

      // Crear workbook y worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Budgets');

      // 🆕 Configurar propiedades del workbook para mejor compatibilidad
      workbook.creator = 'Zurcher Construction';
      workbook.lastModifiedBy = 'Zurcher System';
      workbook.created = new Date();
      workbook.modified = new Date();

      // 🆕 Configurar propiedades de impresión de la hoja
      worksheet.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape', // Horizontal para más columnas
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0, // Permite múltiples páginas verticales
        margins: {
          left: 0.25, top: 0.25, right: 0.25, bottom: 0.25,
          header: 0.3, footer: 0.3
        }
      };

      // Configurar columnas con ancho optimizado (ajustado para mejor visualización)
      worksheet.columns = [
        { header: 'ID/INVOICE', key: 'identifier', width: 16 },
        { header: 'FECHA CREACIÓN', key: 'date', width: 13 },
        { header: 'FECHA EXPIRACIÓN', key: 'expirationDate', width: 15 },
        { header: 'CLIENTE', key: 'applicantName', width: 20 },
        { header: 'EMAIL', key: 'email', width: 25 },
        { header: 'TELÉFONO', key: 'phone', width: 13 },
        { header: 'DIRECCIÓN', key: 'propertyAddress', width: 32 },
        { header: 'SISTEMA', key: 'systemType', width: 20 },
        { header: 'PRECIO TOTAL', key: 'totalPrice', width: 12 },
        { header: 'PAGO INICIAL', key: 'initialPayment', width: 12 },
        { header: 'NOTAS', key: 'generalNotes', width: 30 }
      ];

      // 🆕 Mejorar estilización del encabezado
      const headerRow = worksheet.getRow(1);
      headerRow.height = 22; // Altura un poco más compacta
      headerRow.font = { 
        bold: true, 
        size: 8, // Reducido de 11 a 10
        color: { argb: 'FFFFFFFF' },
        name: 'Arial' // Fuente universal
      };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' } // Azul
      };
      headerRow.alignment = { 
        vertical: 'middle', 
        horizontal: 'center',
        wrapText: true // Permite wrap en encabezados
      };
      
      // 🆕 Agregar bordes al encabezado
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        };
      });

      // Agregar datos con formato mejorado
      budgets.forEach((budget, index) => {
        // Determinar identificador: invoice number si existe, sino idBudget
        const identifier = budget.invoiceNumber 
          ? `INVOICE #${budget.invoiceNumber}` 
          : `BUDGET #${budget.idBudget}`;

        // Formatear fechas en formato MM-DD-YYYY
        const formatDate = (dateString) => {
          if (!dateString) return 'N/A';
          try {
            const date = new Date(dateString);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            return `${month}-${day}-${year}`;
          } catch (error) {
            return 'N/A';
          }
        };

        const row = worksheet.addRow({
          identifier,
          date: formatDate(budget.date),
          expirationDate: formatDate(budget.expirationDate),
          applicantName: (budget.applicantName || budget.Permit?.applicantName || 'N/A').toUpperCase(),
          email: (budget.Permit?.applicantEmail || 'N/A').toUpperCase(),
          phone: budget.Permit?.applicantPhone || 'N/A',
          propertyAddress: (budget.propertyAddress || budget.Permit?.propertyAddress || 'N/A').toUpperCase(),
          systemType: (budget.Permit?.systemType || 'N/A').toUpperCase(),
          totalPrice: budget.totalPrice ? parseFloat(budget.totalPrice) : 0,
          initialPayment: budget.initialPayment ? parseFloat(budget.initialPayment) : 0,
          generalNotes: (budget.generalNotes || '').toUpperCase()
        });

        // 🆕 Configurar altura mínima y fuente para mejor legibilidad
        row.height = 22; // Altura mínima con espacio para respirar
        row.font = { 
          size: 8, // Tamaño compacto pero legible
          name: 'Arial' // Fuente universal
        };

        // 🆕 Aplicar alineación con padding para mejor legibilidad
        row.getCell('identifier').alignment = { vertical: 'middle', horizontal: 'center', indent: 1 };
        row.getCell('date').alignment = { vertical: 'middle', horizontal: 'center', indent: 1 };
        row.getCell('expirationDate').alignment = { vertical: 'middle', horizontal: 'center', indent: 1 };
        row.getCell('applicantName').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        row.getCell('email').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        row.getCell('phone').alignment = { vertical: 'middle', horizontal: 'center', indent: 1 };
        row.getCell('propertyAddress').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
        row.getCell('systemType').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        row.getCell('totalPrice').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        row.getCell('initialPayment').alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
        row.getCell('generalNotes').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };

        // 🆕 Formatear columnas de precios con formato de moneda
        row.getCell('totalPrice').numFmt = '"$"#,##0.00';
        row.getCell('initialPayment').numFmt = '"$"#,##0.00';

        // Colorear fila según estado
        let fillColor = 'FFFFFFFF'; // Blanco por defecto
        switch (budget.status) {
          case 'draft':
            fillColor = 'FFF3F3F3'; // Gris claro
            break;
          case 'signed':
          case 'approved':
            fillColor = 'FFD4EDDA'; // Verde claro
            break;
          case 'sent_for_signature':
            fillColor = 'FFFEF5E7'; // Amarillo claro
            break;
          case 'rejected':
            fillColor = 'FFF8D7DA'; // Rojo claro
            break;
        }

        // Alternar color de fila para mejor legibilidad (solo si es blanco)
        if (index % 2 === 0 && fillColor === 'FFFFFFFF') {
          fillColor = 'FFF8F9FA'; // Gris muy claro
        }

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillColor }
          };
        });
      });

      // 🆕 Aplicar bordes consistentes a todas las celdas con datos
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
          };
        });
      });

      // 🆕 Agregar autofiltro al encabezado (útil en Excel, Google Sheets, etc.)
      if (budgets.length > 0) {
        worksheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: 11 }
        };
      }

      // 🆕 Congelar fila de encabezado para navegación fácil
      worksheet.views = [
        { 
          state: 'frozen', 
          xSplit: 0, 
          ySplit: 1, // Congela la primera fila
          activeCell: 'A2'
        }
      ];

      // Generar nombre de archivo con fecha y filtros aplicados
      let fileNameParts = ['Budgets'];
      
      if (status && status !== 'all') {
        fileNameParts.push(status);
      }
      if (signatureMethod && signatureMethod !== 'all') {
        fileNameParts.push(signatureMethod);
      }
      if (month && month !== 'all') {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        fileNameParts.push(monthNames[parseInt(month) - 1]);
      }
      if (year && year !== 'all') {
        fileNameParts.push(year);
      }
      
      fileNameParts.push(new Date().toISOString().split('T')[0]);
      
      const fileName = `${fileNameParts.join('_')}.xlsx`;

      // Configurar headers de respuesta
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Escribir el archivo a la respuesta
      await workbook.xlsx.write(res);

      console.log(`✅ Excel exportado exitosamente: ${fileName} (${budgets.length} registros)`);
      res.end();

    } catch (error) {
      console.error('❌ Error al exportar budgets a Excel:', error);
      res.status(500).json({
        error: true,
        message: 'Error al exportar budgets a Excel',
        details: error.message
      });
    }
  },

  // 🔍 DIAGNÓSTICO: Ver TODOS los estados que existen en la BD
  async diagnoseStatuses(req, res) {
    try {
      const allBudgets = await Budget.findAll({
        attributes: ['idBudget', 'status', 'signatureMethod', 'isLegacy', 'manualSignedPdfPath', 'paymentProofAmount']
      });

      // Contar por status
      const statusCount = {};
      allBudgets.forEach(b => {
        const status = b.status || 'NULL';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      // Calcular cuántos cubre cada filtro
      const filterCoverage = {
        draft: allBudgets.filter(b => ['draft', 'created'].includes(b.status)).length,
        en_revision: allBudgets.filter(b => ['send', 'pending_review', 'client_approved', 'notResponded', 'sent_for_signature'].includes(b.status)).length,
        signed: allBudgets.filter(b => b.status === 'signed' && !b.isLegacy).length,
        approved: allBudgets.filter(b => b.status === 'approved' && !b.isLegacy).length,
        legacy: allBudgets.filter(b => b.isLegacy === true).length,
        rejected: allBudgets.filter(b => b.status === 'rejected').length,
      };

      const totalInFilters = Object.values(filterCoverage).reduce((sum, count) => sum + count, 0);
      const uncovered = allBudgets.length - totalInFilters;

      // Buscar presupuestos no cubiertos
      const coveredIds = new Set();
      allBudgets.forEach(b => {
        if (['draft', 'created'].includes(b.status) ||
            ['send', 'pending_review', 'client_approved', 'notResponded', 'sent_for_signature'].includes(b.status) ||
            (b.status === 'signed' && !b.isLegacy) ||
            (b.status === 'approved' && !b.isLegacy) ||
            b.isLegacy === true ||
            b.status === 'rejected') {
          coveredIds.add(b.idBudget);
        }
      });

      const uncoveredBudgets = allBudgets.filter(b => !coveredIds.has(b.idBudget)).map(b => ({
        idBudget: b.idBudget,
        status: b.status,
        signatureMethod: b.signatureMethod,
        isLegacy: b.isLegacy,
        hasManualPdf: !!b.manualSignedPdfPath,
        paymentAmount: b.paymentProofAmount
      }));

      res.json({
        totalBudgets: allBudgets.length,
        statusBreakdown: statusCount,
        filterCoverage,
        totalCoveredByFilters: totalInFilters,
        uncoveredCount: uncovered,
        uncoveredBudgets
      });
    } catch (error) {
      console.error('Error en diagnóstico:', error);
      res.status(500).json({
        error: true,
        message: 'Error al diagnosticar estados',
        details: error.message
      });
    }
  },

  /**
   * 🔔 Obtener budgets con alertas/recordatorios próximos
   * Usado para priorizar en la primera página de GestionBudgets
   */
  async getBudgetsWithUpcomingAlerts(req, res) {
    try {
      const { days = 7 } = req.query; // Por defecto, próximos 7 días

      // Calcular rango de fechas
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days));

      // Importar BudgetNote si no está ya importado
      const { BudgetNote } = require('../data');

      // Buscar notas con recordatorios activos en el rango
      const budgetsWithAlerts = await Budget.findAll({
        where: {
          status: { [Op.notIn]: ['archived', 'legacy_maintenance'] } // ✅ Excluir archivados
        },
        include: [
          {
            model: BudgetNote,
            as: 'notes', // 🔧 Usar el alias correcto de la asociación
            required: true, // INNER JOIN - solo budgets con notas
            where: {
              isReminderActive: true,
              reminderDate: {
                [Op.gte]: now,
                [Op.lte]: futureDate
              },
              reminderCompletedAt: null
            },
            attributes: ['id', 'message', 'noteType', 'priority', 'reminderDate', 'createdAt'],
            include: [
              {
                model: Staff,
                as: 'author', // 🔧 Usar el alias correcto
                attributes: ['id', 'name', 'email']
              }
            ]
          },
          {
            model: Permit,
            attributes: ['idPermit', 'propertyAddress']
          },
          {
            model: Staff,
            as: 'createdByStaff',
            attributes: ['id', 'name', 'email']
          }
        ],
        attributes: [
          'idBudget',
          'propertyAddress',
          'applicantName',
          'status',
          'date',
          'createdAt',
          'updatedAt'
        ],
        order: [[{ model: BudgetNote, as: 'notes' }, 'reminderDate', 'ASC']] // Ordenar por fecha de alerta más próxima
      });

      // Calcular días restantes para cada alerta
      const budgetsWithDaysRemaining = budgetsWithAlerts.map(budget => {
        const budgetData = budget.toJSON();
        
        // Encontrar la alerta más próxima (usar alias 'notes')
        const nearestAlert = budgetData.notes[0];
        const daysRemaining = Math.ceil(
          (new Date(nearestAlert.reminderDate) - now) / (1000 * 60 * 60 * 24)
        );

        return {
          ...budgetData,
          nearestAlert: {
            ...nearestAlert,
            daysRemaining,
            isToday: daysRemaining === 0,
            isUrgent: daysRemaining <= 2
          },
          alertCount: budgetData.notes.length
        };
      });

      res.status(200).json({
        success: true,
        count: budgetsWithDaysRemaining.length,
        budgets: budgetsWithDaysRemaining
      });

    } catch (error) {
      console.error('Error al obtener budgets con alertas:', error);
      res.status(500).json({
        error: 'Error al obtener budgets con alertas próximas',
        details: error.message
      });
    }
  },

  /**
   * 🆕 APROBACIÓN MANUAL DE PRESUPUESTO (OWNER BYPASS CLIENT WAIT)
   * Permite al owner aprobar un presupuesto directamente sin esperar respuesta del cliente
   * RUTA: POST /api/budgets/:idBudget/manual-approve
   * PERMISOS: admin, owner
   */
  async manualApprove(req, res) {
    const transaction = await conn.transaction();
    
    try {
      const { idBudget } = req.params;
      const { convertToInvoice = true } = req.body;
      
      console.log(`✋ Owner aprobando manualmente presupuesto ${idBudget}...`);

      const budget = await Budget.findByPk(idBudget, {
        include: [{ model: Permit, attributes: ['applicantName', 'propertyAddress', 'applicantEmail'] }],
        transaction
      });

      if (!budget) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Validar que el presupuesto está en un estado que permite aprobación manual
      const validStates = ['pending_review', 'send', 'notResponded'];
      if (!validStates.includes(budget.status)) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: `No se puede aprobar manualmente este presupuesto (estado actual: ${budget.status}). Solo se pueden aprobar presupuestos en pending_review, send, o notResponded`
        });
      }

      // Obtener información del staff que aprueba (desde el token)
      const approvedByStaffId = req.user.id;
      const approvedByStaff = await Staff.findByPk(approvedByStaffId, {
        attributes: ['id', 'name', 'email']
      });

      let invoiceNumber = null;
      if (convertToInvoice) {
        // Generar invoice number si no existe
        if (budget.invoiceNumber) {
          invoiceNumber = budget.invoiceNumber;
          console.log(`♻️  Manteniendo Invoice Number existente: ${invoiceNumber}`);
        } else {
          invoiceNumber = await getNextInvoiceNumber(transaction);
          console.log(`📋 Asignando nuevo Invoice Number: ${invoiceNumber}`);
        }

        await budget.update({
          status: 'created',
          reviewedAt: new Date(),
          invoiceNumber: invoiceNumber,
          convertedToInvoiceAt: budget.convertedToInvoiceAt || new Date(),
          manuallyApprovedBy: approvedByStaffId, // 🆕 Registrar quién aprobó manualmente
          manuallyApprovedAt: new Date() // 🆕 Registrar cuándo se aprobó manualmente
        }, { transaction });

      } else {
        // Solo aprobar sin convertir a invoice
        await budget.update({
          status: 'client_approved',
          reviewedAt: new Date(),
          manuallyApprovedBy: approvedByStaffId,
          manuallyApprovedAt: new Date()
        }, { transaction });
      }

      await transaction.commit();
      console.log(`✅ Presupuesto ${idBudget} aprobado manualmente por ${approvedByStaff.name}${invoiceNumber ? ` y convertido a Invoice #${invoiceNumber}` : ''}`);

      res.status(200).json({
        success: true,
        message: `Presupuesto aprobado manualmente por ${approvedByStaff.name}${invoiceNumber ? ` y convertido a Invoice #${invoiceNumber}` : ''}`,
        budget: {
          id: budget.idBudget,
          status: budget.status,
          invoiceNumber: invoiceNumber,
          reviewedAt: budget.reviewedAt,
          manuallyApprovedBy: approvedByStaff.name,
          manuallyApprovedAt: budget.manuallyApprovedAt
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en aprobación manual:', error);
      res.status(500).json({
        error: 'Error al aprobar presupuesto manualmente',
        details: error.message
      });
    }
  },

  /**
   * 🆕 OBTENER ENLACE DE FIRMA DE DOCUSIGN
   * Genera una URL de firma embebida que el owner puede copiar y enviar por WhatsApp/SMS
   * RUTA: GET /api/budgets/:idBudget/signature-link
   * PERMISOS: isStaff
   */
  async getSignatureLink(req, res) {
    try {
      const { idBudget } = req.params;
      
      console.log(`🔗 Generando enlace de firma para presupuesto ${idBudget}...`);

      const budget = await Budget.findByPk(idBudget, {
        include: [{ 
          model: Permit, 
          attributes: ['applicantName', 'applicantEmail'] 
        }]
      });

      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // Verificar que el presupuesto tiene un envelope de DocuSign
      if (!budget.docusignEnvelopeId) {
        return res.status(400).json({ 
          error: 'Este presupuesto no tiene un documento enviado a DocuSign',
          suggestion: 'Primero envía el presupuesto para firma usando el botón "Send for Signature"'
        });
      }

      // Obtener email y nombre del cliente
      const clientEmail = budget.Permit?.applicantEmail || budget.applicantEmail;
      const clientName = budget.Permit?.applicantName || budget.applicantName;

      if (!clientEmail || !clientName) {
        return res.status(400).json({ 
          error: 'Faltan datos del cliente (email o nombre)',
          suggestion: 'Verifica que el presupuesto tenga la información completa del cliente'
        });
      }

      // Generar URL de firma embebida usando DocuSignService
      const docuSignService = new DocuSignService();
      const signingUrl = await docuSignService.getRecipientViewUrl(
        budget.docusignEnvelopeId,
        clientEmail,
        clientName,
        process.env.FRONTEND_URL || 'https://zurcher-construction.vercel.app'
      );

      console.log(`✅ Enlace de firma generado exitosamente para presupuesto ${idBudget}`);

      res.status(200).json({
        success: true,
        signingUrl: signingUrl,
        envelopeId: budget.docusignEnvelopeId,
        clientName: clientName,
        clientEmail: clientEmail,
        expiresIn: '5-15 minutes of inactivity',
        note: 'Este enlace es válido por 5-15 minutos después de inactividad. Puedes regenerarlo cuantas veces necesites.'
      });

    } catch (error) {
      console.error('❌ Error generando enlace de firma:', error);
      
      // Error específico de DocuSign (envelope no encontrado, ya firmado, etc.)
      if (error.message?.includes('ENVELOPE_VOIDED') || error.message?.includes('ENVELOPE_COMPLETED')) {
        return res.status(400).json({
          error: 'El documento ya fue firmado o cancelado',
          details: error.message
        });
      }

      res.status(500).json({
        error: 'Error al generar enlace de firma',
        details: error.message
      });
    }
  },

  // 🆕 Obtener lista de contactCompany únicos existentes (para autocomplete)
  async getContactCompanies(req, res) {
    try {
      console.log('--- Obteniendo lista de contactCompany únicos ---');

      // Obtener contactCompany únicos que no sean NULL, ordenados alfabéticamente
      const contactCompanies = await Budget.findAll({
        attributes: [
          [sequelize.fn('DISTINCT', sequelize.col('contact_company')), 'contactCompany']
        ],
        where: {
          contactCompany: {
            [Op.ne]: null, // Excluir valores NULL
            [Op.ne]: ''    // Excluir strings vacíos
          },
          status: { [Op.notIn]: ['archived', 'legacy_maintenance'] } // ✅ Excluir archivados
        },
        raw: true,
        order: [['contactCompany', 'ASC']] // Ordenar alfabéticamente
      });

      // Convertir de [{contactCompany: 'ABC'}] a ['ABC', 'XYZ', ...]
      const companiesList = contactCompanies
        .map(item => item.contactCompany)
        .filter(name => name && name.trim().length > 0); // Filtrar valores vacíos

      console.log(`✅ Se encontraron ${companiesList.length} contactCompany únicos`);

      res.status(200).json({
        success: true,
        count: companiesList.length,
        contactCompanies: companiesList
      });

    } catch (error) {
      console.error('❌ Error obteniendo contactCompanies:', error);
      res.status(500).json({
        error: 'Error al obtener lista de contactCompany',
        details: error.message
      });
    }
  },

  // 🆕 Marcar/desmarcar presupuesto para seguimiento
  async toggleRequiresFollowUp(req, res) {
    try {
      const { idBudget } = req.params;
      const { requiresFollowUp } = req.body;

      console.log(`🔄 Actualizando requiresFollowUp para Budget #${idBudget} a:`, requiresFollowUp);

      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({
          error: 'Presupuesto no encontrado'
        });
      }

      // Actualizar campo
      await budget.update({ requiresFollowUp });

      console.log(`✅ Budget #${idBudget} ${requiresFollowUp ? 'marcado' : 'desmarcado'} para seguimiento`);

      res.status(200).json({
        success: true,
        message: requiresFollowUp 
          ? 'Presupuesto marcado para seguimiento' 
          : 'Presupuesto removido de seguimiento',
        data: {
          idBudget: budget.idBudget,
          requiresFollowUp: budget.requiresFollowUp
        }
      });

    } catch (error) {
      console.error('❌ Error actualizando requiresFollowUp:', error);
      res.status(500).json({
        error: 'Error al actualizar estado de seguimiento',
        details: error.message
      });
    }
  },

  // 🆕 Obtener presupuestos que requieren seguimiento
  async getFollowUpBudgets(req, res) {
    try {
      const { page = 1, pageSize = 20, search = '', status = '' } = req.query;

      console.log('📋 Obteniendo budgets que requieren seguimiento...');

      // Construir filtros
      const whereClause = {
        requiresFollowUp: true, // Solo budgets marcados para seguimiento
        status: { [Op.notIn]: ['legacy_maintenance', 'approved', 'archived'] } // Excluir los que ya no necesitan acción
      };

      // Filtro de búsqueda
      if (search) {
        whereClause[Op.or] = [
          { idBudget: isNaN(search) ? null : parseInt(search) },
          { applicantName: { [Op.iLike]: `%${search}%` } },
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { contactCompany: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Filtro de status (si se especifica, sobrescribe la exclusión de legacy)
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      // Obtener budgets con seguimiento
      const { count, rows: budgets } = await Budget.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Permit,
            attributes: ['idPermit', 'permitNumber', 'applicantName', 'applicantEmail', 'applicantPhone', 'propertyAddress']
          }
        ],
        order: [['date', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      // Obtener estadísticas de status (excluyendo legacy_maintenance)
      const statusStats = await Budget.findAll({
        where: { 
          requiresFollowUp: true,
          status: { [Op.notIn]: ['legacy_maintenance', 'approved', 'archived'] } // Excluir los que ya no necesitan acción
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('idBudget')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      console.log(`✅ ${count} budgets con seguimiento encontrados`);

      res.status(200).json({
        success: true,
        budgets,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(count / parseInt(pageSize)),
        stats: {
          byStatus: statusStats.reduce((acc, stat) => {
            acc[stat.status] = parseInt(stat.count);
            return acc;
          }, {})
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo budgets con seguimiento:', error);
      res.status(500).json({
        error: 'Error al obtener budgets con seguimiento',
        details: error.message
      });
    }
  },

  // 🗄️ ARCHIVAR PRESUPUESTO
  async archiveBudget(req, res) {
    try {
      const { idBudget } = req.params;

      console.log(`🗄️ Archivando budget ${idBudget}...`);

      const budget = await Budget.findByPk(idBudget);

      if (!budget) {
        return res.status(404).json({ error: 'Presupuesto no encontrado' });
      }

      // 📝 VALIDACIÓN: Verificar que tenga al menos una nota antes de archivar
      const notesCount = await BudgetNote.count({
        where: { budgetId: idBudget }
      });

      if (notesCount === 0) {
        console.log(`⚠️ Budget ${idBudget} no puede archivarse: sin notas`);
        return res.status(400).json({ 
          error: 'No se puede archivar sin documentación',
          message: 'Debes agregar al menos una nota explicando el motivo del archivo antes de archivar este presupuesto.',
          needsNote: true
        });
      }

      // Cambiar status a archived
      budget.status = 'archived';
      
      // Si está en seguimiento, remover de seguimiento
      if (budget.requiresFollowUp) {
        budget.requiresFollowUp = false;
      }

      await budget.save();

      console.log(`✅ Budget ${idBudget} archivado exitosamente (${notesCount} notas)`);

      res.json({
        success: true,
        message: 'Presupuesto archivado exitosamente',
        data: {
          idBudget: budget.idBudget,
          status: budget.status,
          requiresFollowUp: budget.requiresFollowUp
        }
      });
    } catch (error) {
      console.error('❌ Error archivando budget:', error);
      res.status(500).json({
        error: 'Error al archivar presupuesto',
        details: error.message
      });
    }
  },

  // 📋 OBTENER PRESUPUESTOS ARCHIVADOS
  async getArchivedBudgetsFromDB(req, res) {
    try {
      const { page = 1, pageSize = 20, search = '' } = req.query;

      console.log('📋 Obteniendo budgets archivados...');

      // Construir filtros
      const whereClause = {
        status: 'archived'
      };

      // Filtro de búsqueda
      if (search) {
        whereClause[Op.or] = [
          { idBudget: isNaN(search) ? null : parseInt(search) },
          { applicantName: { [Op.iLike]: `%${search}%` } },
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { contactCompany: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Obtener budgets archivados
      const { count, rows: budgets } = await Budget.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Permit,
            attributes: ['idPermit', 'permitNumber', 'applicantName', 'applicantEmail', 'propertyAddress']
          }
        ],
        order: [['updatedAt', 'DESC']], // Más recientes primero
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      console.log(`✅ ${count} budgets archivados encontrados`);

      res.json({
        success: true,
        budgets,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(count / parseInt(pageSize))
      });
    } catch (error) {
      console.error('❌ Error obteniendo budgets archivados:', error);
      res.status(500).json({
        error: 'Error al obtener budgets archivados',
        details: error.message
      });
    }
  }

}



module.exports = BudgetController;

