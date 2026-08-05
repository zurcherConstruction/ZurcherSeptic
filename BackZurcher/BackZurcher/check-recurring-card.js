const { Sequelize } = require('sequelize');
const DB_DEPLOY = 'postgresql://postgres:WxSaryUtlCSMyfquHrFjttNXymIxpuUX@nozomi.proxy.rlwy.net:24166/railway';
const sequelize = new Sequelize(DB_DEPLOY, {
  dialect: 'postgres', logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function main() {
  await sequelize.authenticate();

  const [expenses] = await sequelize.query(`
    SELECT "idFixedExpense", name, frequency, "totalAmount"::text, "paymentStatus",
           "paidAmount"::text, "startDate"::text, "nextDueDate"::text
    FROM "FixedExpenses" WHERE name ILIKE '%Recurring Card%'
  `);

  for (const e of expenses) {
    console.log(`=== ${e.name} ===`);
    console.log(`  frequency: ${e.frequency} | totalAmount: $${e.totalAmount} | status: ${e.paymentStatus} | paidAmount: $${e.paidAmount}`);
    console.log(`  startDate: ${e.startDate} | nextDueDate: ${e.nextDueDate}`);

    const [payments] = await sequelize.query(`
      SELECT "idPayment", amount::text, "paymentDate"::text,
             "periodStart"::text, "periodEnd"::text, "paymentMethod", notes
      FROM "FixedExpensePayments"
      WHERE "fixedExpenseId" = $1
      ORDER BY "periodStart" ASC
    `, { bind: [e.idFixedExpense] });

    console.log(`\nPagos (${payments.length} total):`);
    payments.forEach(p => {
      console.log(`  ID: ${p.idPayment}`);
      console.log(`  $${p.amount} | pagado: ${p.paymentDate} | período: ${p.periodStart} → ${p.periodEnd} | ${p.paymentMethod || ''}`);
      if (p.notes) console.log(`    nota: ${p.notes}`);
    });
  }

  await sequelize.close();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
