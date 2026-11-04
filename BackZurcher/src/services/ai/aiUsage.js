/**
 * 💲 Consumo de la API de Claude: suma de tokens por pregunta, costo estimado y resumen por empleado.
 */
const { Op, fn, col, literal } = require('sequelize');
const { AIUsageLog, AIConversation, AIMessage, Staff } = require('../../data/index');

// USD por millón de tokens (lista pública). Escrituras de caché = TTL de 5 minutos.
const PRICES = {
  'claude-opus-5-5': { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  'claude-opus-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

function priceFor(model) {
  const key = Object.keys(PRICES).find(k => model === k || model?.startsWith(`${k}-`));
  return PRICES[key] || PRICES['claude-opus-5-5'];
}

function newUsage() {
  return { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, model: null };
}

// Suma el usage de una respuesta de la API (cada vuelta del bucle de herramientas)
function addUsage(acc, response) {
  const u = response?.usage;
  if (!u) return acc;
  const p = priceFor(response.model);
  const input = u.input_tokens || 0;
  const output = u.output_tokens || 0;
  const cacheRead = u.cache_read_input_tokens || 0;
  const cacheWrite = u.cache_creation_input_tokens || 0;
  acc.requests += 1;
  acc.inputTokens += input;
  acc.outputTokens += output;
  acc.cacheReadTokens += cacheRead;
  acc.cacheWriteTokens += cacheWrite;
  acc.costUsd += (input * p.input + output * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1e6;
  acc.model = response.model || acc.model;
  return acc;
}

async function recordUsage(source, usage, { staffId = null, conversationId = null, toolCalls = 0 } = {}) {
  if (!usage?.requests || !AIUsageLog) return;
  try {
    await AIUsageLog.create({ source, staffId, conversationId, toolCalls, ...usage, costUsd: usage.costUsd.toFixed(5) });
  } catch (err) {
    console.error('❌ [AI] no se pudo registrar el consumo:', err.message);
  }
}

/**
 * Resumen de los últimos `days` días: costo y preguntas por empleado, chat de la web y proyección mensual.
 * Las preguntas se cuentan desde el historial de conversaciones (incluye días anteriores al registro
 * de costos); el costo solo existe desde que se empezó a registrar.
 */
async function usageSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [costRows, questionRows, firstLog, staffList] = await Promise.all([
    AIUsageLog.findAll({
      where: { createdAt: { [Op.gte]: since } },
      attributes: [
        'source', 'staffId',
        [fn('COUNT', col('id')), 'questions'],
        [fn('SUM', col('costUsd')), 'cost'],
        [fn('SUM', col('requests')), 'requests'],
        [fn('SUM', col('toolCalls')), 'toolCalls'],
        [fn('SUM', literal('"inputTokens" + "cacheReadTokens" + "cacheWriteTokens"')), 'inputTokens'],
        [fn('SUM', col('outputTokens')), 'outputTokens'],
      ],
      group: ['source', 'staffId'],
      raw: true,
    }),
    AIMessage.findAll({
      where: { role: 'user', displayText: { [Op.ne]: null }, createdAt: { [Op.gte]: since } },
      include: [{ model: AIConversation, attributes: [] }],
      attributes: [
        [col('AIConversation.staffId'), 'staffId'],
        [fn('COUNT', col('AIMessage.id')), 'questions'],
        [fn('COUNT', fn('DISTINCT', col('AIMessage.conversationId'))), 'conversations'],
        [fn('MAX', col('AIMessage.createdAt')), 'lastQuestionAt'],
      ],
      group: [col('AIConversation.staffId')],
      raw: true,
    }),
    AIUsageLog.min('createdAt'),
    Staff.findAll({ attributes: ['id', 'name', 'email', 'role'], raw: true }),
  ]);

  const staffById = Object.fromEntries(staffList.map(s => [s.id, s]));
  const byStaff = {};
  const row = (staffId) => (byStaff[staffId] ||= {
    staffId,
    name: staffById[staffId]?.name || staffById[staffId]?.email || 'Desconocido',
    role: staffById[staffId]?.role || null,
    questions: 0, conversations: 0, lastQuestionAt: null,
    trackedQuestions: 0, costUsd: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0,
  });

  questionRows.forEach(q => {
    if (!q.staffId) return;
    Object.assign(row(q.staffId), { questions: +q.questions, conversations: +q.conversations, lastQuestionAt: q.lastQuestionAt });
  });

  let webbot = { messages: 0, costUsd: 0 };
  costRows.forEach(c => {
    if (c.source === 'webbot') {
      webbot = { messages: webbot.messages + +c.questions, costUsd: webbot.costUsd + +c.cost };
      return;
    }
    if (!c.staffId) return;
    Object.assign(row(c.staffId), {
      trackedQuestions: +c.questions, costUsd: +c.cost, toolCalls: +c.toolCalls,
      inputTokens: +c.inputTokens, outputTokens: +c.outputTokens,
    });
  });

  const staff = Object.values(byStaff).map(s => ({
    ...s,
    costUsd: +s.costUsd.toFixed(2),
    avgCostPerQuestion: s.trackedQuestions ? +(s.costUsd / s.trackedQuestions).toFixed(3) : null,
  })).sort((a, b) => b.costUsd - a.costUsd || b.questions - a.questions);

  // Proyección: costo por día desde que hay registro (dentro del período) × 30
  const trackedFrom = firstLog && new Date(firstLog) > since ? new Date(firstLog) : since;
  const trackedDays = Math.max((Date.now() - trackedFrom.getTime()) / 86400000, 1);
  const totalCost = staff.reduce((a, s) => a + s.costUsd, 0) + webbot.costUsd;

  return {
    days,
    since,
    trackingSince: firstLog || null,
    trackedDays: +trackedDays.toFixed(1),
    totalCostUsd: +totalCost.toFixed(2),
    projectedMonthlyUsd: firstLog ? +((totalCost / trackedDays) * 30).toFixed(2) : null,
    webbot: { messages: webbot.messages, costUsd: +webbot.costUsd.toFixed(2) },
    staff,
  };
}

module.exports = { newUsage, addUsage, recordUsage, usageSummary, priceFor };
