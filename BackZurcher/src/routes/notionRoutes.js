const express = require('express');
const router = express.Router();
const { allowRoles } = require('../middleware/byRol');
const { syncProspects, getSyncStatus } = require('../services/notion/notionProspectsSync');
const { sendWeeklyNotionReport } = require('../services/notion/notionWeeklyReport');

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

// 📋 Reporte semanal de seguimientos (se manda solo los viernes 10:00)
// GET  /notion/weekly-report/preview → HTML del reporte, sin enviar
// POST /notion/weekly-report/send    → lo manda ahora; body { to } para mandarlo solo a ese email
router.get('/weekly-report/preview', allowRoles(['owner', 'admin']), async (req, res) => {
  try {
    const { html } = await sendWeeklyNotionReport({ dryRun: true });
    res.type('html').send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/weekly-report/send', allowRoles(['owner']), async (req, res) => {
  try {
    const to = req.body?.to;
    if (to && !String(to).includes('@')) return res.status(400).json({ error: 'Email inválido' });
    res.json({ ok: true, ...(await sendWeeklyNotionReport({ to })) });
  } catch (err) {
    console.error('❌ [Notion] reporte semanal manual:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
