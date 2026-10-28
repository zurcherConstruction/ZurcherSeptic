const express = require('express');
const router = express.Router();
const {
  chat,
  listConversations,
  getConversationMessages,
  renameConversation,
  deleteConversation,
  downloadExport,
  getContext,
} = require('../controllers/aiController');
const { allowRoles } = require('../middleware/byRol');
const { AI_ROLES } = require('../services/ai/aiPermissions');

// verifyToken is applied globally in routes/index.js
// Cada usuario solo ve sus propias conversaciones; lo que puede consultar depende de su rol (aiPermissions.js)
router.use(allowRoles(AI_ROLES));

router.post('/chat', chat);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', getConversationMessages);
router.patch('/conversations/:id', renameConversation);
router.delete('/conversations/:id', deleteConversation);
router.get('/conversations/:id/exports/:exportId', downloadExport);
router.get('/context/:entity/:id', getContext);

module.exports = router;
