const express = require('express');
const BudgetController = require('../controllers/BudgetController');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles, isOwner, isAdmin, isRecept, isStaff } = require('../middleware/byRol');
const { upload } = require('../middleware/multer');
const { verifyPendingSignatures } = require('../controllers/SignatureVerificationController');
const router = express.Router();

// ========== NOTA: Las rutas públicas están en BudgetPublicRoutes.js ==========
// Se movieron a un archivo separado para evitar que el middleware verifyToken las bloquee

// ========== RUTAS CON AUTENTICACIÓN ==========

// Rutas con validación de token y roles
router.post('/',  allowRoles(['admin', 'recept', 'owner', 'finance']), BudgetController.createBudget);

// 🆕 NUEVA RUTA: Crear presupuestos/trabajos legacy (migración)
router.post('/legacy', verifyToken, allowRoles(['admin', 'owner']), upload.fields([
  { name: 'permitPdf', maxCount: 1 },
  { name: 'budgetPdf', maxCount: 1 },
  { name: 'optionalDocs', maxCount: 1 }
]), BudgetController.createLegacyBudget); // Solo admin y owner pueden migrar

router.get('/all', verifyToken, isStaff, BudgetController.getBudgets); // Personal del hotel puede ver presupuestos (incluyendo follow-up)

// 🆕 Obtener lista de contactCompany únicos (para autocomplete)
router.get('/contact-companies', verifyToken, isStaff, BudgetController.getContactCompanies);

// 🆕 SEGUIMIENTO (FOLLOW-UP)
// Obtener budgets que requieren seguimiento
router.get('/follow-up', verifyToken, allowRoles(['admin', 'owner', 'follow-up', 'finance']), BudgetController.getFollowUpBudgets);

// 🗄️ ARCHIVO (ARCHIVED BUDGETS)
// Obtener budgets archivados desde la base de datos
router.get('/archived', verifyToken, allowRoles(['admin', 'owner', 'follow-up', 'finance']), BudgetController.getArchivedBudgetsFromDB);

// 🆕 EXPORTAR BUDGETS A EXCEL
router.get('/export/excel', verifyToken, allowRoles(['admin', 'owner', 'finance', 'follow-up']), BudgetController.exportBudgetsToExcel);

router.post(
    '/:idBudget/upload',
    verifyToken,
    allowRoles(['admin', 'recept', 'owner', 'finance']),
    upload.single('file'), // Middleware correcto
    BudgetController.uploadInvoice
  );
  router.post(
    '/:idBudget/upload-pdf',
    verifyToken,
    allowRoles(['admin', 'recept', 'owner', 'finance']), // Roles permitidos
    upload.single('file'), // Middleware para manejar el archivo
    BudgetController.uploadBudgetPDF // Controlador para manejar la lógica
);

// Ruta para descargar el PDF
router.get(
  '/:idBudget/pdf',
  verifyToken, // Verificar que hay un token válido
  isStaff,     // O el rol/roles adecuados (ej: allowRoles(['admin', 'recept', 'owner', 'staff']))
  BudgetController.downloadBudgetPDF // Controlador para manejar la descarga
);
// Ruta para VER el PDF
router.get(
  '/:idBudget/view/pdf',
  verifyToken, // Verificar que hay un token válido
  isStaff,     // O el rol/roles adecuados (ej: allowRoles(['admin', 'recept', 'owner', 'staff']))
  BudgetController.viewBudgetPDF // Controlador para manejar la descarga
);

router.get('/:idBudget/preview',verifyToken, isStaff, BudgetController.previewBudgetPDF);

// === NUEVAS RUTAS PARA PDF DE PERMISO Y OPCIONALES ===
router.get(
  '/:idBudget/permit-pdf',
  verifyToken,
  isStaff,
  BudgetController.permitPdf
);
router.get(
  '/:idBudget/optional-docs',
  verifyToken,
  isStaff,
  BudgetController.optionalDocs
);

// === NUEVA RUTA PARA PDF DEL PRESUPUESTO LEGACY ===
router.get(
  '/:idBudget/legacy-budget-pdf',
  verifyToken,
  isStaff,
  BudgetController.legacyBudgetPdf
);

// 🆕 Enviar presupuesto para REVISIÓN del cliente (sin firma, solo lectura)
router.post(
  '/:idBudget/send-for-review',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance']),
  BudgetController.sendBudgetForReview
);

// 🆕 CONVERTIR DRAFT A INVOICE DEFINITIVO
router.post(
  '/:idBudget/convert-to-invoice',
  verifyToken,
  allowRoles(['admin', 'owner', 'finance']),
  BudgetController.convertDraftToInvoice
);

// ========== RUTAS DE SIGNNOW ==========

// Enviar presupuesto a SignNow para firma
router.post(
  '/:idBudget/send-to-signnow',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance']),
  BudgetController.sendBudgetToSignNow
);

// ✅ NUEVA RUTA: Regenerar enlace de firma cuando expire (solo DocuSign)
router.post(
  '/:idBudget/resend-signature-link',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance']),
  BudgetController.resendSignatureLink
);

// ✅ NUEVA RUTA: Verificar si un envelope soporta regeneración de enlaces
router.get(
  '/:idBudget/check-envelope-support',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance']),
  BudgetController.checkEnvelopeSupport
);

// ✅ NUEVA RUTA: Reenviar documento con firma embebida (para documentos antiguos)
router.post(
  '/:idBudget/resend-with-embedded-signing',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance']),
  BudgetController.resendWithEmbeddedSigning
);

// Verificar estado de firma del presupuesto
router.get(
  '/:idBudget/signature-status',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance', 'staff', 'follow-up']), // Staff, Finance y Follow-up también pueden consultar estado
  BudgetController.checkSignatureStatus
);

// Descargar documento firmado
router.get(
  '/:idBudget/download-signed',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'staff', 'follow-up']), // Staff y follow-up también pueden descargar firmados
  BudgetController.downloadSignedBudget
);

// 🆕 Visualizar documento firmado (inline, para modal)
router.get(
  '/:idBudget/view-signed',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'staff', 'finance', 'follow-up']), // Todos pueden visualizar
  BudgetController.viewSignedBudget
);

// 🆕 Visualizar documento firmado manualmente (proxy de Cloudinary)
router.get(
  '/:idBudget/view-manual-signed',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'staff', 'finance', 'follow-up']), // Todos pueden visualizar
  BudgetController.viewManualSignedBudget
);

// 🔁 Reintentar descarga de PDF firmado
const signNowController = require('../controllers/signNowController');
router.post(
  '/:idBudget/retry-signed-download',
  verifyToken,
  allowRoles(['admin', 'owner']),
  signNowController.retryBudgetSignedDownload
);

// 🔗 Sincronizar documento manual de SignNow
router.post(
  '/:idBudget/sync-manual-signnow',
  verifyToken,
  allowRoles(['admin', 'owner']),
  signNowController.syncManualSignNowDocument
);

// 📤 Subir PDF firmado manualmente (no desde SignNow)
router.post(
  '/:idBudget/upload-manual-signed',
  verifyToken,
  allowRoles(['admin', 'owner', 'recept']), // recept puede subir también
  upload.single('file'), // Usar multer para recibir el archivo PDF
  BudgetController.uploadManualSignedPdf
);

// ========== RUTAS EXISTENTES ==========

// 🔔 RUTA PARA OBTENER BUDGETS CON ALERTAS PRÓXIMAS (debe ir ANTES de /:idBudget)
router.get('/upcoming-alerts', verifyToken, isStaff, BudgetController.getBudgetsWithUpcomingAlerts);

// 🆕 ACTUALIZAR SEGUIMIENTO (FOLLOW-UP)
// 🆕 ACTUALIZAR SEGUIMIENTO (FOLLOW-UP)
router.patch('/:idBudget/follow-up', verifyToken, allowRoles(['admin', 'owner', 'follow-up', 'finance']), BudgetController.toggleRequiresFollowUp);

// 🗄️ ARCHIVAR PRESUPUESTO
router.patch('/:idBudget/archive', verifyToken, allowRoles(['admin', 'owner', 'follow-up', 'finance']), BudgetController.archiveBudget);

  router.put('/:idBudget', verifyToken, BudgetController.updateBudget); // Solo administradores pueden actualizar presupuestos
  router.get('/:idBudget', verifyToken, isStaff, BudgetController.getBudgetById); // Personal del hotel puede ver un presupuesto específico

router.delete('/:idBudget', verifyToken, isOwner, BudgetController.deleteBudget); // Solo el dueño puede eliminar presupuestos

// 🆕 APROBACIÓN MANUAL DE PRESUPUESTOS (OWNER BYPASS CLIENT WAIT)
router.post(
  '/:idBudget/manual-approve',
  verifyToken,
  allowRoles(['admin', 'owner']),
  BudgetController.manualApprove
);

// 🆕 OBTENER ENLACE DE FIRMA DE DOCUSIGN PARA COMPARTIR
router.get(
  '/:idBudget/signature-link',
  verifyToken,
  isStaff,
  BudgetController.getSignatureLink
);

// ========== RUTAS PARA EDITAR DATOS DE CLIENTE ==========

// Obtener datos de cliente de un presupuesto
router.get(
  '/:idBudget/client-data',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner', 'finance']),
  BudgetController.getClientData
);

// Actualizar datos de cliente de un presupuesto (actualiza tanto Budget como Permit)
router.patch(
  '/:idBudget/client-data',
  verifyToken,
  allowRoles(['admin', 'recept', 'owner']), // Solo roles administrativos pueden editar
  BudgetController.updateClientData
);

// 🆕 Verificar manualmente firmas pendientes de SignNow
router.post(
  '/verify-signatures',
  verifyToken,
  isStaff, // Cualquier staff puede verificar
  verifyPendingSignatures
);

// 🔔 Ejecutar manualmente verificación de recordatorios de budget
router.post(
  '/check-reminders',
  verifyToken,
  isStaff, // Cualquier staff puede ejecutar
  async (req, res) => {
    try {
      const { checkBudgetReminders } = require('../services/checkBudgetReminders');
      await checkBudgetReminders();
      res.json({ 
        success: true, 
        message: 'Verificación de recordatorios completada. Revisa los logs del servidor para ver los resultados.' 
      });
    } catch (error) {
      console.error('Error al verificar recordatorios:', error);
      res.status(500).json({ 
        error: true, 
        message: 'Error al verificar recordatorios',
        details: error.message 
      });
    }
  }
);

// 🆕 Archivar presupuestos antiguos manualmente
router.post(
  '/archive-old',
  verifyToken,
  allowRoles(['admin', 'owner']), // Solo admin y owner
  async (req, res) => {
    try {
      const { archiveBudgets } = require('../tasks/cronJobs');
      await archiveBudgets();
      res.json({ 
        success: true, 
        message: 'Presupuestos archivados correctamente' 
      });
    } catch (error) {
      console.error('Error al archivar presupuestos:', error);
      res.status(500).json({ 
        error: true, 
        message: 'Error al archivar presupuestos',
        details: error.message 
      });
    }
  }
);

// // ✅ RUTA DE DIAGNÓSTICO SMTP
// router.get('/diagnostic/email', verifyToken, isOwner, BudgetController.diagnoseEmail); // Solo el owner puede hacer diagnósticos

// 🔍 RUTA DE DIAGNÓSTICO: Ver todos los estados existentes
router.get('/diagnostic/statuses', verifyToken, allowRoles(['admin', 'owner']), BudgetController.diagnoseStatuses);

module.exports = router;
