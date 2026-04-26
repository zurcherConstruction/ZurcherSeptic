const express = require('express');
const router = express.Router();
const multer = require('multer');
const FleetController = require('../controllers/FleetController');
const { verifyToken } = require('../middleware/isAuth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (allowedTypes.test(extension)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WEBP)'));
  },
});

router.use(verifyToken);

// ─── Stats ───────────────────────────────────────────────
router.get('/stats', FleetController.getFleetStats);

// ─── Assets ──────────────────────────────────────────────
router.get('/', FleetController.getAllAssets);
router.post('/', FleetController.createAsset);
router.get('/:id', FleetController.getAssetById);
router.put('/:id', FleetController.updateAsset);
router.patch('/:id', FleetController.updateAsset);
router.delete('/:id', FleetController.deleteAsset);

// Subir imagen del activo
router.post('/:id/image', upload.single('image'), FleetController.uploadAssetImage);

// ─── Mileage / Hours Logs ────────────────────────────────
router.post('/:id/mileage', FleetController.logMileage);
router.get('/:id/mileage', FleetController.getMileageLogs);

// ─── Maintenance ─────────────────────────────────────────
router.get('/:id/maintenance', FleetController.getMaintenanceByAsset);
router.post('/:id/maintenance', FleetController.createMaintenance);
router.put('/:id/maintenance/:maintenanceId', FleetController.updateMaintenance);
router.patch('/:id/maintenance/:maintenanceId', FleetController.updateMaintenance);
router.delete('/:id/maintenance/:maintenanceId', FleetController.deleteMaintenance);
router.post('/:id/maintenance/:maintenanceId/attachment', upload.single('image'), FleetController.uploadMaintenanceAttachment);

module.exports = router;
