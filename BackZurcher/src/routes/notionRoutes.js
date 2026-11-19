const express = require('express');
const router = express.Router();
const { allowRoles } = require('../middleware/byRol');
const { syncProspects, getSyncStatus } = require('../services/notion/notionProspectsSync');

// verifyToken se aplica globalmente en routes/index.js
// Estado de la sincronización Notion ↔ Leads (lo ven los que trabajan con leads)
router.get('/status', allowRoles(['owner', 'admin', 'recept', 'sales_rep']), async (req, res) => {
  try {
    res.json(await getSyncStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sincronizar ahora (además del tiempo real por webhooks y el respaldo cada 12 h)
router.post('/sync', allowRoles(['owner', 'admin', 'recept', 'sales_rep']), async (req, res) => {
  try {
    const result = await syncProspects();
    res.json({ ok: true, result });
  } catch (err) {
    console.error('❌ [Notion] sync manual:', err.message);
    res.status(err.message.includes('NOTION_TOKEN') ? 400 : 500).json({ error: err.message });
  }
});

module.exports = router;
