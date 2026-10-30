const express = require('express');
const router = express.Router();
const { getBase, geocode, matrix, setLocation } = require('../controllers/mapController');
const { allowRoles } = require('../middleware/byRol');

// verifyToken se aplica globalmente en routes/index.js
// 🗺️ Mapas de trabajos (zona de mapas y calendario de asignaciones)
router.get('/base', allowRoles(['owner', 'admin', 'recept', 'finance', 'worker', 'capataz']), getBase);
router.post('/geocode', allowRoles(['owner', 'admin', 'recept', 'finance', 'worker', 'capataz']), geocode);
router.post('/matrix', allowRoles(['owner', 'admin', 'recept', 'finance', 'worker', 'capataz']), matrix);
router.put('/location', allowRoles(['owner', 'admin', 'recept', 'capataz']), setLocation);

module.exports = router;
