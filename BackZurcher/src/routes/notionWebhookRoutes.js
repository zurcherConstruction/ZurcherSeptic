// 🔗 Webhook de Notion (público, sin login): Notion avisa cuando cambia un prospecto y se sincroniza solo ese
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const sync = require('../services/notion/notionProspectsSync');

function validSignature(req, secret) {
  const header = String(req.headers['x-notion-signature'] || '');
  if (!header || !req.rawBody) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};

    // 1) Al crear la suscripción, Notion manda un token de verificación (una sola vez)
    if (typeof body.verification_token === 'string' && Object.keys(body).length === 1) {
      await sync.saveWebhookVerificationToken(body.verification_token);
      console.log(`🔗 [Notion] Webhook: token de verificación recibido → pegalo en Notion para verificar: ${body.verification_token}`);
      return res.json({ ok: true });
    }

    // 2) Eventos: se valida la firma con ese token
    const secret = await sync.getWebhookSecret();
    if (!secret || !validSignature(req, secret)) {
      console.warn('⚠️ [Notion] Webhook con firma inválida o sin token de verificación: ignorado');
      return res.status(401).json({ error: 'invalid signature' });
    }

    res.json({ ok: true }); // se responde enseguida; la sincronización sigue en segundo plano
    sync.markWebhookReceived().catch(() => {});
    sync.handleWebhookEvent(body).catch(err => console.error('❌ [Notion] webhook:', err.message));
  } catch (err) {
    console.error('❌ [Notion] webhook:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'webhook error' });
  }
});

module.exports = router;
