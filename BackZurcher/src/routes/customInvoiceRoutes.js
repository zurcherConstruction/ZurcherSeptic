const express = require('express');
const router = express.Router();
const { allowRoles } = require('../middleware/byRol');
const {
  createInvoice,
  createPumpOutInvoice,
  listMyPumpOutInvoices,
  listInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  generatePdf,
  downloadPdf,
  sendInvoice,
  sendForSignature,
  createPaymentLink,
  clearPaymentLink,
  markAsPaid,
  getInvoicesByWork,
  getInvoicesBySimpleWork,
  getAvailableYears,
} = require('../controllers/CustomInvoiceController');

const INVOICE_ROLES = ['admin', 'owner', 'finance'];

router.get('/available-years', allowRoles(INVOICE_ROLES), getAvailableYears);
// Linked by Work or SimpleWork — must be before /:id to avoid param conflict
router.get('/by-work/:workId', allowRoles(INVOICE_ROLES), getInvoicesByWork);
router.get('/by-simple-work/:simpleWorkId', allowRoles(INVOICE_ROLES), getInvoicesBySimpleWork);
router.get('/', allowRoles(INVOICE_ROLES), listInvoices);
router.post('/', allowRoles(INVOICE_ROLES), createInvoice);
// 🚽 Pump-Out / Desagote — creado desde la app móvil por rol contractor
// El GET /pump-out/mine debe ir antes de /:id para no ser interceptado por ese param route.
router.get('/pump-out/mine', allowRoles([...INVOICE_ROLES, 'contractor']), listMyPumpOutInvoices);
router.post('/pump-out', allowRoles([...INVOICE_ROLES, 'contractor']), createPumpOutInvoice);
router.get('/:id', allowRoles(INVOICE_ROLES), getInvoice);
router.put('/:id', allowRoles(INVOICE_ROLES), updateInvoice);
router.delete('/:id', allowRoles(INVOICE_ROLES), deleteInvoice);
router.post('/:id/generate-pdf', allowRoles(INVOICE_ROLES), generatePdf);
router.get('/:id/download', allowRoles(INVOICE_ROLES), downloadPdf);
router.post('/:id/send', allowRoles(INVOICE_ROLES), sendInvoice);
router.post('/:id/send-for-signature', allowRoles(INVOICE_ROLES), sendForSignature);
router.post('/:id/create-payment-link', allowRoles(INVOICE_ROLES), createPaymentLink);
router.delete('/:id/payment-link', allowRoles(INVOICE_ROLES), clearPaymentLink);
router.post('/:id/mark-paid', allowRoles(INVOICE_ROLES), markAsPaid);

module.exports = router;
