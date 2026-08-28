const express = require('express');
const router = express.Router();
const { allowRoles } = require('../middleware/byRol');
const staffAttendanceController = require('../controllers/staffAttendanceController');

// Roles que pueden marcar asistencia (web + app móvil de campo)
const MARKERS = ['owner','capataz'];
// Roles que pueden ver reportes/resúmenes (solo web administrativo)
const REPORTERS = ['owner'];

// GET /api/staff-attendance/monthly - Obtener asistencias de un mes específico
router.get('/monthly', allowRoles(MARKERS), staffAttendanceController.getMonthlyAttendance);

// POST /api/staff-attendance/mark - Marcar/editar asistencia
router.post('/mark', allowRoles(MARKERS), staffAttendanceController.markAttendance);

// GET /api/staff-attendance/yearly-summary - Resumen anual por staff
router.get('/yearly-summary', allowRoles(REPORTERS), staffAttendanceController.getYearlySummary);

// GET /api/staff-attendance/available-years - Años disponibles
router.get('/available-years', allowRoles(REPORTERS), staffAttendanceController.getAvailableYears);

// DELETE /api/staff-attendance/:id - Eliminar registro de asistencia
router.delete('/:id', allowRoles(REPORTERS), staffAttendanceController.deleteAttendance);

module.exports = router;