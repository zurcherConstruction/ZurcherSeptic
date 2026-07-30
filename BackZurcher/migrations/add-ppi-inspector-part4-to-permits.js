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

  const queries = [
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorName" VARCHAR(200)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorBusiness" VARCHAR(200)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorEmail" VARCHAR(150)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorPhone" VARCHAR(50)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorMailingAddress" VARCHAR(300)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorCity" VARCHAR(100)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorState" VARCHAR(50) DEFAULT 'FL'`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorZipCode" VARCHAR(20)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorQualificationType" VARCHAR(50)`,
    `ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS "ppiInspectorLicenseNumber" VARCHAR(100)`,
  ];

  for (const query of queries) {
    await sequelize.query(query);
    console.log(`✅ ${query.replace('ALTER TABLE "Permits" ADD COLUMN IF NOT EXISTS ', '')}`);
  }

  console.log('\n✅ Migración completada: PPI Part 4 inspector fields agregados a Permits');
  await sequelize.close();
}

migrate().catch(e => {
  console.error('❌ Error en migración:', e.message);
  process.exit(1);
});
