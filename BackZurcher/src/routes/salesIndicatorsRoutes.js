const express = require('express');
const router  = express.Router();
const { allowRoles } = require('../middleware/byRol');
const { getMonthlySalesIndicators, getAvailableYears } = require('../controllers/SalesIndicatorsController');

router.get('/monthly',         allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getMonthlySalesIndicators);
router.get('/available-years', allowRoles(['admin', 'owner', 'finance', 'finance-viewer']), getAvailableYears);

module.exports = router;
