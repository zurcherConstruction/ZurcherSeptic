/**
 * Script: Ampliar linked_entity_type de VARCHAR(10) a VARCHAR(20)
 *
 * Motivo: El valor 'workCalendar' (12 chars) supera el límite actual de 10 chars,
 *         impidiendo crear recordatorios automáticos para works pendientes.
 *
 * Ejecución local:
 *   node migrations/run-reminder-entity-type-fix.js
 *
 * Ejecución producción (Railway):
 *   $env:DB_DEPLOY="postgresql://..."; node migrations/run-reminder-entity-type-fix.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.DB_DEPLOY && process.env.DB_DEPLOY.trim() !== '';

const sequelize = isProduction
  ? new Sequelize(process.env.DB_DEPLOY, {
      dialect: 'postgres',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: false,
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
      }
    );

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');
    console.log(`📊 Base de datos: ${isProduction ? 'PRODUCCIÓN (Railway)' : 'LOCAL'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const qi = sequelize.getQueryInterface();
    const cols = await qi.describeTable('Reminders');

    const currentType = cols['linked_entity_type']?.type || '';
    console.log(`\n📋 Tipo actual de linked_entity_type: ${currentType}`);

    if (currentType.includes('20') || currentType.includes('CHARACTER VARYING(20)') ||
        (currentType.includes('CHARACTER VARYING') && !currentType.includes('(10)'))) {
      console.log('⚠️  La columna ya tiene el tamaño correcto — sin cambios.');
      return;
    }

    console.log('\n📌 Alterando columna linked_entity_type → VARCHAR(20)...');
    await sequelize.query(`ALTER TABLE "Reminders" ALTER COLUMN linked_entity_type TYPE VARCHAR(20)`);
    console.log('✅ Columna alterada exitosamente');

    const colsAfter = await qi.describeTable('Reminders');
    console.log(`✅ Tipo final: ${colsAfter['linked_entity_type']?.type}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    throw err;
  } finally {
    await sequelize.close();
    console.log('🔌 Conexión cerrada');
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
