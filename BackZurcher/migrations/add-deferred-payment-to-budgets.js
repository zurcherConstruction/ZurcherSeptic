require('dotenv').config();
const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.DB_DEPLOY) {
  sequelize = new Sequelize(process.env.DB_DEPLOY, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: console.log
    }
  );
}

async function migrate() {
  await sequelize.authenticate();
  const [result] = await sequelize.query('SELECT current_database() AS db');
  console.log(`✅ Conectado a: ${result[0].db}`);

  await sequelize.query(`
    ALTER TABLE "Budgets"
    ADD COLUMN IF NOT EXISTS "deferredPayment" BOOLEAN DEFAULT false
  `);

  console.log('✅ Columna deferredPayment agregada a Budgets');
  await sequelize.close();
}

migrate().catch(e => {
  console.error('❌ Error en migración:', e.message);
  process.exit(1);
});
