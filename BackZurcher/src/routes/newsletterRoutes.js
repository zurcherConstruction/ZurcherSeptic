const express = require('express');
const router = express.Router();
const multer = require('multer');
const newsletterController = require('../controllers/newsletterController');
const { verifyToken } = require('../middleware/isAuth');

// Configurar multer para manejar uploads en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // Límite de 5MB
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// ==================== RUTAS PÚBLICAS ====================
// Suscripción desde el sitio web (sin autenticación)
router.post('/subscribe', newsletterController.publicSubscribe);

// Desuscribirse desde email (GET público con HTML)
router.get('/public-unsubscribe/:id', newsletterController.publicUnsubscribe);

// Desuscribirse desde API (POST con JSON)
router.post('/unsubscribe/:id', newsletterController.unsubscribe);

// 📧 Tracking de aperturas (pixel invisible en emails)
router.get('/track-open/:recipientId', newsletterController.trackOpen);

// ==================== RUTAS PROTEGIDAS (SUBSCRIBERS) ====================
router.get('/subscribers', verifyToken, newsletterController.getAllSubscribers);
router.post('/subscribers', verifyToken, newsletterController.createSubscriber);
router.put('/subscribers/:id', verifyToken, newsletterController.updateSubscriber);
router.put('/subscribers/:id/unsubscribe', verifyToken, newsletterController.unsubscribeSubscriber);
router.delete('/subscribers/:id', verifyToken, newsletterController.deleteSubscriber);

// ==================== RUTAS PROTEGIDAS (TEMPLATES) ====================
router.get('/templates', verifyToken, newsletterController.getAllTemplates);
router.post('/templates', verifyToken, newsletterController.createTemplate);
router.put('/templates/:id', verifyToken, newsletterController.updateTemplate);
router.delete('/templates/:id', verifyToken, newsletterController.deleteTemplate);

// ==================== RUTAS PROTEGIDAS (NEWSLETTERS) ====================
router.get('/newsletters', verifyToken, newsletterController.getAllNewsletters);
router.get('/newsletters/:id', verifyToken, newsletterController.getNewsletterById);
router.get('/newsletters/:id/stats', verifyToken, newsletterController.getNewsletterStats);
router.post('/newsletters', verifyToken, newsletterController.createNewsletter);
router.put('/newsletters/:id', verifyToken, newsletterController.updateNewsletter);
router.post('/newsletters/:id/send', verifyToken, newsletterController.sendNewsletter);
router.post('/newsletters/:id/resend', verifyToken, newsletterController.resendNewsletter);
router.delete('/newsletters/:id', verifyToken, newsletterController.deleteNewsletter);

// ==================== RUTAS PROTEGIDAS (IMAGES) ====================
router.post('/images/upload', verifyToken, upload.single('image'), newsletterController.uploadNewsletterImage);
router.get('/images', verifyToken, newsletterController.getNewsletterImages);
router.delete('/images/:publicId', verifyToken, newsletterController.deleteNewsletterImage);

module.exports = router;
