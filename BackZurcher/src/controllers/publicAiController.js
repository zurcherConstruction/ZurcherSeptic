/**
 * 🌐 Chat público de la landing (sin autenticación).
 * POST /public-ai/chat  { sessionId, messages: [{ role: 'user'|'assistant', content: string }], leadSaved?, lang?: 'en'|'es' }
 * Responde en Server-Sent Events: delta {text} · status {label} · done {answer, leadSaved} · error {error}
 *
 * Sin historial en la base de datos: el navegador guarda la conversación de la sesión y la reenvía.
 * Lo único que se guarda es el lead (con la conversación como nota) cuando el visitante deja sus datos.
 */
const Anthropic = require('@anthropic-ai/sdk');
const bot = require('../services/ai/publicBot');

const { buildPublicSystemPrompt, SAVE_LEAD_TOOL, DIAGNOSTIC_TOOL, checkRateLimit } = bot;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.PUBLIC_BOT_MODEL || 'claude-haiku-5-5';
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 1500;
const MAX_ITERATIONS = 3;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// Solo texto plano, roles alternados, terminando en una pregunta del visitante
function sanitizeMessages(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const messages = raw.slice(-MAX_MESSAGES).map(m => ({
    role: m?.role === 'assistant' ? 'assistant' : 'user',
    content: String(m?.content || '').slice(0, MAX_MESSAGE_CHARS).trim(),
  })).filter(m => m.content);
  while (messages.length && messages[0].role !== 'user') messages.shift();
  const merged = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else merged.push({ ...m });
  }
  if (!merged.length || merged[merged.length - 1].role !== 'user') return null;
  return merged;
}

const publicChat = async (req, res) => {
  const { sessionId, leadSaved } = req.body || {};
  const lang = req.body?.lang === 'es' ? 'es' : 'en';
  const messages = sanitizeMessages(req.body?.messages);

  if (!messages || typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 64) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Chat not available right now. Please call (954) 636-8200.' });
  }
  if (!checkRateLimit(clientIp(req))) {
    return res.status(429).json({ error: 'Too many messages. Please call or WhatsApp us at (954) 636-8200.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  let clientGone = false;
  res.on('close', () => { clientGone = true; });
  const emit = (event, data = {}) => {
    if (!clientGone && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let savedThisTurn = false;
  try {
    const system = buildPublicSystemPrompt({ leadSaved: !!leadSaved, lang });
    const turn = messages.map(m => ({ role: m.role, content: m.content }));
    let finalText = '';

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 1200,
        cache_control: { type: 'ephemeral' },
        system,
        tools: [SAVE_LEAD_TOOL, DIAGNOSTIC_TOOL],
        ...(i === MAX_ITERATIONS - 1 ? { tool_choice: { type: 'none' } } : {}),
        messages: turn,
      });
      let streamed = false;
      stream.on('text', (delta) => {
        streamed = true;
        emit('delta', { text: delta });
      });
      const response = await stream.finalMessage();
      turn.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        finalText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        break;
      }
      if (streamed) emit('reset');
      const toolNames = response.content.filter(b => b.type === 'tool_use').map(b => b.name);
      emit('status', { label: toolNames.includes('create_diagnostic_payment_link') ? '💳 Creating your payment link…' : '📝 Saving your details…' });

      const results = [];
      // En orden: el link de pago necesita el lead ya guardado
      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        let result;
        try {
          if (block.name === 'save_lead') {
            result = await bot.saveLead(sessionId, block.input, messages);
            if (result.ok) savedThisTurn = true;
          } else if (block.name === 'create_diagnostic_payment_link') {
            result = await bot.createDiagnosticLink(sessionId, block.input);
          } else {
            result = { ok: false, error: 'Unknown tool' };
          }
        } catch (err) {
          console.error('❌ [WebBot] save_lead:', err.message);
          result = { ok: false, error: 'Could not save right now; ask the visitor to call (954) 636-8200.' };
        }
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result), ...(result.ok ? {} : { is_error: true }) });
      }
      turn.push({ role: 'user', content: results });
    }

    if (!finalText) finalText = 'Sorry, something went wrong. Please call or WhatsApp us at (954) 636-8200.';
    console.log(`🌐 [WebBot] ${messages.length} msgs${savedThisTurn ? ' — lead guardado' : ''}`);
    emit('done', { answer: finalText, leadSaved: !!leadSaved || savedThisTurn });
  } catch (error) {
    console.error('❌ [WebBot] chat:', error.message);
    emit('error', {
      error: error instanceof Anthropic.RateLimitError
        ? 'We are receiving many messages right now. Please try again in a minute or call (954) 636-8200.'
        : 'Sorry, the chat is not available right now. Please call or WhatsApp us at (954) 636-8200.',
      leadSaved: !!leadSaved || savedThisTurn,
    });
  } finally {
    res.end();
  }
};

/**
 * POST /public-ai/translate  { texts: string[], lang: 'en'|'es' } → { texts: string[] }
 * Traduce las respuestas ya mostradas cuando el visitante cambia de idioma a mitad del chat.
 */
const translateMessages = async (req, res) => {
  const lang = req.body?.lang === 'es' ? 'es' : 'en';
  const texts = Array.isArray(req.body?.texts) ? req.body.texts.slice(0, MAX_MESSAGES).map(t => String(t || '').slice(0, 4000)) : null;
  if (!texts?.length) return res.status(400).json({ error: 'Invalid request' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Not available' });
  if (!checkRateLimit(clientIp(req))) return res.status(429).json({ error: 'Too many requests' });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: `You translate chat messages from a septic company's website assistant into ${lang === 'es' ? 'Spanish (neutral Latin American)' : 'English'}. Keep the meaning, tone, markdown, links, prices, phone numbers, emails and proper names exactly. If a message is already in the target language, return it unchanged. Output ONLY the translations, each wrapped as <t i="N">…</t> with the same index N as the input, nothing else.`,
      messages: [{ role: 'user', content: texts.map((t, i) => `<t i="${i}">${t}</t>`).join('\n') }],
    });
    const output = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const translated = texts.map((original, i) => {
      const match = output.match(new RegExp(`<t i="${i}">([\\s\\S]*?)</t>`));
      return match ? match[1].trim() : original;
    });
    res.json({ texts: translated });
  } catch (error) {
    console.error('❌ [WebBot] translate:', error.message);
    res.status(500).json({ error: 'Translation failed' });
  }
};

module.exports = { publicChat, translateMessages };
