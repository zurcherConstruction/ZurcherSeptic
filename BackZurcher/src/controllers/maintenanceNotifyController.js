'use strict';

const fs = require('fs');
const { MaintenanceVisit, Work, Budget, Permit } = require('../data');
const { sendMaintenanceNotification, getClientEmail } = require('../services/maintenanceNotificationService');
const { sendEmail } = require('../utils/notifications/emailService');
const { generateMaintenanceHDProofPDF } = require('../utils/pdfGenerators/maintenanceHDProofPdfGenerator');


// GET /maintenance-notify/confirm/:token
const confirmVisit = async (req, res) => {
  try {
    const visit = await MaintenanceVisit.findOne({ where: { clientToken: req.params.token } });
    if (!visit) return res.status(404).json({ ok: false, message: 'Este enlace no es válido o ya fue utilizado.' });

    if (['confirmed', 'rejected', 'waived'].includes(visit.clientStatus)) {
      const msg = visit.clientStatus === 'confirmed'
        ? 'Ya había confirmado esta visita. ¡Gracias!'
        : 'Esta visita ya fue procesada.';
      return res.json({ ok: true, alreadyProcessed: true, message: msg });
    }

    await visit.update({
      clientStatus: 'confirmed',
      clientRespondedAt: new Date(),
    });

    await notifyOwner(visit, 'confirmed');

    return res.json({
      ok: true,
      message: `Gracias por confirmar. Su visita de mantenimiento #${visit.visitNumber} quedó registrada. Nos comunicaremos para coordinar el horario exacto.`,
    });
  } catch (err) {
    console.error('[Maintenance Notify] confirm error:', err.message);
    return res.status(500).json({ ok: false, message: 'Ocurrió un error. Intente nuevamente más tarde.' });
  }
};

// GET /maintenance-notify/reject/:token
const rejectVisit = async (req, res) => {
  try {
    const visit = await MaintenanceVisit.findOne({ where: { clientToken: req.params.token } });
    if (!visit) return res.status(404).json({ ok: false, message: 'Este enlace no es válido o ya fue utilizado.' });

    if (['confirmed', 'rejected', 'waived'].includes(visit.clientStatus)) {
      return res.json({ ok: true, alreadyProcessed: true, message: 'Esta visita ya fue procesada.' });
    }

    await visit.update({
      clientStatus: 'rejected',
      clientRespondedAt: new Date(),
    });

    await notifyOwner(visit, 'rejected');

    return res.json({
      ok: true,
      message: 'Registramos su respuesta. Si necesita coordinar un mantenimiento en el futuro, no dude en contactarnos.',
    });
  } catch (err) {
    console.error('[Maintenance Notify] reject error:', err.message);
    return res.status(500).json({ ok: false, message: 'Ocurrió un error. Intente nuevamente más tarde.' });
  }
};

// POST /api/maintenance-notify/reschedule/:token
// Body: { proposedDate: 'YYYY-MM-DD' }
const rescheduleVisit = async (req, res) => {
  try {
    const visit = await MaintenanceVisit.findOne({ where: { clientToken: req.params.token } });
    if (!visit) return res.status(404).json({ error: 'Token inválido' });

    const { proposedDate } = req.body;
    if (!proposedDate || !/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) {
      return res.status(400).json({ error: 'proposedDate requerido (YYYY-MM-DD)' });
    }

    await visit.update({
      clientStatus: 'reschedule_requested',
      clientProposedDate: proposedDate,
      clientRespondedAt: new Date(),
    });

    await notifyOwner(visit, 'reschedule_requested', proposedDate);

    return res.json({ ok: true, message: 'Solicitud de reprogramación registrada.' });
  } catch (err) {
    console.error('[Maintenance Notify] reschedule error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// POST /api/maintenance/:visitId/send-notification  (autenticado)
const manualSendNotification = async (req, res) => {
  try {
    const visit = await MaintenanceVisit.findByPk(req.params.visitId);
    if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });

    if (['confirmed', 'rejected', 'waived'].includes(visit.clientStatus)) {
      return res.status(400).json({ error: `La visita ya está en estado "${visit.clientStatus}"` });
    }
    if ((visit.notificationCount || 0) >= 3) {
      return res.status(400).json({ error: 'Ya se enviaron 3 notificaciones. Marcar como eximida si el cliente no responde.' });
    }

    const result = await sendMaintenanceNotification(visit);
    if (!result.sent) {
      return res.status(422).json({ error: 'No hay email válido para esta visita.', reason: result.reason });
    }

    return res.json({ ok: true, attempt: result.attempt, sentTo: result.email });
  } catch (err) {
    console.error('[Maintenance Notify] manual send error:', err.message);
    return res.status(500).json({ error: 'Error interno al enviar notificación' });
  }
};

// POST /maintenance/:visitId/waive  (autenticado, manual)
const manualWaiveVisit = async (req, res) => {
  try {
    const visit = await MaintenanceVisit.findByPk(req.params.visitId);
    if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });

    await visit.update({ clientStatus: 'waived', clientRespondedAt: new Date() });
    await notifyOwner(visit, 'waived');

    return res.json({ ok: true, message: 'Visita marcada como eximida.' });
  } catch (err) {
    console.error('[Maintenance Notify] waive error:', err.message);
    return res.status(500).json({ error: 'Error interno' });
  }
};

async function notifyOwner(visit, action, proposedDate = null) {
  try {
    const { Staff, Work } = require('../data');
    const owners = await Staff.findAll({ where: { role: 'owner' }, attributes: ['email'] });
    const ownerEmails = owners.map(o => o.email).filter(Boolean);
    if (!ownerEmails.length) return;

    const work = await Work.findByPk(visit.workId, { attributes: ['propertyAddress'] });
    const address = work?.propertyAddress || visit.workId;

    const labels = {
      confirmed: { subject: '✅ Cliente confirmó visita de mantenimiento', body: `El cliente confirmó la visita de mantenimiento <strong>#${visit.visitNumber}</strong>.<br><br><strong>Dirección:</strong> ${address}` },
      rejected:  { subject: '❌ Cliente rechazó visita de mantenimiento',  body: `El cliente rechazó la visita de mantenimiento <strong>#${visit.visitNumber}</strong>.<br><br><strong>Dirección:</strong> ${address}` },
      reschedule_requested: {
        subject: '📅 Cliente solicita reprogramar visita de mantenimiento',
        body: `El cliente solicitó reprogramar la visita <strong>#${visit.visitNumber}</strong>.<br><br><strong>Dirección:</strong> ${address}<br><strong>Fecha propuesta:</strong> ${proposedDate}`,
      },
      waived: {
        subject: `🏛️ Visita #${visit.visitNumber} eximida manualmente (HD)`,
        body: `La visita de mantenimiento <strong>#${visit.visitNumber}</strong> fue eximida manualmente después de ${visit.notificationCount || 0} aviso(s) sin respuesta del cliente.<br><br><strong>Dirección:</strong> ${address}<br><br>Se recomienda generar el documento de exención (HD proof) desde el sistema.`,
      },
    };

    const { subject, body } = labels[action] || {};
    if (!subject) return;

    await sendEmail({
      to: ownerEmails.join(','),
      replyTo: 'admin@zurcherseptic.com',
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#1e293b"><p>${body}</p><p style="color:#64748b;font-size:13px">Revisá el sistema para más detalles.</p></div>`,
    });
  } catch (e) {
    console.error('[Maintenance Notify] Error notificando al owner:', e.message);
  }
}

// GET /maintenance/:visitId/hd-proof-pdf  (autenticado)
const downloadHDProofPDF = async (req, res) => {
  try {
    const visit = await MaintenanceVisit.findByPk(req.params.visitId, {
      include: [
        { model: Work, as: 'work', include: [{ model: Permit }] },
      ],
    });
    if (!visit) return res.status(404).json({ error: 'Visita no encontrada' });

    const clientInfo = await getClientEmail(visit);
    const propertyAddress = visit.work?.propertyAddress || 'N/A';
    const systemType = visit.work?.Permit?.systemType || 'N/A';

    const pdfPath = await generateMaintenanceHDProofPDF({
      visit: visit.toJSON ? visit.toJSON() : visit,
      clientEmail: clientInfo?.email || null,
      clientName: clientInfo?.name || 'N/A',
      propertyAddress,
      systemType,
    });

    if (!fs.existsSync(pdfPath)) {
      return res.status(500).json({ error: 'Error al generar el PDF' });
    }

    const safeAddr = propertyAddress.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `HD_Proof_Visita${visit.visitNumber}_${safeAddr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
    fileStream.on('end', () => {
      setTimeout(() => {
        try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch {}
      }, 1000);
    });
  } catch (err) {
    console.error('[Maintenance Notify] HD Proof PDF error:', err.message);
    res.status(500).json({ error: 'Error interno al generar el PDF' });
  }
};

module.exports = {
  confirmVisit,
  rejectVisit,
  rescheduleVisit,
  manualSendNotification,
  manualWaiveVisit,
  downloadHDProofPDF,
};
