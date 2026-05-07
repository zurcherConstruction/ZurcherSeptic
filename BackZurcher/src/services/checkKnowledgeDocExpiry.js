/**
 * Cron: Verifica documentos de Knowledge Base próximos a vencer.
 * - Avisa 30 días antes (configurable con KNOWLEDGE_DOC_EXPIRY_ALERT_DAYS)
 * - Crea un Reminder y notifica a todos los owners por email
 * - Solo notifica una vez por documento (campo expiry_notified)
 */
const { Op } = require('sequelize');
const { KnowledgeDocument, KnowledgeCategory, Staff, Reminder, ReminderAssignment } = require('../data');
const { sendEmail } = require('../utils/notifications/emailService');

const ALERT_DAYS = Number(process.env.KNOWLEDGE_DOC_EXPIRY_ALERT_DAYS || 30);

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const toDateOnly = (date) => date.toISOString().split('T')[0];

async function notifyDocumentExpiry({ owners, doc }) {
  const dueDate = doc.expiresAt; // already DATEONLY string
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((new Date(dueDate + 'T00:00:00') - today) / (1000 * 60 * 60 * 24));

  const reminderTitle = `Vencimiento de documento: ${doc.title} (${dueDate})`;
  const categoryLabel = doc.category ? `${doc.category.icon || ''} ${doc.category.name}` : 'Sin categoría';

  // Crear Reminder (evitar duplicados)
  const existing = await Reminder.findOne({
    where: { linkedEntityType: 'kb_doc', linkedEntityId: String(doc.id), dueDate },
  });

  if (!existing) {
    const reminder = await Reminder.create({
      title: reminderTitle,
      description: `Categoría: ${categoryLabel}\nDocumento: ${doc.title}\nVencimiento: ${dueDate}\nFaltan ${daysLeft} días.`,
      type: 'tagged',
      priority: daysLeft <= 7 ? 'urgent' : 'high',
      dueDate,
      linkedEntityType: 'kb_doc',
      linkedEntityId: String(doc.id),
      linkedEntityLabel: doc.title,
      createdBy: owners[0].id,
    });

    await ReminderAssignment.bulkCreate(
      owners.map((o) => ({ reminderId: reminder.id, staffId: o.id })),
      { ignoreDuplicates: true }
    );
  }

  // Enviar email (una sola vez — lo controla expiry_notified)
  const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/knowledge-base`;

  for (const owner of owners) {
    if (!owner.email) continue;

    const urgencyColor = daysLeft <= 7 ? '#dc2626' : daysLeft <= 30 ? '#d97706' : '#1d4ed8';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <h2 style="color: ${urgencyColor}; margin-bottom: 8px;">⚠️ Documento próximo a vencer</h2>
        <p style="margin-top: 0; color: #4b5563;">
          Se generó un recordatorio automático en el sistema de Knowledge Base.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Documento:</strong> ${doc.title}</p>
          <p style="margin: 0 0 8px;"><strong>Categoría:</strong> ${categoryLabel}</p>
          <p style="margin: 0 0 8px;"><strong>Fecha de vencimiento:</strong> ${dueDate}</p>
          <p style="margin: 0; color: ${urgencyColor};"><strong>Tiempo restante:</strong> ${daysLeft} días</p>
        </div>

        <a href="${dashboardUrl}" style="display:inline-block;background:${urgencyColor};color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">
          Ver en Knowledge Base
        </a>

        <p style="margin-top: 18px; font-size: 12px; color: #6b7280;">
          Este email se envía una sola vez por cada documento a punto de vencer.
        </p>
      </div>
    `;

    await sendEmail({
      to: owner.email,
      subject: `📄 Vencimiento: ${doc.title} — ${daysLeft} días`,
      html,
      text: `El documento "${doc.title}" vence el ${dueDate} (${daysLeft} días restantes).`,
    });
  }

  // Marcar como notificado
  await doc.update({ expiryNotified: true });

  return true;
}

const checkKnowledgeDocExpiry = async () => {
  try {
    console.log('\n🔍 [CRON - KB EXPIRY] Verificando vencimientos de Knowledge Base...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertDate = addDays(today, ALERT_DAYS);

    const owners = await Staff.findAll({
      where: { role: 'owner', isActive: true },
      attributes: ['id', 'name', 'email'],
    });

    if (!owners.length) {
      console.log('⚠️ [CRON - KB EXPIRY] No hay owners activos para notificar');
      return;
    }

    // Documentos activos con vencimiento dentro de los próximos ALERT_DAYS días,
    // que aún no hayan sido notificados
    const docs = await KnowledgeDocument.findAll({
      where: {
        active: true,
        expiryNotified: false,
        expiresAt: {
          [Op.gte]: toDateOnly(today),
          [Op.lte]: toDateOnly(alertDate),
        },
      },
      include: [{ model: KnowledgeCategory, as: 'category', attributes: ['name', 'icon'] }],
    });

    if (!docs.length) {
      console.log('✅ [CRON - KB EXPIRY] Sin documentos próximos a vencer.');
      return;
    }

    console.log(`📄 [CRON - KB EXPIRY] ${docs.length} documento(s) por vencer.`);
    let notified = 0;

    for (const doc of docs) {
      const sent = await notifyDocumentExpiry({ owners, doc });
      if (sent) notified++;
    }

    console.log(`✅ [CRON - KB EXPIRY] ${notified} notificación(es) enviadas.`);
  } catch (err) {
    console.error('❌ [CRON - KB EXPIRY] Error:', err.message);
  }
};

module.exports = { checkKnowledgeDocExpiry };
