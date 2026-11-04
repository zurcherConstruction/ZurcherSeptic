/**
 * 💲 ZurcherAI — presupuesto mensual
 *
 * El owner define cuánto quiere gastar por mes (AISettings 'monthlyBudgetUsd'; por defecto
 * AI_MONTHLY_BUDGET_USD o $150). Al 80% se avisa a los owners con una tarea; al 100% solo los
 * owners pueden seguir usando ZurcherAI hasta fin de mes.
 */
const { Op, fn, col } = require('sequelize');
const { AIUsageLog, AISetting, Staff, Reminder, ReminderAssignment } = require('../../data/index');

const DEFAULT_BUDGET = Number(process.env.AI_MONTHLY_BUDGET_USD) || 150;
const CACHE_MS = 60 * 1000;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let cache = { at: 0, spent: 0 };

// Primer día del mes en Florida
function monthStart() {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return { date: new Date(ny.getFullYear(), ny.getMonth(), 1), label: `${MONTHS[ny.getMonth()]} ${ny.getFullYear()}` };
}

async function getMonthlyBudget() {
  const row = await AISetting.findByPk('monthlyBudgetUsd');
  const value = Number(row?.value);
  return value > 0 ? value : DEFAULT_BUDGET;
}

async function setMonthlyBudget(amount) {
  const value = Number(amount);
  if (!(value > 0) || value > 100000) throw new Error('Monto inválido');
  await AISetting.upsert({ key: 'monthlyBudgetUsd', value });
  return value;
}

async function monthToDateSpend({ fresh = false } = {}) {
  if (!fresh && Date.now() - cache.at < CACHE_MS) return cache.spent;
  const total = await AIUsageLog.findOne({
    where: { createdAt: { [Op.gte]: monthStart().date } },
    attributes: [[fn('SUM', col('costUsd')), 'total']],
    raw: true,
  });
  cache = { at: Date.now(), spent: Number(total?.total) || 0 };
  return cache.spent;
}

async function budgetStatus({ fresh = false } = {}) {
  const [budget, spent] = await Promise.all([getMonthlyBudget(), monthToDateSpend({ fresh })]);
  return { budget, spent: +spent.toFixed(2), ratio: budget ? spent / budget : 0, month: monthStart().label };
}

// Tarea para los owners al cruzar 80% y 100% (una vez por mes y por umbral)
const alertsInProgress = new Set(); // evita duplicados si llegan dos preguntas a la vez
async function alertOwners(threshold, status) {
  const title = `ZurcherAI: ${threshold}% del presupuesto de ${status.month}`;
  if (alertsInProgress.has(title)) return;
  alertsInProgress.add(title);
  try {
    if (await Reminder.findOne({ where: { title } })) return;
    await createAlert(title, threshold, status);
  } finally {
    alertsInProgress.delete(title);
  }
}

async function createAlert(title, threshold, status) {
  const owners = await Staff.findAll({ where: { role: 'owner', isActive: true }, attributes: ['id'], raw: true });
  if (!owners.length) return;
  const reminder = await Reminder.create({
    title,
    description: `Se gastaron $${status.spent.toFixed(2)} de $${status.budget.toFixed(2)} este mes. ${threshold >= 100
      ? 'Admin y recepción no pueden usar ZurcherAI hasta fin de mes, salvo que se aumente el presupuesto (ZurcherAI → 💲 Consumo).'
      : 'Podés revisar quién lo usa en ZurcherAI → 💲 Consumo.'}`,
    type: 'tagged',
    priority: threshold >= 100 ? 'urgent' : 'high',
    createdBy: owners[0].id,
  });
  await ReminderAssignment.bulkCreate(owners.map(o => ({ reminderId: reminder.id, staffId: o.id })), { ignoreDuplicates: true });
  console.log(`💲 [AI] Aviso de presupuesto: ${title}`);
}

/**
 * Antes de cada pregunta: devuelve { allowed, status }. Al 100% bloquea a los no-owner.
 */
async function checkBudget(role) {
  const status = await budgetStatus();
  if (status.ratio >= 1) alertOwners(100, status).catch(err => console.error('❌ [AI] aviso presupuesto:', err.message));
  else if (status.ratio >= 0.8) alertOwners(80, status).catch(err => console.error('❌ [AI] aviso presupuesto:', err.message));
  return { allowed: status.ratio < 1 || role === 'owner', status };
}

module.exports = { checkBudget, budgetStatus, getMonthlyBudget, setMonthlyBudget };
