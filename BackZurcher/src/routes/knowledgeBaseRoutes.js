const express = require('express');
const router = express.Router();
const knowledgeBaseController = require('../controllers/KnowledgeBaseController');
const countyController = require('../controllers/KnowledgeCountyController');
const { upload } = require('../middleware/multer');

// ========== CATEGORÍAS ==========
router.get('/categories', knowledgeBaseController.getAllCategories);
router.post('/categories', knowledgeBaseController.createCategory);
router.put('/categories/:id', knowledgeBaseController.updateCategory);
router.delete('/categories/:id', knowledgeBaseController.deleteCategory);

// ========== CONTACTOS ==========
router.get('/contacts', knowledgeBaseController.getAllContacts);
router.get('/contacts/:id', knowledgeBaseController.getContactById);
router.post('/contacts', knowledgeBaseController.createContact);
router.put('/contacts/:id', knowledgeBaseController.updateContact);
router.patch('/contacts/:id/favorite', knowledgeBaseController.toggleFavoriteContact);
router.delete('/contacts/:id', knowledgeBaseController.deleteContact);

// ========== PROCEDIMIENTOS ==========
router.get('/procedures', knowledgeBaseController.getAllProcedures);
router.get('/procedures/:id', knowledgeBaseController.getProcedureById);
router.post('/procedures', knowledgeBaseController.createProcedure);
router.put('/procedures/:id', knowledgeBaseController.updateProcedure);
router.patch('/procedures/:id/favorite', knowledgeBaseController.toggleFavoriteProcedure);
router.delete('/procedures/:id', knowledgeBaseController.deleteProcedure);

// ========== DOCUMENTOS ==========
// 📤 Upload de archivos (debe ir ANTES de las rutas con :id)
router.post('/documents/upload', upload.array('files', 10), knowledgeBaseController.uploadDocumentFiles);

router.get('/documents', knowledgeBaseController.getAllDocuments);
router.get('/documents/:id', knowledgeBaseController.getDocumentById);
router.post('/documents', knowledgeBaseController.createDocument);
router.put('/documents/:id', knowledgeBaseController.updateDocument);
router.patch('/documents/:id/favorite', knowledgeBaseController.toggleFavoriteDocument);
router.delete('/documents/:id', knowledgeBaseController.deleteDocument);

// ========== BÚSQUEDA GLOBAL ==========
router.get('/search', knowledgeBaseController.globalSearch);

// ========== CONDADOS ==========
router.post('/counties/upload', upload.array('files', 10), countyController.uploadCountyFiles);
router.get('/counties/regions', countyController.getRegions);
router.get('/counties', countyController.getAllCounties);
router.get('/counties/:id', countyController.getCountyById);
router.post('/counties', countyController.createCounty);
router.put('/counties/:id', countyController.updateCounty);
router.delete('/counties/:id', countyController.deleteCounty);

module.exports = router;
