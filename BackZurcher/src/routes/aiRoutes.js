const express = require('express');
const router = express.Router();
const { queryAI } = require('../controllers/aiController');
const { allowRoles } = require('../middleware/byRol');

// POST /api/ai/query — natural language business query
// verifyToken is applied globally in routes/index.js
router.post('/query', allowRoles(['admin', 'owner', 'finance', 'finance-viewer', 'worker']), queryAI);

module.exports = router;
