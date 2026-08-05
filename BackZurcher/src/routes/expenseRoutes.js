const express = require('express');
const router = express.Router();
const { 
  createExpense, 
  getAllExpenses, 
  getExpenseById, 
  updateExpense, 
  deleteExpense, 
  getExpenseTypes,
  getUnpaidExpenses,
  getExpensesByPaymentStatus,
  createGeneralExpenseWithReceipt,
  getMyExpenses
} = require('../controllers/expenseController');
const { upload } = require('../middleware/multer');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol');

// Ruta para obtener tipos de gasto (debe ir antes de /:id)
router.get('/types', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'finance-viewer', 'worker']), getExpenseTypes);

// 📱 Ruta para obtener gastos del usuario logueado (app móvil)
router.get('/my', verifyToken, allowRoles(['worker', 'maintenance', 'admin', 'owner']), getMyExpenses);

// 🆕 Ruta para crear gasto general con recibo (workers)
router.post('/general', verifyToken, allowRoles(['worker', 'admin', 'owner', 'capataz']), upload.single('receipt'), createGeneralExpenseWithReceipt);

// 🆕 Ruta para obtener gastos no pagados (para vincular con invoices)
router.get('/unpaid', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'finance-viewer']), getUnpaidExpenses);

// 🆕 Ruta para obtener gastos por estado de pago
router.get('/by-status/:status', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'finance-viewer']), getExpensesByPaymentStatus);

router.post('/', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'worker', 'maintenance']), upload.single('file'), createExpense);
router.get('/', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'finance-viewer', 'worker']), getAllExpenses);
router.get('/:id', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'finance-viewer', 'worker']), getExpenseById);
router.put('/:id', verifyToken, allowRoles(['admin', 'recept', 'owner', 'finance', 'worker']), updateExpense);
router.delete('/:id', verifyToken, allowRoles(['admin', 'owner', 'finance']), deleteExpense);

module.exports = router;