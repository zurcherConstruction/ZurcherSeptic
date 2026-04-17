const cron = require('node-cron');
const { sendScheduledNewsletters, processRecurringNewsletters } = require('../tasks/newsletterScheduler');

/**
 * 📧 CRON JOB: Newsletter Scheduler
 * 
 * Ejecuta verificaciones dos veces al día para:
 * 1. Newsletters programados (scheduledAt)
 * 2. Newsletters recurrentes (daily/weekly/monthly)
 * 
 * Se ejecuta a las 8:00 AM y 8:00 PM
 * Horarios optimizados para máxima tasa de apertura sin sobrecargar el servidor
 * 
 * Para DESHABILITAR: Agregar ENABLE_NEWSLETTER_SCHEDULER=false en .env
 */

const startNewsletterSchedulerCron = () => {
  // Solo activar si no está explícitamente deshabilitado
  if (process.env.ENABLE_NEWSLETTER_SCHEDULER === 'false') {
    console.log('ℹ️ Newsletter Scheduler DESHABILITADO (ENABLE_NEWSLETTER_SCHEDULER=false)');
    return;
  }

  console.log('✅ Newsletter Scheduler programado para las 8 AM y 8 PM - Verifica programados y recurrentes');
  
  // Ejecutar a las 8 AM y 8 PM (horarios óptimos para newsletters)
  cron.schedule('0 8,20 * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    console.log(`\n⏰ [CRON - NEWSLETTER ${hour}:00] Verificando newsletters programados y recurrentes...`);
    
    try {
      // 1. Procesar newsletters programados
      await sendScheduledNewsletters();
      
      // 2. Procesar newsletters recurrentes
      await processRecurringNewsletters();
      
      console.log('✅ [CRON - NEWSLETTER] Verificación completada\n');
    } catch (error) {
      console.error('❌ [CRON - NEWSLETTER] Error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
};

module.exports = { startNewsletterSchedulerCron };
