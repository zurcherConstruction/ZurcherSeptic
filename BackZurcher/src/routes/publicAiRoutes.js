const express = require('express');
const router = express.Router();
const { publicChat, translateMessages } = require('../controllers/publicAiController');

// 🌐 Rutas PÚBLICAS (sin token): asistente de la landing para clientes interesados
router.post('/chat', publicChat);
router.post('/translate', translateMessages);

module.exports = router;
