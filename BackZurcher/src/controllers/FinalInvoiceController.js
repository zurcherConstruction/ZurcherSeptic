const { FinalInvoice, WorkExtraItem, Work, Budget, Permit, ChangeOrder, WorkNote, conn } = require('../data'); // Asegúrate que los modelos se exportan correctamente desde data/index.js
const { Op } = require('sequelize');
const { generateAndSaveFinalInvoicePDF } = require('../utils/pdfGenerators'); // Necesitarás crear esta función
const fs = require('fs'); // <-- AÑADIR ESTA LÍNEA
const path = require('path'); //
const { sendEmail } = require('../utils/notifications/emailService'); // Asegúrate de tener esta función para enviar correos electrónicos
const { getNextInvoiceNumber } = require('../utils/invoiceNumberManager'); // 🆕 HELPER DE NUMERACIÓN UNIFICADA
const {
  DEFAULT_GOOGLE_REVIEW_LINK,
  buildTrackedGoogleReviewLink,
  verifyGoogleReviewTrackingToken,
} = require('../utils/googleReviewTracking');

const FinalInvoiceController = {

  // Crear la factura final inicial para una obra
  async createFinalInvoice(req, res) {
    const { workId } = req.params;
    const startTime = Date.now();
    const transaction = await conn.transaction(); // Start transaction

    try {
      const work = await Work.findByPk(workId, {
        include: [
          { model: Budget, as: 'budget' },
          { 
            model: ChangeOrder, 
            as: 'changeOrders', 
            where: { status: 'approved' }, 
            required: false // Makes it an outer join, so work is returned even if no approved COs
          }
        ],
        transaction
      });

      if (!work) {
        await transaction.rollback();
        return res.status(404).json({ error: true, message: 'Obra no encontrada.' });
      }
      if (!work.budget) {
        await transaction.rollback();
        return res.status(400).json({ error: true, message: 'La obra no tiene un presupuesto asociado.' });
      }
      if (!['approved', 'signed'].includes(work.budget.status)) {
  await transaction.rollback();
  return res.status(400).json({ error: true, message: 'El presupuesto asociado a la obra debe estar aprobado o firmado.' });
}

      const existingInvoice = await FinalInvoice.findOne({ where: { workId }, transaction });
      if (existingInvoice) {
        await transaction.rollback();
        // Fetch with items to return consistent data
        const invoiceWithDetails = await FinalInvoice.findByPk(existingInvoice.id, {
            include: [{ model: WorkExtraItem, as: 'extraItems' }]
        });
        return res.status(409).json({ error: true, message: 'Ya existe una factura final para esta obra.', finalInvoice: invoiceWithDetails });
      }

      const originalBudgetTotal = parseFloat(work.budget.totalPrice);
      let actualInitialPaymentMade = 0;
      if (work.budget.paymentProofAmount !== null && !isNaN(parseFloat(work.budget.paymentProofAmount))) {
        actualInitialPaymentMade = parseFloat(work.budget.paymentProofAmount);
      } else if (work.budget.initialPayment !== null && !isNaN(parseFloat(work.budget.initialPayment))) {
        actualInitialPaymentMade = parseFloat(work.budget.initialPayment);
      }

      let subtotalFromChangeOrders = 0;
      const extraItemsFromChangeOrdersInput = [];

      if (work.changeOrders && work.changeOrders.length > 0) {
        work.changeOrders.forEach(co => {
          const coTotal = parseFloat(co.totalCost);
          if (!isNaN(coTotal) && coTotal > 0) {
            extraItemsFromChangeOrdersInput.push({
              description: `Change Order #${co.changeOrderNumber || co.id.substring(0,8)}: ${co.itemDescription || co.description}`,
              quantity: 1,
              unitPrice: coTotal,
              lineTotal: coTotal,
            });
            subtotalFromChangeOrders += coTotal;
          }
        });
      }
      
      const initialSubtotalExtras = subtotalFromChangeOrders;
      const discount = parseFloat(req.body.discount) || 0; // 🆕 DESCUENTO opcional desde el body
      const finalAmountDueInitial = originalBudgetTotal + initialSubtotalExtras - discount - actualInitialPaymentMade;

      const invoiceNumber = await getNextInvoiceNumber(transaction);

      const newFinalInvoice = await FinalInvoice.create({
        workId: work.idWork,
        budgetId: work.budget.idBudget,
        invoiceNumber: invoiceNumber, // 🆕 NÚMERO DE INVOICE UNIFICADO
        invoiceDate: new Date(),
        originalBudgetTotal: originalBudgetTotal,
        initialPaymentMade: actualInitialPaymentMade,
        subtotalExtras: initialSubtotalExtras,
        discount: discount, // 🆕 DESCUENTO
        finalAmountDue: finalAmountDueInitial,
        status: 'pending',
      }, { transaction });

      if (extraItemsFromChangeOrdersInput.length > 0) {
        const itemsToCreate = extraItemsFromChangeOrdersInput.map(item => ({
          ...item,
          finalInvoiceId: newFinalInvoice.id
        }));
        await WorkExtraItem.bulkCreate(itemsToCreate, { transaction });
      }

      await transaction.commit();

      const finalInvoiceWithDetails = await FinalInvoice.findByPk(newFinalInvoice.id, {
        include: [{ model: WorkExtraItem, as: 'extraItems' }]
      });

      // 🆕 Crear nota automática para generación de Final Invoice
      try {
        const invoiceNum = newFinalInvoice.invoiceNumber || newFinalInvoice.id.substring(0, 8);
        const totalAmount = newFinalInvoice.finalAmountDue ? `$${parseFloat(newFinalInvoice.finalAmountDue).toFixed(2)}` : 'monto pendiente';
        const changeOrdersCount = extraItemsFromChangeOrdersInput.length;
        const changeOrdersNote = changeOrdersCount > 0 ? ` (incluye ${changeOrdersCount} Change Order${changeOrdersCount > 1 ? 's' : ''})` : '';
        
        await WorkNote.create({
          workId: workId,
          staffId: null, // Sistema automático
          message: `Factura Final #${invoiceNum} generada - Total: ${totalAmount}${changeOrdersNote}`,
          noteType: 'payment',
          priority: 'high',
          relatedStatus: null,
          isResolved: false,
          mentionedStaffIds: []
        });
        console.log(`✅ WorkNote creado para generación de Final Invoice #${invoiceNum}`);
      } catch (noteError) {
        console.error('⚠️ Error al crear WorkNote para Final Invoice:', noteError);
      }

      const totalTime = Date.now() - startTime;
      res.status(201).json(finalInvoiceWithDetails);

    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error(`Error al crear la factura final para workId ${workId}:`, error);
      res.status(500).json({ error: true, message: 'Error interno del servidor al crear factura final.' });
    }
  },

  // Obtener la factura final y sus items por workId
  async getFinalInvoiceByWorkId(req, res) {
    const { workId } = req.params;
    try {
      // 🆕 DIAGNÓSTICO: Verificar que el Work existe y tiene las asociaciones correctas
      const work = await Work.findByPk(workId, {
        include: [
          { 
            model: Budget, 
            as: 'budget', 
            include: [{ model: Permit }] 
          }
        ]
      });
      
      if (work) {
        console.log(`✅ [FinalInvoice] Work encontrado:`, {
          workId: work.idWork,
          hasIdPermit: !!work.idPermit,
          hasBudget: !!work.budget,
          budgetId: work.budget?.idBudget,
          budgetPermitId: work.budget?.PermitIdPermit,
          hasPermit: !!work.budget?.Permit
        });
      }
      
      const finalInvoice = await FinalInvoice.findOne({
        where: { workId },
        include: [
          { model: WorkExtraItem, as: 'extraItems' }, // Incluir los items extras
          { model: Work, include: [{ model: Budget, as: 'budget', include: [{ model: Permit }] }] }, // Incluir Work, Budget y Permit para contexto
          // { model: Budget } // Si no incluyes Work, puedes incluir Budget directamente
        ]
      });

      if (!finalInvoice) {
        return res.status(404).json({ error: true, message: 'Factura final no encontrada para esta obra.' });
      }

      res.status(200).json(finalInvoice);

    } catch (error) {
      console.error(`Error al obtener la factura final para workId ${workId}:`, error);
      res.status(500).json({ error: true, message: 'Error interno del servidor.' });
    }
  },

  // Añadir un item extra a una factura final
  async addExtraItem(req, res) {
    const { finalInvoiceId } = req.params;
    const { description, quantity, unitPrice } = req.body;
   
    const transaction = await conn.transaction();
    if (!description || quantity === undefined || unitPrice === undefined) {
      return res.status(400).json({ error: true, message: 'Faltan datos: description, quantity, unitPrice son requeridos.' });
    }

    try {
      const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId);
      if (!finalInvoice) {
        await transaction.rollback();
        return res.status(404).json({ error: true, message: 'Factura final no encontrada.' });
      }

      // Calcular total de la línea
      const qty = parseFloat(quantity);
      const price = parseFloat(unitPrice);
      const lineTotal = qty * price;

      // Crear el item extra dentro de la transacción
      const newExtraItem = await WorkExtraItem.create({
        finalInvoiceId: finalInvoice.id,
        description,
        quantity: qty,
        unitPrice: price,
        lineTotal: lineTotal,
      }, { transaction }); // <-- Añadir transacción

      // Recalcular totales de la factura
      const updatedSubtotalExtras = parseFloat(finalInvoice.subtotalExtras) + lineTotal;
      const discount = parseFloat(finalInvoice.discount) || 0;
      const updatedFinalAmountDue = parseFloat(finalInvoice.originalBudgetTotal) + updatedSubtotalExtras - discount - parseFloat(finalInvoice.initialPaymentMade);

      // Actualizar la factura
      await finalInvoice.update({
        subtotalExtras: updatedSubtotalExtras,
        finalAmountDue: updatedFinalAmountDue,
      }, { transaction }); // <-- Añadir transacción

      // Confirmar transacción
      await transaction.commit();

      // --- INICIO: Volver a buscar la factura actualizada CON los items ---
      const updatedInvoiceData = await FinalInvoice.findByPk(finalInvoice.id, {
          // No necesitamos transacción aquí, ya se confirmó
          include: [
              {
                  model: WorkExtraItem,
                  as: 'extraItems' // Asegúrate que el alias 'extraItems' sea correcto
              },
              // Puedes incluir otras asociaciones si las necesitas actualizadas en el frontend
              // { model: Work, include: [...] }
          ]
      });
      // --- FIN: Volver a buscar la factura actualizada
      res.status(201).json({ finalInvoice: updatedInvoiceData });

    } catch (error) {
      // Asegurarse de hacer rollback si la transacción existe y no se ha confirmado/revertido
      if (transaction && !transaction.finished) {
          await transaction.rollback();
      }
      console.error(`Error al añadir item extra a finalInvoiceId ${finalInvoiceId}:`, error);
      res.status(500).json({ error: true, message: 'Error interno del servidor al añadir item.' });
    }
  },
   // --- ACTUALIZADO: updateExtraItem ---
   async updateExtraItem(req, res) {
    const { itemId } = req.params;
    const { description, quantity, unitPrice } = req.body;
    const transaction = await conn.transaction(); // Usar transacción

    if (description === undefined && quantity === undefined && unitPrice === undefined) {
      return res.status(400).json({ error: true, message: 'Se requiere al menos un campo (description, quantity, unitPrice) para actualizar.' });
    }

    try {
       const itemToUpdate = await WorkExtraItem.findByPk(itemId, { transaction });
       if (!itemToUpdate) {
         await transaction.rollback();
         return res.status(404).json({ error: true, message: 'Item extra no encontrado.' });
       }

       const finalInvoice = await FinalInvoice.findByPk(itemToUpdate.finalInvoiceId, { transaction });
       if (!finalInvoice) {
          // Esto sería raro si el item existe, pero por seguridad
          await transaction.rollback();
          return res.status(404).json({ error: true, message: 'Factura final asociada no encontrada.' });
       }

       // Guardar el total original de la línea
       const originalLineTotal = parseFloat(itemToUpdate.lineTotal);

       // Actualizar campos del item
       if (description !== undefined) itemToUpdate.description = description;
       const newQuantity = quantity !== undefined ? parseFloat(quantity) : parseFloat(itemToUpdate.quantity);
       const newUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : parseFloat(itemToUpdate.unitPrice);

       if (isNaN(newQuantity) || newQuantity <= 0 || isNaN(newUnitPrice) || newUnitPrice < 0) {
           await transaction.rollback();
           return res.status(400).json({ error: true, message: 'Quantity debe ser positivo y unitPrice no negativo.' });
       }

       itemToUpdate.quantity = newQuantity;
       itemToUpdate.unitPrice = newUnitPrice;
       const newLineTotal = newQuantity * newUnitPrice;
       itemToUpdate.lineTotal = newLineTotal;

       // Guardar cambios del item
       await itemToUpdate.save({ transaction });

       // Recalcular totales de la factura usando la diferencia
       const difference = newLineTotal - originalLineTotal;
       const updatedSubtotalExtras = parseFloat(finalInvoice.subtotalExtras) + difference;
       const discount = parseFloat(finalInvoice.discount) || 0;
       const updatedFinalAmountDue = parseFloat(finalInvoice.originalBudgetTotal) + updatedSubtotalExtras - discount - parseFloat(finalInvoice.initialPaymentMade);

       // Actualizar la factura
       await finalInvoice.update({
         subtotalExtras: updatedSubtotalExtras,
         finalAmountDue: updatedFinalAmountDue,
       }, { transaction });

       await transaction.commit();

       // Devolver la factura actualizada completa
       const updatedInvoiceData = await FinalInvoice.findByPk(finalInvoice.id, {
           include: [{ model: WorkExtraItem, as: 'extraItems' }]
       });

       res.status(200).json({ finalInvoice: updatedInvoiceData }); // Devolver la factura actualizada

    } catch (error) {
       await transaction.rollback();
       console.error(`Error al actualizar item extra ${itemId}:`, error);
       res.status(500).json({ error: true, message: 'Error interno del servidor al actualizar item.' });
    }
 },

 // --- ACTUALIZADO: removeExtraItem ---
 async removeExtraItem(req, res) {
    const { itemId } = req.params;
    const transaction = await conn.transaction(); // Usar transacción

    try {
       const itemToRemove = await WorkExtraItem.findByPk(itemId, { transaction });
       if (!itemToRemove) {
         await transaction.rollback();
         return res.status(404).json({ error: true, message: 'Item extra no encontrado.' });
       }

       const finalInvoice = await FinalInvoice.findByPk(itemToRemove.finalInvoiceId, { transaction });
       if (!finalInvoice) {
          await transaction.rollback();
          return res.status(404).json({ error: true, message: 'Factura final asociada no encontrada.' });
       }

       // Guardar el total de la línea que se va a eliminar
       const removedLineTotal = parseFloat(itemToRemove.lineTotal);

       // Eliminar el item
       await itemToRemove.destroy({ transaction });

       // Recalcular totales de la factura restando el valor eliminado
       const updatedSubtotalExtras = parseFloat(finalInvoice.subtotalExtras) - removedLineTotal;
       const discount = parseFloat(finalInvoice.discount) || 0;
       const updatedFinalAmountDue = parseFloat(finalInvoice.originalBudgetTotal) + updatedSubtotalExtras - discount - parseFloat(finalInvoice.initialPaymentMade);

       // Actualizar la factura
       await finalInvoice.update({
         subtotalExtras: updatedSubtotalExtras,
         finalAmountDue: updatedFinalAmountDue,
       }, { transaction });

       await transaction.commit();

       // Devolver la factura actualizada completa
       const updatedInvoiceData = await FinalInvoice.findByPk(finalInvoice.id, {
           include: [{ model: WorkExtraItem, as: 'extraItems' }]
       });

       res.status(200).json({ finalInvoice: updatedInvoiceData }); // Devolver la factura actualizada

    } catch (error) {
       await transaction.rollback();
       console.error(`Error al eliminar item extra ${itemId}:`, error);
       res.status(500).json({ error: true, message: 'Error interno del servidor al eliminar item.' });
    }
 },

 // 🆕 ACTUALIZAR DESCUENTO DE LA FACTURA FINAL
 async updateDiscount(req, res) {
    const { finalInvoiceId } = req.params;
    const { discount, discountReason } = req.body;
    const transaction = await conn.transaction();

    try {
       if (discount === undefined || discount === null) {
         await transaction.rollback();
         return res.status(400).json({ error: true, message: 'El campo discount es requerido.' });
       }

       const discountValue = parseFloat(discount);
       if (isNaN(discountValue) || discountValue < 0) {
         await transaction.rollback();
         return res.status(400).json({ error: true, message: 'El descuento debe ser un número positivo o cero.' });
       }

       const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId, { transaction });
       if (!finalInvoice) {
         await transaction.rollback();
         return res.status(404).json({ error: true, message: 'Factura final no encontrada.' });
       }

       // Recalcular finalAmountDue con el nuevo descuento
       const subtotalExtras = parseFloat(finalInvoice.subtotalExtras) || 0;
       const originalBudgetTotal = parseFloat(finalInvoice.originalBudgetTotal) || 0;
       const initialPaymentMade = parseFloat(finalInvoice.initialPaymentMade) || 0;
       const updatedFinalAmountDue = originalBudgetTotal + subtotalExtras - discountValue - initialPaymentMade;

       // Actualizar discount, discountReason y finalAmountDue
       await finalInvoice.update({
         discount: discountValue,
         discountReason: discountReason || null, // 🆕 Guardar razón del descuento
         finalAmountDue: updatedFinalAmountDue,
       }, { transaction });

       await transaction.commit();

       // Devolver la factura actualizada completa
       const updatedInvoiceData = await FinalInvoice.findByPk(finalInvoice.id, {
           include: [{ model: WorkExtraItem, as: 'extraItems' }]
       });

       res.status(200).json(updatedInvoiceData);

    } catch (error) {
       if (transaction && !transaction.finished) {
         await transaction.rollback();
       }
       console.error(`Error al actualizar descuento de finalInvoiceId ${finalInvoiceId}:`, error);
       res.status(500).json({ error: true, message: 'Error interno del servidor al actualizar descuento.' });
    }
 },


 // --- ACTUALIZADO: updateFinalInvoiceStatus ---
 async updateFinalInvoiceStatus(req, res) {
    const { finalInvoiceId } = req.params;
    const { status, paymentDate, paymentNotes } = req.body;
    const validStatuses = ['pending', 'paid', 'partially_paid', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
       return res.status(400).json({ error: true, message: `Estado inválido. Estados permitidos: ${validStatuses.join(', ')}` });
    }

    try {
       const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId);
       if (!finalInvoice) {
         return res.status(404).json({ error: true, message: 'Factura final no encontrada.' });
       }

       const updateData = { status };
       if (status === 'paid' || status === 'partially_paid') {
           // Si se marca como pagado/parcialmente pagado, usar la fecha proporcionada o la actual
           updateData.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
       } else {
           // Para otros estados, limpiar la fecha de pago
           updateData.paymentDate = null;
       }
       if (paymentNotes !== undefined) {
           updateData.paymentNotes = paymentNotes;
       }

       await finalInvoice.update(updateData);

       // Devolver la factura actualizada completa
       const updatedInvoiceData = await FinalInvoice.findByPk(finalInvoice.id, {
           include: [{ model: WorkExtraItem, as: 'extraItems' }]
       });

       res.status(200).json(updatedInvoiceData); // Devolver la factura actualizada

    } catch (error) {
       console.error(`Error al actualizar estado de finalInvoiceId ${finalInvoiceId}:`, error);
       res.status(500).json({ error: true, message: 'Error interno del servidor al actualizar estado.' });
    }
 },

   // --- ACTUALIZADO: generateFinalInvoicePDF ---
   async generateFinalInvoicePDF(req, res) {
    const { finalInvoiceId } = req.params;
    try {
       // 1. Buscar la factura con todas las relaciones necesarias para el PDF
       const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId, {
         include: [
           { model: WorkExtraItem, as: 'extraItems' },
           {
             model: Work,
             include: [
               {
                 model: Budget,
                 as: 'budget',
                 include: [ { model: Permit } ] // Incluir Permit desde Budget
               },
               { // <--- AÑADIR ESTO PARA INCLUIR CHANGE ORDERS
                 model: ChangeOrder,
                 as: 'changeOrders' // Usar el alias definido en la asociación Work.hasMany(ChangeOrder)
               }
               // Si Work puede tener Permit directamente, incluirlo también como fallback
               // { model: Permit }
             ]
           },
           // Incluir Budget directamente si la relación existe y es necesaria
           // { model: Budget, include: [ { model: Permit } ] }
         ]
       });

       if (!finalInvoice) {
         return res.status(404).json({ error: true, message: 'Factura final no encontrada.' });
       }

       // 2. Generar el PDF
       const generatedPdfPath = await generateAndSaveFinalInvoicePDF(finalInvoice.toJSON()); // Pasar datos planos

       // 3. Actualizar la ruta en la BD (si cambió o no existía)
       if (finalInvoice.pdfPath !== generatedPdfPath) {
           await finalInvoice.update({ pdfPath: generatedPdfPath });
       }

       // 4. Responder (opcional: devolver la factura actualizada o solo la URL)
       const responseData = finalInvoice.toJSON();
       responseData.pdfUrl = `${req.protocol}://${req.get('host')}/final-invoice/${finalInvoiceId}/pdf/view`; // URL para ver

       res.status(200).json({
           message: 'PDF de factura final generado/actualizado exitosamente.',
           pdfPath: generatedPdfPath,
           pdfUrl: responseData.pdfUrl,
           finalInvoice: responseData // Devolver datos actualizados
       });

    } catch (error) {
       console.error(`Error al generar PDF para finalInvoiceId ${finalInvoiceId}:`, error);
       res.status(500).json({ error: true, message: 'Error interno del servidor al generar PDF.' });
    }
 },

 async previewFinalInvoicePDF(req, res){
    const { finalInvoiceId } = req.params;
    let tempPdfPath = null; // Para rastrear la ruta del archivo temporal

    try {
      const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId, {
        include: [
          { model: WorkExtraItem, as: 'extraItems' },
          {
            model: Work,
            as: 'Work',
            include: [
              { model: Budget, as: 'budget', include: [{ model: Permit }] },
              { model: ChangeOrder, as: 'changeOrders' }
            ]
          }
        ]
      });

      if (!finalInvoice) {
        return res.status(404).json({ error: true, message: 'Factura final no encontrada.' });
      }

      // 🔧 Generar PDF temporal con nombre único para preview (no sobreescribir el principal)
      const tempInvoiceData = {
        ...finalInvoice.toJSON(),
        _isPreview: true,
        _tempSuffix: `_preview_${Date.now()}`
      };
      tempPdfPath = await generateAndSaveFinalInvoicePDF(tempInvoiceData);

      // Enviamos el archivo al navegador
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="preview_invoice_${finalInvoiceId}.pdf"`);
      
      const fileStream = fs.createReadStream(tempPdfPath);
      fileStream.pipe(res);

      // Cuando el envío termine, borramos el archivo temporal.
      fileStream.on('close', () => {
        fs.unlink(tempPdfPath, (err) => {
          if (err) {
            console.error(`Error al borrar el PDF temporal de previsualización ${tempPdfPath}:`, err);
          } else {
            console.log(`PDF temporal de previsualización ${tempPdfPath} borrado.`);
          }
        });
      });

      fileStream.on('error', (err) => {
        console.error('Error en el stream del PDF de previsualización:', err);
        // Si hay un error en el stream, intentamos borrar el archivo igualmente
        if (fs.existsSync(tempPdfPath)) {
          fs.unlinkSync(tempPdfPath);
        }
      });

    } catch (error) {
      console.error('Error al generar la vista previa del PDF de la Factura Final:', error);
      // Si ocurre un error general, también intentamos borrar el archivo si se creó
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: 'Error interno al generar la vista previa del PDF.' });
      }
    }
  },


 // --- NUEVO: viewFinalInvoicePDF ---
async viewFinalInvoicePDF(req, res) {
    try {
      const { finalInvoiceId } = req.params;
      const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId, { attributes: ['pdfPath'] });

      if (!finalInvoice || !finalInvoice.pdfPath) {
        return res.status(404).send('PDF no encontrado para esta factura final.');
      }
      // Ahora 'fs' estará definido aquí
      if (!fs.existsSync(finalInvoice.pdfPath)) {
        console.error(`Error: Archivo PDF no encontrado en la ruta física: ${finalInvoice.pdfPath}`);
        return res.status(404).send('Archivo PDF no encontrado en el servidor.');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.sendFile(finalInvoice.pdfPath); // 'path' no es necesario aquí, pero sí en download
    } catch (error) {
      console.error(`Error en viewFinalInvoicePDF para ID ${req.params.finalInvoiceId}:`, error);
      res.status(500).send('Error interno al procesar la solicitud del PDF.');
    }
  },

  async downloadFinalInvoicePDF(req, res) {
    try {
      const { finalInvoiceId } = req.params;
      const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId, { 
        attributes: ['pdfPath', 'invoiceNumber', 'id'] 
      });

      if (!finalInvoice || !finalInvoice.pdfPath) {
        return res.status(404).json({ error: true, message: 'PDF no encontrado para esta factura final.' });
      }
      
      if (!fs.existsSync(finalInvoice.pdfPath)) {
        console.error(`Error: Archivo PDF no encontrado en la ruta física: ${finalInvoice.pdfPath}`);
        return res.status(404).json({ error: true, message: 'Archivo PDF no encontrado en el servidor.' });
      }

      // Usar el mismo método que funciona en preview, pero con 'attachment' para forzar descarga
      const filename = `Final_Invoice_${finalInvoice.invoiceNumber || finalInvoice.id}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(finalInvoice.pdfPath);
      fileStream.pipe(res);
      
      fileStream.on('error', (err) => {
        console.error('Error en el stream del PDF de descarga:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: true, message: 'Error al leer el archivo PDF.' });
        }
      });
      
    } catch (error) {
      console.error(`Error en downloadFinalInvoicePDF para ID ${req.params.finalInvoiceId}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: 'Error interno al procesar la solicitud del PDF.' });
      }
    }
  },

 // --- NUEVO: emailFinalInvoicePDF ---
async emailFinalInvoicePDF(req, res) {
   const { finalInvoiceId } = req.params;
   const { recipientEmail, recipientEmails, includeGoogleReview } = req.body;

   try {
       // 1. Buscar la factura con TODOS los datos necesarios para el PDF, igual que en la vista previa.
       const finalInvoice = await FinalInvoice.findByPk(finalInvoiceId, {
           include: [
             { model: WorkExtraItem, as: 'extraItems' },
             {
               model: Work,
               as: 'Work',
               include: [
                 { model: Budget, as: 'budget', include: [{ model: Permit }] },
                 { model: ChangeOrder, as: 'changeOrders' }
               ]
             }
           ]
       });

       if (!finalInvoice) {
           return res.status(404).json({ error: true, message: 'Factura final no encontrada.' });
       }

       // 2. Siempre generar un PDF nuevo para asegurar que esté actualizado.
       console.log(`Generando PDF actualizado para finalInvoiceId ${finalInvoiceId} antes de enviar email...`);
       const pdfPathToUse = await generateAndSaveFinalInvoicePDF(finalInvoice.toJSON());
       
       // 3. Actualizar la ruta del PDF en la base de datos.
       await finalInvoice.update({ pdfPath: pdfPathToUse });
       console.log(`PDF regenerado y guardado en: ${pdfPathToUse}`);

       // 4. Preparar destinatarios
       const budget = finalInvoice.Work?.budget;
       const permit = budget?.Permit;
       const defaultEmail = permit?.applicantEmail || budget?.applicantEmail;
       
       // 🆕 Construir lista de emails destinatarios
       let emailsToSend = [];
       
       // Si se envió un array de emails seleccionados, usar esos
       if (recipientEmails && Array.isArray(recipientEmails) && recipientEmails.length > 0) {
         emailsToSend = recipientEmails.filter(email => email && email.includes('@'));
       } 
       // Si se envió un email individual (compatibilidad con versión anterior)
       else if (recipientEmail && recipientEmail.includes('@')) {
         emailsToSend = [recipientEmail];
       }
       // Si no se especificó ninguno, usar el email principal del cliente
       else if (defaultEmail && defaultEmail.includes('@')) {
         emailsToSend = [defaultEmail];
       }
       
       if (emailsToSend.length === 0) {
           return res.status(400).json({ 
             error: true, 
             message: 'No se pudo determinar ningún correo electrónico válido para enviar la factura.' 
           });
       }
       
       const clientName = budget?.applicantName || permit?.applicantName || 'Customer';
       const propertyAddress = finalInvoice.Work?.propertyAddress || budget?.propertyAddress || 'N/A';
      
       // 🆕 USAR invoiceNumber REAL EN LUGAR DEL ID
       const invoiceNumber = finalInvoice.invoiceNumber || finalInvoice.id.toString().substring(0, 8);

       // ✅ INICIO: Recalcular el total para que coincida con el PDF
       const { originalBudgetTotal, initialPaymentMade, discount, discountReason, extraItems } = finalInvoice;
       const remainingBudgetAmount = parseFloat(originalBudgetTotal || 0) - parseFloat(initialPaymentMade || 0);
       const totalExtras = extraItems.reduce((acc, item) => acc + parseFloat(item.lineTotal || 0), 0);
       const discountAmount = parseFloat(discount || 0);
       const correctTotalAmount = remainingBudgetAmount + totalExtras - discountAmount;
       
       // Opcional pero recomendado: Actualizar el valor en la BD para consistencia
       await finalInvoice.update({ finalAmountDue: correctTotalAmount });
       // ✅ FIN: Recálculo

       // 🆕 Construir mensaje del descuento para el email
       let discountText = '';
       if (discountAmount > 0) {
         discountText = `\nDiscount Applied: -$${discountAmount.toFixed(2)}`;
         if (discountReason && discountReason.trim()) {
           discountText += `\n  (${discountReason.trim()})`;
         }
       }

       // 🆕 GOOGLE REVIEW: Construir sección de review si está habilitada
       const googleReviewLink = DEFAULT_GOOGLE_REVIEW_LINK;
       const trackedGoogleReviewLink = buildTrackedGoogleReviewLink({
         workId: finalInvoice.workId,
         email: emailsToSend[0] || null,
         req,
       });
       let reviewSection = '';
       let reviewSectionHtml = '';
       
       if (includeGoogleReview) {
         // Versión texto plano (fallback)
         reviewSection = `\n\n${'─'.repeat(50)}\n\n⭐ WE VALUE YOUR FEEDBACK ⭐\n\nIf we made your project simple and stress-free, we'd love to hear from you.\n\nYour review helps other homeowners choose a reliable septic company—and helps us keep improving every day.\n\n👉 Share your experience in 30 seconds\n\nLeave Your Review: ${trackedGoogleReviewLink}\n\nThank you for trusting Zurcher Septic!`;
         
         // Versión HTML profesional con colores de la empresa (compatible con modo oscuro)
         reviewSectionHtml = `
         <!-- DIVIDER -->
         <tr>
           <td style="padding:0 40px;">
             <hr style="border:none;border-top:2px solid #e2e8f0;margin:28px 0;" />
           </td>
         </tr>

         <!-- GOOGLE REVIEW SECTION -->
         <tr>
           <td style="padding:0 40px 36px;">
             <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a3a5c" style="background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%) !important;background-color:#1a3a5c !important;border-radius:12px;overflow:hidden;border:3px solid #f6d02c;">
               <tr>
                 <td bgcolor="#1a3a5c" style="padding:32px 28px;text-align:center;background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%) !important;">
                   <!-- 5 Estrellas como Google -->
                   <div style="font-size:40px;line-height:1;margin-bottom:12px;letter-spacing:4px;color:#fde047 !important;-webkit-text-fill-color:#fde047 !important;">⭐⭐⭐⭐⭐</div>
                   
                   <h2 style="color:#f6d02c !important;-webkit-text-fill-color:#f6d02c !important;margin:0 0 18px;font-size:26px;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,0.5);">
                     WE VALUE YOUR FEEDBACK
                   </h2>
                   
                   <p style="font-size:16px;color:#f5f5f5 !important;-webkit-text-fill-color:#f5f5f5 !important;line-height:1.7;margin:0 0 16px;max-width:520px;margin-left:auto;margin-right:auto;text-shadow:0 1px 4px rgba(0,0,0,0.3);">
                     If we made your project <strong style="color:#fde047 !important;-webkit-text-fill-color:#fde047 !important;font-weight:800;">simple and stress-free</strong>, we'd love to hear from you.
                   </p>
                   
                   <p style="font-size:15px;color:#f5f5f5 !important;-webkit-text-fill-color:#f5f5f5 !important;line-height:1.6;margin:0 0 24px;max-width:500px;margin-left:auto;margin-right:auto;text-shadow:0 1px 4px rgba(0,0,0,0.3);">
                     Your review helps other homeowners choose a reliable septic company—and helps us keep improving every day.
                   </p>
                   
                   <p style="font-size:14px;color:#fde047 !important;-webkit-text-fill-color:#fde047 !important;font-weight:700;margin:0 0 20px;letter-spacing:0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.4);">
                     👉 Share your experience in 30 seconds
                   </p>
                   
                   <!-- Botón con colores de la empresa -->
                   <a href="${trackedGoogleReviewLink}" target="_blank"
                      style="display:inline-block;background:#f6d02c !important;background-color:#f6d02c !important;color:#000000 !important;-webkit-text-fill-color:#000000 !important;text-decoration:none;padding:16px 44px;border-radius:30px;font-size:17px;font-weight:700;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(0,0,0,0.25), 0 4px 12px rgba(246,208,44,0.40);">
                     <span style="color:#000000 !important;-webkit-text-fill-color:#000000 !important;text-shadow:0 0 12px rgba(26,58,92,1), 0 3px 6px rgba(26,58,92,1), 0 0 20px rgba(26,58,92,0.8);">⭐</span> Leave Your Review
                   </a>
                   
                   <p style="margin:20px 0 0;font-size:15px;color:#f5f5f5 !important;-webkit-text-fill-color:#f5f5f5 !important;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,0.3);">
                     Thank you for trusting Zurcher Septic!
                   </p>
                 </td>
               </tr>
             </table>
           </td>
         </tr>`;
       }

       // 🆕 Construir email HTML profesional
       const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a5c 0%,#2563a8 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:1px;">
                Zurcher Septic
              </h1>
              <p style="color:#a8c8f0;margin:6px 0 0;font-size:14px;letter-spacing:2px;text-transform:uppercase;">
                Final Invoice #${invoiceNumber}
              </p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="font-size:18px;color:#1a3a5c;font-weight:600;margin:0 0 14px;">Dear ${clientName},</p>
              <p style="font-size:15px;color:#4a5568;line-height:1.7;margin:0 0 12px;">
                Please find attached the final invoice <strong>#${invoiceNumber}</strong> for the work completed at <strong>${propertyAddress}</strong>.
              </p>
            </td>
          </tr>

          <!-- INVOICE DETAILS -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#4a5568;">
                          <strong style="color:#1a3a5c;">Subtotal:</strong>
                        </td>
                        <td align="right" style="padding:6px 0;font-size:14px;color:#2d3748;font-weight:600;">
                          $${(remainingBudgetAmount + totalExtras).toFixed(2)}
                        </td>
                      </tr>
                      ${discountAmount > 0 ? `
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#4a5568;">
                          <strong style="color:#059669;">Discount Applied:</strong>
                          ${discountReason && discountReason.trim() ? `<br/><span style="font-size:12px;color:#6b7280;">${discountReason.trim()}</span>` : ''}
                        </td>
                        <td align="right" style="padding:6px 0;font-size:14px;color:#059669;font-weight:600;">
                          -$${discountAmount.toFixed(2)}
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td colspan="2" style="padding:12px 0 8px;">
                          <hr style="border:none;border-top:2px solid #cbd5e0;margin:0;" />
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:18px;color:#1a3a5c;">
                          <strong>Total Amount Due:</strong>
                        </td>
                        <td align="right" style="padding:8px 0;font-size:22px;color:#2563a8;font-weight:700;">
                          $${correctTotalAmount.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#6b7280;">
                          Status:
                        </td>
                        <td align="right" style="padding:6px 0;font-size:13px;color:#6b7280;text-transform:uppercase;">
                          ${finalInvoice.status?.replace('_', ' ') || 'PENDING'}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${reviewSectionHtml}

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="font-size:14px;color:#4a5568;margin:0 0 8px;font-weight:600;">
                Best regards,<br/>Zurcher Septic Team
              </p>
              <p style="font-size:13px;color:#a0aec0;margin:0 0 8px;">
                Professional Septic Solutions | Licensed & Insured
              </p>
              <p style="font-size:13px;color:#a0aec0;margin:0;">
                📞 <a href="tel:+19546368200" style="color:#2563a8;text-decoration:none;">+1(954) 636-8200</a> | 
                🌐 <a href="https://www.zurcherseptic.com" style="color:#2563a8;text-decoration:none;">www.zurcherseptic.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

       // 🆕 Enviar a todos los emails seleccionados
       const mailOptions = {
           to: emailsToSend.join(', '), // Múltiples destinatarios separados por coma
           subject: `Final Invoice #${invoiceNumber} for ${propertyAddress}`,
           // Texto plano como fallback
           text: `Dear ${clientName},\n\nPlease find attached the final invoice #${invoiceNumber} for the work completed at ${propertyAddress}.\n\nSubtotal: $${(remainingBudgetAmount + totalExtras).toFixed(2)}${discountText}\n\nTotal Amount Due: $${correctTotalAmount.toFixed(2)}\nStatus: ${finalInvoice.status?.replace('_', ' ').toUpperCase() || 'N/A'}\n\nBest regards,\nZurcher Septic${reviewSection}`,
           // HTML profesional
           html: htmlContent,
           attachments: [
               {
                   filename: `final_invoice_${invoiceNumber}.pdf`,
                   path: pdfPathToUse, // Usar la ruta del PDF recién generado
                   contentType: 'application/pdf'
               }
           ]
       }
       await sendEmail(mailOptions);
       
       console.log(`✅ Final Invoice #${invoiceNumber} enviada exitosamente a: ${emailsToSend.join(', ')}`);
       if (includeGoogleReview) {
         console.log(`⭐ Solicitud de Google Review incluida en el email`);
       }
       
       // 🆕 Crear nota automática para envío de Final Invoice
       try {
         const invoiceNum = finalInvoice.invoiceNumber || finalInvoice.id.substring(0, 8);
         const totalAmount = correctTotalAmount ? `$${correctTotalAmount.toFixed(2)}` : 'monto pendiente';
         const reviewNote = includeGoogleReview ? ' + Review Request' : '';
         const emailList = emailsToSend.length > 1 
           ? `${emailsToSend.length} destinatarios` 
           : emailsToSend[0];
         
         await WorkNote.create({
           workId: finalInvoice.workId,
           staffId: null, // Sistema automático
           message: `Factura Final #${invoiceNum} ENVIADA${reviewNote} - Total: ${totalAmount} - Enviado a: ${emailList}`,
           noteType: 'payment',
           priority: 'high',
           relatedStatus: 'invoiceFinal',
           isResolved: false,
           mentionedStaffIds: []
         });
         console.log(`✅ WorkNote creado para envío de Final Invoice #${invoiceNum}`);
       } catch (noteError) {
         console.error('⚠️ Error al crear WorkNote para envío de Final Invoice:', noteError);
       }
       
       // ✅ AUTOMATIZAR: Cambiar estado del work de 'covered' a 'invoiceFinal'
       const work = finalInvoice.Work;
       if (work && work.status === 'covered') {
         await work.update({ status: 'invoiceFinal' });
         
         // Enviar notificaciones para el nuevo estado automático
         const { sendNotifications } = require('../utils/notifications/notificationManager');
         await sendNotifications('invoiceFinal', work);
       }
       
       const recipientMessage = emailsToSend.length > 1 
         ? `${emailsToSend.length} destinatarios` 
         : emailsToSend[0];
       res.status(200).json({ message: `Factura final enviada exitosamente a ${recipientMessage}.` });

   } catch (error) {
       console.error(`Error al enviar por correo la factura final ${finalInvoiceId}:`, error);
       res.status(500).json({ error: true, message: 'Error interno al enviar el correo electrónico.' });
   }
 },

  async trackAndRedirectGoogleReview(req, res) {
    try {
      const { token } = req.params;
      const parsed = verifyGoogleReviewTrackingToken(token);

      if (!parsed.valid) {
        console.warn(`[GoogleReviewTracking] Invalid token: ${parsed.reason}`);
        return res.redirect(302, DEFAULT_GOOGLE_REVIEW_LINK);
      }

      const workId = parsed.payload.w;
      const email = parsed.payload.e;

      const existingClickNote = await WorkNote.findOne({
        where: {
          workId,
          noteType: 'client_contact',
          relatedStatus: 'invoiceFinal',
          message: { [Op.iLike]: '[AUTO] Google Review link clicked%' },
        },
      });

      if (!existingClickNote) {
        await WorkNote.create({
          workId,
          staffId: null,
          noteType: 'client_contact',
          priority: 'medium',
          relatedStatus: 'invoiceFinal',
          isResolved: false,
          mentionedStaffIds: [],
          message: `[AUTO] Google Review link clicked${email ? ` by ${email}` : ''} (${new Date().toISOString()})`,
        });
      }

      return res.redirect(302, DEFAULT_GOOGLE_REVIEW_LINK);
    } catch (error) {
      console.error('[FinalInvoiceController.trackAndRedirectGoogleReview]', error);
      return res.redirect(302, DEFAULT_GOOGLE_REVIEW_LINK);
    }
  },

  async confirmGoogleReview(req, res) {
    try {
      const { workId } = req.params;
      const staffId = req.staff?.id || null;
      const staffName = req.staff?.name || 'Staff';

      const work = await Work.findByPk(workId);
      if (!work) {
        return res.status(404).json({ success: false, message: 'Work no encontrado' });
      }

      await WorkNote.create({
        workId,
        staffId,
        noteType: 'client_contact',
        priority: 'low',
        relatedStatus: 'invoiceFinal',
        isResolved: true,
        mentionedStaffIds: [],
        message: `[MANUAL] Google Review confirmed by ${staffName} (${new Date().toISOString()})`,
      });

      return res.status(200).json({ success: true, message: 'Google Review marcado como confirmado' });
    } catch (error) {
      console.error('[FinalInvoiceController.confirmGoogleReview]', error);
      return res.status(500).json({ success: false, message: 'Error confirmando Google Review', error: error.message });
    }
  },
};



module.exports = FinalInvoiceController;