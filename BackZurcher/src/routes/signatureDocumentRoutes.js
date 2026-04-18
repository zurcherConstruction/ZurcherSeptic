const express = require('express');
const router = express.Router();
const multer = require('multer');
const SignatureDocumentController = require('../controllers/SignatureDocumentController');
const { verifyToken } = require('../middleware/isAuth');

// Configurar multer para PDFs en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

/**
 * @route GET /signature-documents
 * @desc Listar todos los documentos de firma
 * @query {string} status - Filtrar por estado (draft, pending, signed, etc.)
 * @query {string} linkedContactId - Filtrar por contacto vinculado
 * @query {number} page - Número de página (default: 1)
 * @query {number} limit - Documentos por página (default: 50)
 */
router.get('/', SignatureDocumentController.getAllDocuments);

/**
 * @route GET /signature-documents/test-connection
 * @desc Probar conexión con el proveedor activo (SignNow o DocuSign)
 */
router.get('/test-connection', SignatureDocumentController.testConnection);

/**
 * @route GET /signature-documents/:id
 * @desc Obtener un documento específico
 */
router.get('/:id', SignatureDocumentController.getDocument);

/**
 * @route POST /signature-documents
 * @desc Crear y enviar un documento para firma
 * @body {file} pdfFile - Archivo PDF a enviar
 * @body {string} documentName - Nombre del documento
 * @body {string} documentType - Tipo de documento (opcional)
 * @body {string} description - Descripción (opcional)
 * @body {string} signerName - Nombre del firmante
 * @body {string} signerEmail - Email del firmante
 * @body {string} signerPhone - Teléfono del firmante (opcional)
 * @body {string} linkedContactId - ID del contacto vinculado (opcional)
 * @body {string} linkedEntityType - Tipo de entidad vinculada (opcional)
 * @body {string} linkedEntityId - ID de la entidad vinculada (opcional)
 * @file pdfFile - Archivo PDF a enviar para firma
 */
router.post('/', upload.single('pdfFile'), SignatureDocumentController.createAndSendDocument);

/**
 * @route GET /signature-documents/:id/status
 * @desc Verificar estado de firma de un documento
 */
router.get('/:id/status', SignatureDocumentController.checkDocumentStatus);

/**
 * @route GET /signature-documents/:id/download-signed
 * @desc Descargar documento firmado
 */
router.get('/:id/download-signed', SignatureDocumentController.downloadSignedDocument);

/**
 * @route PUT /signature-documents/:id/cancel
 * @desc Cancelar un documento pendiente
 */
router.put('/:id/cancel', SignatureDocumentController.cancelDocument);

/**
 * @route DELETE /signature-documents/:id
 * @desc Eliminar un documento
 */
router.delete('/:id', SignatureDocumentController.deleteDocument);

module.exports = router;
