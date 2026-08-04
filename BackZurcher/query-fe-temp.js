const { Sequelize } = require('sequelize');

const DB_DEPLOY = 'postgresql://postgres:WxSaryUtlCSMyfquHrFjttNXymIxpuUX@nozomi.proxy.rlwy.net:24166/railway';

const sequelize = new Sequelize(DB_DEPLOY, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

const FREQ = { monthly:'Mensual', biweekly:'Quincenal', weekly:'Semanal', quarterly:'Trimestral', semiannual:'Semestral', annual:'Anual', one_time:'Unico' };
const ST = { unpaid:'Sin pagar', partial:'Parcial', paid:'Pagado', paid_via_credit_card:'Pagado (TC)', paid_via_invoice:'Pagado (Fact.)' };

async function main() {
  await sequelize.authenticate();
  console.log('Conectado a Railway\n');

  const [expenses] = await sequelize.query(`
    SELECT "idFixedExpense", name, category, frequency,
           "totalAmount", "paidAmount", "paymentStatus", "isActive", vendor
    FROM "FixedExpenses"
    ORDER BY category, name
  `);

  console.log('══════════════════════════════════════════════════════');
  console.log(`GASTOS FIJOS REGISTRADOS — Total: ${expenses.length}`);
  console.log('══════════════════════════════════════════════════════');
  expenses.forEach((e, i) => {
    const act = e.isActive ? 'ACTIVO' : 'inactivo';
    console.log(`${String(i+1).padStart(2)}. [${e.category}] ${e.name}`);
    console.log(`    ${FREQ[e.frequency]||e.frequency} | $${parseFloat(e.totalAmount).toFixed(2)} | ${ST[e.paymentStatus]||e.paymentStatus} | ${act}`);
    if (e.vendor) console.log(`    Proveedor: ${e.vendor}`);
  });

  const [payments] = await sequelize.query(`
    SELECT
      fep."idPayment",
      fep."fixedExpenseId",
      fep.amount,
      fep."paymentDate",
      fep."paymentMethod",
      fep."periodStart",
      fep."periodEnd",
      fep."receiptUrl",
      fep.notes,
      fe.name AS expense_name,
      fe.category,
      fe.frequency
    FROM "FixedExpensePayments" fep
    JOIN "FixedExpenses" fe ON fe."idFixedExpense" = fep."fixedExpenseId"
    WHERE fep."paymentDate" >= '2026-01-01'
       OR fep."periodStart" >= '2026-01-01'
    ORDER BY fep."paymentDate" ASC, fe.category, fe.name
  `);

  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`PAGOS REGISTRADOS en 2026 — Total: ${payments.length}`);
  console.log(`══════════════════════════════════════════════════════`);

  const byMonth = {};
  payments.forEach(p => {
    const m = (p.paymentDate || p.periodStart || '').toString().slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(p);
  });

  let grand = 0;
  Object.keys(byMonth).sort().forEach(month => {
    const pmts = byMonth[month];
    const tot = pmts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    grand += tot;
    console.log(`\n── ${month}  (${pmts.length} pago/s | $${tot.toFixed(2)}) ──`);
    pmts.forEach(p => {
      const date = (p.paymentDate || '').toString().slice(0, 10);
      const per  = p.periodStart ? `per:${p.periodStart.toString().slice(0,7)}` : '';
      const rec  = p.receiptUrl ? '🧾 COMPROBANTE' : 'sin comprobante';
      const meth = p.paymentMethod || 'sin metodo';
      console.log(`  • [${p.category}] ${p.expense_name}`);
      console.log(`    $${parseFloat(p.amount).toFixed(2)} | ${date} | ${per} | ${meth} | ${rec}`);
      if (p.notes) console.log(`    Nota: ${p.notes}`);
    });
  });

  console.log(`\n══════════════════════════════════════════════════════`);
  console.log(`TOTAL PAGADO 2026: $${grand.toFixed(2)}`);
  console.log(`══════════════════════════════════════════════════════`);

  // Activos sin pagos
  const paidIds = new Set(payments.map(p => p.fixedExpenseId));
  const sinPago = expenses.filter(e => !paidIds.has(e.idFixedExpense) && e.isActive);
  if (sinPago.length) {
    console.log(`\n⚠  ACTIVOS SIN NINGUN PAGO EN 2026 (${sinPago.length}):`);
    sinPago.forEach(e => {
      console.log(`  • [${e.category}] ${e.name} | ${FREQ[e.frequency]||e.frequency} | $${parseFloat(e.totalAmount).toFixed(2)} | ${ST[e.paymentStatus]||e.paymentStatus}`);
    });
  }

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
