const { Newsletter, NewsletterSubscriber, NewsletterRecipient, NewsletterTemplate } = require('../data');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

/**
 * Envía newsletters programados que han llegado a su fecha de envío
 */
const sendScheduledNewsletters = async () => {
  try {
    const now = new Date();
    
    // Buscar newsletters programados cuya fecha de envío ya pasó
    const scheduledNewsletters = await Newsletter.findAll({
      where: {
        status: 'scheduled',
        scheduledAt: {
          [Op.lte]: now
        }
      },
      include: [
        {
          model: NewsletterTemplate,
          as: 'template'
        }
      ]
    });

    // Solo mostrar log si hay newsletters para enviar
    if (scheduledNewsletters.length > 0) {
      console.log('📧 [Newsletter Scheduler] Verificando newsletters programados...');
      console.log(`📊 [Newsletter Scheduler] Encontrados ${scheduledNewsletters.length} newsletters para enviar`);
    }

    for (const newsletter of scheduledNewsletters) {
      try {
        await processNewsletterSending(newsletter);
        console.log(`✅ [Newsletter Scheduler] Newsletter "${newsletter.name}" enviado exitosamente`);
      } catch (error) {
        console.error(`❌ [Newsletter Scheduler] Error enviando newsletter ${newsletter.id}:`, error.message);
        await newsletter.update({ status: 'failed' });
      }
    }
  } catch (error) {
    console.error('❌ [Newsletter Scheduler] Error en sendScheduledNewsletters:', error);
  }
};

/**
 * Procesa newsletters recurrentes y crea envíos automáticos
 */
const processRecurringNewsletters = async () => {
  try {
    const now = new Date();
    const currentDay = now.getDay() || 7; // 1-7 (Lunes-Domingo)
    const currentDate = now.getDate(); // 1-31
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Buscar newsletters con metadata de recurrencia activa
    const recurringNewsletters = await Newsletter.findAll({
      where: {
        status: {
          [Op.in]: ['draft', 'scheduled', 'sent'] // Los recurrentes pueden estar en cualquier estado
        }
      }
    });

    // Filtrar los que tienen metadata de recurrencia
    const activeRecurring = recurringNewsletters.filter(n => {
      if (!n.metadata || !n.metadata.recurring || !n.metadata.enabled) return false;
      
      const { frequency, day, time } = n.metadata;
      
      // Parsear la hora programada
      const [schedHour, schedMinute] = (time || '09:00').split(':').map(Number);
      
      // Verificar si es el momento de enviar
      const isTimeMatch = currentHour === schedHour && currentMinute === schedMinute;
      
      if (!isTimeMatch) return false;
      
      // Verificar frecuencia
      if (frequency === 'daily') {
        return true;
      } else if (frequency === 'weekly') {
        return currentDay === parseInt(day);
      } else if (frequency === 'monthly') {
        return currentDate === parseInt(day);
      }
      
      return false;
    });

    // Solo mostrar log si hay newsletters recurrentes para enviar
    if (activeRecurring.length > 0) {
      console.log('🔄 [Newsletter Scheduler] Verificando newsletters recurrentes...');
      console.log(`📊 [Newsletter Scheduler] Encontrados ${activeRecurring.length} newsletters recurrentes para enviar ahora`);
    }

    for (const newsletter of activeRecurring) {
      try {
        // Crear una copia del newsletter para este envío
        const newSend = await Newsletter.create({
          name: `${newsletter.name} - ${now.toLocaleDateString('es-AR')}`,
          subject: newsletter.subject,
          htmlContent: newsletter.htmlContent,
          textContent: newsletter.textContent,
          templateId: newsletter.templateId,
          status: 'sending',
          createdByStaffId: newsletter.createdByStaffId,
          metadata: {
            ...newsletter.metadata,
            parentNewsletteId: newsletter.id,
            autoSent: true,
            sentDate: now.toISOString()
          }
        });

        await processNewsletterSending(newSend);
        console.log(`✅ [Newsletter Scheduler] Newsletter recurrente "${newsletter.name}" enviado`);
      } catch (error) {
        console.error(`❌ [Newsletter Scheduler] Error enviando newsletter recurrente ${newsletter.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('❌ [Newsletter Scheduler] Error en processRecurringNewsletters:', error);
  }
};

/**
 * Envía un newsletter a sus destinatarios
 */
const processNewsletterSending = async (newsletter) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    pool: true, // ✅ REUTILIZAR conexión en lugar de crear nueva cada vez
    maxConnections: 1, // ✅ Una sola conexión para evitar múltiples logins
    maxMessages: Infinity, // ✅ Sin límite de mensajes por conexión
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Actualizar estado a "enviando"
  await newsletter.update({ status: 'sending' });

  // Obtener destinatarios según filtros en metadata
  const filters = newsletter.metadata?.recipientFilters || {};
  let whereClause = {};

  if (filters.filter === 'active') {
    whereClause.status = 'active';
  } else if (filters.filter === 'tags' && filters.tags && filters.tags.length > 0) {
    whereClause.tags = {
      [Op.overlap]: filters.tags
    };
  }

  const recipients = await NewsletterSubscriber.findAll({
    where: whereClause
  });

  let sentCount = 0;
  let failedCount = 0;

  // 🚀 OPTIMIZACIÓN: Procesar en lotes con concurrencia controlada
  const BATCH_SIZE = 3; // ✅ Reducido de 10 a 3 para evitar rate limit
  const DELAY_BETWEEN_BATCHES = 2000; // ✅ Aumentado a 2 segundos
  
  console.log(`📧 [Newsletter Scheduler] Procesando ${recipients.length} destinatarios en lotes de ${BATCH_SIZE}`);

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);
    
    console.log(`📦 [Newsletter Scheduler] Procesando lote ${batchNumber}/${totalBatches} (${batch.length} emails)`);

    // Procesar este lote en paralelo
    const batchPromises = batch.map(async (subscriber) => {
      try {
        // Reemplazar variables
        let html = newsletter.htmlContent || '';
        let text = newsletter.textContent || '';
        
        html = html.replace(/{{firstName}}/g, subscriber.firstName || '');
        html = html.replace(/{{lastName}}/g, subscriber.lastName || '');
        html = html.replace(/{{email}}/g, subscriber.email || '');
        
        text = text.replace(/{{firstName}}/g, subscriber.firstName || '');
        text = text.replace(/{{lastName}}/g, subscriber.lastName || '');
        text = text.replace(/{{email}}/g, subscriber.email || '');

        // Agregar link de desuscripción
        const unsubscribeLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/newsletter/unsubscribe/${subscriber.id}`;
        html += `<br/><br/><small><a href="${unsubscribeLink}">Desuscribirse</a></small>`;
        text += `\n\nDesuscribirse: ${unsubscribeLink}`;

        await transporter.sendMail({
          from: `"Zurcher Septic" <${process.env.SMTP_USER}>`,
          to: subscriber.email,
          subject: newsletter.subject,
          html,
          text
        });

        // Registrar envío
        await NewsletterRecipient.create({
          newsletterId: newsletter.id,
          subscriberId: subscriber.id,
          sentAt: new Date(),
          status: 'sent'
        });

        return { success: true, email: subscriber.email };
      } catch (error) {
        console.error(`❌ Error enviando a ${subscriber.email}:`, error.message);
        
        // Registrar fallo
        await NewsletterRecipient.create({
          newsletterId: newsletter.id,
          subscriberId: subscriber.id,
          status: 'failed'
        });

        return { success: false, email: subscriber.email };
      }
    });

    // Esperar a que termine todo el lote
    const results = await Promise.allSettled(batchPromises);
    
    // Contar resultados
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    });

    console.log(`✅ Lote ${batchNumber}/${totalBatches} completado - Enviados: ${sentCount}, Fallidos: ${failedCount}`);

    // Pausa entre lotes para no saturar el servidor SMTP
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  // Contar contadores finales (incluyendo 'opened' como enviados exitosos)
  const allRecipients = await NewsletterRecipient.findAll({
    where: { newsletterId: newsletter.id },
    attributes: ['status']
  });
  
  const finalSentCount = allRecipients.filter(r => r.status === 'sent' || r.status === 'opened').length;
  const finalFailedCount = allRecipients.filter(r => r.status === 'failed').length;
  const finalOpenedCount = allRecipients.filter(r => r.status === 'opened').length;

  // Actualizar newsletter con resultados
  await newsletter.update({
    status: finalSentCount > 0 ? 'sent' : 'failed',
    recipientCount: recipients.length,
    sentCount: finalSentCount,
    failedCount: finalFailedCount,
    openedCount: finalOpenedCount,
    metadata: {
      ...newsletter.metadata,
      lastSentAt: new Date().toISOString()
    }
  });

  // 🔒 Cerrar el pool de conexiones SMTP
  transporter.close();

  return { sentCount, failedCount, totalRecipients: recipients.length };
};

module.exports = {
  sendScheduledNewsletters,
  processRecurringNewsletters,
  processNewsletterSending
};
