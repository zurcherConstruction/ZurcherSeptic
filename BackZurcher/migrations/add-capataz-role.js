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
  console.log('✅ Conexión a base de datos establecida');

  const [results] = await sequelize.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'capataz'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'enum_Staffs_role'
      )
    );
  `);

  if (results[0].exists) {
    console.log('⚠️  El rol "capataz" ya existe en el ENUM, nada que hacer');
    return;
  }

  await sequelize.query(`ALTER TYPE "enum_Staffs_role" ADD VALUE 'capataz';`);
  console.log('✅ Rol "capataz" agregado exitosamente al ENUM');

  await sequelize.close();
}

migrate().catch(e => {
  console.error('❌ Migración falló:', e.message);
  process.exit(1);
});
