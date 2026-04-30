const { FleetAsset, FleetMaintenance, FleetMileageLog, Staff } = require('../data');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUploader');
const { Op } = require('sequelize');

// Convierte strings vacíos o "Invalid date" en null para campos de fecha
const DATE_FIELDS = ['purchaseDate', 'insuranceExpiry', 'registrationExpiry', 'serviceDate', 'nextServiceDate', 'recordedAt'];
function sanitizeDates(data) {
  const result = { ...data };
  DATE_FIELDS.forEach((field) => {
    if (result[field] !== undefined) {
      const val = result[field];
      if (!val || val === 'Invalid date' || val === '') {
        result[field] = null;
      }
    }
  });
  return result;
}

function sanitizeAssetPayload(data) {
  const result = sanitizeDates(data);

  if (!result.companyType) {
    result.companyType = 'zurcher';
  }

  if (result.companyType !== 'other') {
    result.companyOtherName = null;
  } else if (!result.companyOtherName || !String(result.companyOtherName).trim()) {
    result.companyOtherName = null;
  } else {
    result.companyOtherName = String(result.companyOtherName).trim();
  }

  return result;
}

const FleetController = {

  // ─────────────────────────────────────────────────────────────
  // FLEET ASSETS
  // ─────────────────────────────────────────────────────────────

  async getAllAssets(req, res) {
    try {
      const { status, assetType, search } = req.query;
      const where = {};

      if (status) where.status = status;
      if (assetType) where.assetType = assetType;
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { brand: { [Op.iLike]: `%${search}%` } },
          { model: { [Op.iLike]: `%${search}%` } },
          { licensePlate: { [Op.iLike]: `%${search}%` } },
          { serialNumber: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const assets = await FleetAsset.findAll({
        where,
        include: [
          { model: Staff, as: 'assignedTo', attributes: ['id', 'name', 'email'] },
        ],
        order: [['status', 'ASC'], ['name', 'ASC']],
      });

      res.json({ success: true, data: assets });
    } catch (error) {
      console.error('[FleetController.getAllAssets]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo activos de flota' });
    }
  },

  async getAssetById(req, res) {
    try {
      const { id } = req.params;

      const asset = await FleetAsset.findByPk(id, {
        include: [
          { model: Staff, as: 'assignedTo', attributes: ['id', 'name', 'email'] },
          {
            model: FleetMaintenance,
            as: 'maintenances',
            include: [
              { model: Staff, as: 'performedBy', attributes: ['id', 'name'] },
              { model: Staff, as: 'createdBy', attributes: ['id', 'name'] },
            ],
            order: [['serviceDate', 'DESC']],
          },
          {
            model: FleetMileageLog,
            as: 'mileageLogs',
            include: [{ model: Staff, as: 'recordedBy', attributes: ['id', 'name'] }],
            order: [['recordedAt', 'DESC']],
            limit: 20,
          },
        ],
      });

      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      res.json({ success: true, data: asset });
    } catch (error) {
      console.error('[FleetController.getAssetById]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo activo' });
    }
  },

  async createAsset(req, res) {
    try {
      const data = sanitizeAssetPayload(req.body);
      const asset = await FleetAsset.create(data);
      res.status(201).json({ success: true, data: asset });
    } catch (error) {
      console.error('[FleetController.createAsset]', error);
      res.status(500).json({ success: false, message: 'Error creando activo' });
    }
  },

  async updateAsset(req, res) {
    try {
      const { id } = req.params;
      const asset = await FleetAsset.findByPk(id);
      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      await asset.update(sanitizeAssetPayload(req.body));
      res.json({ success: true, data: asset });
    } catch (error) {
      console.error('[FleetController.updateAsset]', error);
      res.status(500).json({ success: false, message: 'Error actualizando activo' });
    }
  },

  async deleteAsset(req, res) {
    try {
      const { id } = req.params;
      const asset = await FleetAsset.findByPk(id);
      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      // Soft delete: cambiar status a 'retired'
      await asset.update({ status: 'retired' });
      res.json({ success: true, message: 'Activo marcado como retirado' });
    } catch (error) {
      console.error('[FleetController.deleteAsset]', error);
      res.status(500).json({ success: false, message: 'Error eliminando activo' });
    }
  },

  async uploadAssetImage(req, res) {
    try {
      const { id } = req.params;
      const asset = await FleetAsset.findByPk(id);
      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió imagen' });

      // Eliminar imagen anterior de Cloudinary si existe
      if (asset.imagePublicId) {
        await deleteFromCloudinary(asset.imagePublicId).catch(() => {});
      }

      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'fleet-assets',
        resource_type: 'image',
      });

      await asset.update({
        imageUrl: result.secure_url,
        imagePublicId: result.public_id,
      });

      res.json({ success: true, data: { imageUrl: result.secure_url, imagePublicId: result.public_id } });
    } catch (error) {
      console.error('[FleetController.uploadAssetImage]', error);
      res.status(500).json({ success: false, message: 'Error subiendo imagen' });
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MILEAGE / HOURS LOG
  // ─────────────────────────────────────────────────────────────

  async logMileage(req, res) {
    try {
      const { id } = req.params;
      const { mileage, hours, recordedAt, notes } = req.body;
      const staffId = req.staff?.id;

      const asset = await FleetAsset.findByPk(id);
      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      const logEntry = await FleetMileageLog.create({
        assetId: id,
        mileage: mileage || null,
        hours: hours || null,
        previousMileage: asset.currentMileage,
        previousHours: asset.currentHours,
        recordedById: staffId,
        recordedAt: recordedAt || new Date(),
        notes,
      });

      // Actualizar métricas del activo
      const updates = {};
      if (mileage !== undefined && mileage !== null && mileage !== '') {
        updates.currentMileage = parseFloat(mileage);
      }
      if (hours !== undefined && hours !== null && hours !== '') {
        updates.currentHours = parseFloat(hours);
      }
      if (Object.keys(updates).length > 0) {
        await asset.update(updates);
      }

      res.status(201).json({ success: true, data: logEntry, asset: { ...asset.toJSON(), ...updates } });
    } catch (error) {
      console.error('[FleetController.logMileage]', error);
      res.status(500).json({ success: false, message: 'Error registrando mileaje' });
    }
  },

  async getMileageLogs(req, res) {
    try {
      const { id } = req.params;
      const logs = await FleetMileageLog.findAll({
        where: { assetId: id },
        include: [{ model: Staff, as: 'recordedBy', attributes: ['id', 'name'] }],
        order: [['recordedAt', 'DESC']],
      });
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error('[FleetController.getMileageLogs]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo registros' });
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MAINTENANCE RECORDS
  // ─────────────────────────────────────────────────────────────

  async getMaintenanceByAsset(req, res) {
    try {
      const { id } = req.params;
      const records = await FleetMaintenance.findAll({
        where: { assetId: id },
        include: [
          { model: Staff, as: 'performedBy', attributes: ['id', 'name'] },
          { model: Staff, as: 'createdBy', attributes: ['id', 'name'] },
        ],
        order: [['serviceDate', 'DESC']],
      });
      res.json({ success: true, data: records });
    } catch (error) {
      console.error('[FleetController.getMaintenanceByAsset]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo mantenimientos' });
    }
  },

  async getAllMaintenance(req, res) {
    try {
      const { status, maintenanceType, assetId, upcoming } = req.query;
      const where = {};

      if (status) where.status = status;
      if (maintenanceType) where.maintenanceType = maintenanceType;
      if (assetId) where.assetId = assetId;

      // Próximos servicios: fecha futura o pendientes
      if (upcoming === 'true') {
        where.status = { [Op.in]: ['scheduled', 'in_progress'] };
        where.nextServiceDate = { [Op.gte]: new Date() };
      }

      const records = await FleetMaintenance.findAll({
        where,
        include: [
          { model: FleetAsset, as: 'asset', attributes: ['id', 'name', 'licensePlate', 'assetType', 'imageUrl'] },
          { model: Staff, as: 'performedBy', attributes: ['id', 'name'] },
        ],
        order: [['serviceDate', 'DESC']],
      });

      res.json({ success: true, data: records });
    } catch (error) {
      console.error('[FleetController.getAllMaintenance]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo registros de mantenimiento' });
    }
  },

  async createMaintenance(req, res) {
    try {
      const { id } = req.params; // assetId
      const staffId = req.staff?.id;

      const asset = await FleetAsset.findByPk(id);
      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      // Generar número de servicio
      const count = await FleetMaintenance.count({ where: { assetId: id } });
      const serviceNumber = `SVC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

      const record = await FleetMaintenance.create({
        ...sanitizeDates(req.body),
        assetId: id,
        serviceNumber,
        createdById: staffId,
      });

      // Si el mantenimiento está completado, actualizar métricas del activo
      if (record.status === 'completed') {
        const updates = {};
        if (record.mileageAtService) updates.currentMileage = record.mileageAtService;
        if (record.hoursAtService) updates.currentHours = record.hoursAtService;
        if (record.status === 'completed' && asset.status === 'in_repair') {
          updates.status = 'active';
        }
        if (Object.keys(updates).length > 0) await asset.update(updates);
      }

      const populated = await FleetMaintenance.findByPk(record.id, {
        include: [{ model: Staff, as: 'performedBy', attributes: ['id', 'name'] }],
      });

      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      console.error('[FleetController.createMaintenance]', error);
      res.status(500).json({ success: false, message: 'Error creando mantenimiento' });
    }
  },

  async updateMaintenance(req, res) {
    try {
      const { maintenanceId } = req.params;
      const record = await FleetMaintenance.findByPk(maintenanceId);
      if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });

      await record.update(sanitizeDates(req.body));
      res.json({ success: true, data: record });
    } catch (error) {
      console.error('[FleetController.updateMaintenance]', error);
      res.status(500).json({ success: false, message: 'Error actualizando mantenimiento' });
    }
  },

  async deleteMaintenance(req, res) {
    try {
      const { maintenanceId } = req.params;
      const record = await FleetMaintenance.findByPk(maintenanceId);
      if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });

      await record.destroy();
      res.json({ success: true, message: 'Registro eliminado' });
    } catch (error) {
      console.error('[FleetController.deleteMaintenance]', error);
      res.status(500).json({ success: false, message: 'Error eliminando mantenimiento' });
    }
  },

  async uploadMaintenanceAttachment(req, res) {
    try {
      const { maintenanceId } = req.params;
      const record = await FleetMaintenance.findByPk(maintenanceId);
      if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });

      if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });

      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: 'fleet-maintenance',
        resource_type: 'image',
      });

      const attachments = record.attachments || [];
      attachments.push({
        url: result.secure_url,
        publicId: result.public_id,
        name: req.file.originalname,
        type: 'image',
        uploadedAt: new Date().toISOString(),
      });

      await record.update({ attachments });
      res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
    } catch (error) {
      console.error('[FleetController.uploadMaintenanceAttachment]', error);
      res.status(500).json({ success: false, message: 'Error subiendo adjunto' });
    }
  },

  // ─────────────────────────────────────────────────────────────
  // DASHBOARD STATS
  // ─────────────────────────────────────────────────────────────

  async getFleetStats(req, res) {
    try {
      const [totalAssets, activeAssets, inRepair, upcomingMaintenance] = await Promise.all([
        FleetAsset.count({ where: { status: { [Op.ne]: 'retired' } } }),
        FleetAsset.count({ where: { status: 'active' } }),
        FleetAsset.count({ where: { status: 'in_repair' } }),
        FleetMaintenance.count({
          where: {
            status: 'scheduled',
            nextServiceDate: {
              [Op.lte]: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // próximos 30 días
              [Op.gte]: new Date(),
            },
          },
        }),
      ]);

      res.json({
        success: true,
        data: { totalAssets, activeAssets, inRepair, upcomingMaintenance },
      });
    } catch (error) {
      console.error('[FleetController.getFleetStats]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo estadísticas' });
    }
  },
};

module.exports = FleetController;
