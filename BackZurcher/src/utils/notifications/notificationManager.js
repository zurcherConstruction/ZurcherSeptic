const { getNotificationDetails } = require('./notificationService');
const { getNotificationDetailsApp } = require('./notificationServiceApp');
const { sendEmail } = require('./emailService');
const { Notification, Staff } = require('../../data');
const { Expo } = require('expo-server-sdk');
const { filterDuplicates, registerSent } = require('./notificationDeduplicator');
const { createRoutedReminder } = require('../createRoutedReminder');
let expo = new Expo();

const getCanonicalRecipientEmail = (staff) => {
  const rawEmail = (staff?.email || '').toString().trim().toLowerCase();
  const adminInbox = (process.env.ADMIN_EMAIL || process.env.SMTP_USER || '').toString().trim().toLowerCase();

  if (staff?.role === 'admin' && adminInbox) {
    return adminInbox;
  }

  return rawEmail;
};

const isValidEmail = (email) => typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email.trim());

const sendNotifications = async (status, work, budget, io, context = {}) => {
  try {
    // 🔧 AUTO-DETECTAR ORDEN DE PARÁMETROS
    // Si el tercer parámetro tiene el método 'to', es el objeto io, no budget
    if (budget && typeof budget === 'object' && typeof budget.to === 'function') {
      // Orden nuevo: sendNotifications(status, work, io, context)
      context = io || {};
      io = budget;
      budget = null;
    }
    
    // Obtener el ID de la entidad para deduplicación
    // 🆕 Incluir idExpense para evitar conflictos cuando se crean múltiples expenses
    const entityId = work?.idExpense || work?.idWork || budget?.idBudget || work?.id || budget?.id || 'unknown';
    
    // Obtener detalles para notificaciones por correo
    const emailDetails = await getNotificationDetails(status, work || budget, context);

    if (emailDetails) {
      const { staffToNotify, message, subject, htmlTemplate, roles } = emailDetails;
      
      // 🛡️ DEDUPLICACIÓN DESHABILITADA - Siempre enviar correos
      // const filteredStaff = filterDuplicates(staffToNotify, status, entityId);
      const filteredStaff = staffToNotify; // ✅ Usar lista completa sin filtrar
      const sentRecipientEmails = new Set();
      
      // if (filteredStaff.length === 0) {
      //   console.log(`⏭️ Todas las notificaciones de email para "${status}" (${entityId}) fueron filtradas por duplicación`);
      // }

      for (const staff of filteredStaff) {
        const recipientEmail = getCanonicalRecipientEmail(staff);

        if (!isValidEmail(recipientEmail)) {
          console.error(`El usuario ${staff.id} no tiene un correo electrónico válido: ${staff.email}`);
          continue;
        }

        if (sentRecipientEmails.has(recipientEmail)) {
          console.log(`🚫 Bloqueando envío duplicado a ${recipientEmail} (canal ya procesado en este lote)`);
          continue;
        }
        
        // 🚫 FILTRO 1: No notificar al usuario que realiza la acción
        // Evita que recibas emails de tus propias acciones
        if (context?.userId && staff.id && context.userId === staff.id) {
          console.log(`🚫 Bloqueando auto-notificación a ${recipientEmail} (usuario ${staff.id} realizó la acción)`);
          continue;
        }

        try {
          let htmlContent;
          
          // 🎨 Si hay un template HTML personalizado, usarlo (ej: menciones en notas)
          if (htmlTemplate && typeof htmlTemplate === 'function') {
            htmlContent = htmlTemplate(work || budget, context);
          } else {
            // Lógica existente para otros tipos de notificaciones
            const isQuickRejection = status === 'initial_inspection_rejected' && work.resultDocumentUrl;
            const isBudgetCreated = status === 'budgetCreated' || status === 'budgetSentToSignNow';
            
            if (isQuickRejection) {
              // Mostrar la imagen/PDF como enlace y/o vista previa si es imagen
              const isImage = work.resultDocumentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              htmlContent = `
                <div style=\"font-family: Arial, sans-serif; color: #333;\">
                  <h2 style=\"color: #1a365d;\">${work.propertyAddress}</h2>
                  <p>${message.replace(work.resultDocumentUrl, '')}</p>
                  <p><strong>Documento de rechazo:</strong></p>
                  ${isImage ? `<img src=\"${work.resultDocumentUrl}\" alt=\"Documento de rechazo\" style=\"max-width:400px;max-height:400px;display:block;margin-bottom:10px;\" />` : ''}
                  <a href=\"${work.resultDocumentUrl}\" target=\"_blank\" style=\"color:#1a365d;word-break:break-all;\">${work.resultDocumentUrl}</a>
                </div>
              `;
            } else if (isBudgetCreated) {
              // Mantener el formato especial SOLO para creación/envío de presupuesto
              htmlContent = `
                <div style=\"font-family: Arial, sans-serif; color: #333;\">
                  <h2 style=\"color: #1a365d;\">Presupuesto listo para revisión</h2>
                  <p>${message}</p>
                  ${work.budgetLink || (work.notificationDetails && work.notificationDetails.budgetLink) ? `
                    <a href=\"${work.budgetLink || (work.notificationDetails && work.notificationDetails.budgetLink)}\" 
                       style=\"display:inline-block;margin:20px 0;padding:12px 24px;background:#1a365d;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;\">
                      Ver presupuestos
                    </a>
                  ` : ''}
                  ${work.attachments || (work.notificationDetails && work.notificationDetails.attachments) ? `<p>Adjunto encontrarás el PDF del presupuesto para revisión.</p>` : ''}
                </div>
              `;
            } else {
              // Para todas las demás notificaciones, usar la dirección como título
              // Si no hay dirección, usar un título genérico basado en el tipo de notificación
              const titleText = (work || budget)?.propertyAddress || 
                              (status === 'expenseCreated' ? 'Nuevo Gasto Registrado' :
                               status === 'incomeRegistered' ? 'Nuevo Ingreso Registrado' :
                               status === 'expenseUpdated' ? 'Gasto Actualizado' : 
                               'Notificación del Sistema');
              
              htmlContent = `
                <div style=\"font-family: Arial, sans-serif; color: #333;\">
                  <h2 style=\"color: #1a365d;\">${titleText}</h2>
                  <p>${message}</p>
                </div>
              `;
            }
          }
          
          // Generar asunto del correo
          const emailSubject = subject || 
                              (work || budget)?.propertyAddress || 
                              (status === 'expenseCreated' ? 'Nuevo Gasto Registrado' :
                               status === 'incomeRegistered' ? 'Nuevo Ingreso Registrado' :
                               status === 'expenseUpdated' ? 'Gasto Actualizado' : 
                               'Notificación del Sistema');
          
          await sendEmail({
            to: recipientEmail,
            subject: emailSubject,
            text: message,
            html: htmlContent,
            attachments: work.attachments || (work.notificationDetails && work.notificationDetails.attachments) || [],
          });

          sentRecipientEmails.add(recipientEmail);
        } catch (error) {
          console.error(`Error al enviar correo a ${recipientEmail}:`, error);
        }
      }
      
      // 🛡️ Registrar los correos enviados exitosamente
      registerSent(filteredStaff, status, entityId);

      // 📌 Crear recordatorio automático para el responsable configurado
      await createRoutedReminder(status, work || budget || {});
    }

    // --- Notificaciones Push ---
    const appDetails = await getNotificationDetailsApp(status, work, budget, context);

    if (appDetails && appDetails.staffToNotify.length > 0) {
      const { staffToNotify, message: pushMessageBase } = appDetails;

      let messagesToSend = [];

      for (const staffMember of staffToNotify) {
        try {
          // 1. Crear notificación en BD
          const notificationRecord = await Notification.create({
            title: `Estado: ${status}`,
            message: pushMessageBase,
            staffId: staffMember.id,
            type: 'push',
            isRead: false,
          });

          // 2. Emitir por Socket.IO
          if (io) {
            io.to(staffMember.id).emit('newNotification', notificationRecord);
          }

          // 3. Preparar notificación push
          const staffWithToken = await Staff.findByPk(staffMember.id, { attributes: ['pushToken'] });
          const pushToken = staffWithToken?.pushToken;

          if (pushToken && Expo.isExpoPushToken(pushToken)) {
            const unreadCount = await Notification.count({
              where: { staffId: staffMember.id, isRead: false }
            });

            messagesToSend.push({
              to: pushToken,
              sound: 'default',
              title: notificationRecord.title,
              body: notificationRecord.message,
              data: {
                notificationId: notificationRecord.id,
                staffId: staffMember.id,
                type: 'workUpdate'
              },
              badge: unreadCount + 1,
              priority: 'high',
              channelId: 'default',
              ios: {
                sound: 'default',
                badge: unreadCount + 1,
                _displayInForeground: true,
              },
              android: {
                sound: 'default',
                priority: 'high',
                channelId: 'default',
              }
            });
          } else {
            console.warn(`Usuario ${staffMember.id} no tiene un push token válido.`);
          }

        } catch (error) {
          console.error(`Error procesando notificación push para ${staffMember.id}:`, error);
        }
      }

      // 4. Enviar los mensajes push en lotes
      if (messagesToSend.length > 0) {
        let chunks = expo.chunkPushNotifications(messagesToSend);
        let tickets = [];
        for (let chunk of chunks) {
          try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
          } catch (error) {
            console.error('Error enviando chunk de notificaciones push:', error);
          }
        }
        // (Opcional: lógica para manejar receipts de los tickets)
      }
    }

  } catch (error) {
    console.error('Error general en sendNotifications:', error);
  }
};

module.exports = { sendNotifications };