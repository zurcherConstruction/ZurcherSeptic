const express = require('express');
const router = express.Router();
const multer = require('multer');
const SimpleWorkController = require('../controllers/SimpleWorkController');
const SimpleWorkPaymentController = require('../controllers/SimpleWorkPaymentController'); // 🆕
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol'); // 🆕

// Configurar multer para archivos en memoria (imágenes, videos y PDFs)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB para videos
  },
  fileFilter: (req, file, cb) => {
    // Permitir imágenes, videos y PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|mov|avi|mkv|webm/;
    const extension = file.originalname.toLowerCase().split('.').pop();
    const extname = allowedTypes.test(extension);
    const mimetype = /image\/(jpeg|jpg|png|gif)|application\/pdf|video\/(mp4|quicktime|x-msvideo|x-matroska|webm)/.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF), videos (MP4, MOV, AVI, MKV, WEBM) y PDFs'));
    }
  }
});

/**
 * Rutas para SimpleWork - Trabajos varios
 * Todas las rutas requieren autenticación
 */

// 🔍 GET /api/simple-works/assigned - Obtener trabajos asignados al staff autenticado (app móvil)
router.get('/assigned', verifyToken, allowRoles(['owner', 'worker', 'maintenance', 'admin', 'capataz']), SimpleWorkController.getAssignedSimpleWorks);

// ✅ POST /approve/:token ahora está en simpleWorkPublicRoutes.js (montada antes de verifyToken)

// 🔍 GET /api/simple-works - Obtener todos los trabajos con filtros
router.get('/', verifyToken, SimpleWorkController.getAllSimpleWorks);

// 📊 GET /api/simple-works/summary - Resumen financiero
router.get('/summary', verifyToken, SimpleWorkController.getFinancialSummary);

// 🔗 GET /api/simple-works/link-works - Works disponibles para vinculación
router.get('/link-works', verifyToken, SimpleWorkController.getWorksForLinking);

// 📎 POST /simple-works/temp-attachments - Subir archivo temporal (durante creación)
router.post('/temp-attachments', verifyToken, upload.single('file'), SimpleWorkController.uploadTempAttachment);

// 🗑️ DELETE /simple-works/temp-attachments/:attachmentId - Eliminar archivo temporal  
router.delete('/temp-attachments/:attachmentId', verifyToken, SimpleWorkController.deleteTempAttachment);

// 🆕 POST /api/simple-works - Crear nuevo trabajo simple
router.post('/', verifyToken, SimpleWorkController.createSimpleWork);

// 🔍 GET /api/simple-works/:id - Obtener trabajo por ID
router.get('/:id', verifyToken, SimpleWorkController.getSimpleWorkById);

// 📄 GET /api/simple-works/:id/pdf - Generar PDF del presupuesto
router.get('/:id/pdf', verifyToken, SimpleWorkController.generateSimpleWorkPDF);

// 👁️ GET /api/simple-works/:id/view-pdf - Vista previa del PDF (inline)
router.get('/:id/view-pdf', verifyToken, SimpleWorkController.viewSimpleWorkPDF);

// ✏️ PUT /api/simple-works/:id - Actualizar trabajo completo
router.put('/:id', verifyToken, SimpleWorkController.updateSimpleWork);

// ✏️ PATCH /api/simple-works/:id - Actualizar campos específicos del trabajo
router.patch('/:id', verifyToken, SimpleWorkController.updateSimpleWork);

// 🗑️ DELETE /api/simple-works/:id - Eliminar trabajo
router.delete('/:id', verifyToken, SimpleWorkController.deleteSimpleWork);

// 💰 POST /api/simple-works/:id/payments - Agregar pago
router.post('/:id/payments', verifyToken, SimpleWorkController.addPayment);

// 🗑️ DELETE /api/simple-works/:id/payment/:paymentId - Eliminar pago
router.delete('/:id/payment/:paymentId', verifyToken, SimpleWorkController.deletePayment);

// 🆕 💳 POST /api/simple-works/:id/payments/financial - Registrar pago con integración financiera completa
router.post('/:id/payments/financial', 
  verifyToken, 
  allowRoles(['admin', 'owner', 'finance', 'recept']),
  upload.single('receipt'), 
  SimpleWorkPaymentController.createPayment
);

// 🆕 📋 GET /api/simple-works/:id/payments/financial - Obtener historial de pagos financieros
router.get('/:id/payments/financial', 
  verifyToken, 
  allowRoles(['admin', 'owner', 'finance', 'finance-viewer', 'recept']),
  SimpleWorkPaymentController.getPayments
);

// 💸 POST /api/simple-works/:id/expenses - Agregar gasto
router.post('/:id/expenses', verifyToken, SimpleWorkController.addExpense);

// 🗑️ DELETE /api/simple-works/:id/expense/:expenseId - Eliminar gasto
router.delete('/:id/expense/:expenseId', verifyToken, SimpleWorkController.deleteExpense);

// 📎 POST /api/simple-works/:id/attachments - Subir archivo adjunto (planos, documentos)
router.post('/:id/attachments', verifyToken, upload.single('file'), SimpleWorkController.uploadAttachment);

// 🗑️ DELETE /api/simple-works/:id/attachments/:attachmentId - Eliminar archivo adjunto
router.delete('/:id/attachments/:attachmentId', verifyToken, SimpleWorkController.deleteAttachment);

// � POST /api/simple-works/:id/images - Subir imagen de trabajo o finalización
router.post('/:id/images', verifyToken, upload.single('image'), SimpleWorkController.uploadImage);

// 🗑️ DELETE /api/simple-works/:id/images/:imageId - Eliminar imagen
router.delete('/:id/images/:imageId', verifyToken, SimpleWorkController.deleteImage);

// �📧 POST /api/simple-works/:id/send-email - Enviar SimpleWork por email al cliente
router.post('/:id/send-email', verifyToken, SimpleWorkController.sendSimpleWorkToClient);

// ✅ PATCH /api/simple-works/:id/complete - Marcar SimpleWork como completado
router.patch('/:id/complete', verifyToken, SimpleWorkController.markAsCompleted);

// ✅ PATCH /api/simple-works/:id/approve - Aprobar SimpleWork manualmente (admin/owner/recept)
router.patch('/:id/approve', verifyToken, allowRoles(['admin', 'owner', 'recept']), SimpleWorkController.approveSimpleWorkManually);

module.exports = router;