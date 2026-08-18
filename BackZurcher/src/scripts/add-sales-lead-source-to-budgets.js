require('dotenv').config();
const { Client } = require('pg');

const isProduction = !!process.env.DB_DEPLOY;

const clientConfig = isProduction
  ? { connectionString: process.env.DB_DEPLOY, ssl: { rejectUnauthorized: false } }
  : {
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME,
    };

console.log(`🌍 Ambiente: ${isProduction ? 'PRODUCCIÓN (DB_DEPLOY)' : 'LOCAL'}`);

async function run() {
  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Conectado a DB_DEPLOY');

    await client.query(`
      ALTER TYPE "enum_Budgets_leadSource" ADD VALUE IF NOT EXISTS 'sales_lead';
    `);
    console.log('✅ Valor sales_lead agregado al enum enum_Budgets_leadSource');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
