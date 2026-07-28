const express = require('express');
const router = express.Router();
const { exportWorksToExcel, exportFixedExpensesToExcel } = require('../controllers/exportController');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol');

// Exportar works a Excel
// Query params: status, applicantEmail
router.get(
  '/works',
  verifyToken,
  allowRoles(['admin', 'owner', 'worker', 'finance', 'finance-viewer']),
  exportWorksToExcel
);

// Exportar gastos fijos a Excel por rango de períodos
// Query params: from=YYYY-MM, to=YYYY-MM
router.get(
  '/fixed-expenses',
  verifyToken,
  allowRoles(['admin', 'owner', 'finance', 'finance-viewer']),
  exportFixedExpensesToExcel
);

module.exports = router;
