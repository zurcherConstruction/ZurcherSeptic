const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Configuración para manejar datos en memoria
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol');
const {
  createSupplierInvoice,
  getSupplierInvoices,
  getSupplierInvoiceById,
  registerPayment,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  getAccountsPayable,
  getPaymentHistory,
  uploadInvoicePdf,
  distributeInvoiceToWorks,
  paySupplierInvoice, // 🆕 NUEVO
  getVendorsSummary, // 🆕 NUEVO
  createSimpleSupplierInvoice, // 🆕 NUEVO formulario simplificado
  getVendorsList, // 🆕 NUEVO lista de vendors para autocomplete
  createCreditCardTransaction, // 💳 NUEVO transacciones de tarjeta
  reverseCreditCardPayment, // 🔄 NUEVO revertir pagos de Chase
  getCreditCardBalance, // 💳 NUEVO balance de tarjeta
  createAmexTransaction, // 💳 NUEVO transacciones AMEX
  reverseAmexPayment, // 🔄 NUEVO revertir pagos de AMEX
  getAmexBalance, // 💳 NUEVO balance AMEX
  getInvoicesByWorkId, // 🆕 NUEVO obtener invoices por work
  verifyInvoice,
} = require('../controllers/supplierInvoiceController');

// Middleware de autenticación (ajusta según tu implementación)
// const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/supplier-invoices/accounts-payable
 * @desc    Obtener todas las cuentas por pagar (invoices pendientes)
 * @access  Private
 */
router.get('/accounts-payable', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getAccountsPayable);

/**
 * 🆕 @route   GET /api/supplier-invoices/vendors/summary
 * @desc    Obtener resumen de proveedores con totales pendientes agrupados
 * @access  Private
 */
router.get('/vendors/summary', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getVendorsSummary);

/**
 * 🆕 @route   GET /api/supplier-invoices/vendors/list
 * @desc    Obtener lista de vendors únicos para autocomplete
 * @access  Private
 */
router.get('/vendors/list', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getVendorsList);

/**
 * 💳 @route   GET /api/supplier-invoices/credit-card/balance
 * @desc    Obtener balance actual y transacciones de Chase Credit Card
 * @access  Private
 */
router.get('/credit-card/balance', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getCreditCardBalance);

/**
 * 💳 @route   POST /api/supplier-invoices/credit-card/transaction
 * @desc    Crear una transacción de tarjeta de crédito Chase (cargo, pago o interés)
 * @body    { transactionType, amount, date, description, invoiceNumber, paymentMethod?, paymentDetails? }
 * @access  Private
 */
router.post('/credit-card/transaction', allowRoles(['admin', 'owner', 'finance']), upload.single('receipt'), createCreditCardTransaction);

/**
 * 🔄 @route   DELETE /api/supplier-invoices/credit-card/payment/:paymentId
 * @desc    Revertir un pago de tarjeta Chase (deshace el pago y restaura los expenses)
 * @params  paymentId - ID del registro de pago en SupplierInvoice
 * @access  Private
 */
router.delete('/credit-card/payment/:paymentId', allowRoles(['admin', 'owner', 'finance']), reverseCreditCardPayment);

/**
 * 💳 @route   GET /api/supplier-invoices/amex/balance
 * @desc    Obtener balance actual y transacciones de AMEX
 * @access  Private
 */
router.get('/amex/balance', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getAmexBalance);

/**
 * 💳 @route   POST /api/supplier-invoices/amex/transaction
 * @desc    Crear una transacción de AMEX (cargo, pago o interés)
 * @body    { transactionType, amount, date, description, invoiceNumber, paymentMethod?, paymentDetails? }
 * @access  Private
 */
router.post('/amex/transaction', allowRoles(['admin', 'owner', 'finance']), upload.single('receipt'), createAmexTransaction);

/**
 * 🔄 @route   DELETE /api/supplier-invoices/amex/payment/:paymentId
 * @desc    Revertir un pago de AMEX (deshace el pago y restaura los expenses)
 * @params  paymentId - ID del registro de pago en SupplierInvoice
 * @access  Private
 */
router.delete('/amex/payment/:paymentId', allowRoles(['admin', 'owner', 'finance']), reverseAmexPayment);

/**
 * @route   GET /api/supplier-invoices/payment-history
 * @desc    Obtener historial de pagos realizados
 * @query   startDate, endDate, vendor
 * @access  Private
 */
router.get('/payment-history', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getPaymentHistory);

/**
 * 🆕 @route   GET /api/supplier-invoices/work/:workId
 * @desc    Obtener todos los invoices vinculados a un work específico
 * @params  workId - ID del work
 * @access  Private
 */
router.get('/work/:workId', allowRoles(['admin', 'owner', 'finance', 'finance-viewer', 'worker']), getInvoicesByWorkId);

/**
 * @route   POST /api/supplier-invoices
 * @desc    Crear un nuevo invoice de proveedor
 * @body    { invoiceNumber, vendor, issueDate, dueDate, items, notes }
 * @access  Private
 */
router.post('/', allowRoles(['admin', 'owner', 'finance']), createSupplierInvoice);

/**
 * 🆕 @route   POST /api/supplier-invoices/simple
 * @desc    Crear un nuevo invoice SIMPLIFICADO (sin items, solo invoice + comprobante)
 * @body    FormData con invoiceNumber, vendor, issueDate, dueDate, totalAmount, notes, invoiceFile (archivo)
 * @access  Private
 */
router.post('/simple', allowRoles(['admin', 'owner', 'finance']), upload.single('invoiceFile'), createSimpleSupplierInvoice);

/**
 * @route   GET /api/supplier-invoices
 * @desc    Obtener todos los invoices con filtros opcionales
 * @query   status, vendor, startDate, endDate, includeItems
 * @access  Private
 */
router.get('/', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getSupplierInvoices);

/**
 * @route   GET /api/supplier-invoices/:id
 * @desc    Obtener un invoice específico por ID con todos sus detalles
 * @access  Private
 */
router.get('/:id', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getSupplierInvoiceById);

/**
 * @route   PATCH /api/supplier-invoices/:id/pay
 * @desc    Registrar un pago para un invoice
 * @body    { paymentMethod, paymentDate, paidAmount, paymentDetails }
 * @access  Private
 */
router.patch('/:id/pay', registerPayment);
router.patch('/:id/verify', allowRoles(['admin', 'owner', 'finance']), verifyInvoice);

/**
 * @route   POST /api/supplier-invoices/:id/upload-invoice
 * @desc    Subir PDF o imagen del invoice a Cloudinary
 * @body    FormData con file (PDF, JPG, PNG, WEBP)
 * @access  Private
 */
router.post('/:id/upload-invoice', upload.single('file'), uploadInvoicePdf);

/**
 * @route   POST /api/supplier-invoices/:id/distribute
 * @desc    Distribuir invoice entre múltiples trabajos y crear expenses automáticamente
 * @body    FormData con distribution (JSON string), paymentMethod, paymentDate, referenceNumber, receipt (file opcional)
 * @access  Private
 */
router.post('/:id/distribute', upload.single('receipt'), distributeInvoiceToWorks);

/**
 * 🆕 @route   POST /api/supplier-invoices/:id/pay-v2
 * @desc    Pagar invoice con 3 opciones: vincular a expenses existentes, crear con works, o crear general
 * @body    FormData con paymentType, paymentMethod, paymentDate, paymentDetails, receipt (file opcional), expenseIds[], workIds[], distribution[]
 * @access  Private
 */
router.post('/:id/pay-v2', upload.single('receipt'), paySupplierInvoice);

/**
 * @route   PUT /api/supplier-invoices/:id
 * @desc    Actualizar un invoice existente
 * @body    FormData con invoiceNumber, vendor, issueDate, totalAmount, dueDate, notes, linkedWorks, invoiceFile (opcional)
 * @access  Private
 */
router.put('/:id', upload.single('invoiceFile'), updateSupplierInvoice);

/**
 * @route   DELETE /api/supplier-invoices/:id
 * @desc    Eliminar un invoice (solo si no está pagado)
 * @access  Private
 */
router.delete('/:id', deleteSupplierInvoice);

module.exports = router;
