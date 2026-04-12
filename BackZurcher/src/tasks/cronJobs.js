const cron = require("node-cron");
const archiveBudgets = require("./archiveBudgets");
const { sendScheduledNewsletters, processRecurringNewsletters } = require("./newsletterScheduler");

// Solo activar el cron si la variable de entorno lo indica
if (process.env.ENABLE_AUTO_ARCHIVE === 'true') {
  // Configurar la tarea para ejecutarse al inicio de cada mes
  cron.schedule("0 0 1 * *", () => {
    console.log("⏰ [CRON] Ejecutando tarea de archivado de presupuestos...");
    archiveBudgets();
  });
  console.log("✅ Tarea programada para archivar presupuestos configurada (se ejecuta el día 1 de cada mes a las 00:00).");
} else {
  console.log("ℹ️ Auto-archivado de presupuestos DESHABILITADO. Activa con ENABLE_AUTO_ARCHIVE=true");
}

// Newsletter Scheduler - Verificar cada minuto si hay newsletters programados
if (process.env.ENABLE_NEWSLETTER_SCHEDULER !== 'false') {
  // Newsletters programados - cada minuto
  cron.schedule("* * * * *", () => {
    sendScheduledNewsletters();
  });
  
  // Newsletters recurrentes - cada minuto (verifica fecha/hora internamente)
  cron.schedule("* * * * *", () => {
    processRecurringNewsletters();
  });
  
  console.log("✅ Newsletter Scheduler activado - Verifica cada minuto para envíos programados y recurrentes");
} else {
  console.log("ℹ️ Newsletter Scheduler DESHABILITADO. Activa quitando ENABLE_NEWSLETTER_SCHEDULER=false");
}

// Exportar función para ejecución manual
module.exports = { 
  archiveBudgets,
  sendScheduledNewsletters,
  processRecurringNewsletters
};