require('dotenv').config();
const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.DB_DEPLOY) {
  // Producción: usar connection string completo
  sequelize = new Sequelize(process.env.DB_DEPLOY, {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
  });
} else {
  // Desarrollo local: usar variables individuales
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
  const [result] = await sequelize.query('SELECT current_database() AS db, inet_server_addr() AS host, inet_server_port() AS port');
  console.log(`✅ Conectado a: ${result[0].db} @ ${result[0].host}:${result[0].port}`);

  await sequelize.query(`
    ALTER TABLE "FixedExpenses"
    ADD COLUMN IF NOT EXISTS "variableAmount" BOOLEAN NOT NULL DEFAULT false
  `);

  console.log('✅ Columna variableAmount agregada a FixedExpenses');
  await sequelize.close();
}

migrate().catch(e => {
  console.error('❌ Error en migración:', e.message);
  process.exit(1);
});
