const express = require('express');
const router = express.Router();
const { allowRoles } = require('../middleware/byRol');
const { getActivitySummary, getStaffDetail } = require('../controllers/StaffActivityController');

router.get('/summary', allowRoles(['owner']), getActivitySummary);
router.get('/:staffId', allowRoles(['owner']), getStaffDetail);

module.exports = router;
