const cron = require('node-cron');
const { BudgetNote, Budget, Staff } = require('../data');
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
 * 🔔 Servicio para verificar recordatorios de notas de budget
 * Se ejecuta diariamente a las 7:00 AM para enviar emails 24 horas antes del vencimiento
 * Solo envía UNA VEZ por alerta (marca reminderEmailSentAt)
 */

const checkBudgetReminders = async () => {
  try {
    console.log('\n🔍 [CRON - BUDGET REMINDERS] Verificando recordatorios de budget...');

    // Obtener fecha de MAÑANA en zona Orlando
    const tomorrowOrlando = getDateOnlyInOrlando(new Date(Date.now() + 24 * 60 * 60 * 1000));

    console.log(`📅 Buscando recordatorios para: ${tomorrowOrlando} (24hs antes, Orlando)`);

    // Buscar notas con recordatorios activos para mañana que NO hayan recibido email aún
    const reminders = await BudgetNote.findAll({
      where: {
        isReminderActive: true,
        reminderCompletedAt: null,
        reminderEmailSentAt: null, // Solo las que NO han recibido email
        [Op.and]: [
          sequelize.literal(`DATE("reminderDate" AT TIME ZONE '${ORLANDO_TZ}') = DATE '${tomorrowOrlando}'`)
        ]
      },
      include: [
        {
          model: Budget,
          as: 'budget', // 🔧 Usar alias correcto
          attributes: ['idBudget', 'propertyAddress', 'status', 'applicantName']
        },
        {
          model: Staff,
          as: 'author', // 🔧 Usar alias correcto
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['reminderDate', 'ASC']]
    });

    if (reminders.length === 0) {
      console.log('✅ [CRON - BUDGET REMINDERS] No hay recordatorios para mañana');
      return;
    }

    console.log(`📬 [CRON - BUDGET REMINDERS] Encontrados ${reminders.length} recordatorios:\n`);

    // Obtener todos los staff con rol follow-up
    const followUpStaff = await Staff.findAll({
      where: {
        role: 'follow-up', // 🔧 Usar guion, no guion bajo
        isActive: true
      },
      attributes: ['id', 'name', 'email']
    });

    if (followUpStaff.length === 0) {
      console.log('⚠️ [CRON - BUDGET REMINDERS] No hay usuarios con rol follow-up activos');
      return;
    }

    console.log(`👥 Usuarios follow-up: ${followUpStaff.map(s => s.name).join(', ')}`);
    console.log(`📧 Emails configurados: ${followUpStaff.map(s => `${s.name}: ${s.email || 'SIN EMAIL'}`).join(', ')}\n`);

    // Procesar cada recordatorio
    for (const reminder of reminders) {
      const budget = reminder.budget; // 🔧 Usar alias minúscula
      const author = reminder.author; // 🔧 Usar alias correcto

      console.log(`\n📋 Procesando recordatorio:`);
      console.log(`   Budget: ${budget.propertyAddress} (ID: ${budget.idBudget})`);
      console.log(`   Mensaje: ${reminder.message.substring(0, 60)}...`);
      console.log(`   Prioridad: ${reminder.priority}`);

      // Determinar a quiénes enviar
      let recipients = [];
      
      if (reminder.reminderFor && reminder.reminderFor.length > 0) {
        // Enviar a los especificados en reminderFor
        const specificRecipients = await Staff.findAll({
          where: {
            id: {
              [Op.in]: reminder.reminderFor
            },
            isActive: true
          },
          attributes: ['id', 'name', 'email']
        });
        recipients = specificRecipients;
      }
      
      // SIEMPRE agregar usuarios follow-up (evitando duplicados)
      const recipientIds = new Set(recipients.map(r => r.id));
      for (const followUp of followUpStaff) {
        if (!recipientIds.has(followUp.id)) {
          recipients.push(followUp);
        }
      }

      console.log(`   📬 Destinatarios totales: ${recipients.length}`);
      console.log(`   ${recipients.map(r => `${r.name} (${r.email || 'SIN EMAIL'})`).join(', ')}\n`);

      // Enviar email a cada destinatario
      for (const recipient of recipients) {
        if (!recipient.email) {
          console.log(`   ⚠️ ${recipient.name} no tiene email configurado - OMITIDO`);
          continue;
        }

        try {
          const emailSubject = `🔔 Recordatorio (24hs antes): ${budget.propertyAddress}`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">🔔 Recordatorio de Seguimiento</h2>
              
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-weight: bold;">
                  ⏰ Este recordatorio vence mañana (${new Date(reminder.reminderDate).toLocaleDateString('es-US', { timeZone: ORLANDO_TZ })})
                </p>
              </div>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">📋 Budget: ${budget.propertyAddress}</h3>
                <p><strong>Cliente:</strong> ${budget.applicantName || 'N/A'}</p>
                <p><strong>Estado:</strong> ${budget.status}</p>
                <p><strong>ID:</strong> ${budget.idBudget}</p>
              </div>

              <div style="background-color: ${reminder.priority === 'urgent' ? '#fef2f2' : reminder.priority === 'high' ? '#fff7ed' : '#f0f9ff'}; padding: 20px; border-radius: 8px; border-left: 4px solid ${reminder.priority === 'urgent' ? '#dc2626' : reminder.priority === 'high' ? '#ea580c' : '#2563eb'};">
                <p><strong>Prioridad:</strong> 
                  ${reminder.priority === 'urgent' ? '🔴 URGENTE' : 
                    reminder.priority === 'high' ? '🟠 ALTA' : 
                    reminder.priority === 'medium' ? '🟡 MEDIA' : '⚪ BAJA'}
                </p>
                <p><strong>Tipo:</strong> ${reminder.noteType}</p>
                <p><strong>Creado por:</strong> ${author?.name || 'Sistema'}</p>
                <p><strong>Mensaje:</strong></p>
                <p style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${reminder.message}</p>
              </div>

              <div style="margin-top: 20px;">
                <p>Este recordatorio fue programado para mañana. Revisa el budget en el sistema para más detalles.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/gestion-budgets" 
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
                  Ver en el Sistema
                </a>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #6b7280;">
                Zurcher Construction - Sistema de Gestión de Presupuestos
              </p>
            </div>
          `;

          await sendEmail({
            to: recipient.email,
            subject: emailSubject,
            html: emailHtml
          });
          console.log(`   ✅ Email enviado a: ${recipient.name} (${recipient.email})`);

        } catch (emailError) {
          console.error(`   ❌ Error enviando email a ${recipient.name}:`, emailError.message);
        }
      }

      console.log(`   📧 Emails enviados: ${recipients.length}`);
      
      // Marcar que se envió el email de recordatorio
      if (recipients.length > 0) {
        await reminder.update({
          reminderEmailSentAt: new Date()
        });
        console.log(`   ✅ Recordatorio marcado como enviado`);
      }
    }

    console.log('✅ [CRON - BUDGET REMINDERS] Proceso de recordatorios completado\n');

  } catch (error) {
    console.error('❌ [CRON - BUDGET REMINDERS] Error:', error);
  }
};

/**
 * Inicializar el CRON JOB para verificar recordatorios de budget
 * Se ejecuta diariamente a las 7:00 AM (horario de baja actividad)
 */
const startBudgetRemindersCron = () => {
  console.log('✅ Cron job para recordatorios de budget programado para las 7:00 AM');
  
  // Ejecutar todos los días a las 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    await checkBudgetReminders();
  }, {
    scheduled: true,
    timezone: "America/New_York"
  });
};

module.exports = { startBudgetRemindersCron, checkBudgetReminders };
