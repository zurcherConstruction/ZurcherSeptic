const express = require('express');
const router = express.Router();
const multer = require('multer');
const QuoteRequestController = require('../controllers/QuoteRequestController');
const { verifyToken } = require('../middleware/isAuth');
const { allowRoles } = require('../middleware/byRol');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp|heic)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  },
});

// GET /api/quote-requests — admin/owner/recept
router.get('/', verifyToken, allowRoles(['owner', 'admin', 'recept']), QuoteRequestController.getAll);

// GET /api/quote-requests/:id
router.get('/:id', verifyToken, allowRoles(['owner', 'admin', 'recept']), QuoteRequestController.getById);

// POST /api/quote-requests — workers/capataz can create
router.post('/', verifyToken, allowRoles(['owner', 'admin', 'recept', 'worker', 'capataz', 'maintenance', 'contractor']), QuoteRequestController.create);

// PATCH /api/quote-requests/:id — admin/owner update status, notes, link
router.patch('/:id', verifyToken, allowRoles(['owner', 'admin', 'recept', 'worker', 'capataz', 'maintenance', 'contractor']), QuoteRequestController.update);

// POST /api/quote-requests/:id/photos — upload photos
router.post('/:id/photos', verifyToken, allowRoles(['owner', 'admin', 'recept', 'worker', 'capataz', 'maintenance', 'contractor']), upload.array('photos', 10), QuoteRequestController.uploadPhotos);

// DELETE /api/quote-requests/:id/photos/:publicId
router.delete('/:id/photos/:publicId', verifyToken, allowRoles(['owner', 'admin', 'recept', 'worker', 'capataz', 'maintenance', 'contractor']), QuoteRequestController.deletePhoto);

// DELETE /api/quote-requests/:id
router.delete('/:id', verifyToken, allowRoles(['owner', 'admin']), QuoteRequestController.remove);

module.exports = router;
