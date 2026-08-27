const { QuoteRequest, Staff, SimpleWork, NotificationRouting, Reminder, ReminderAssignment } = require('../data');

const cloudinary = require('cloudinary').v2;

// Mapeo de workType de QuoteRequest a SimpleWork ENUM
const QUOTE_TO_SW_WORK_TYPE = {
  reparacion:  'repair',
  desagote:    'other',
  instalacion: 'other',
  plomeria:    'plumbing',
  inspeccion:  'other',
  culvert:     'culvert',
  drainfield:  'drainfield',
  otro:        'other',
};

const WORK_TYPE_LABELS = {
  reparacion: 'Reparación',
  desagote: 'Desagote',
  instalacion: 'Instalación',
  plomeria: 'Plomería',
  inspeccion: 'Inspección',
  culvert: 'Culvert',
  drainfield: 'Drainfield',
  otro: 'Otro',
};

const URGENCY_LABELS = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  emergency: 'Emergencia',
};

// GET /api/quote-requests
exports.getAll = async (req, res) => {
  try {
    const { status, urgency } = req.query;
    const where = {};
    if (status) where.status = status;
    if (urgency) where.urgency = urgency;

    const requests = await QuoteRequest.findAll({
      where,
      include: [
        {
          model: Staff,
          as: 'reportedBy',
          attributes: ['id', 'name', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(requests);
  } catch (err) {
    console.error('QuoteRequest.getAll error:', err);
    return res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

// GET /api/quote-requests/:id
exports.getById = async (req, res) => {
  try {
    const request = await QuoteRequest.findByPk(req.params.id, {
      include: [
        {
          model: Staff,
          as: 'reportedBy',
          attributes: ['id', 'name', 'role'],
        },
      ],
    });
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });
    return res.json(request);
  } catch (err) {
    console.error('QuoteRequest.getById error:', err);
    return res.status(500).json({ error: 'Error al obtener solicitud' });
  }
};

// POST /api/quote-requests
exports.create = async (req, res) => {
  try {
    const {
      clientName, clientPhone, clientEmail, clientAddress,
      workType, description, urgency,
    } = req.body;

    if (!clientName) {
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    }

    const staffId = req.staff?.id || req.user?.id || null;

    const request = await QuoteRequest.create({
      clientName,
      clientPhone: clientPhone || null,
      clientEmail: clientEmail || null,
      clientAddress: clientAddress || null,
      workType: workType || 'otro',
      description: description || null,
      urgency: urgency || 'normal',
      photos: [],
      reportedByStaffId: staffId,
      status: 'reviewing',
    });

    // Auto-crear SimpleWork y asignarlo al staff configurado en routing
    try {
      const routing = await NotificationRouting.findOne({ where: { eventType: 'quote_request' } });
      const routingStaffId = routing?.staffId || null;

      const swWorkType = QUOTE_TO_SW_WORK_TYPE[workType] || 'other';
      const workNumber = await SimpleWork.generateWorkNumber();

      const simpleWork = await SimpleWork.create({
        workNumber,
        workType: swWorkType,
        propertyAddress: clientAddress || 'Pendiente confirmar',
        clientData: {
          name:    clientName,
          phone:   clientPhone  || '',
          email:   clientEmail  || '',
          address: clientAddress || '',
        },
        description: `[Solicitud de campo] ${WORK_TYPE_LABELS[workType] || workType}${description ? `: ${description}` : ''}`,
        estimatedAmount: 0,
        status: 'quoted',
        assignedStaffId: routingStaffId,
        assignedDate: routingStaffId ? new Date() : null,
        notes: `Generado automáticamente desde solicitud de cotización #${request.id}. Pendiente de cotizar — monto a definir.`,
        createdBy: staffId,
      });

      await request.update({ linkedSimpleWorkId: simpleWork.id });

      // Crear Reminder en el tablero para el staff de routing
      if (routingStaffId) {
        const urgencyLabel = { low: 'Baja', normal: 'Normal', high: 'Alta', emergency: 'EMERGENCIA' }[urgency] || 'Normal';
        const reminder = await Reminder.create({
          title: `Cotización pendiente: ${clientName} — ${WORK_TYPE_LABELS[workType] || workType}`,
          description: [
            `📋 Orden: ${simpleWork.workNumber}`,
            `👤 Cliente: ${clientName}${clientPhone ? ` · ${clientPhone}` : ''}`,
            `📍 Dirección: ${clientAddress || 'No especificada'}`,
            description ? `📝 ${description}` : null,
            `⚠️ Urgencia: ${urgencyLabel}`,
          ].filter(Boolean).join('\n'),
          type: 'system',
          priority: urgency === 'emergency' ? 'urgent' : urgency === 'high' ? 'high' : 'medium',
          linkedEntityType: 'simpleWork',
          linkedEntityId: simpleWork.id,
          linkedEntityLabel: simpleWork.workNumber,
          createdBy: routingStaffId,
        });

        await ReminderAssignment.create({
          reminderId: reminder.id,
          staffId: routingStaffId,
          completed: false,
        });
      }
    } catch (swErr) {
      // No fallar el request si el SimpleWork/Reminder no se puede crear
      console.error('❌ QuoteRequest auto-SimpleWork error:', swErr.message, swErr.stack);
    }

    return res.status(201).json(request);
  } catch (err) {
    console.error('QuoteRequest.create error:', err);
    return res.status(500).json({ error: 'Error al crear solicitud' });
  }
};

// PATCH /api/quote-requests/:id
exports.update = async (req, res) => {
  try {
    const request = await QuoteRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const {
      clientName, clientPhone, clientEmail, clientAddress,
      workType, description, urgency,
      status, adminNotes, linkedSimpleWorkId,
    } = req.body;

    await request.update({
      ...(clientName !== undefined && { clientName }),
      ...(clientPhone !== undefined && { clientPhone }),
      ...(clientEmail !== undefined && { clientEmail }),
      ...(clientAddress !== undefined && { clientAddress }),
      ...(workType !== undefined && { workType }),
      ...(description !== undefined && { description }),
      ...(urgency !== undefined && { urgency }),
      ...(status !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
      ...(linkedSimpleWorkId !== undefined && { linkedSimpleWorkId }),
    });

    return res.json(request);
  } catch (err) {
    console.error('QuoteRequest.update error:', err);
    return res.status(500).json({ error: 'Error al actualizar solicitud' });
  }
};

// POST /api/quote-requests/:id/photos
exports.uploadPhotos = async (req, res) => {
  try {
    const request = await QuoteRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    const uploaded = [];
    for (const file of req.files) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'quote-requests', resource_type: 'image' },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(file.buffer);
      });

      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        createdAt: result.created_at,
      });
    }

    const updatedPhotos = [...(request.photos || []), ...uploaded];
    await request.update({ photos: updatedPhotos });

    // Sincronizar fotos al SimpleWork vinculado
    if (request.linkedSimpleWorkId) {
      try {
        const sw = await SimpleWork.findByPk(request.linkedSimpleWorkId);
        if (sw) {
          const swImages = uploaded.map(p => ({ id: p.publicId, url: p.url, publicId: p.publicId }));
          await sw.update({ workImages: [...(sw.workImages || []), ...swImages] });
        }
      } catch (swPhotoErr) {
        console.error('❌ Error sincronizando fotos al SimpleWork:', swPhotoErr.message);
      }
    }

    return res.json({ photos: updatedPhotos });
  } catch (err) {
    console.error('QuoteRequest.uploadPhotos error:', err);
    return res.status(500).json({ error: 'Error al subir fotos' });
  }
};

// DELETE /api/quote-requests/:id/photos/:publicId
exports.deletePhoto = async (req, res) => {
  try {
    const request = await QuoteRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const publicId = decodeURIComponent(req.params.publicId);

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (_) {
      // ignore cloudinary errors — still remove from DB
    }

    const updatedPhotos = (request.photos || []).filter(p => p.publicId !== publicId);
    await request.update({ photos: updatedPhotos });

    return res.json({ photos: updatedPhotos });
  } catch (err) {
    console.error('QuoteRequest.deletePhoto error:', err);
    return res.status(500).json({ error: 'Error al eliminar foto' });
  }
};

// DELETE /api/quote-requests/:id
exports.remove = async (req, res) => {
  try {
    const request = await QuoteRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });
    await request.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('QuoteRequest.remove error:', err);
    return res.status(500).json({ error: 'Error al eliminar solicitud' });
  }
};
