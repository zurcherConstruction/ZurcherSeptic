const express = require('express');
const MaintenanceController = require('../controllers/MaintenanceController');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol')
const { upload } = require('../middleware/multer'); // Tu config de Multer

const router = express.Router();

// Programar visitas de mantenimiento manualmente
router.post('/work/:workId/schedule', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'maintenance']), // Solo admin, owner y maintenance pueden programar visitas
    MaintenanceController.scheduleMaintenanceVisits
);

// Inicializar mantenimiento histórico para obras antiguas
router.post('/work/:workId/initialize-historical', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'maintenance']), // Solo admin, owner y maintenance pueden inicializar mantenimiento histórico
    MaintenanceController.initializeHistoricalMaintenance
);

// Crear una visita individual de mantenimiento
router.post('/work/:workId/visit', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'maintenance']), // Solo admin, owner y maintenance pueden crear visitas
    MaintenanceController.createMaintenanceVisit
);

// Obtener todas las visitas de mantenimiento para una obra específica
router.get('/work/:workId', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'finance', 'finance-viewer', 'capataz']),
    MaintenanceController.getMaintenanceVisitsForWork
);

// ⭐ Obtener detalles completos de una visita específica (incluyendo mediaFiles)
router.get('/:visitId/details', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']),
    MaintenanceController.getMaintenanceVisitDetails
);

// Actualizar una visita de mantenimiento (registrar fecha, notas, estado)
router.put('/:visitId', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']), // Ajusta roles
    MaintenanceController.updateMaintenanceVisit
);

// ⭐ Subir imagen individual en background (autoguardado progresivo)
router.post('/:visitId/upload-image',
    verifyToken,
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']),
    upload.array('maintenanceFiles', 5), // Hasta 5 imágenes por request
    MaintenanceController.uploadMaintenanceImage
);

// Añadir media a una visita de mantenimiento
router.post('/:visitId/media', 
    verifyToken, 
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']), // Ajusta roles
    upload.array('maintenanceFiles', 10), // 'maintenanceFiles' es el fieldname, permite hasta 10 archivos
    MaintenanceController.addMediaToMaintenanceVisit
);

// Eliminar un archivo multimedia de una visita
router.delete('/media/:mediaId',
    verifyToken,
    allowRoles(['admin', 'owner', 'maintenance', 'worker', 'capataz']), // Permitir que workers eliminen sus propias fotos
    MaintenanceController.deleteMaintenanceMedia
);

// ⭐ Obtener mantenimientos asignados a un worker (usado por la app móvil)
router.get('/assigned',
    verifyToken,
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']),
    MaintenanceController.getAssignedMaintenances
);

// ⭐ Obtener todas las visitas completadas (para Owner/Admin)
router.get('/completed',
    verifyToken,
    allowRoles(['admin', 'owner', 'maintenance', 'capataz']),
    MaintenanceController.getAllCompletedMaintenances
);

// ⭐ Generar token de corta duración para acceso al formulario web
router.post('/:visitId/generate-token',
    verifyToken,
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']),
    MaintenanceController.generateMaintenanceToken
);

// ⭐ Completar formulario de mantenimiento (multipart con archivos)
router.post('/:visitId/complete',
    verifyToken,
    allowRoles(['admin', 'owner', 'worker', 'maintenance', 'capataz']),
    upload.fields([
        { name: 'maintenanceFiles', maxCount: 20 }, // Archivos generales de la inspección
        { name: 'wellSample1', maxCount: 1 },       // Muestra 1 PBTS/ATU
        { name: 'wellSample2', maxCount: 1 },       // Muestra 2 PBTS/ATU
        { name: 'wellSample3', maxCount: 1 },       // Muestra 3 PBTS/ATU
        { name: 'systemVideo', maxCount: 1 },       // Video general del sistema
        { name: 'finalSystemImage', maxCount: 1 }   // 🆕 Imagen final del sistema completo (OBLIGATORIA)
    ]),
    MaintenanceController.completeMaintenanceVisit
);

// 📄 Descargar PDF de visita de mantenimiento completada
router.get('/:visitId/download-pdf',
    verifyToken,
    allowRoles(['admin', 'owner', 'maintenance', 'worker', 'capataz']),
    MaintenanceController.downloadMaintenancePDF
);

// 🚫 Cancelar visita por cliente (no quiere mantenimiento)
router.post('/:visitId/cancel-by-client',
    verifyToken,
    allowRoles(['admin', 'owner', 'maintenance', 'worker', 'capataz']),
    MaintenanceController.cancelMaintenanceByClient
);

// 📅 Postergar visita por cliente ausente
router.post('/:visitId/postpone-no-access',
    verifyToken,
    allowRoles(['admin', 'owner', 'maintenance', 'worker', 'capataz']),
    MaintenanceController.postponeMaintenanceNoAccess
);

// 🚫 Cancelar visita por otros motivos
router.post('/:visitId/cancel-other',
    verifyToken,
    allowRoles(['admin', 'owner', 'maintenance', 'worker', 'capataz']),
    MaintenanceController.cancelMaintenanceOther
);

module.exports = router;