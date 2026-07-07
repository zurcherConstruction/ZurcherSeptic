/**
 * clear-corrupt-signed-budgets.js
 * Elimina archivos PDF firmados corruptos (< 20KB) del caché local
 * para que se re-descarguen correctamente desde DocuSign la próxima vez.
 * 
 * También limpia signedPdfPath en la BD para los registros afectados.
 * 
 * Uso: node clear-corrupt-signed-budgets.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize(process.env.DB_DEPLOY, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false,
});

const MIN_VALID_SIZE_KB = 20; // Un PDF firmado válido siempre pesa más de 20KB

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado a producción (Railway)\n');

    // Buscar todos los budgets con signedPdfPath registrado
    const [budgets] = await sequelize.query(`
      SELECT "idBudget", "signedPdfPath", "signatureMethod"
      FROM "Budgets"
      WHERE "signedPdfPath" IS NOT NULL
      ORDER BY "idBudget"
    `);

    console.log(`📄 Budgets con PDF firmado cacheado: ${budgets.length}\n`);

    let corrupted = 0;
    let missing = 0;
    let valid = 0;

    for (const budget of budgets) {
      const filePath = budget.signedPdfPath;

      if (!fs.existsSync(filePath)) {
        // El path está en la BD pero el archivo no existe
        console.log(`❌ [${budget.idBudget}] Archivo no encontrado: ${filePath}`);
        await sequelize.query(
          `UPDATE "Budgets" SET "signedPdfPath" = NULL WHERE "idBudget" = :id`,
          { replacements: { id: budget.idBudget } }
        );
        missing++;
        continue;
      }

      const stats = fs.statSync(filePath);
      const sizeKB = stats.size / 1024;

      if (sizeKB < MIN_VALID_SIZE_KB) {
        console.log(`⚠️  [${budget.idBudget}] PDF corrupto (${sizeKB.toFixed(1)} KB) → eliminando caché`);
        fs.unlinkSync(filePath);
        await sequelize.query(
          `UPDATE "Budgets" SET "signedPdfPath" = NULL WHERE "idBudget" = :id`,
          { replacements: { id: budget.idBudget } }
        );
        corrupted++;
      } else {
        console.log(`✅ [${budget.idBudget}] OK (${sizeKB.toFixed(1)} KB) — ${budget.signatureMethod}`);
        valid++;
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log(`  RESUMEN`);
    console.log(`  ✅ Válidos:   ${valid}`);
    console.log(`  ⚠️  Corruptos limpiados: ${corrupted}`);
    console.log(`  ❌ No encontrados: ${missing}`);
    console.log(`\n  Los ${corrupted + missing} presupuestos afectados se re-descargarán`);
    console.log(`  correctamente desde DocuSign la próxima vez que se visualicen.`);
    console.log('═══════════════════════════════════════════════');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

main();
