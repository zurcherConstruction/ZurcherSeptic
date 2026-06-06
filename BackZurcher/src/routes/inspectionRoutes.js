const express = require('express');
const InspectionController = require('../controllers/InspectionController');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol'); // Ajusta según tus middlewares
const { upload } = require('../middleware/multer');
const router = express.Router();

// 1. Iniciar proceso de inspección inicial (envía correo a inspectores)
router.post(
    '/:workId/request-initial',
    verifyToken, allowRoles(['admin', 'recept', 'owner']),
    InspectionController.requestInitialInspection
  );
  
  // 2. Registrar respuesta de inspectores (sube doc para aplicante)
  router.put(
    '/:inspectionId/schedule-received',
    verifyToken, allowRoles(['admin', 'recept', 'owner']),
    upload.single('documentForApplicantFile'), // 'documentForApplicantFile' es el name del input file en el form
    InspectionController.registerInspectorResponse
  );
  
  // 3. Enviar documento (de inspectores) al aplicante para firma
  router.post(
    '/:inspectionId/send-to-applicant',
    verifyToken, allowRoles(['admin', 'recept', 'owner']),
    InspectionController.sendDocumentToApplicant
  );
  
  // 4. Registrar documento firmado devuelto por el aplicante (sube doc firmado)
  router.put(
    '/:inspectionId/applicant-document-received',
    verifyToken, allowRoles(['admin', 'recept', 'owner']),
    upload.single('signedDocumentFile'), // 'signedDocumentFile' es el name del input file
    InspectionController.registerSignedApplicantDocument
  );
  
  // 5. Registrar resultado final de la inspección (sube doc de resultado)
  router.put(
    '/:inspectionId/register-result',
    verifyToken, allowRoles(['admin', 'recept', 'owner']),
    upload.array('resultDocumentFiles', 3), // 'resultDocumentFile' es el name del input file
    InspectionController.registerInspectionResult
  );
  router.post(
    '/reinspection/:workId',
    verifyToken, allowRoles(['owner', 'admin', 'staff', 'maintenance']), upload.array('attachments', 5), InspectionController.requestReinspection
);
router.post(
  '/:inspectionId/mark-corrected',
  verifyToken, allowRoles(['owner', 'admin', 'staff', 'worker', 'maintenance']),
 
  InspectionController.markCorrectionByWorker
);
  
  // Rutas para obtener inspecciones
  router.get(
    '/work/:workId', 
    verifyToken, allowRoles(['admin', 'recept', 'owner', 'maintenance', 'finance', 'finance-viewer']), 
    InspectionController.getInspectionsByWork
  );
  
  router.get(
    '/:inspectionId', 
    verifyToken, allowRoles(['admin', 'recept', 'owner', 'maintenance', 'finance', 'finance-viewer']), 
    InspectionController.getInspectionById
  );

  // --- INICIO: RUTAS PARA EL FLUJO DE INSPECCIÓN FINAL ---

// 6. Cliente solicita la inspección final (puede incluir adjuntos)
router.post(
  '/:workId/request-final',
  verifyToken, allowRoles(['admin', 'recept', 'owner', 'client']), // Ajusta roles según quién puede solicitar
  upload.array('attachments', 5), // 'attachments' es el name del input file, permite hasta 5 archivos
  InspectionController.requestFinalInspection
);

// 7. Inspectores responden con el invoice para la inspección final (sube archivo de invoice)
router.put(
  '/:inspectionId/register-final-invoice',
  verifyToken, allowRoles(['admin', 'recept', 'owner']),
  upload.single('invoiceFile'), // 'invoiceFile' es el name del input file
  InspectionController.registerInspectorInvoiceForFinal
);

// 8. Se reenvía el invoice (recibido de inspectores) al cliente
router.post(
  '/:inspectionId/send-final-invoice-to-client',
  verifyToken, allowRoles(['admin', 'recept', 'owner']),
  InspectionController.sendInvoiceToClientForFinal
);

// 9. Cliente avisa que abonó el invoice (puede incluir comprobante de pago)
router.put(
  '/:inspectionId/confirm-client-payment',
  verifyToken, allowRoles(['admin', 'recept', 'owner', 'client']), // Ajusta roles
  upload.single('paymentProofFile'), // 'paymentProofFile' es el name del input file
  InspectionController.confirmClientPaymentForFinal
);

// 9b. Registrar pago directo (admin/recept/owner paga el invoice directamente)
router.put(
  '/:inspectionId/confirm-direct-payment',
  verifyToken, allowRoles(['admin', 'recept', 'owner']),
  upload.single('paymentProofFile'),
  InspectionController.confirmDirectPaymentForFinal
);

// 10. Se envía confirmación de pago al inspector para que termine la inspección final
router.post(
  '/:inspectionId/notify-inspector-payment',
  verifyToken, allowRoles(['admin', 'recept', 'owner']),
  InspectionController.notifyInspectorPaymentForFinal
);

// --- NUEVO: Registrar resultado rápido de inspección (aprobada/rechazada + imagen) ---
router.post(
  '/:workId/quick-result',
  verifyToken, allowRoles(['admin', 'recept', 'owner', 'inspector']),
  upload.single('resultDocumentFile'),
  InspectionController.registerQuickInspectionResult
);

router.put(
  '/:workId/quick-follow-up',
  verifyToken, allowRoles(['admin', 'recept', 'owner']),
  InspectionController.saveQuickInspectionFollowUp
);


// --- FIN: RUTAS PARA EL FLUJO DE INSPECCIÓN FINAL ---

  

// // Crear una inspección (solo administradores)
// router.post('/', verifyToken, allowRoles(['admin', 'recept', 'owner']), InspectionController.createInspection);

// // Obtener inspecciones por obra (personal del hotel)
// router.get('/work/:workId', verifyToken, allowRoles(['admin', 'recept', 'owner']), InspectionController.getInspectionsByWork);

// // Actualizar una inspección (solo administradores)
// router.put('/:id', verifyToken, allowRoles(['admin', 'recept', 'owner']), InspectionController.updateInspection);

module.exports = router;