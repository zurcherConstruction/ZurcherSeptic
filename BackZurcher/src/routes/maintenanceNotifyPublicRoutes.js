'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/maintenanceNotifyController');

// Rutas PÚBLICAS — sin autenticación (accesadas desde links de email al cliente)

// GET /api/maintenance-notify/confirm/:token
router.get('/confirm/:token', ctrl.confirmVisit);

// GET /api/maintenance-notify/reject/:token
router.get('/reject/:token', ctrl.rejectVisit);

// POST /api/maintenance-notify/reschedule/:token  — body: { proposedDate: 'YYYY-MM-DD' }
router.post('/reschedule/:token', ctrl.rescheduleVisit);

module.exports = router;
