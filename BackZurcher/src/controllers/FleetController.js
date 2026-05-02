const { FleetAsset, FleetMaintenance, FleetMileageLog, Staff } = require('../data');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUploader');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');

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

      const [asset, maintenances, mileageLogs] = await Promise.all([
        FleetAsset.findByPk(id, {
          include: [{ model: Staff, as: 'assignedTo', attributes: ['id', 'name', 'email'] }],
        }),
        FleetMaintenance.findAll({
          where: { assetId: id },
          include: [
            { model: Staff, as: 'performedBy', attributes: ['id', 'name'] },
            { model: Staff, as: 'createdBy', attributes: ['id', 'name'] },
          ],
          order: [['serviceDate', 'DESC']],
        }),
        FleetMileageLog.findAll({
          where: { assetId: id },
          include: [{ model: Staff, as: 'recordedBy', attributes: ['id', 'name'] }],
          order: [['recordedAt', 'DESC']],
          limit: 20,
        }),
      ]);

      if (!asset) return res.status(404).json({ success: false, message: 'Activo no encontrado' });

      const data = asset.toJSON();
      data.maintenances = maintenances.map((m) => m.toJSON());
      data.mileageLogs = mileageLogs.map((l) => l.toJSON());

      res.json({ success: true, data });
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
  // UPCOMING ALERTS (placa, seguro, service)
  // ─────────────────────────────────────────────────────────────

  async getUpcomingAlerts(req, res) {
    try {
      const days = Number(req.query.days || 30);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const maxDate = new Date(today);
      maxDate.setDate(today.getDate() + days);

      const toISO = (d) => d.toISOString().split('T')[0];
      const parseDateOnly = (value) => {
        if (!value) return null;
        const str = String(value);
        const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        const [, y, m, day] = match;
        return new Date(Number(y), Number(m) - 1, Number(day));
      };
      const normalizeDateOnly = (value) => {
        if (!value) return null;
        const str = String(value);
        const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return str;
        return `${match[1]}-${match[2]}-${match[3]}`;
      };
      const getDaysLeft = (value) => {
        const d = parseDateOnly(value);
        if (!d) return null;
        return Math.ceil((d - today) / 86400000);
      };

      // Assets con vencimientos próximos
      const assets = await FleetAsset.findAll({
        where: {
          status: { [Op.ne]: 'retired' },
          [Op.or]: [
            { registrationExpiry: { [Op.between]: [toISO(today), toISO(maxDate)] } },
            { insuranceExpiry: { [Op.between]: [toISO(today), toISO(maxDate)] } },
          ],
        },
        attributes: ['id', 'name', 'assetType', 'companyType', 'companyOtherName', 'licensePlate', 'serialNumber', 'imageUrl', 'registrationExpiry', 'insuranceExpiry'],
        order: [['name', 'ASC']],
      });

      const registrations = assets
        .filter((a) => a.registrationExpiry && a.registrationExpiry >= toISO(today) && a.registrationExpiry <= toISO(maxDate))
        .map((a) => ({
          assetId: a.id, name: a.name, assetType: a.assetType,
          companyType: a.companyType, companyOtherName: a.companyOtherName,
          plate: a.licensePlate || a.serialNumber || 'S/D',
          imageUrl: a.imageUrl,
          date: normalizeDateOnly(a.registrationExpiry),
          daysLeft: getDaysLeft(a.registrationExpiry),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft);

      const insurances = assets
        .filter((a) => a.insuranceExpiry && a.insuranceExpiry >= toISO(today) && a.insuranceExpiry <= toISO(maxDate))
        .map((a) => ({
          assetId: a.id, name: a.name, assetType: a.assetType,
          companyType: a.companyType, companyOtherName: a.companyOtherName,
          plate: a.licensePlate || a.serialNumber || 'S/D',
          imageUrl: a.imageUrl,
          date: normalizeDateOnly(a.insuranceExpiry),
          daysLeft: getDaysLeft(a.insuranceExpiry),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft);

      const maintenances = await FleetMaintenance.findAll({
        where: {
          status: 'scheduled',
          nextServiceDate: { [Op.between]: [toISO(today), toISO(maxDate)] },
        },
        include: [{
          model: FleetAsset,
          as: 'asset',
          where: { status: { [Op.ne]: 'retired' } },
          attributes: ['id', 'name', 'assetType', 'companyType', 'companyOtherName', 'licensePlate', 'serialNumber', 'imageUrl'],
        }],
        order: [['nextServiceDate', 'ASC']],
      });

      const services = maintenances.map((m) => ({
        maintenanceId: m.id,
        assetId: m.asset.id,
        name: m.asset.name,
        assetType: m.asset.assetType,
        companyType: m.asset.companyType,
        companyOtherName: m.asset.companyOtherName,
        plate: m.asset.licensePlate || m.asset.serialNumber || 'S/D',
        imageUrl: m.asset.imageUrl,
        maintenanceType: m.maintenanceType,
        serviceNumber: m.serviceNumber,
        date: normalizeDateOnly(m.nextServiceDate),
        daysLeft: getDaysLeft(m.nextServiceDate),
      }));

      res.json({
        success: true,
        data: { registrations, insurances, services },
      });
    } catch (error) {
      console.error('[FleetController.getUpcomingAlerts]', error);
      res.status(500).json({ success: false, message: 'Error obteniendo alertas' });
    }
  },

  // ─────────────────────────────────────────────────────────────
  // EXPORT REPORT (Excel)
  // ─────────────────────────────────────────────────────────────

  async exportFleetReport(req, res) {
    try {
      const { month, year } = req.query;

      const assets = await FleetAsset.findAll({
        where: { status: { [Op.ne]: 'retired' } },
        include: [
          { model: Staff, as: 'assignedTo', attributes: ['id', 'name'] },
          {
            model: FleetMaintenance,
            as: 'maintenances',
            include: [{ model: Staff, as: 'performedBy', attributes: ['id', 'name'] }],
            order: [['serviceDate', 'DESC']],
          },
        ],
        order: [['name', 'ASC']],
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = 'ZurcherSystem';
      wb.created = new Date();

      const HEADER_FILL = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF1D4ED8' },
      };
      const HEADER_FONT = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const BORDER = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };

      const companyLabel = (asset) => {
        if (asset.companyType === 'zurcher') return 'ZURCHER';
        if (asset.companyType === 'invertech') return 'INVERTECH';
        if (asset.companyType === 'other') return asset.companyOtherName || 'OTRA';
        return 'ZURCHER';
      };

      const fmtDate = (d) => {
        if (!d) return '';
        try {
          return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return ''; }
      };

      const fmtCurrency = (n) => (n != null ? `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '');

      const COLUMNS = [
        { header: 'Nombre', key: 'name', width: 24 },
        { header: 'Marca', key: 'brand', width: 16 },
        { header: 'Modelo', key: 'model', width: 16 },
        { header: 'Año', key: 'year', width: 8 },
        { header: 'Placa / Serie', key: 'plate', width: 18 },
        { header: 'Color', key: 'color', width: 12 },
        { header: 'Combustible', key: 'fuelType', width: 14 },
        { header: 'Empresa', key: 'company', width: 14 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Km / Millas actuales', key: 'mileage', width: 20 },
        { header: 'Horas actuales', key: 'hours', width: 16 },
        { header: 'Asignado a', key: 'assignedTo', width: 20 },
        { header: 'Fecha Compra', key: 'purchaseDate', width: 16 },
        { header: 'Precio Compra', key: 'purchasePrice', width: 18 },
        { header: 'Venc. Seguro', key: 'insuranceExpiry', width: 16 },
        { header: 'Venc. Placa', key: 'registrationExpiry', width: 16 },
        { header: 'Último Service', key: 'lastServiceDate', width: 16 },
        { header: 'Tipo Último Service', key: 'lastServiceType', width: 22 },
        { header: 'Costo Último Service', key: 'lastServiceCost', width: 22 },
        { header: 'Próx. Service Fecha', key: 'nextServiceDate', width: 20 },
        { header: 'Próx. Service Km/Mi', key: 'nextServiceMileage', width: 20 },
        { header: 'Notas', key: 'notes', width: 30 },
      ];

      const statusLabels = {
        active: 'Operativo', in_repair: 'En Taller',
        inactive: 'Inactivo', retired: 'Retirado',
      };

      const buildRow = (asset) => {
        const lastMaint = (asset.maintenances || []).find((m) => m.status === 'completed');
        const nextMaint = (asset.maintenances || []).find((m) => m.status === 'scheduled');
        return {
          name: asset.name || '',
          brand: asset.brand || '',
          model: asset.model || '',
          year: asset.year || '',
          plate: asset.licensePlate || asset.serialNumber || '',
          color: asset.color || '',
          fuelType: asset.fuelType || '',
          company: companyLabel(asset),
          status: statusLabels[asset.status] || asset.status,
          mileage: asset.currentMileage != null ? asset.currentMileage : '',
          hours: asset.currentHours != null ? asset.currentHours : '',
          assignedTo: asset.assignedTo?.name || '',
          purchaseDate: fmtDate(asset.purchaseDate),
          purchasePrice: fmtCurrency(asset.purchasePrice),
          insuranceExpiry: fmtDate(asset.insuranceExpiry),
          registrationExpiry: fmtDate(asset.registrationExpiry),
          lastServiceDate: lastMaint ? fmtDate(lastMaint.serviceDate) : '',
          lastServiceType: lastMaint?.maintenanceType || '',
          lastServiceCost: lastMaint ? fmtCurrency(lastMaint.cost) : '',
          nextServiceDate: nextMaint ? fmtDate(nextMaint.nextServiceDate) : '',
          nextServiceMileage: nextMaint?.nextServiceMileage != null ? nextMaint.nextServiceMileage : '',
          notes: asset.notes || '',
        };
      };

      const applyHeaderStyle = (sheet) => {
        sheet.getRow(1).eachCell((cell) => {
          cell.fill = HEADER_FILL;
          cell.font = HEADER_FONT;
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = BORDER;
        });
        sheet.getRow(1).height = 28;
      };

      const applyDataStyle = (sheet, rowIdx) => {
        const row = sheet.getRow(rowIdx);
        const isEven = rowIdx % 2 === 0;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', wrapText: false };
          cell.border = BORDER;
          if (isEven) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
          }
        });
      };

      const buildSheet = (sheetName, filteredAssets) => {
        const ws = wb.addWorksheet(sheetName);
        ws.columns = COLUMNS;

        const periodLabel = month && year
          ? `Reporte ${String(month).padStart(2, '0')}/${year}`
          : `Reporte ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;

        // Title row
        ws.insertRow(1, []);
        ws.mergeCells(1, 1, 1, COLUMNS.length);
        const titleCell = ws.getCell('A1');
        titleCell.value = `${sheetName} - ${periodLabel}`;
        titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 32;

        // Header row is now row 2
        applyHeaderStyle(ws);

        filteredAssets.forEach((asset, i) => {
          ws.addRow(buildRow(asset));
          applyDataStyle(ws, i + 3); // row 1=title, row 2=headers
        });

        // Auto-freeze header rows
        ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activeCell: 'A3' }];
        return ws;
      };

      // Separate by type: "Vehículos" = vehicle + trailer, "Maquinaria" = machine + equipment
      const vehicles = assets.filter((a) => ['vehicle', 'trailer'].includes(a.assetType));
      const machinery = assets.filter((a) => ['machine', 'equipment'].includes(a.assetType));

      buildSheet('Vehículos', vehicles);
      buildSheet('Maquinaria', machinery);

      const monthStr = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
      const yearStr = year || new Date().getFullYear();
      const filename = `Fleet_Report_${yearStr}_${monthStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await wb.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('[FleetController.exportFleetReport]', error);
      res.status(500).json({ success: false, message: 'Error generando reporte' });
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
