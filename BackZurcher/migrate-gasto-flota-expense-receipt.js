const { sequelize } = require('./src/data');

/**
 * Migración idempotente para soportar Gasto Flota en Expense + Receipt
 *
 * Qué hace:
 * 1) Agrega 'Gasto Flota' al enum de Expenses.typeExpense
 * 2) Agrega 'Gasto Flota' al enum de Receipts.type
 * 3) Agrega columna Expenses.fleetAssetId (UUID) si no existe
 * 4) Agrega FK Expenses.fleetAssetId -> fleet_assets.id si no existe
 * 5) Agrega índice sobre Expenses.fleetAssetId si no existe
 */

async function addEnumValueIfMissing(enumTypeName, value) {
  const [rows] = await sequelize.query(
    `
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = :enumTypeName
        AND e.enumlabel = :value
    `,
    {
      replacements: { enumTypeName, value },
    }
  );

  if (rows.length > 0) {
    console.log(`✅ '${value}' ya existe en ${enumTypeName}`);
    return;
  }

  await sequelize.query(`ALTER TYPE "${enumTypeName}" ADD VALUE '${value}';`);
  console.log(`✅ '${value}' agregado a ${enumTypeName}`);
}

async function addFleetAssetColumnIfMissing() {
  const [rows] = await sequelize.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Expenses'
        AND column_name = 'fleetAssetId'
    `
  );

  if (rows.length > 0) {
    console.log('✅ Columna Expenses.fleetAssetId ya existe');
    return;
  }

  await sequelize.query(`ALTER TABLE "Expenses" ADD COLUMN "fleetAssetId" UUID;`);
  console.log('✅ Columna Expenses.fleetAssetId agregada');
}

async function addFleetAssetFkIfMissing() {
  const constraintName = 'expenses_fleet_asset_id_fkey';

  const [rows] = await sequelize.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conname = :constraintName
    `,
    {
      replacements: { constraintName },
    }
  );

  if (rows.length > 0) {
    console.log(`✅ FK ${constraintName} ya existe`);
    return;
  }

  await sequelize.query(`
    ALTER TABLE "Expenses"
    ADD CONSTRAINT "${constraintName}"
    FOREIGN KEY ("fleetAssetId")
    REFERENCES "fleet_assets"("id")
    ON UPDATE CASCADE
    ON DELETE SET NULL;
  `);

  console.log(`✅ FK ${constraintName} agregada`);
}

async function addFleetAssetIndexIfMissing() {
  const indexName = 'idx_expenses_fleet_asset_id';

  const [rows] = await sequelize.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'Expenses'
        AND indexname = :indexName
    `,
    {
      replacements: { indexName },
    }
  );

  if (rows.length > 0) {
    console.log(`✅ Índice ${indexName} ya existe`);
    return;
  }

  await sequelize.query(`CREATE INDEX "${indexName}" ON "Expenses" ("fleetAssetId");`);
  console.log(`✅ Índice ${indexName} agregado`);
}

async function run() {
  try {
    console.log('🔄 === MIGRACIÓN GASTO FLOTA (EXPENSE + RECEIPT) ===\n');

    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    console.log('1. Actualizando enum de Expenses...');
    await addEnumValueIfMissing('enum_Expenses_typeExpense', 'Gasto Flota');

    console.log('\n2. Actualizando enum de Receipts...');
    await addEnumValueIfMissing('enum_Receipts_type', 'Gasto Flota');

    console.log('\n3. Verificando columna fleetAssetId...');
    await addFleetAssetColumnIfMissing();

    console.log('\n4. Verificando FK fleetAssetId...');
    await addFleetAssetFkIfMissing();

    console.log('\n5. Verificando índice fleetAssetId...');
    await addFleetAssetIndexIfMissing();

    console.log('\n🎉 Migración completada exitosamente');
  } catch (error) {
    console.error('\n❌ Error en migración:', error.message);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
    console.log('🔒 Conexión cerrada');
  }
}

run();
