const cron = require('node-cron');
const { sendScheduledNewsletters, processRecurringNewsletters } = require('../tasks/newsletterScheduler');

/**
 * 📧 CRON JOB: Newsletter Scheduler
 * 
 * Ejecuta verificaciones diarias para:
 * 1. Newsletters programados (scheduledAt)
 * 2. Newsletters recurrentes (daily/weekly/monthly)
 * 
 * Se ejecuta todos los días a las 00:00 (medianoche)
 * 
 * Para DESHABILITAR: Agregar ENABLE_NEWSLETTER_SCHEDULER=false en .env
 */

const startNewsletterSchedulerCron = () => {
  // Solo activar si no está explícitamente deshabilitado
  if (process.env.ENABLE_NEWSLETTER_SCHEDULER === 'false') {
    console.log('ℹ️ Newsletter Scheduler DESHABILITADO (ENABLE_NEWSLETTER_SCHEDULER=false)');
    return;
  }

  console.log('✅ Newsletter Scheduler programado para las 00:00 (medianoche) - Verifica programados y recurrentes');
  
  // Ejecutar todos los días a las 00:00 (medianoche)
  cron.schedule('0 0 * * *', async () => {
    console.log('\n⏰ [CRON - NEWSLETTER] Verificando newsletters programados y recurrentes...');
    
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
