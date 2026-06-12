const { Router } = require('express');
const FinalInvoiceController = require('../controllers/FinalInvoiceController');
const upload = require('../middleware/multer'); // Si necesitas subir archivos para PDF o pagos
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol');
const { checkGoogleReviewReminders } = require('../services/checkGoogleReviewReminders');

const router = Router();

// Crear factura final para una obra
router.post('/work/:workId/final-invoice', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.createFinalInvoice);

// Obtener factura final por ID de obra
router.get('/work/:workId/final-invoice', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.getFinalInvoiceByWorkId);

// Añadir item extra a una factura final
router.post('/:finalInvoiceId/items', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.addExtraItem);

// Actualizar item extra (Pendiente)
router.put('/items/:itemId', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.updateExtraItem);

// Eliminar item extra (Pendiente)
router.delete('/items/:itemId', verifyToken, allowRoles(['admin', 'owner']), FinalInvoiceController.removeExtraItem);

// Actualizar estado de la factura final (Pendiente)
router.patch('/:finalInvoiceId/status', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.updateFinalInvoiceStatus);

// 🆕 Actualizar descuento de la factura final
router.patch('/:finalInvoiceId/discount', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.updateDiscount);

// Generar/Obtener PDF de la factura final (Pendiente)
router.get('/:finalInvoiceId/pdf', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.generateFinalInvoicePDF);

router.get('/:finalInvoiceId/pdf/view', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.viewFinalInvoicePDF); // NUEVO
router.get('/:finalInvoiceId/preview-pdf', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.previewFinalInvoicePDF); // NUEVO

// Descargar PDF
router.get('/:finalInvoiceId/pdf/download', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.downloadFinalInvoicePDF); // NUEVO

// --- Ruta Email ---
router.post('/:finalInvoiceId/email', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance']), FinalInvoiceController.emailFinalInvoicePDF); // NUEVO

// --- Confirmación manual de Google Review (follow-up/owner/admin) ---
router.post('/work/:workId/google-review/confirm', verifyToken, allowRoles(['admin', 'owner', 'finance', 'follow-up']), FinalInvoiceController.confirmGoogleReview);

// --- Trigger manual para recordatorios de Google Review ---
router.post('/google-review/reminders/run', verifyToken, allowRoles(['admin', 'owner', 'finance', 'follow-up']), async (req, res) => {
	try {
		const olderThanDays = req.body?.olderThanDays;
		const lookbackDays = req.body?.lookbackDays;
		const dryRun = req.body?.dryRun === true;

		const result = await checkGoogleReviewReminders({ olderThanDays, lookbackDays, dryRun });
		res.status(200).json({ success: true, result });
	} catch (error) {
		console.error('[FinalInvoiceRoutes] Error running Google Review reminders:', error);
		res.status(500).json({ success: false, message: 'Error ejecutando recordatorios de Google Review', error: error.message });
	}
});


module.exports = router;