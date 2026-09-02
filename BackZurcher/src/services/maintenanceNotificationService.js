'use strict';

const crypto = require('crypto');
const { MaintenanceVisit, Work, Budget, Permit, Staff } = require('../data');
const { sendEmail } = require('../utils/notifications/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.zurcherseptic.com';

const FAKE_EMAILS = ['falta@email.com', 'purchasing@zurcherseptic.com'];

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isValidEmail(email) {
  return email && email.includes('@') && !FAKE_EMAILS.includes(email.toLowerCase().trim());
}

async function getClientEmail(visit) {
  const work = await Work.findByPk(visit.workId, {
    include: [
      { model: Budget, as: 'budget', attributes: ['applicantEmail', 'applicantName'], required: false },
      { model: Permit, attributes: ['applicantEmail', 'applicantName'], required: false },
    ],
  });
  if (!work) return null;

  // Budget tiene prioridad; Permit como fallback
  const email = work.budget?.applicantEmail || work.Permit?.applicantEmail;
  const name  = work.budget?.applicantName  || work.Permit?.applicantName || 'Cliente';

  if (!isValidEmail(email)) return null;
  return { email: email.trim(), name, address: work.propertyAddress };
}

function buildEmailHtml({ name, address, visitNumber, scheduledDate, attempt, confirmUrl, rejectUrl, rescheduleUrl }) {
  const attemptLabels = ['primer', 'segundo', 'tercer'];
  const attemptLabel = attemptLabels[attempt - 1] || 'siguiente';
  const formattedDate = new Date(scheduledDate + 'T12:00:00').toLocaleDateString('es-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1e3a8a;padding:28px 40px;text-align:center;">
            <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic" style="height:52px;margin-bottom:10px;" />
            <p style="color:#93c5fd;margin:0;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Mantenimiento de Sistema Séptico</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="color:#1e293b;margin:0 0 8px;">Hola, ${name}</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
              Le enviamos este ${attemptLabel} aviso para recordarle que su visita de mantenimiento <strong>#${visitNumber}</strong> está programada para:
            </p>
            <div style="background:#eff6ff;border-left:4px solid #1e3a8a;border-radius:6px;padding:16px 20px;margin:0 0 24px;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#1e3a8a;">${formattedDate}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#475569;">📍 ${address}</p>
            </div>
            <p style="color:#475569;font-size:14px;margin:0 0 28px;">
              Por favor, confirme su disponibilidad usando uno de los botones a continuación:
            </p>
            <!-- Buttons -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 4px 12px;">
                  <a href="${confirmUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700;width:160px;text-align:center;">
                    ✅ Confirmar
                  </a>
                </td>
                <td align="center" style="padding:0 4px 12px;">
                  <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700;width:160px;text-align:center;">
                    ❌ Rechazar
                  </a>
                </td>
                <td align="center" style="padding:0 4px 12px;">
                  <a href="${rescheduleUrl}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700;width:160px;text-align:center;">
                    📅 Reprogramar
                  </a>
                </td>
              </tr>
            </table>
            <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;line-height:1.5;">
              Si tiene alguna pregunta, puede responder a este email o contactarnos al
              <a href="mailto:admin@zurcherseptic.com" style="color:#1e3a8a;">admin@zurcherseptic.com</a>.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Zurcher Septic &amp; Construction LLC<br>
              <a href="${FRONTEND_URL}" style="color:#1e3a8a;text-decoration:none;">www.zurcherseptic.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendMaintenanceNotification(visit) {
  const clientInfo = await getClientEmail(visit);
  if (!clientInfo) {
    console.log(`[Maintenance] Visita ${visit.id}: sin email válido, omitida.`);
    return { sent: false, reason: 'no_email' };
  }

  const token     = generateToken();
  const attempt   = (visit.notificationCount || 0) + 1;
  const confirmUrl    = `${FRONTEND_URL}/maintenance-confirm/${token}`;
  const rejectUrl     = `${FRONTEND_URL}/maintenance-reject/${token}`;
  const rescheduleUrl = `${FRONTEND_URL}/maintenance-reschedule?token=${token}`;

  const html = buildEmailHtml({
    name: clientInfo.name,
    address: clientInfo.address,
    visitNumber: visit.visitNumber,
    scheduledDate: visit.scheduledDate,
    attempt,
    confirmUrl,
    rejectUrl,
    rescheduleUrl,
  });

  await sendEmail({
    to: clientInfo.email,
    replyTo: 'admin@zurcherseptic.com',
    subject: `[Aviso #${attempt}] Visita de Mantenimiento Séptico — ${new Date(visit.scheduledDate + 'T12:00:00').toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    html,
  });

  await visit.update({
    clientToken: token,
    clientStatus: 'notified',
    notificationCount: attempt,
    lastNotificationSentAt: new Date(),
  });

  console.log(`[Maintenance] Email enviado a ${clientInfo.email} — visita ${visit.id} (intento ${attempt})`);
  return { sent: true, attempt, email: clientInfo.email };
}

async function waiveVisit(visit) {
  await visit.update({ clientStatus: 'waived' });

  // Notificar al owner
  try {
    const ownerStaff = await Staff.findOne({ where: { role: 'owner' }, attributes: ['email', 'name'] });
    if (ownerStaff?.email) {
      await sendEmail({
        to: ownerStaff.email,
        replyTo: 'admin@zurcherseptic.com',
        subject: `Mantenimiento EXIMIDO — Visita #${visit.visitNumber} (3 avisos sin respuesta)`,
        html: `<p>La visita de mantenimiento <strong>#${visit.visitNumber}</strong> fue eximida automáticamente después de 3 avisos sin respuesta del cliente.</p>
               <p><strong>Dirección:</strong> ${visit.work?.propertyAddress || visit.workId}</p>
               <p><strong>Fecha programada:</strong> ${visit.scheduledDate}</p>
               <p>Se recomienda generar el documento de exención (HD proof) desde el sistema.</p>`,
      });
    }
  } catch (e) {
    console.error('[Maintenance] Error notificando al owner sobre exención:', e.message);
  }

  console.log(`[Maintenance] Visita ${visit.id} marcada como waived (eximida por inactividad)`);
}

async function runDailyNotificationCheck() {
  const { Op } = require('sequelize');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d7 = new Date(today); d7.setDate(d7.getDate() + 7);
  const d4 = new Date(today); d4.setDate(d4.getDate() + 4);
  const d1 = new Date(today); d1.setDate(d1.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const toDateStr = (d) => d.toISOString().split('T')[0];

  const activeStatuses = ['pending_scheduling', 'scheduled', 'assigned'];

  const visits = await MaintenanceVisit.findAll({
    where: {
      status: { [Op.in]: activeStatuses },
      clientStatus: { [Op.in]: ['pending_notification', 'notified'] },
      scheduledDate: { [Op.gte]: toDateStr(yesterday) },
    },
    include: [{ model: Work, as: 'work', attributes: ['propertyAddress'] }],
  });

  let sent = 0, waived = 0;

  for (const visit of visits) {
    const schedDate = new Date(visit.scheduledDate + 'T12:00:00');
    schedDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((schedDate - today) / (1000 * 60 * 60 * 24));
    const count = visit.notificationCount || 0;

    // Waivar si ya se enviaron 3 y no respondió
    if (count >= 3 && visit.clientStatus === 'notified' && daysUntil <= 0) {
      await waiveVisit(visit);
      waived++;
      continue;
    }

    // Cooldown mínimo de 2 días entre emails
    const lastSent = visit.lastNotificationSentAt ? new Date(visit.lastNotificationSentAt) : null;
    const daysSinceLastSent = lastSent
      ? Math.floor((today - lastSent) / (1000 * 60 * 60 * 24))
      : 999;

    const shouldSend =
      (count === 0 && daysUntil <= 7) ||
      (count === 1 && daysUntil <= 4 && daysSinceLastSent >= 2) ||
      (count === 2 && daysUntil <= 1 && daysSinceLastSent >= 2);

    if (shouldSend) {
      const result = await sendMaintenanceNotification(visit);
      if (result.sent) sent++;
    }
  }

  console.log(`[Maintenance Cron] Notificaciones enviadas: ${sent}, eximidas: ${waived}`);
  return { sent, waived };
}

module.exports = {
  sendMaintenanceNotification,
  runDailyNotificationCheck,
  isValidEmail,
  getClientEmail,
};
