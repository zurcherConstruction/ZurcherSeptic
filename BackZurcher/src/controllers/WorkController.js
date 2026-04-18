const { Work, Permit, Budget, Material, Inspection, Image, Staff, InstallationDetail, MaterialSet, Receipt, Expense, Income, ChangeOrder, FinalInvoice, MaintenanceVisit, MaintenanceMedia, WorkChecklist, WorkNote } = require('../data');

const convertPdfDataToUrl = require('../utils/convertPdfDataToUrl');
const { sendNotifications } = require('../utils/notifications/notificationManager');
const {  deleteFromCloudinary, uploadBufferToCloudinary } = require('../utils/cloudinaryUploader'); // Asegúrate de importar la función de subida a Cloudinary
const { cloudinary } = require('../utils/cloudinaryConfig');
const multer = require('multer');
const path = require('path');
const {generateAndSaveChangeOrderPDF} = require('../utils/pdfGenerator')
const fs = require('fs'); 
const { v4: uuidv4 } = require('uuid');
const { Op, literal} = require('sequelize');
const {scheduleInitialMaintenanceVisits} = require('./MaintenanceController'); // Asegúrate de importar la función de programación de mantenimientos iniciales
const { sequelize } = require('../data'); 
const { autoGenerateTokenForWork, getPortalInfoForWork } = require('../services/ClientPortalService'); // 🆕 Portal de cliente 

const { 
  STATUS_ORDER,
  STATE_DEPENDENCIES,
  isStatusBackward,
  isStatusForward,
  validateStatusChange,
  checkStatusConflicts,
  rollbackToStatus,
  rollbackSpecificStatus,
  deleteImagesByStage,
  advanceToStatus,
  logStatusChange,
  deleteReceiptsByWorkAndType,
} = require('../utils/statusManager');

// 🔄 Helper: Reintentar queries que fallan con ECONNRESET
const withRetry = async (queryFn, maxRetries = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      const isConnectionError = 
        error.name === 'SequelizeDatabaseError' && 
        (error.parent?.code === 'ECONNRESET' || 
         error.parent?.code === 'ETIMEDOUT' ||
         error.original?.code === 'ECONNRESET' ||
         error.original?.code === 'ETIMEDOUT');
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`⚠️ DB connection error, retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        continue;
      }
      throw error;
    }
  }
};



const createWork = async (req, res) => {
  try {
   
    const { idBudget } = req.body;

    // Buscar el presupuesto con estado "approved"
    const budget = await Budget.findOne({
      where: { idBudget, status: 'approved' },
      include: [{ model: Permit }], // Incluir el permiso relacionado
    });

    if (!budget) {
      return res.status(404).json({ error: true, message: 'Presupuesto no encontrado o no aprobado' });
    }

    // Verificar si ya existe un Work asociado al Budget
    const existingWork = await Work.findOne({ where: { propertyAddress: budget.propertyAddress } });
    if (existingWork) {
      return res.status(400).json({ error: true, message: 'Ya existe una obra asociada a este presupuesto' });
    }

    // Crear la obra
    const work = await Work.create({
      propertyAddress: budget.propertyAddress,
      status: 'pending', // Estado inicial
      idBudget: budget.idBudget, // Asociar el presupuesto
      notes: `Work creado a partir del presupuesto N° ${idBudget}`,
    });

    // 🆕 Auto-generar token del portal de cliente
    try {
      console.log('🔄 Intentando generar token del portal para work:', work.id);
      await autoGenerateTokenForWork({
        idWork: work.id,
        idBudget: work.idBudget
      });
    } catch (tokenError) {
      console.error('❌ Error generando token del portal:', tokenError);
      // No afecta la creación del work, solo es una funcionalidad adicional
    }
    
    await sendNotifications('pending', work, req.app.get('io'));

    res.status(201).json({ message: 'Obra creada correctamente', work });
  } catch (error) {
    console.error('Error al crear la obra:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor' });
  }
};

// Obtener todas las obras
const getWorks = async (req, res) => {
  try {
    // 📄 PAGINACIÓN: Extraer parámetros de query
    const page = parseInt(req.query.page) || 1;
    const requestedLimit = req.query.limit;
    
    // 🎯 FILTRO POR STAFF: Extraer staffId de query params
    const { staffId } = req.query;
    
    // ✅ SOLUCIÓN UNIVERSAL: Permitir "all" para obtener todos los registros
    let limit, offset;
    if (requestedLimit === 'all') {
      limit = null; // Sin límite
      offset = 0;
    } else {
      const numericLimit = parseInt(requestedLimit) || 50;
      limit = Math.min(numericLimit, 2000); // Máximo 2000 para casos normales
      offset = (page - 1) * limit;
    }

    // OPTIMIZACIÓN: Cargar solo lo esencial en la consulta principal
    // Evita locks excesivos al no cargar Expenses ni Receipts en el JOIN principal
    // ✅ Construir opciones de consulta dinámicamente
    const queryOptions = {
      // 🎯 FILTRO POR STAFF: Agregar WHERE si staffId está presente
      where: staffId ? { staffId: staffId } : {},
      include: [
        {
          model: Budget,
          as: 'budget',
          attributes: ['idBudget', 'propertyAddress', 'status', 'paymentInvoice', 'initialPayment', 'paymentProofAmount', 'date', 'signatureMethod'],
        },
        {
          model: Permit,
          attributes: [
            'idPermit', 
            'propertyAddress', 
            'applicantName', 
            'expirationDate', 
            'applicantEmail',
            // ✅ URLs de Cloudinary (livianas)
            'permitPdfUrl',
            'permitPdfPublicId',
            'optionalDocsUrl',
            'optionalDocsPublicId',
            // ❌ EXCLUIDOS: pdfData, optionalDocs (BLOBs pesados)
          ],
        },
        {
          model: FinalInvoice,
          as: 'finalInvoice',
          required: false
        },
        {
          model: WorkChecklist,
          as: 'checklist',
          required: false,
          attributes: ['finalReviewCompleted'] // Solo traer si está completado
        },
        {
          model: MaintenanceVisit,
          as: 'maintenanceVisits',
          required: false,
          attributes: ['id', 'visitNumber', 'scheduledDate', 'actualVisitDate', 'status', 'createdAt']
        }
        // ❌ Removido: Expense y Receipt de la consulta principal
        // ✅ Se cargarán después en consultas separadas (más eficiente)
      ],
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true, // ✅ Importante para COUNT correcto con includes
    };

    // ✅ Solo agregar limit si no es "all"
    if (limit !== null) {
      queryOptions.limit = limit;
    }

    // 🔄 QUERY PRINCIPAL con retry automático
    const { count, rows: worksInstances } = await withRetry(async () => {
      return await Work.findAndCountAll(queryOptions);
    });

    // 🚀 OPTIMIZACIÓN: Cargar expenses y receipts EN PARALELO
    const workIds = worksInstances.map(w => w.idWork);
    
    // Ejecutar las 2 queries independientes en paralelo
    const [allExpenses, workReceipts] = await Promise.all([
      // Query 1: Todos los expenses
      withRetry(() => Expense.findAll({
        where: { workId: workIds },
        raw: true
      })),
      // Query 2: Receipts directos de Works
      withRetry(() => Receipt.findAll({
        where: { relatedModel: 'Work', relatedId: workIds },
        attributes: ['idReceipt', 'type', 'notes', 'fileUrl', 'publicId', 'mimeType', 'originalName', 'createdAt', 'relatedId'],
        raw: true
      }))
    ]);
    
    // Agrupar expenses por workId
    const expensesByWork = allExpenses.reduce((acc, exp) => {
      if (!acc[exp.workId]) acc[exp.workId] = [];
      acc[exp.workId].push(exp);
      return acc;
    }, {});
    
    // Agrupar receipts por workId
    const receiptsByWork = workReceipts.reduce((acc, receipt) => {
      if (!acc[receipt.relatedId]) acc[receipt.relatedId] = [];
      acc[receipt.relatedId].push(receipt);
      return acc;
    }, {});

    // 🚀 Query 3: Cargar TODOS los expense receipts en UNA sola query (elimina N+1)
    const allExpenseIds = allExpenses.map(e => e.idExpense).filter(Boolean);
    let expenseReceiptsByExpenseId = {};
    if (allExpenseIds.length > 0) {
      const allExpenseReceipts = await withRetry(() => Receipt.findAll({
        where: { relatedModel: 'Expense', relatedId: allExpenseIds, type: 'Inspección Inicial' },
        raw: true
      }));
      expenseReceiptsByExpenseId = allExpenseReceipts.reduce((acc, receipt) => {
        if (!acc[receipt.relatedId]) acc[receipt.relatedId] = [];
        acc[receipt.relatedId].push({ ...receipt, fromExpense: true });
        return acc;
      }, {});
    }

    // Para cada work, combinar los receipts directos y los de expenses (sin romper la estructura original)
    const worksWithDetails = worksInstances.map((workInstance) => {
      const workJson = workInstance.get({ plain: true });
      
      // Agregar expenses desde el objeto precargado
      workJson.expenses = expensesByWork[workJson.idWork] || [];

      // Receipts directos desde el objeto precargado
      let directReceipts = [];
      const workReceiptsData = receiptsByWork[workJson.idWork] || [];
      if (workReceiptsData.length > 0) {
        directReceipts = convertPdfDataToUrl(workReceiptsData);
      }

      // 🚀 Receipts de expenses desde el objeto precargado (sin query adicional)
      let expenseReceipts = [];
      if (workJson.expenses && workJson.expenses.length > 0) {
        const matchingReceipts = workJson.expenses
          .flatMap(e => expenseReceiptsByExpenseId[e.idExpense] || []);
        if (matchingReceipts.length > 0) {
          expenseReceipts = convertPdfDataToUrl(matchingReceipts);
        }
      }

      // Eliminar el campo startDate si no está asignado (lógica existente)
      if (!workJson.startDate) {
        delete workJson.startDate;
      }

      // --- Calcular y añadir estado de expiración del Permit si existe ---
      if (workJson.Permit && workJson.Permit.expirationDate) {
        let permitExpirationStatus = "valid";
        let permitExpirationMessage = "";
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expirationDateString = typeof workJson.Permit.expirationDate === 'string'
          ? workJson.Permit.expirationDate.split('T')[0]
          : new Date(workJson.Permit.expirationDate).toISOString().split('T')[0];

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
            console.warn(`Fecha de expiración de permiso inválida (post-parse) para work ${workJson.idWork}, permit ${workJson.Permit.idPermit}: ${expirationDateString}`);
          }
        } else {
          console.warn(`Formato de fecha de expiración de permiso inválido para work ${workJson.idWork}, permit ${workJson.Permit.idPermit}: ${expirationDateString}`);
        }
        workJson.Permit.expirationStatus = permitExpirationStatus;
        workJson.Permit.expirationMessage = permitExpirationMessage;
      } else if (workJson.Permit) {
        workJson.Permit.expirationStatus = "valid";
        workJson.Permit.expirationMessage = "Permiso sin fecha de expiración especificada.";
      }

      // Unir ambos arrays de receipts (sin romper la estructura original)
      workJson.Receipts = [...directReceipts, ...expenseReceipts];
      return workJson;
    });

    // 📊 METADATA DE PAGINACIÓN
    const totalPages = limit ? Math.ceil(count / limit) : 1;
    const pagination = {
      total: count,
      page,
      limit: limit || 'all',
      totalPages,
      hasNextPage: limit ? page < totalPages : false,
      hasPrevPage: page > 1,
      // 🎯 Información de filtro
      filteredByStaff: staffId || null
    };

    res.status(200).json({
      works: worksWithDetails,
      pagination
    });
  } catch (error) {
    console.error('❌ [getWorks] Error al obtener las obras:', error);
    // ✅ SIEMPRE devolver array vacío para evitar crashes en frontend
    res.status(500).json({ 
      error: true, 
      works: [], 
      pagination: { total: 0, page: 1, limit: 50, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      message: 'Error interno del servidor' 
    });
  }
};

// Obtener una obra por ID
const getWorkById = async (req, res) => {
  try {
    const { idWork } = req.params;
    const { light } = req.query; // ⚡ Modo light para respuestas rápidas
    const startTime = Date.now();
    
    //  Modo LIGHT: Solo lo esencial (Budget, Permit, Staff)
    if (light === 'true') {
      const workLight = await withRetry(async () => {
        return await Work.findByPk(idWork, {
          include: [
            {
              model: Budget,
              as: 'budget',
              attributes: ['idBudget', 'propertyAddress', 'status', 'applicantName', 'totalPrice'],
              required: false
            },
            {
              model: Permit,
              attributes: ['idPermit', 'propertyAddress', 'applicantName', 'expirationDate'],
              required: false
            },
            {
              model: Staff,
              attributes: ['id', 'name', 'email'],
              required: false
            }
          ]
        });
      });
      
      if (!workLight) {
        return res.status(404).json({ error: true, message: 'Obra no encontrada' });
      }
      
      return res.status(200).json(workLight);
    }
    
    // 🔄 Query COMPLETA con retry automático
    const work = await withRetry(async () => {
      return await Work.findByPk(idWork, {
      include: [
        {
          model: Budget,
          as: 'budget',
          attributes: [
            'idBudget', 
            'propertyAddress', 
            'status', 
            'paymentInvoice', 
            'paymentProofType', 
            'initialPayment', 
            'paymentProofAmount', 
            'date', 
            'applicantName',
            'applicantEmail',        // 🆕 Necesario para ClientPortalLink
            'contactCompany',        // 🆕 Necesario para ClientPortalLink
            'clientPortalToken',     // 🆕 Necesario para ClientPortalLink
            'totalPrice', 
            'initialPaymentPercentage',
            'signatureMethod',
            'signNowDocumentId',
            'signedPdfPath',
            'manualSignedPdfPath',
            'manualSignedPdfPublicId'
          ],
        },
        {
          model: Permit,
          attributes: [
            'idPermit',
            'propertyAddress',
            'permitNumber',
            'applicantName',
            'applicantEmail',
            'expirationDate',
            // ✅ URLs de Cloudinary (reemplazo de BLOBs)
            'permitPdfUrl',
            'permitPdfPublicId',
            'optionalDocsUrl',
            'optionalDocsPublicId',
            // 🆕 Campos PPI firmado
            'ppiCloudinaryUrl',
            'ppiSignedPdfUrl',
            'ppiSignatureStatus',
            'ppiSignedAt',
            // ❌ EXCLUIDOS: pdfData, optionalDocs (BLOBs pesados, migrados a Cloudinary)
          ],
        },
        {
          model: Material,
          attributes: ['idMaterial', 'name', 'quantity', 'cost'],
        },
        {
          model: Inspection,
          as: 'inspections',
          attributes: [
            'idInspection',
            'type',
            'processStatus',
            'finalStatus',
            'dateRequestedToInspectors',
            'inspectorScheduledDate',
            'documentForApplicantUrl',
            'dateDocumentSentToApplicant',
            'signedDocumentFromApplicantUrl',
            'dateSignedDocumentReceived',
            'dateInspectionPerformed',
            'resultDocumentUrl',
            'dateResultReceived',
            'notes',
            'workerHasCorrected',
            'dateWorkerCorrected',
            'createdAt',
            'updatedAt',
          ],
          order: [['createdAt', 'DESC']],
        },
        {
          model: InstallationDetail,
          as: 'installationDetails',
          attributes: ['idInstallationDetail', 'date', 'extraDetails', 'extraMaterials', 'images'],
        },
        {
          model: MaterialSet,
          as: 'MaterialSets',
          attributes: ['idMaterialSet', 'invoiceFile', 'totalCost'],
        },
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'stage', 'dateTime', 'imageUrl', 'publicId', 'comment', 'truckCount'],
        },
        {
          model: Expense,
          as: 'expenses',
        },
        {
          model: Receipt,
          as: 'Receipts',
          required: false,
          on: {
            [Op.and]: [
              literal(`"Receipts"."relatedModel" = 'Work'`),
              literal(`"Work"."idWork" = CAST("Receipts"."relatedId" AS UUID)`)
            ]
          },
          attributes: ['idReceipt', 'type', 'notes', 'fileUrl', 'publicId', 'mimeType', 'originalName','createdAt'],
        },
        {
          model: ChangeOrder,
          as: 'changeOrders',
        },
        {
          model: FinalInvoice,
          as: 'finalInvoice',
          required: false,
        }
      ],
    });
    }); // Cierre de withRetry
    
    const queryTime = Date.now() - startTime;

    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }

    // Receipts directos
    let directReceipts = [];
    if (work.Receipts) {
      directReceipts = convertPdfDataToUrl(work.Receipts);
    }

    // Receipts de tipo Inspección Inicial asociados a Expenses (consulta JS, no include)
    let expenseReceipts = [];
    const workJson = work.get({ plain: true });
    if (workJson.expenses && Array.isArray(workJson.expenses) && workJson.expenses.length > 0) {
      const expenseIds = workJson.expenses.map(e => e.idExpense);
      if (expenseIds.length > 0) {
        // 🔄 Cargar receipts con retry
        const foundReceipts = await withRetry(async () => {
          return await Receipt.findAll({
            where: {
              relatedModel: 'Expense',
              relatedId: expenseIds,
              type: 'Inspección Inicial'
            }
          });
        });
        expenseReceipts = convertPdfDataToUrl(foundReceipts.map(r => ({ ...r.get({ plain: true }), fromExpense: true })));
      }
    }

    // Unir ambos arrays de receipts
    workJson.Receipts = [...directReceipts, ...expenseReceipts];

    const totalTime = Date.now() - startTime;
    
    res.status(200).json(workJson);
  } catch (error) {
    res.status(500).json({ error: true, message: 'Error interno del servidor' });
  }
};

// Actualizar una obra
const updateWork = async (req, res) => {
  try {
    const { idWork } = req.params;
    const { propertyAddress, status, startDate, notes, staffId, stoneExtractionCONeeded  } = req.body;

    let workInstance = await Work.findByPk(idWork);
    if (!workInstance) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }
    // --- Guardar valores antiguos ---
    const oldStatus = workInstance.status;
    const oldStartDate = workInstance.startDate;
    const oldStaffId = workInstance.staffId;
    const oldStoneExtractionCONeeded = workInstance.stoneExtractionCONeeded;
    let statusChanged = false;
    let assignmentChanged = false;

    // --- Actualizar los campos ---
    workInstance.propertyAddress = propertyAddress || workInstance.propertyAddress;

    // Permitir reactivar trabajos cancelados
    if (oldStatus === 'cancelled' && status && status !== 'cancelled') {
      workInstance.status = status;
      statusChanged = true;
    } else if (status && status !== oldStatus) {
      workInstance.status = status;
      statusChanged = true;
      if (status === 'inProgress' && !workInstance.startDate) {
        workInstance.startDate = new Date();
      }
    }

    // --- LÓGICA DE MANTENIMIENTO ---
    if (workInstance.status === 'maintenance') {
      // Solo sistemas ATU deben estar en maintenance
      const rawSystemType = workInstance.Permit?.systemType || workInstance.systemType || null;
      const systemTypeNormalized = rawSystemType ? String(rawSystemType).toLowerCase() : '';
      const isATUSystem = systemTypeNormalized.includes('atu');

      if (!isATUSystem) {
        // Si alguien fuerza manualmente un work NO ATU a 'maintenance', corregimos a 'finalApproved'
        console.warn(`[WorkController - updateWork] Work ${idWork} is NOT ATU (systemType="${rawSystemType}") but status was set to 'maintenance'. Forcing status to 'finalApproved' with no maintenance visits.`);
        workInstance.status = 'finalApproved';
      } else {
        if (!workInstance.maintenanceStartDate) {
          workInstance.maintenanceStartDate = new Date();
        }
        if (status === 'maintenance' && oldStatus !== 'maintenance') {
          await workInstance.save();
          try {
            await scheduleInitialMaintenanceVisits(idWork);
          } catch (scheduleError) {
            console.error(`[WorkController - updateWork] ERROR CALLING scheduleInitialMaintenanceVisits for work ${idWork}:`, scheduleError);
          }
        }
      }
    }

    // Detectar cambios en asignación (staffId o startDate)
    if ((staffId && staffId !== oldStaffId) || (startDate && startDate !== oldStartDate)) {
      assignmentChanged = true;
    }

    workInstance.startDate = startDate || workInstance.startDate;
    workInstance.staffId = staffId || workInstance.staffId;
    workInstance.notes = notes || workInstance.notes;
    if (typeof stoneExtractionCONeeded === 'boolean') {
      workInstance.stoneExtractionCONeeded = stoneExtractionCONeeded;
    }

    await workInstance.save();

    // Volver a buscar la obra incluyendo el Staff asignado
    const workWithStaff = await Work.findByPk(workInstance.idWork, {
      include: [
        { model: Staff, attributes: ['name', 'email', 'id'] }
      ]
    });

    //  Notificaciones asíncronas sin bloquear (fire and forget)
    if (statusChanged) {
      sendNotifications(workInstance.status, workWithStaff, req.app.get('io')).catch(err => {
        console.error(`Error sending notifications for work ${idWork} status ${workInstance.status}:`, err);
      });
    }
    // Notificar si cambia asignación aunque el estado no cambie
    if (assignmentChanged) {
      sendNotifications('assigned', workWithStaff, req.app.get('io')).catch(err => {
        console.error(`Error sending assignment notifications for work ${idWork}:`, err);
      });
    }

    //  OPTIMIZACIÓN: Si solo cambió asignación/fecha (no status), devolver respuesta mínima
    const isSimpleAssignment = assignmentChanged && !statusChanged;
    
    if (isSimpleAssignment) {
      //  Respuesta rápida: solo Budget, Permit y Staff (lo esencial)
      const updatedWorkLight = await Work.findByPk(idWork, {
        include: [
          { model: Budget, as: 'budget', attributes: ['idBudget', 'propertyAddress', 'status', 'applicantName']},
          { model: Permit, attributes: ['idPermit', 'propertyAddress', 'applicantName', 'expirationDate']},
          { model: Staff, attributes: ['id', 'name', 'email'] }
        ],
      });
      
      return res.status(200).json(updatedWorkLight);
    }

    // --- RECARGAR LA OBRA CON SUS ASOCIACIONES COMPLETAS (solo si cambió status u otros campos) ---
    const updatedWorkWithAssociations = await Work.findByPk(idWork, {
      include: [
        { model: Budget, as: 'budget', attributes: ['idBudget', 'propertyAddress', 'status', 'paymentInvoice', 'paymentProofType', 'initialPayment', 'date', 'applicantName','totalPrice', 'initialPaymentPercentage']},
        { model: Permit, attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantName', 'expirationDate', 'permitPdfUrl', 'permitPdfPublicId', 'optionalDocsUrl', 'optionalDocsPublicId']}, // ✅ URLs de Cloudinary
        { model: Material, attributes: ['idMaterial', 'name', 'quantity', 'cost']},
        {
          model: Inspection,
          as: 'inspections',
          attributes: [
           'idInspection',
            'type',
            'processStatus', 
            'finalStatus',   
            'dateRequestedToInspectors',
            'inspectorScheduledDate',
            'documentForApplicantUrl',
            'dateDocumentSentToApplicant',
            'signedDocumentFromApplicantUrl',
            'dateSignedDocumentReceived',
            'dateInspectionPerformed',
            'resultDocumentUrl',
            'dateResultReceived',
            'notes',
            'workerHasCorrected',
            'dateWorkerCorrected',
            'createdAt', 
            'updatedAt',
          ],
          order: [['createdAt', 'DESC']], 
        },
        { model: InstallationDetail, as: 'installationDetails', attributes: ['idInstallationDetail', 'date', 'extraDetails', 'extraMaterials', 'images']},
        { model: MaterialSet, as: 'MaterialSets', attributes: ['idMaterialSet', 'invoiceFile', 'totalCost']},
        { model: Image, as: 'images', attributes: ['id', 'stage', 'dateTime', 'imageUrl', 'publicId', 'comment', 'truckCount']},
       {
          model: Receipt,
          as: 'Receipts',
          required: false,
          on: {
            [Op.and]: [
              literal(`"Receipts"."relatedModel" = 'Work'`),
              literal(`"Work"."idWork" = CAST("Receipts"."relatedId" AS UUID)`)
            ]
          },
          attributes: ['idReceipt', 'type', 'notes', 'fileUrl', 'publicId', 'mimeType', 'originalName','createdAt'],
        },
         { model: ChangeOrder, as: 'changeOrders' },
      ],
    });

    if (!updatedWorkWithAssociations) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada después de la actualización (inesperado)' });
    }
    const finalWorkResponse = {
      ...updatedWorkWithAssociations.get({ plain: true }),
      Receipts: updatedWorkWithAssociations.Receipts ? convertPdfDataToUrl(updatedWorkWithAssociations.Receipts) : [],
    };
    res.status(200).json(finalWorkResponse);
  } catch (error) {
    console.error(`Error al actualizar la obra ${req.params.idWork}:`, error);
    res.status(500).json({ error: true, message: 'Error interno del servidor al actualizar la obra' });
  }
};


// Eliminar una obra
const deleteWork = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { idWork } = req.params;

    // Buscar el trabajo con todas sus relaciones (excepto Receipts que tiene tipo incompatible)
    const work = await Work.findByPk(idWork, {
      include: [
        { model: Image, as: 'images' },
        // Receipt excluido - se consulta por separado debido a tipo polimórfico STRING vs UUID
        { model: Expense, as: 'expenses' },
        { model: Income, as: 'incomes' },
        { model: MaterialSet, as: 'MaterialSets' },
        { model: ChangeOrder, as: 'changeOrders' },
        { model: MaintenanceVisit, as: 'maintenanceVisits' },
        { model: Material }, // Sin alias, usa el plural del modelo: Materials
        { model: Inspection, as: 'inspections' },
        { model: InstallationDetail, as: 'installationDetails' },
        { model: FinalInvoice, as: 'finalInvoice' }
      ],
      transaction
    });

    if (!work) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }

    // Consulta separada para Receipts debido a incompatibilidad de tipos (UUID vs STRING)
    const workReceipts = await Receipt.findAll({
      where: {
        relatedModel: 'Work',
        relatedId: idWork.toString() // Convertir UUID a string para comparación
      },
      transaction
    });

    console.log(`🗑️ Eliminando Work #${idWork} (${work.address || work.propertyAddress})...`);

    // Contadores para el resumen
    let deletedCounts = {
      images: 0,
      receipts: 0,
      materials: 0,
      inspections: 0,
      incomes: 0,
      expenses: 0,
      materialSets: 0,
      changeOrders: 0,
      maintenanceVisits: 0
    };

    // 1. Eliminar imágenes de Cloudinary
    if (work.images && work.images.length > 0) {
      deletedCounts.images = work.images.length;
      const imageDeletes = work.images.map(img => 
        deleteFromCloudinary(img.publicId)
          .catch(err => console.warn(`⚠️ Error eliminando imagen ${img.publicId}:`, err.message))
      );
      await Promise.all(imageDeletes);
    }

    // 2. Eliminar receipts de Cloudinary y sus datos asociados
    if (workReceipts && workReceipts.length > 0) {
      deletedCounts.receipts = workReceipts.length;
      const receiptDeletes = workReceipts.map(receipt => 
        deleteFromCloudinary(receipt.publicId)
          .catch(err => console.warn(`⚠️ Error eliminando receipt ${receipt.publicId}:`, err.message))
      );
      await Promise.all(receiptDeletes);
    }

    // 3. Eliminar receipts asociados a expenses del work
    if (work.expenses && work.expenses.length > 0) {
      deletedCounts.expenses = work.expenses.length;
      for (const expense of work.expenses) {
        const expenseReceipts = await Receipt.findAll({
          where: {
            relatedModel: 'Expense',
            relatedId: expense.idExpense.toString()
          },
          transaction
        });
        
        if (expenseReceipts.length > 0) {
          const expenseReceiptDeletes = expenseReceipts.map(receipt =>
            deleteFromCloudinary(receipt.publicId)
              .catch(err => console.warn(`⚠️ Error eliminando expense receipt:`, err.message))
          );
          await Promise.all(expenseReceiptDeletes);
        }
      }
    }

    // 4. Procesar Incomes
    if (work.incomes && work.incomes.length > 0) {
      deletedCounts.incomes = work.incomes.length;
    }

    // 5. Eliminar MaterialSet invoices de Cloudinary
    if (work.MaterialSets && work.MaterialSets.length > 0) {
      deletedCounts.materialSets = work.MaterialSets.length;
      for (const matSet of work.MaterialSets) {
        if (matSet.invoiceFile && matSet.invoiceFile.includes('cloudinary')) {
          const urlParts = matSet.invoiceFile.split('/');
          const publicId = urlParts.slice(-2).join('/').split('.')[0];
          await deleteFromCloudinary(publicId)
            .catch(err => console.warn(`⚠️ Error eliminando invoice de MaterialSet:`, err.message));
        }
      }
    }

    // 6. Eliminar PDFs de ChangeOrders
    if (work.changeOrders && work.changeOrders.length > 0) {
      deletedCounts.changeOrders = work.changeOrders.length;
      for (const co of work.changeOrders) {
        if (co.pdfPath && fs.existsSync(co.pdfPath)) {
          fs.unlinkSync(co.pdfPath);
        }
      }
    }

    // 7. Eliminar MaintenanceVisit media files
    if (work.maintenanceVisits && work.maintenanceVisits.length > 0) {
      deletedCounts.maintenanceVisits = work.maintenanceVisits.length;
      for (const visit of work.maintenanceVisits) {
        const mediaFiles = await MaintenanceMedia.findAll({
          where: { maintenanceVisitId: visit.id }, // ✅ Usar visit.id en lugar de visit.idMaintenanceVisit
          transaction
        });
        
        if (mediaFiles.length > 0) {
          const mediaDeletes = mediaFiles.map(media =>
            deleteFromCloudinary(media.publicId)
              .catch(err => console.warn(`⚠️ Error eliminando maintenance media:`, err.message))
          );
          await Promise.all(mediaDeletes);
        }
      }
    }

    // 8. Contar Materials e Inspections antes de eliminar
    if (work.Materials) deletedCounts.materials = work.Materials.length;
    if (work.inspections) deletedCounts.inspections = work.inspections.length;

    // 9. Limpiar campos de pago del Budget asociado (si existe)
    if (work.idBudget) {
      const budget = await Budget.findByPk(work.idBudget, { transaction });
      if (budget && (budget.paymentProofAmount || budget.paymentInvoice)) {
        await budget.update({
          paymentProofAmount: null,
          paymentProofMethod: null,
          paymentInvoice: null,
          paymentProofType: null
        }, { transaction });
      }
    }

    // 10. CASCADE en DB eliminará automáticamente:
    //    - Materials ✅
    //    - MaterialSets ✅
    //    - Inspections ✅
    //    - InstallationDetails ✅
    //    - Images (registros DB) ✅
    //    - ChangeOrders ✅
    //    - FinalInvoices ✅
    //    - MaintenanceVisits ✅
    //    - Incomes ✅
    //    - Expenses ✅
    //    - Receipts ✅

    // 11. Eliminar el Work (trigger CASCADE en DB)
    await work.destroy({ transaction });

    await transaction.commit();

    res.status(200).json({ 
      success: true,
      message: `Obra "${work.address || work.propertyAddress}" eliminada exitosamente`,
      deleted: deletedCounts
    });
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al eliminar la obra:', error);
    res.status(500).json({ 
      error: true, 
      message: 'Error al eliminar la obra: ' + error.message 
    });
  }
};
const addInstallationDetail = async (req, res) => {
  try {
    console.log("Request Body:", req.body);
    const { idWork } = req.params; // ID del Work al que se asociará el detalle
    const { date, extraDetails, extraMaterials, images } = req.body;

    // Verificar que el Work exista
    const work = await Work.findByPk(idWork);
    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }

    // Crear el detalle de instalación
    const installationDetail = await InstallationDetail.create({
      idWork,
      date,
      extraDetails,
      extraMaterials,
      images,
    });

    // --- Actualizar el estado del Work a "installed" ---
    const oldStatus = work.status; // Guardar estado anterior por si acaso
    work.status = 'installed';
    await work.save();
    const statusChanged = work.status !== oldStatus; // Verificar si realmente cambió

    // --- INICIO: Enviar Notificación ---
    if (statusChanged) { // Solo notificar si el estado cambió a 'installed'
      console.log(`Work ${idWork}: Status changed to '${work.status}'. Sending 'installed' notifications...`);
      try {
        // Usar el estado 'installed' y el objeto work actualizado
        await sendNotifications(work.status, work, null, req.app.get('io')); // Pasas work, null para budget, y io
        console.log(`Notifications sent for status '${work.status}'.`);
      } catch (notificationError) {
        console.error(`Error sending notifications for work ${idWork} status ${work.status}:`, notificationError);
        // Manejar el error como en updateWork (opcionalmente)
        if (notificationError.message.includes('Estado de notificación no configurado')) {
          console.warn(notificationError.message);
        }
      }
    }
    // --- FIN: Enviar Notificación ---

    res.status(201).json({
      message: 'Detalle de instalación agregado correctamente y estado actualizado a installed.',
      installationDetail,
      work // Devolver el work actualizado
    });
  } catch (error) {
    console.error('Error al agregar el detalle de instalación:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor' });
  }
};

const attachInvoiceToWork = async (req, res) => {
  try {
    const { idWork } = req.params; // ID de la obra
    const { totalCost } = req.body; // Costo total enviado en el cuerpo de la solicitud

    // Verificar si se subió un archivo
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No se subió ningún archivo' });
    }

    // Obtener el nombre del archivo subido
    const invoiceFile = req.file.filename;

    // Verificar que la obra exista
    const work = await Work.findByPk(idWork, {
      include: [
        {
          model: MaterialSet,
          as: 'MaterialSets',
        },
      ],
    });

    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }

    // Crear o actualizar el conjunto de materiales asociado a la obra
    let materialSet = work.MaterialSets[0]; // Asumimos que hay un único conjunto de materiales
    if (!materialSet) {
      materialSet = await MaterialSet.create({
        workId: idWork,
        invoiceFile,
        totalCost,
      });
    } else {
      materialSet.invoiceFile = invoiceFile;
      materialSet.totalCost = totalCost;
      await materialSet.save();
    }

    res.status(200).json({
      message: 'Factura y costo total guardados correctamente',
      materialSet,
    });
  } catch (error) {
    console.error('Error al guardar la factura y el costo total:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor' });
  }
};

const getAssignedWorks = async (req, res) => {
  try {

    // Obtener las obras asignadas al worker autenticado
    const works = await Work.findAll({
      where: { staffId: req.staff.id }, // Filtrar por el ID del usuario autenticado
      attributes: [
        'idWork',
        'propertyAddress', 
        'status',
        'staffId',
        'stoneExtractionCONeeded',
        'startDate', // ✅ Fecha de asignación del trabajo
        'updatedAt',
        'createdAt'
      ], // ✅ Solo atributos que existen en Work
      include: [
        {
          model: Permit,
          attributes: [
            'idPermit', 'propertyAddress', 'permitNumber', 
            'applicantName', 'applicantEmail', 'applicantPhone',
            // ✅ URLs de Cloudinary para PDFs (para visualización en app móvil)
            'permitPdfUrl', 'optionalDocsUrl'
          ],
        },
        {
          model: Material,
          attributes: ['idMaterial', 'name', 'quantity', 'cost'],
        },
        {
          model: Inspection,
          as: 'inspections',
          attributes: [
            'idInspection',
            'type',
            'processStatus',
            'finalStatus',
            'workerHasCorrected',
            'dateWorkerCorrected',
            'createdAt',
          ], // ✅ Solo campos críticos para worker
          order: [['createdAt', 'DESC']],
        },
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'stage'], // ✅ SOLO id y stage - sin imageUrl
        },
      ],
    });

    // ✅ Si no hay obras, devolver array vacío (no 404)
    if (works.length === 0) {
      return res.status(200).json({ error: false, works: [], message: 'No tienes tareas asignadas actualmente' });
    }

    // ✅ Transformar para enviar solo metadata de imágenes
    const optimizedWorks = works.map(work => {
      const workData = work.toJSON();
      
      // Contar imágenes por etapa
      const imageStats = {};
      if (workData.images) {
        workData.images.forEach(img => {
          imageStats[img.stage] = (imageStats[img.stage] || 0) + 1;
        });
      }
      
      return {
        ...workData,
        imageCount: workData.images?.length || 0,
        imagesByStage: imageStats,
        images: undefined // Remover array completo
      };
    });

    const dataSize = JSON.stringify(optimizedWorks).length;

    res.status(200).json({ error: false, works: optimizedWorks });
  } catch (error) {
    console.error('❌ [getAssignedWorks] Error al obtener las tareas asignadas:', error);
    // ✅ SIEMPRE devolver array vacío en caso de error para evitar crashes en frontend
    res.status(500).json({ error: true, works: [], message: 'Error interno del servidor' });
  }
};

const addImagesToWork = async (req, res) => {
 
  try {
    const { idWork } = req.params; // ID del trabajo
    const { stage, dateTime, comment, truckCount } = req.body; // Etapa, imagen en Base64 y fecha/hora
    
    // 🐛 DEBUG: Ver qué datos están llegando desde la app
    console.log("🐛 [addImagesToWork] Datos recibidos:");
    console.log("   - idWork:", idWork);
    console.log("   - stage:", stage);
    console.log("   - dateTime:", dateTime);
    console.log("   - comment:", comment);
    console.log("   - truckCount:", truckCount);
    console.log("   - req.body completo:", req.body);
    
    if (!req.file) {
      console.error("Controlador addImagesToWork: No se proporcionó ningún archivo.");
      return res.status(400).json({ error: true, message: 'No se proporcionó ningún archivo de imagen.' });
    }

    // Verificación adicional del tipo de archivo para esta ruta específica (imágenes)
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedImageTypes.includes(req.file.mimetype)) {
      console.error("Controlador addImagesToWork: Tipo de archivo no permitido:", req.file.mimetype);
      return res.status(400).json({ error: true, message: 'Tipo de archivo no permitido para esta operación. Solo se aceptan imágenes (JPG, PNG, GIF, WEBP).' });
    }
    // Verificar que el trabajo exista
    const work = await Work.findByPk(idWork);
    if (!work) {
      console.error("Controlador addImagesToWork: Trabajo no encontrado:", idWork);
      // Si el archivo ya se guardó temporalmente por multer, elimínalo
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: true, message: 'Trabajo no encontrado' });
    }


    // Validar que la etapa sea válida
    const validStages = [
    'foto previa del lugar',
    'materiales',
    'foto excavación',
    'camiones de arena',
    'sistema instalado',
    'extracción de piedras',
    'camiones de tierra',
    'trabajo cubierto',
    'inspeccion final'
    ];
    if (!validStages.includes(stage)) {
      console.error("Controlador addImagesToWork: Etapa no válida:", stage);
      return res.status(400).json({ error: true, message: 'Etapa no válida' });
    }
    console.log("Controlador addImagesToWork: Intentando subir a Cloudinary...");
    const cloudinaryResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: `works/${idWork}/${stage}`,
      resource_type: "image"
    });
    
    
    // --- ASIGNAR EL RESULTADO DE Image.create A newImage ---
    const newImage = await Image.create({ // <--- CAMBIO AQUÍ
      idWork,
      stage,
      imageUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      dateTime: dateTime,
      comment: comment,
      truckCount: truckCount,
    });
   
    const updatedWork = await Work.findByPk(idWork, {
     
      include: [
        {
          model: Image,
          as: 'images',
          attributes: ['id', 'stage', 'dateTime', 'imageUrl', 'publicId', 'comment', 'truckCount'],
        },
        {
          model: Permit,
          as: 'Permit', // Asegúrate que el alias 'as' coincida con tu definición de modelo si existe
          attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'permitPdfUrl', 'permitPdfPublicId', 'optionalDocsUrl', 'optionalDocsPublicId'], // ✅ URLs de Cloudinary
        },
        {
          model: Inspection,
          as: 'inspections', // <--- ALIAS AÑADIDO
          attributes: [     // <--- ATRIBUTOS ACTUALIZADOS
            'idInspection',
            'type',
            'processStatus',
            'finalStatus',
            'dateRequestedToInspectors',
            'inspectorScheduledDate',
            'documentForApplicantUrl',
            'dateDocumentSentToApplicant',
            'signedDocumentFromApplicantUrl',
            'dateSignedDocumentReceived',
            'dateInspectionPerformed',
            'resultDocumentUrl',
            'dateResultReceived',
            'notes',
            'workerHasCorrected', // <--- AÑADIR ESTE CAMPO
            'dateWorkerCorrected', // <--- AÑADIR ESTE CAMPO
            'createdAt',
            'updatedAt',
          ],
          order: [['createdAt', 'DESC']], // Opcional, pero consistente con otros includes
        },
        {
          model: InstallationDetail,
          as: 'installationDetails',
          attributes: ['idInstallationDetail', 'date', 'extraDetails', 'extraMaterials', 'images'],
        },
        {
          model: MaterialSet,
          as: 'MaterialSets',
          attributes: ['idMaterialSet', 'invoiceFile', 'totalCost'],
        },
       
        // ... incluye cualquier otra asociación que UploadScreen pueda necesitar indirectamente
        // a través de currentWork o sus componentes hijos.
      ]
    });
    
    res.status(201).json({
      message: 'Imagen agregada correctamente a Cloudinary y DB',
      work: updatedWork,
      createdImage: newImage 
    });

  } catch (error) {
    console.error('Controlador addImagesToWork: ERROR CAPTURADO:', error); // LOG DETALLADO DEL ERROR
    
    // Error de conexión de red con Cloudinary
    if (error.code === 'ECONNRESET' || error.errno === -4077) {
        console.error('Error de conexión con Cloudinary (ECONNRESET):', error.message);
        return res.status(503).json({ 
          error: true, 
          message: 'Error de conexión con el servidor de almacenamiento. Por favor, intenta de nuevo.' 
        });
    }
    
    if (error instanceof multer.MulterError) {
        console.error('Error de Multer al agregar imagen:', error);
        return res.status(400).json({ error: true, message: `Error de Multer: ${error.message}` });
    } else if (error.http_code && error.http_code === 400) { // Error específico de Cloudinary por formato, etc.
        console.error('Error de Cloudinary (posiblemente formato):', error);
        return res.status(400).json({ error: true, message: `Error de Cloudinary: ${error.message}` });
    }
    
    // Error genérico
    res.status(500).json({ 
      error: true, 
      message: error.message || 'Error interno del servidor al subir imagen.' 
    });
  }
};

const deleteImagesFromWork = async (req, res) => {
  try {
    const { idWork, imageId } = req.params; // Obtener IDs de los parámetros de la URL

  



   const imageToDelete = await Image.findOne({
      where: { id: imageId, idWork: idWork }
    });

    if (!imageToDelete) {
      return res.status(404).json({ error: true, message: 'Imagen no encontrada o no pertenece a este trabajo' });
    }

    // Eliminar de Cloudinary si tiene publicId
    if (imageToDelete.publicId) {
      await deleteFromCloudinary(imageToDelete.publicId);
    }

    // Eliminar de la base de datos
    await imageToDelete.destroy();

    
    res.status(204).send();

  } catch (error) {
    console.error('Error al eliminar imagen (Cloudinary):', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor al eliminar imagen.' });
  }
};

// ✅ NUEVA FUNCIÓN: Obtener imágenes de una obra específica (para mobile app)
const getWorkImages = async (req, res) => {
  try {
    const { idWork } = req.params;
    const { stage } = req.query;

    // Verificar que el trabajo existe
    const work = await Work.findByPk(idWork);
    if (!work) {
      return res.status(404).json({ error: true, message: 'Trabajo no encontrado' });
    }

    // Construir filtro
    const whereClause = { idWork };
    if (stage) {
      whereClause.stage = stage;
    }

    const images = await Image.findAll({
      where: whereClause,
      attributes: ['id', 'stage', 'dateTime', 'imageUrl', 'publicId', 'comment', 'truckCount'],
      order: [['dateTime', 'DESC'], ['id', 'DESC']],
    });

    res.status(200).json({ 
      error: false, 
      workId: idWork,
      stage: stage || 'todas',
      count: images.length,
      images 
    });
  } catch (error) {
    console.error('❌ [getWorkImages] Error:', error);
    res.status(500).json({ error: true, message: 'Error al obtener imágenes' });
  }
};

// --- NUEVA FUNCIÓN PARA OBTENER OBRAS EN MANTENIMIENTO CON DETALLES DE PRÓXIMA VISITA ---
const getMaintenanceOverviewWorks = async (req, res) => {
  try {
    const worksInMaintenance = await Work.findAll({
      where: { status: 'maintenance' },
      include: [
         {
          model: Permit,
          as: 'Permit', // Asegúrate que el alias 'as' coincida con tu definición de modelo si existe
          attributes: ['idPermit', 'propertyAddress', 'permitNumber', 'applicantEmail', 'applicantName'],
        },
      
        {
          model: MaintenanceVisit,
          as: 'maintenanceVisits', // Asegúrate que este 'as' coincida con tu definición de asociación
          attributes: ['id', 'visitNumber', 'scheduledDate', 'status', 'actualVisitDate'],
          // Solo nos interesan las visitas que no están completadas o saltadas para determinar la "próxima"
          where: {
            status: { [Op.notIn]: ['completed', 'skipped'] }
          },
          order: [['scheduledDate', 'ASC']], // La más próxima primero
          required: false, // LEFT JOIN para incluir obras en mantenimiento aunque aún no tengan visitas programadas (raro, pero posible)
        },
        // Puedes añadir otros includes que sean relevantes para la vista de "obras en mantenimiento"
      ],
      order: [['propertyAddress', 'ASC']], // O por la fecha de la próxima visita si prefieres
    });
 
    const worksWithNextVisitDetails = worksInMaintenance.map(workInstance => {
      const work = workInstance.get({ plain: true });

      let nextMaintenanceDate = null;
      let nextVisitNumber = null;
      let nextVisitStatus = null;
      let nextVisitId = null;

       // --- RE-ORDENAR LAS VISITAS EN JAVASCRIPT ---
      if (work.maintenanceVisits && work.maintenanceVisits.length > 0) {
        work.maintenanceVisits.sort((a, b) => {
          // Ordenar por scheduledDate ASC. Si son iguales, por visitNumber ASC.
          const dateA = new Date(a.scheduledDate);
          const dateB = new Date(b.scheduledDate);
          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;
          // Si las fechas son iguales, ordenar por número de visita
          if (a.visitNumber < b.visitNumber) return -1;
          if (a.visitNumber > b.visitNumber) return 1;
          return 0;
        });
        // La primera visita en la lista ordenada es la próxima
        const nextVisit = work.maintenanceVisits[0];
        nextMaintenanceDate = nextVisit.scheduledDate;
        nextVisitNumber = nextVisit.visitNumber;
        nextVisitStatus = nextVisit.status;
        nextVisitId = nextVisit.id;
      }

      // Eliminar el array completo de maintenanceVisits si solo quieres el resumen en esta vista
      // delete work.maintenanceVisits; 

      return {
        ...work, // Todos los campos de la obra y sus otros includes (Permit, Budget)
        nextMaintenanceDate,
        nextVisitNumber,
        nextVisitStatus,
        nextVisitId,
      };
    });

    res.status(200).json(worksWithNextVisitDetails);
  } catch (error) {
    console.error('Error al obtener obras en mantenimiento con detalles:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor.' });
  }
};

// Nueva función para cambiar estados
const changeWorkStatus = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { idWork } = req.params;
    const { targetStatus, reason, force = false } = req.body;

    // Validar que targetStatus sea válido
    const validStatuses = [
      'pending', 'assigned', 'inProgress', 'installed', 
      'firstInspectionPending', 'approvedInspection', 'rejectedInspection',
      'coverPending', 'covered', 'finalInspectionPending', 
      'finalApproved', 'finalRejected', 'invoiceFinal', 
      'paymentReceived', 'maintenance'
    ];

    if (!validStatuses.includes(targetStatus)) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: true, 
        message: 'Estado objetivo no válido',
        validStatuses 
      });
    }

    // Obtener el trabajo con todas sus asociaciones
    const work = await Work.findByPk(idWork, {
      include: [
        { model: Inspection, as: 'inspections' },
        { model: InstallationDetail, as: 'installationDetails' },
        { model: Image, as: 'images' },
        { model: FinalInvoice, as: 'finalInvoice' },
        { model: MaintenanceVisit, as: 'maintenanceVisits' }
      ],
      transaction
    });

    if (!work) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }

    const currentStatus = work.status;

    // Si el estado es el mismo, no hacer nada
    if (currentStatus === targetStatus) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: true, 
        message: `La obra ya está en estado '${targetStatus}'` 
      });
    }

    const isMovingBackward = isStatusBackward(currentStatus, targetStatus);
    const isMovingForward = isStatusForward(currentStatus, targetStatus);

    // Validar el cambio
    const validation = await validateStatusChange(work, targetStatus, isMovingBackward, force);
    if (!validation.valid) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: true, 
        message: validation.message,
        conflicts: validation.conflicts,
        suggestion: "Use 'force: true' para forzar el cambio ignorando los conflictos"
      });
    }

    // Ejecutar el cambio de estado
    if (isMovingBackward) {
      await rollbackToStatus(work, targetStatus, transaction, reason);
    } else if (isMovingForward) {
      await advanceToStatus(work, targetStatus, transaction);
    }

    // Actualizar el trabajo
    work.status = targetStatus;
    await work.save({ transaction });

    // Log del cambio
    await logStatusChange(idWork, currentStatus, targetStatus, reason, req.staff?.id, transaction);

    await transaction.commit();

    // Recargar trabajo con asociaciones
    const updatedWork = await Work.findByPk(idWork, {
      include: [
        { model: Budget, as: 'budget' },
        { model: Permit },
        { model: Inspection, as: 'inspections' },
        { model: InstallationDetail, as: 'installationDetails' },
        { model: Image, as: 'images' },
        { model: FinalInvoice, as: 'finalInvoice' },
        { model: MaintenanceVisit, as: 'maintenanceVisits' }
      ]
    });

    console.log(`✅ Estado cambiado exitosamente: ${currentStatus} → ${targetStatus} para work ${idWork}`);

    res.status(200).json({
      message: `Estado cambiado de '${currentStatus}' a '${targetStatus}'`,
      work: updatedWork,
      changedBy: req.staff?.id,
      reason,
      direction: isMovingBackward ? 'backward' : isMovingForward ? 'forward' : 'same'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al cambiar estado:', error);
    res.status(500).json({ 
      error: true, 
      message: 'Error interno del servidor',
      details: error.message 
    });
  }
};

const validateStatusChangeOnly = async (req, res) => {
  try {
    const { idWork } = req.params;
    const { targetStatus } = req.body;

    const work = await Work.findByPk(idWork, {
      include: [
        { model: Inspection, as: 'inspections' },
        { model: InstallationDetail, as: 'installationDetails' },
        { model: Image, as: 'images' },
        { model: FinalInvoice, as: 'finalInvoice' },
        { model: MaintenanceVisit, as: 'maintenanceVisits' }
      ]
    });

    if (!work) {
      return res.status(404).json({ error: true, message: 'Obra no encontrada' });
    }

    const currentStatus = work.status;
    const isMovingBackward = isStatusBackward(currentStatus, targetStatus);
    
    // Solo validar, no ejecutar
    const validation = await validateStatusChange(work, targetStatus, isMovingBackward, false);
    
    res.status(200).json({
      currentStatus,
      targetStatus,
      isValid: validation.valid,
      conflicts: validation.conflicts || [],
      message: validation.message || 'Validación completada',
      direction: isMovingBackward ? 'backward' : 'forward'
    });

  } catch (error) {
    console.error('Error en validación de estado:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor' });
  }
};

// Obtener obras en estado de mantenimiento
const getWorksInMaintenance = async (req, res) => {
  try {
    const works = await Work.findAll({
      where: { status: 'maintenance' },
      include: [
        {
          model: MaintenanceVisit,
          as: 'maintenanceVisits',
          include: [
            { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] }
          ],
          order: [['scheduledDate', 'ASC']] // Ordenar visitas por fecha ascendente
        },
        { 
          model: Budget, 
          as: 'budget', 
          attributes: ['applicantName', 'propertyAddress', 'applicantEmail'] 
        },
        {
          model: Permit,
          attributes: ['propertyAddress', 'applicantName', 'applicantPhone', 'applicantEmail']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enriquecer cada obra con información de zona (ZIP code y city extraídos)
    const enrichedWorks = works.map(work => {
      const workData = work.get({ plain: true });
      
      // Extraer información de la dirección
      const address = workData.budget?.propertyAddress || workData.Permit?.propertyAddress || workData.propertyAddress || '';
      
      // Extraer ZIP code (buscar patrón de 5 dígitos)
      const zipMatch = address.match(/\b\d{5}\b/);
      const zipCode = zipMatch ? zipMatch[0] : null;
      
      // City - extracción mejorada
      let city = null;
      if (address) {
        // Normalizar dirección para búsqueda
        const normalizedAddress = address.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Lista de palabras clave de ciudades conocidas
        const cityKeywords = [
          'lehigh acres', 'lehigh', 'cape coral', 'fort myers', 'ft myers',
          'north port', 'port charlotte', 'la belle', 'labelle',
          'deltona', 'poinciana', 'orlando'
        ];
        
        // Buscar coincidencias en el orden de prioridad (más específico primero)
        for (const keyword of cityKeywords) {
          if (normalizedAddress.includes(keyword)) {
            city = keyword;
            break;
          }
        }
        
        // Si no se encuentra keyword, intentar extracción por comas
        if (!city) {
          const parts = address.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            city = parts[parts.length - 2].toLowerCase();
          }
        }
      }
      
      return {
        ...workData,
        extractedZipCode: zipCode,
        extractedCity: city,
        fullAddress: address
      };
    });

    res.status(200).json(enrichedWorks);
  } catch (error) {
    console.error('Error al obtener obras en mantenimiento:', error);
    res.status(500).json({ error: true, message: 'Error interno del servidor' });
  }
};

// Actualizar información de Notice to Owner y Lien
const updateNoticeToOwner = async (req, res) => {
  try {
    const { idWork } = req.params;
    const {
      noticeToOwnerFiled,
      noticeToOwnerDocumentUrl,
      noticeToOwnerFiledDate,
      lienFiled,
      lienDocumentUrl,
      lienFiledDate,
      noticeToOwnerNotes
    } = req.body;

    console.log(`📋 Actualizando Notice to Owner para trabajo ${idWork}:`, req.body);

    // Buscar el trabajo
    const work = await Work.findByPk(idWork);
    if (!work) {
      return res.status(404).json({ error: true, message: 'Trabajo no encontrado' });
    }

    // Verificar que tenga installationStartDate
    if (!work.installationStartDate) {
      return res.status(400).json({ 
        error: true, 
        message: 'Este trabajo no tiene fecha de inicio de instalación registrada' 
      });
    }

    // Preparar datos para actualizar
    const updateData = {};
    
    if (noticeToOwnerFiled !== undefined) {
      updateData.noticeToOwnerFiled = noticeToOwnerFiled;
      // Si se marca como archivado y no tiene fecha, usar hoy
      if (noticeToOwnerFiled && !noticeToOwnerFiledDate && !work.noticeToOwnerFiledDate) {
        updateData.noticeToOwnerFiledDate = new Date().toISOString().split('T')[0];
      }
    }
    
    if (noticeToOwnerDocumentUrl !== undefined) {
      updateData.noticeToOwnerDocumentUrl = noticeToOwnerDocumentUrl;
    }
    
    if (noticeToOwnerFiledDate !== undefined) {
      updateData.noticeToOwnerFiledDate = noticeToOwnerFiledDate;
    }
    
    if (lienFiled !== undefined) {
      updateData.lienFiled = lienFiled;
      // Si se marca como archivado y no tiene fecha, usar hoy
      if (lienFiled && !lienFiledDate && !work.lienFiledDate) {
        updateData.lienFiledDate = new Date().toISOString().split('T')[0];
      }
    }
    
    if (lienDocumentUrl !== undefined) {
      updateData.lienDocumentUrl = lienDocumentUrl;
    }
    
    if (lienFiledDate !== undefined) {
      updateData.lienFiledDate = lienFiledDate;
    }
    
    if (noticeToOwnerNotes !== undefined) {
      updateData.noticeToOwnerNotes = noticeToOwnerNotes;
    }

    // Actualizar el trabajo
    await work.update(updateData);

    console.log('✅ Notice to Owner actualizado exitosamente');

    // Devolver el trabajo actualizado
    const updatedWork = await Work.findByPk(idWork);

    res.status(200).json({
      success: true,
      message: 'Notice to Owner actualizado exitosamente',
      work: updatedWork
    });

  } catch (error) {
    console.error('❌ Error actualizando Notice to Owner:', error);
    res.status(500).json({ 
      error: true, 
      message: 'Error al actualizar Notice to Owner',
      details: error.message 
    });
  }
};

// ============================================
// 📄 SUBIR PERMISO DE OPERACIÓN
// ============================================
const uploadOperatingPermit = async (req, res) => {
  try {
    const { idWork } = req.params;
    const staffId = req.user?.id || null;

    // Validar que existe archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    // Buscar el Work
    const work = await Work.findByPk(idWork);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work no encontrado'
      });
    }

    console.log(`📄 Subiendo Permiso de Operación para Work ${idWork}...`);

    // Subir a Cloudinary
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'zurcher/work-documents/operating-permits',
          resource_type: 'auto',
          public_id: `operating_permit_work_${idWork}_${Date.now()}`
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    console.log(`✅ Permiso de Operación subido a Cloudinary: ${cloudinaryResult.secure_url}`);

    // Actualizar Work con URLs y fecha
    work.operatingPermitUrl = cloudinaryResult.secure_url;
    work.operatingPermitPublicId = cloudinaryResult.public_id;
    work.operatingPermitSentAt = new Date();
    await work.save();

    // Crear nota automática
    const noteMessage = `📄 Permiso de Operación subido al sistema - ${new Date().toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    await WorkNote.create({
      workId: idWork,
      staffId: staffId,
      message: noteMessage,
      noteType: 'other',
      priority: 'medium',
      isResolved: true,
      mentionedStaffIds: []
    });

    console.log(`✅ Nota automática creada: "${noteMessage}"`);

    return res.status(200).json({
      success: true,
      message: 'Permiso de Operación subido exitosamente',
      data: {
        url: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        sentAt: work.operatingPermitSentAt
      }
    });

  } catch (error) {
    console.error('❌ Error al subir Permiso de Operación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al subir Permiso de Operación',
      details: error.message
    });
  }
};

// ============================================
// 🔧 SUBIR SERVICIO DE MANTENIMIENTO
// ============================================
const uploadMaintenanceService = async (req, res) => {
  try {
    const { idWork } = req.params;
    const staffId = req.user?.id || null;

    // Validar que existe archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    // Buscar el Work
    const work = await Work.findByPk(idWork);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work no encontrado'
      });
    }

    console.log(`🔧 Subiendo Servicio de Mantenimiento para Work ${idWork}...`);

    // Subir a Cloudinary
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'zurcher/work-documents/maintenance-services',
          resource_type: 'auto',
          public_id: `maintenance_service_work_${idWork}_${Date.now()}`
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    console.log(`✅ Servicio de Mantenimiento subido a Cloudinary: ${cloudinaryResult.secure_url}`);

    // Actualizar Work con URLs y fecha
    work.maintenanceServiceUrl = cloudinaryResult.secure_url;
    work.maintenanceServicePublicId = cloudinaryResult.public_id;
    work.maintenanceServiceSentAt = new Date();
    await work.save();

    // Crear nota automática
    const noteMessage = `🔧 Servicio de Mantenimiento subido al sistema - ${new Date().toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    await WorkNote.create({
      workId: idWork,
      staffId: staffId,
      message: noteMessage,
      noteType: 'other',
      priority: 'medium',
      isResolved: true,
      mentionedStaffIds: []
    });

    console.log(`✅ Nota automática creada: "${noteMessage}"`);

    return res.status(200).json({
      success: true,
      message: 'Servicio de Mantenimiento subido exitosamente',
      data: {
        url: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        sentAt: work.maintenanceServiceSentAt
      }
    });

  } catch (error) {
    console.error('❌ Error al subir Servicio de Mantenimiento:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al subir Servicio de Mantenimiento',
      details: error.message
    });
  }
};

// ============================================
// 📎 SUBIR DOCUMENTO/IMAGEN EXTRA
// ============================================
const uploadExtraDocument = async (req, res) => {
  try {
    const { idWork } = req.params;
    const staffId = req.user?.id || null;

    // Validar que existe archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    // Buscar el Work
    const work = await Work.findByPk(idWork);
    if (!work) {
      return res.status(404).json({
        success: false,
        message: 'Work no encontrado'
      });
    }

    console.log(`📎 Subiendo Documento Extra para Work ${idWork}...`);

    // Subir a Cloudinary
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'zurcher/work-documents/extra-documents',
          resource_type: 'auto',
          public_id: `extra_document_work_${idWork}_${Date.now()}`
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    console.log(`✅ Documento Extra subido a Cloudinary: ${cloudinaryResult.secure_url}`);

    // Actualizar Work con URLs y fecha
    work.extraDocumentUrl = cloudinaryResult.secure_url;
    work.extraDocumentPublicId = cloudinaryResult.public_id;
    work.extraDocumentSentAt = new Date();
    await work.save();

    // Crear nota automática
    const noteMessage = `📎 Documento Extra subido al sistema - ${new Date().toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    await WorkNote.create({
      workId: idWork,
      staffId: staffId,
      message: noteMessage,
      noteType: 'other',
      priority: 'medium',
      isResolved: true,
      mentionedStaffIds: []
    });

    console.log(`✅ Nota automática creada: "${noteMessage}"`);

    return res.status(200).json({
      success: true,
      message: 'Documento Extra subido exitosamente',
      data: {
        url: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        sentAt: work.extraDocumentSentAt
      }
    });

  } catch (error) {
    console.error('❌ Error al subir Documento Extra:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al subir Documento Extra',
      details: error.message
    });
  }
};

// 🆕 Obtener información del portal de cliente para un work
const getWorkPortalInfo = async (req, res) => {
  try {
    const { workId } = req.params;

    if (!workId) {
      return res.status(400).json({
        success: false,
        message: 'workId es requerido'
      });
    }

    const portalInfo = await getPortalInfoForWork(workId);

    if (!portalInfo) {
      return res.status(404).json({
        success: false,
        message: 'Work no encontrado o sin información de cliente'
      });
    }

    res.status(200).json({
      success: true,
      data: portalInfo
    });

  } catch (error) {
    console.error('❌ Error obteniendo información del portal:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      details: error.message
    });
  }
};

module.exports = {
  createWork,
  getWorks,
  getWorkById,
  updateWork,
  deleteWork,
  addInstallationDetail,
  attachInvoiceToWork,
  getAssignedWorks,
  addImagesToWork,
  deleteImagesFromWork,
  getWorkImages, // ✅ Nuevo endpoint para imágenes
  getMaintenanceOverviewWorks,
  changeWorkStatus,
  validateStatusChangeOnly,
  getWorksInMaintenance,
  updateNoticeToOwner,
  uploadOperatingPermit,        // 🆕 NUEVO
  uploadMaintenanceService,      // 🆕 NUEVO
  uploadExtraDocument,           // 🆕 NUEVO - Documento Extra
  getWorkPortalInfo,            // 🆕 Portal de cliente
};