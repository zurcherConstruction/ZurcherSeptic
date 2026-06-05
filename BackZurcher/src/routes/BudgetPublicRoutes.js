const express = require('express');
const BudgetController = require('../controllers/BudgetController');
const router = express.Router();

// ========== RUTAS PÚBLICAS DE PRESUPUESTOS (SIN AUTENTICACIÓN) ==========
// Estas rutas permiten a los clientes revisar y responder a presupuestos
// usando un token de revisión único

/**
 * Obtener detalles del presupuesto para revisión (público con token)
 * GET /api/budgets/:idBudget/review/:reviewToken
 */
router.get(
  '/:idBudget/review/:reviewToken',
  BudgetController.getBudgetForReview
);

/**
 * Ver PDF del presupuesto (público con token)
 * GET /api/budgets/:idBudget/view-pdf/:reviewToken
 */
router.get(
  '/:idBudget/view-pdf/:reviewToken',
  BudgetController.viewBudgetPDFPublic
);

/**
 * Cliente aprueba el presupuesto (endpoint público con token en URL)
 * POST /api/budgets/:idBudget/approve-review/:reviewToken
 */
router.post(
  '/:idBudget/approve-review/:reviewToken',
  BudgetController.approveReview
);

/**
 * Cliente rechaza el presupuesto (endpoint público con token en URL)
 * POST /api/budgets/:idBudget/reject-review/:reviewToken
 */
router.post(
  '/:idBudget/reject-review/:reviewToken',
  BudgetController.rejectReview
);

/**
 * ✅ NUEVO: Generar enlace de firma on-demand y redirigir a DocuSign
 * GET /api/budgets/:idBudget/sign
 * Público (sin autenticación) para usar en correos al cliente
 */
router.get(
  '/:idBudget/sign',
  BudgetController.getSigningLinkAndRedirect
);

/**
 * Ver recibo Stripe renderizado dentro del modal/iframe.
 * Público para que el navegador pueda cargarlo sin enviar Authorization header.
 */
router.get(
  '/:idBudget/stripe-receipt/view',
  BudgetController.viewStripeReceipt
);

/**
 * Descargar comprobante de pago (manual o Stripe) sin usar Cloudinary directamente.
 */
router.get(
  '/:idBudget/payment-receipt/download',
  BudgetController.downloadPaymentReceipt
);

/**
 * Ver comprobante manual de pago en el modal/iframe sin forzar descarga.
 */
router.get(
  '/:idBudget/payment-receipt/view',
  BudgetController.viewPaymentReceipt
);

module.exports = router;
