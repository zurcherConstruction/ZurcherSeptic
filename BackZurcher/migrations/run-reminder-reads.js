/**
 * Script: Crear tabla ReminderReads para tracking de lectura de comentarios
 *
 * Fecha: 2026-07-03
 * Propósito: Cada fila registra cuándo un staff leyó por última vez los comentarios
 *            de un reminder. Permite mostrar el badge "no leído" por persona.
 *
 * Ejecución local:
 *   node migrations/run-reminder-reads.js
 *
 * Ejecución producción (Railway):
 *   $env:DB_DEPLOY="postgresql://..."; node migrations/run-reminder-reads.js
 */

const { Sequelize, DataTypes } = require('sequelize');
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const qi = sequelize.getQueryInterface();
    const tables = await qi.showAllTables();

    if (tables.includes('ReminderReads')) {
      console.log('⚠️  La tabla ReminderReads ya existe — sin cambios.');
      return;
    }

    console.log('\n📌 Creando tabla ReminderReads...');

    await qi.createTable('ReminderReads', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      reminder_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Reminders', key: 'id' },
        onDelete: 'CASCADE',
      },
      staff_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Staffs', key: 'id' },
        onDelete: 'CASCADE',
      },
      last_read_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    await qi.addIndex('ReminderReads', ['reminder_id', 'staff_id'], {
      unique: true,
      name: 'reminder_reads_reminder_staff_unique',
    });

    console.log('✅ Tabla ReminderReads creada');
    console.log('✅ Índice único (reminder_id, staff_id) creado');

    // Verificación
    const cols = await qi.describeTable('ReminderReads');
    console.log('\n📋 Estructura de ReminderReads:');
    Object.keys(cols).forEach(col => console.log(`   - ${col}: ${cols[col].type}`));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
