const cron = require('node-cron');
const { LeadNote, SalesLead, Staff } = require('../data');
const { sendEmail } = require('../utils/notifications/emailService');
const { Op } = require('sequelize');
const { sequelize } = require('../data');

const ORLANDO_TZ = 'America/New_York';
const getDateOnlyInOrlando = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: ORLANDO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(date);

/**
 * 🔔 Servicio para verificar recordatorios de notas de Sales Leads
 * Se ejecuta diariamente a las 7:00 AM para enviar emails 24 horas antes del vencimiento
 * Solo envía UNA VEZ por alerta (marca reminderEmailSentAt)
 */

const checkLeadReminders = async () => {
  try {
    console.log('\n🔍 [CRON - LEAD REMINDERS] Verificando recordatorios de leads...');

    // Obtener fecha de MAÑANA en zona Orlando
    const tomorrowOrlando = getDateOnlyInOrlando(new Date(Date.now() + 24 * 60 * 60 * 1000));

    console.log(`📅 Buscando recordatorios para: ${tomorrowOrlando} (24hs antes, Orlando)`);

    // Buscar notas con recordatorios activos para mañana que NO hayan recibido email aún
    const reminders = await LeadNote.findAll({
      where: {
        isReminderActive: true,
        reminderCompletedAt: null,
        reminderEmailSentAt: null,
        [Op.and]: [
          sequelize.literal(`DATE("reminderDate" AT TIME ZONE '${ORLANDO_TZ}') = DATE '${tomorrowOrlando}'`)
        ]
      },
      include: [
        {
          model: SalesLead,
          as: 'lead',
          attributes: ['id', 'applicantName', 'propertyAddress', 'status']
        },
        {
          model: Staff,
          as: 'author',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['reminderDate', 'ASC']]
    });

    if (reminders.length === 0) {
      console.log('✅ [CRON - LEAD REMINDERS] No hay recordatorios para mañana');
      return;
    }

    console.log(`📬 [CRON - LEAD REMINDERS] Encontrados ${reminders.length} recordatorios:\n`);

    // Obtener staff de ventas (sales_rep y recept activos)
    const salesStaff = await Staff.findAll({
      where: {
        role: { [Op.in]: ['sales_rep', 'recept'] },
        isActive: true
      },
      attributes: ['id', 'name', 'email']
    });

    if (salesStaff.length === 0) {
      console.log('⚠️ [CRON - LEAD REMINDERS] No hay usuarios sales_rep o recept activos');
    }

    // Procesar cada recordatorio
    for (const reminder of reminders) {
      const lead = reminder.lead;
      const author = reminder.author;
      const location = lead?.propertyAddress || lead?.applicantName || `Lead #${reminder.leadId}`;

      console.log(`\n📋 Procesando recordatorio:`);
      console.log(`   Lead: ${location}`);
      console.log(`   Mensaje: ${reminder.message.substring(0, 60)}...`);
      console.log(`   Prioridad: ${reminder.priority}`);

      // Determinar destinatarios
      let recipients = [];

      if (reminder.reminderFor && reminder.reminderFor.length > 0) {
        const specificRecipients = await Staff.findAll({
          where: {
            id: { [Op.in]: reminder.reminderFor },
            isActive: true
          },
          attributes: ['id', 'name', 'email']
        });
        recipients = specificRecipients;
      }

      // Siempre agregar sales staff (sin duplicados)
      const recipientIds = new Set(recipients.map(r => r.id));
      for (const s of salesStaff) {
        if (!recipientIds.has(s.id)) {
          recipients.push(s);
        }
      }

      console.log(`   📬 Destinatarios: ${recipients.map(r => `${r.name}`).join(', ')}`);

      if (recipients.length === 0) {
        console.log('   ⚠️ Sin destinatarios, omitiendo');
        continue;
      }

      // Enviar email a cada destinatario
      for (const recipient of recipients) {
        if (!recipient.email) {
          console.log(`   ⚠️ ${recipient.name} sin email - OMITIDO`);
          continue;
        }

        try {
          const priorityLabel =
            reminder.priority === 'urgent' ? '🔴 URGENTE' :
            reminder.priority === 'high'   ? '🟠 ALTA'    :
            reminder.priority === 'medium' ? '🟡 MEDIA'   : '⚪ BAJA';

          const priorityColor =
            reminder.priority === 'urgent' ? '#dc2626' :
            reminder.priority === 'high'   ? '#ea580c' : '#2563eb';

          const priorityBg =
            reminder.priority === 'urgent' ? '#fef2f2' :
            reminder.priority === 'high'   ? '#fff7ed' : '#f0f9ff';

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a3a5c;">🔔 Sales Lead Reminder</h2>

              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-weight: bold;">
                  ⏰ This reminder is due tomorrow (${new Date(reminder.reminderDate).toLocaleDateString('en-US', { timeZone: ORLANDO_TZ })})
                </p>
              </div>

              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">👤 Lead: ${location}</h3>
                <p><strong>Client:</strong> ${lead?.applicantName || 'N/A'}</p>
                <p><strong>Status:</strong> ${lead?.status || 'N/A'}</p>
              </div>

              <div style="background-color: ${priorityBg}; padding: 20px; border-radius: 8px; border-left: 4px solid ${priorityColor};">
                <p><strong>Priority:</strong> ${priorityLabel}</p>
                <p><strong>Type:</strong> ${reminder.noteType}</p>
                <p><strong>Created by:</strong> ${author?.name || 'System'}</p>
                <p><strong>Note:</strong></p>
                <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${reminder.message}</p>
              </div>

              <div style="margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/sales-leads"
                   style="display: inline-block; background-color: #1a3a5c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
                  View in Sales Leads
                </a>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #6b7280;">
                Zurcher Septic — Sales Management System
              </p>
            </div>
          `;

          await sendEmail({
            to: recipient.email,
            subject: `🔔 Lead Reminder (24h): ${location}`,
            html: emailHtml
          });
          console.log(`   ✅ Email enviado a: ${recipient.name} (${recipient.email})`);

        } catch (emailError) {
          console.error(`   ❌ Error enviando email a ${recipient.name}:`, emailError.message);
        }
      }

      // Marcar que se envió el email de recordatorio
      await reminder.update({ reminderEmailSentAt: new Date() });
      console.log(`   ✅ Recordatorio marcado como enviado`);
    }

    console.log('✅ [CRON - LEAD REMINDERS] Proceso completado\n');

  } catch (error) {
    console.error('❌ [CRON - LEAD REMINDERS] Error:', error);
  }
};

/**
 * Inicializar el CRON JOB para verificar recordatorios de leads
 * Se ejecuta diariamente a las 7:00 AM (mismo horario que budget reminders)
 */
const startLeadRemindersCron = () => {
  console.log('✅ Cron job para recordatorios de leads programado para las 7:00 AM');

  cron.schedule('0 7 * * *', async () => {
    await checkLeadReminders();
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
};

module.exports = { startLeadRemindersCron, checkLeadReminders };
