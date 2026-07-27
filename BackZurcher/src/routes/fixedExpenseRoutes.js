const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Configuración básica de multer para FormData
const {
  createFixedExpense,
  getAllFixedExpenses,
  getFixedExpenseById,
  updateFixedExpense,
  deleteFixedExpense,
  toggleFixedExpenseStatus,
  getUpcomingFixedExpenses,
  generateExpenseFromFixed,
  getUnpaidFixedExpenses,
  getFixedExpensesByPaymentStatus,
  getMonthlySummary,
  getMonthlyChecklist
} = require('../controllers/fixedExpenseController');
const { getCronStatus } = require('../controllers/cronStatusController');

// 🆕 Controlador de pagos parciales
const {
  addPartialPayment,
  getPaymentHistory,
  deletePartialPayment,
  getPendingPaymentPeriods
} = require('../controllers/fixedExpensePaymentController');

// Middleware de autenticación (ajustar según tu sistema)
// const { isAuth } = require('../middleware/isAuth');

/**
 * @route   POST /api/fixed-expenses
 * @desc    Crear un nuevo gasto fijo
 * @access  Private
 */
router.post('/', createFixedExpense);

/**
 * @route   GET /api/fixed-expenses
 * @desc    Obtener todos los gastos fijos (con filtros opcionales)
 * @query   ?isActive=true&category=Renta&paymentMethod=Chase&search=internet
 * @access  Private
 */
router.get('/', getAllFixedExpenses);

/**
 * 🆕 @route   GET /api/fixed-expenses/cron-status
 * @desc    Verificar estado del CRON de auto-generación
 * @access  Private
 */
router.get('/cron-status', getCronStatus);

/**
 * 📊 @route   GET /api/fixed-expenses/monthly-summary
 * @desc    Obtener resumen mensual de gastos fijos para dashboard
 * @access  Private
 */
router.get('/monthly-summary', getMonthlySummary);

/**
 * 📋 @route   GET /api/fixed-expenses/monthly-checklist
 * @desc    Checklist mensual con estado de pago por gasto fijo
 * @query   ?month=YYYY-MM (default: mes actual)
 * @access  Private
 */
router.get('/monthly-checklist', getMonthlyChecklist);

/**
 * @route   GET /api/fixed-expenses/upcoming
 * @desc    Obtener gastos fijos próximos a vencer
 * @query   ?days=30
 * @access  Private
 */
router.get('/upcoming', getUpcomingFixedExpenses);

/**
 * 🆕 @route   GET /api/fixed-expenses/unpaid
 * @desc    Obtener gastos fijos no pagados (para vincular con invoices)
 * @query   ?vendor=&category=
 * @access  Private
 */
router.get('/unpaid', getUnpaidFixedExpenses);

/**
 * 🆕 @route   GET /api/fixed-expenses/by-status/:status
 * @desc    Obtener gastos fijos por estado de pago
 * @param   status - unpaid | paid | paid_via_invoice
 * @query   ?category=&vendor=
 * @access  Private
 */
router.get('/by-status/:status', getFixedExpensesByPaymentStatus);

/**
 * @route   GET /api/fixed-expenses/:id
 * @desc    Obtener un gasto fijo por ID
 * @access  Private
 */
router.get('/:id', getFixedExpenseById);

/**
 * @route   PATCH /api/fixed-expenses/:id
 * @desc    Actualizar un gasto fijo
 * @access  Private
 */
router.patch('/:id', updateFixedExpense);

/**
 * @route   DELETE /api/fixed-expenses/:id
 * @desc    Eliminar un gasto fijo
 * @access  Private
 */
router.delete('/:id', deleteFixedExpense);

/**
 * @route   PATCH /api/fixed-expenses/:id/toggle-status
 * @desc    Activar/Desactivar un gasto fijo
 * @access  Private
 */
router.patch('/:id/toggle-status', toggleFixedExpenseStatus);

/**
 * @route   POST /api/fixed-expenses/:id/generate-expense
 * @desc    Generar un Expense a partir de un Fixed Expense
 * @body    { paymentDate: '2025-10-09', notes: 'Opcional' }
 * @access  Private
 */
router.post('/:id/generate-expense', generateExpenseFromFixed);

// ============================================
// 🆕 RUTAS DE PAGOS PARCIALES
// ============================================

/**
 * 💰 @route   POST /api/fixed-expenses/:id/payments
 * @desc    Registrar un pago parcial (crea Expense automáticamente)
 * @body    { amount, paymentDate?, paymentMethod?, notes?, staffId? }
 * @files   receipt (opcional)
 * @access  Private
 */
router.post('/:id/payments', upload.single('receipt'), addPartialPayment);

/**
 * 📋 @route   GET /api/fixed-expenses/:id/payments
 * @desc    Obtener historial de pagos de un gasto fijo
 * @access  Private
 */
router.get('/:id/payments', getPaymentHistory);

/**
 * 🆕 📋 @route   GET /api/fixed-expenses/:id/pending-periods
 * @desc    Obtener períodos pendientes de pago (sin pagar)
 * @access  Private
 */
router.get('/:fixedExpenseId/pending-periods', getPendingPaymentPeriods);

module.exports = router;
