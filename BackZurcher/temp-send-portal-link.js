const { Work, WorkNote } = require('./src/data');
const { Op } = require('sequelize');
const { getPortalInfoForWork, autoGenerateTokenForWork } = require('./src/services/ClientPortalService');
const { sendEmail } = require('./src/utils/notifications/emailService');

(async () => {
  const workId = 'c1e4c8e5-0760-4dce-bf69-b415d5a9e12a';

  const existing = await WorkNote.findOne({
    where: {
      workId,
      noteType: 'client_contact',
      relatedStatus: 'inProgress',
      message: { [Op.iLike]: 'Enlace del Portal de Seguimiento enviado%' }
    }
  });

  if (existing) {
    console.log('ALREADY_SENT_NOTE', existing.id);
    return;
  }

  const work = await Work.findByPk(workId, {
    attributes: ['idWork', 'idBudget', 'propertyAddress']
  });

  if (!work) {
    console.log('WORK_NOT_FOUND');
    return;
  }

  let portal = await getPortalInfoForWork(workId);
  if (!portal?.hasPortal) {
    await autoGenerateTokenForWork({ idWork: work.idWork, idBudget: work.idBudget });
    portal = await getPortalInfoForWork(workId);
  }

  if (!portal?.clientEmail || !portal?.portalUrl) {
    console.log('MISSING_PORTAL_INFO', portal);
    return;
  }

  const subject = 'Tu proyecto ya esta en progreso | Zurcher Septic';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
      <h2 style="margin-bottom: 8px; color: #0f4c81;">Tu proyecto esta en progreso</h2>
      <p>Hola ${portal.clientName || 'cliente'},</p>
      <p>Tu proyecto en <strong>${work.propertyAddress || 'tu direccion'}</strong> cambio al estado <strong>In Progress</strong>.</p>
      <p><a href="${portal.portalUrl}" style="background: #0f4c81; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 6px; display: inline-block;">Abrir Portal de Seguimiento</a></p>
      <p>${portal.portalUrl}</p>
    </div>
  `;

  const info = await sendEmail({ to: portal.clientEmail, subject, html });

  await WorkNote.create({
    workId,
    staffId: null,
    message: `Enlace del Portal de Seguimiento enviado automaticamente al cliente (${portal.clientEmail}) al pasar a inProgress - ${new Date().toLocaleString('es-ES')}`,
    noteType: 'client_contact',
    priority: 'medium',
    relatedStatus: 'inProgress',
    isResolved: true,
    mentionedStaffIds: []
  });

  console.log('SENT_TO', portal.clientEmail);
  console.log('MESSAGE_ID', info?.messageId || 'N/A');
})();
