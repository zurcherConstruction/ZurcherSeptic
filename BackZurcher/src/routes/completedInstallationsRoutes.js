const express = require('express');
const router = express.Router();
const { getCompletedInstallations, getAvailableYears } = require('../controllers/completedInstallationsController');

router.get('/', getCompletedInstallations);
router.get('/available-years', getAvailableYears);

module.exports = router;
