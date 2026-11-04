/**
 * 🔀 ZurcherAI — elección de modelo por conversación
 *
 * Las consultas simples (buscar datos, listas, estados) van a Sonnet (la mitad de precio); redactar correos
 * o documentos, analizar, comparar o leer archivos va a Opus. Lo decide Haiku con una llamada mínima.
 * El modelo queda fijo en la conversación (el caché es por modelo) y solo puede subir de Sonnet a Opus,
 * nunca bajar. Variables: AI_MODEL (complejo), AI_MODEL_SIMPLE (simple), AI_ROUTER=off lo desactiva.
 */
const Anthropic = require('@anthropic-ai/sdk');
const { newUsage, addUsage, recordUsage } = require('./aiUsage');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const COMPLEX_MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const SIMPLE_MODEL = process.env.AI_MODEL_SIMPLE || 'claude-sonnet-5-5';
const ROUTER_MODEL = 'claude-haiku-5-5';
const ROUTER_ENABLED = process.env.AI_ROUTER !== 'off' && SIMPLE_MODEL !== COMPLEX_MODEL;

const ROUTER_PROMPT = `You route questions for the internal assistant of a septic installation company. Classify the user's request:
- SIMPLE: look up or list records, statuses, dates, counts, totals, a single work/budget/invoice summary, find an email, create a reminder or note, a route, a straightforward Excel export.
- COMPLEX: write or reply to an email or letter, write a document or PDF for a client, analyze or compare (performance, trends, profitability, staff analysis), read and interpret files or attachments, multi-step investigations, anything ambiguous that needs judgment.
Answer with exactly one word: SIMPLE or COMPLEX.`;

async function classify(question) {
  const response = await client.messages.create({
    model: ROUTER_MODEL,
    // Haiku 5.5 piensa por defecto: con effort low casi no lo hace, pero necesita margen de tokens
    max_tokens: 300,
    output_config: { effort: 'low' },
    system: ROUTER_PROMPT,
    messages: [{ role: 'user', content: String(question).slice(0, 2000) }],
  });
  recordUsage('router', addUsage(newUsage(), response));
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('').toUpperCase();
  return text.includes('SIMPLE') ? 'simple' : 'complex';
}

/**
 * Devuelve el modelo para esta pregunta. currentModel: el que ya usa la conversación (o null si es nueva).
 */
async function chooseModel(question, currentModel) {
  if (!ROUTER_ENABLED) return COMPLEX_MODEL;
  if (currentModel === COMPLEX_MODEL) return COMPLEX_MODEL; // nunca baja
  try {
    const level = await classify(question);
    if (level === 'complex') return COMPLEX_MODEL;
    return currentModel || SIMPLE_MODEL;
  } catch (err) {
    console.error('⚠️ [AI router] usando modelo completo:', err.message);
    return currentModel || COMPLEX_MODEL;
  }
}

module.exports = { chooseModel, COMPLEX_MODEL, SIMPLE_MODEL };
