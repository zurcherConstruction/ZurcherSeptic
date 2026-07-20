const express = require('express');
const router = express.Router();
const { allowRoles } = require('../middleware/byRol');
const {
  createInvoice,
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
  getAvailableYears,
} = require('../controllers/CustomInvoiceController');

const INVOICE_ROLES = ['admin', 'owner', 'finance'];

router.get('/available-years', allowRoles(INVOICE_ROLES), getAvailableYears);
router.get('/', allowRoles(INVOICE_ROLES), listInvoices);
router.post('/', allowRoles(INVOICE_ROLES), createInvoice);
router.get('/:id', allowRoles(INVOICE_ROLES), getInvoice);
router.put('/:id', allowRoles(INVOICE_ROLES), updateInvoice);
router.delete('/:id', allowRoles(INVOICE_ROLES), deleteInvoice);
router.post('/:id/generate-pdf', allowRoles(INVOICE_ROLES), generatePdf);
router.get('/:id/download', allowRoles(INVOICE_ROLES), downloadPdf);
router.post('/:id/send', allowRoles(INVOICE_ROLES), sendInvoice);
router.post('/:id/send-for-signature', allowRoles(INVOICE_ROLES), sendForSignature);
router.post('/:id/create-payment-link', allowRoles(INVOICE_ROLES), createPaymentLink);
router.delete('/:id/payment-link', allowRoles(INVOICE_ROLES), clearPaymentLink);

module.exports = router;
