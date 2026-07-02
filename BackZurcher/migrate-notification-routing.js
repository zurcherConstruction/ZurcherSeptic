const { conn } = require('./src/data');

async function run() {
  try {
    await conn.authenticate();
    console.log('✅ Conectado a la base de datos\n');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS "NotificationRoutings" (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type  VARCHAR(50) NOT NULL UNIQUE,
        staff_id    UUID NOT NULL REFERENCES "Staffs"(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✅ Tabla NotificationRoutings creada (o ya existía)');
    console.log('\n📋 Tipos de eventos que podés configurar desde la pantalla:');
    console.log('   • fleet_registration  — Vencimiento de Placa / Registro');
    console.log('   • fleet_insurance     — Vencimiento de Seguro');
    console.log('   • fleet_maintenance   — Mantenimiento Programado');
    console.log('   • kb_doc_expiry       — Documentos por Vencer (KB)');
    console.log('\n✅ MIGRACIÓN COMPLETADA\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await conn.close();
    process.exit(0);
  }
}

run();
