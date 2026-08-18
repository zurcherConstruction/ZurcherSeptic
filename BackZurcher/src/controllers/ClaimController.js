const { Claim, Staff, Work, SimpleWork, Permit } = require('../data');
const { uploadToCloudinary, deleteFromCloudinary, uploadBufferToCloudinary } = require('../utils/cloudinaryUploader');

/**
 * ClaimController - Controlador para gestión de reclamos
 */
const ClaimController = {

  /**
   * Obtener todos los reclamos con filtros
   */
  async getAllClaims(req, res) {
    try {
      const { status, priority, assignedStaffId, claimType, search, page = 1, limit = 50 } = req.query;

      const where = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (assignedStaffId) where.assignedStaffId = assignedStaffId;
      if (claimType) where.claimType = claimType;

      if (search) {
        const { Op } = require('sequelize');
        where[Op.or] = [
          { claimNumber: { [Op.iLike]: `%${search}%` } },
          { clientName: { [Op.iLike]: `%${search}%` } },
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const { count, rows } = await Claim.findAndCountAll({
        where,
        include: [
          { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
          { model: Staff, as: 'claimCreator', attributes: ['id', 'name'] }
        ],
        order: [
          ['status', 'ASC'],
          ['priority', 'DESC'],
          ['scheduledDate', 'ASC'],
          ['createdAt', 'DESC']
        ],
        limit: parseInt(limit),
        offset
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('❌ Error obteniendo reclamos:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo reclamos', error: error.message });
    }
  },

  /**
   * Obtener reclamo por ID
   */
  async getClaimById(req, res) {
    try {
      const { id } = req.params;
      const claim = await Claim.findByPk(id, {
        include: [
          { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email', 'phone'] },
          { model: Staff, as: 'claimCreator', attributes: ['id', 'name'] }
        ]
      });

      if (!claim) {
        return res.status(404).json({ success: false, message: 'Reclamo no encontrado' });
      }

      // Intentar incluir Work/SimpleWork vinculados
      let linkedWork = null;
      let linkedSimpleWork = null;
      
      if (claim.linkedWorkId) {
        try { 
          linkedWork = await Work.findByPk(claim.linkedWorkId, { 
            attributes: ['idWork', 'propertyAddress', 'notes', 'status'],
            include: [{ model: Permit, attributes: ['applicantName'], required: false }]
          }); 
        } catch(e) {}
      }
      if (claim.linkedSimpleWorkId) {
        try { linkedSimpleWork = await SimpleWork.findByPk(claim.linkedSimpleWorkId, { attributes: ['id', 'workNumber', 'propertyAddress', 'description', 'status'] }); } catch(e) {}
      }

      const claimData = claim.toJSON();
      claimData.linkedWork = linkedWork;
      claimData.linkedSimpleWork = linkedSimpleWork;

      res.json({ success: true, data: claimData });
    } catch (error) {
      console.error('❌ Error obteniendo reclamo:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo reclamo', error: error.message });
    }
  },

  /**
   * Crear nuevo reclamo
   */
  async createClaim(req, res) {
    try {
      const {
        clientName, clientPhone, clientEmail, propertyAddress,
        linkedWorkId, linkedSimpleWorkId,
        description, claimType, priority,
        claimDate, scheduledDate, assignedStaffId, notes
      } = req.body;

      if (!clientName || !propertyAddress || !description) {
        return res.status(400).json({
          success: false,
          message: 'Campos requeridos: clientName, propertyAddress, description'
        });
      }

      // Determinar status según si tiene fecha y staff asignado
      let status = 'pending';
      if (scheduledDate && assignedStaffId) status = 'scheduled';
      else if (scheduledDate) status = 'scheduled';

      // Reintentar hasta 5 veces en caso de duplicado (race condition)
      let claim = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (!claim && attempts < maxAttempts) {
        attempts++;
        try {
          const claimNumber = await Claim.generateClaimNumber();

          claim = await Claim.create({
            claimNumber,
            clientName,
            clientPhone: clientPhone || null,
            clientEmail: clientEmail || null,
            propertyAddress,
            linkedWorkId: linkedWorkId || null,
            linkedSimpleWorkId: linkedSimpleWorkId || null,
            description,
            claimType: claimType || 'repair',
            priority: priority || 'medium',
            status,
            claimDate: claimDate || new Date(),
            scheduledDate: scheduledDate || null,
            assignedStaffId: assignedStaffId || null,
            notes: notes || null,
            createdBy: req.user?.id || null
          });
        } catch (err) {
          // Si es error de duplicado, reintentar
          if (err.name === 'SequelizeUniqueConstraintError' && attempts < maxAttempts) {
            console.warn(`⚠️ Número de claim duplicado, reintentando... (intento ${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // Espera progresiva
            continue;
          }
          // Si no es duplicado o se excedió max intentos, lanzar error
          throw err;
        }
      }

      if (!claim) {
        throw new Error('No se pudo generar un número de claim único después de múltiples intentos');
      }

      const createdClaim = await Claim.findByPk(claim.id, {
        include: [
          { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
          { model: Staff, as: 'claimCreator', attributes: ['id', 'name'] }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Reclamo creado exitosamente',
        data: createdClaim
      });
    } catch (error) {
      console.error('❌ Error creando reclamo:', error);
      res.status(500).json({ success: false, message: 'Error creando reclamo', error: error.message });
    }
  },

  /**
   * Actualizar reclamo
   */
  async updateClaim(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const claim = await Claim.findByPk(id);
      if (!claim) {
        return res.status(404).json({ success: false, message: 'Reclamo no encontrado' });
      }

      const allowedFields = [
        'clientName', 'clientPhone', 'clientEmail', 'propertyAddress',
        'linkedWorkId', 'linkedSimpleWorkId',
        'description', 'claimType', 'priority', 'status',
        'claimDate', 'scheduledDate', 'repairDate',
        'assignedStaffId', 'notes', 'resolution',
        'claimImages', 'repairImages'
      ];

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          claim[field] = updates[field] === '' ? null : updates[field];
        }
      });

      // Auto-actualizar status basado en cambios
      if (updates.repairDate && !updates.status) {
        claim.status = 'completed';
      }
      if (updates.scheduledDate && claim.status === 'pending') {
        claim.status = 'scheduled';
      }

      await claim.save();

      const updatedClaim = await Claim.findByPk(id, {
        include: [
          { model: Staff, as: 'assignedStaff', attributes: ['id', 'name', 'email'] },
          { model: Staff, as: 'claimCreator', attributes: ['id', 'name'] }
        ]
      });

      res.json({ success: true, message: 'Reclamo actualizado', data: updatedClaim });
    } catch (error) {
      console.error('❌ Error actualizando reclamo:', error);
      res.status(500).json({ success: false, message: 'Error actualizando reclamo', error: error.message });
    }
  },

  /**
   * Eliminar reclamo
   */
  async deleteClaim(req, res) {
    try {
      const { id } = req.params;
      const claim = await Claim.findByPk(id);
      if (!claim) {
        return res.status(404).json({ success: false, message: 'Reclamo no encontrado' });
      }

      // Limpiar imágenes de Cloudinary
      const allImages = [...(claim.claimImages || []), ...(claim.repairImages || [])];
      for (const img of allImages) {
        if (img.publicId) {
          try { await deleteFromCloudinary(img.publicId); } catch(e) {}
        }
      }

      await claim.destroy();
      res.json({ success: true, message: 'Reclamo eliminado' });
    } catch (error) {
      console.error('❌ Error eliminando reclamo:', error);
      res.status(500).json({ success: false, message: 'Error eliminando reclamo', error: error.message });
    }
  },

  /**
   * Subir imagen de reclamo o reparación
   */
  async uploadImage(req, res) {
    try {
      const { id } = req.params;
      const { type } = req.query; // 'claim' o 'repair'

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se proporcionó archivo' });
      }

      const claim = await Claim.findByPk(id);
      if (!claim) {
        return res.status(404).json({ success: false, message: 'Reclamo no encontrado' });
      }

      // Detectar si es video o imagen
      const mimeType = req.file.mimetype || '';
      const isVideo = mimeType.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';
      
      const folder = `zurcher/claims/${id}/${type || 'claim'}`;
      const uploadOptions = { folder, resource_type: resourceType };
      
      // Para videos grandes, usar procesamiento asíncrono
      if (isVideo && req.file.size > 15 * 1024 * 1024) {
        uploadOptions.eager_async = true;
      }
      
      const result = await uploadBufferToCloudinary(req.file.buffer, uploadOptions);

      const imageData = {
        id: result.public_id || `img_${Date.now()}`,
        publicId: result.public_id,
        url: result.secure_url || result.url,
        originalName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.id || null
      };

      const imageField = type === 'repair' ? 'repairImages' : 'claimImages';
      const currentImages = [...(claim[imageField] || [])]; // copia nueva del array
      currentImages.push(imageData);
      claim[imageField] = currentImages;
      claim.changed(imageField, true); // forzar que Sequelize detecte el cambio en JSONB

      await claim.save();

      res.json({
        success: true,
        message: `Imagen de ${type === 'repair' ? 'reparación' : 'reclamo'} subida`,
        data: imageData
      });
    } catch (error) {
      console.error('❌ Error subiendo imagen:', error);
      res.status(500).json({ success: false, message: 'Error subiendo imagen', error: error.message });
    }
  },

  /**
   * Eliminar imagen
   */
  async deleteImage(req, res) {
    try {
      const { id, imageId } = req.params;
      const { type } = req.query;

      const claim = await Claim.findByPk(id);
      if (!claim) {
        return res.status(404).json({ success: false, message: 'Reclamo no encontrado' });
      }

      const imageField = type === 'repair' ? 'repairImages' : 'claimImages';
      const currentImages = claim[imageField] || [];
      const imageToDelete = currentImages.find(img => img.id === imageId || img.publicId === imageId);

      if (imageToDelete && imageToDelete.publicId) {
        try { await deleteFromCloudinary(imageToDelete.publicId); } catch(e) {}
      }

      claim[imageField] = currentImages.filter(img => img.id !== imageId && img.publicId !== imageId);
      claim.changed(imageField, true); // forzar detección de cambio en JSONB
      await claim.save();

      res.json({ success: true, message: 'Imagen eliminada' });
    } catch (error) {
      console.error('❌ Error eliminando imagen:', error);
      res.status(500).json({ success: false, message: 'Error eliminando imagen', error: error.message });
    }
  },

  /**
   * Obtener direcciones existentes (Works + SimpleWorks) para vincular
   */
  async getAddressesForLinking(req, res) {
    try {
      const { search } = req.query;
      const { Op } = require('sequelize');

      const results = [];

      // Buscar en Works (incluir Permit para obtener nombre del cliente)
      const workWhere = search ? {
        [Op.or]: [
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { notes: { [Op.iLike]: `%${search}%` } },
          { '$Permit.applicantName$': { [Op.iLike]: `%${search}%` } }
        ]
      } : {};
      const works = await Work.findAll({
        where: workWhere,
        attributes: ['idWork', 'propertyAddress', 'notes', 'status'],
        include: [{
          model: Permit,
          attributes: ['applicantName'],
          required: false
        }],
        limit: 20,
        order: [['createdAt', 'DESC']],
        subQuery: false
      });
      works.forEach(w => {
        results.push({
          type: 'work',
          id: w.idWork,
          address: w.propertyAddress,
          description: w.notes || '',
          status: w.status,
          clientName: w.Permit?.applicantName || ''
        });
      });

      // Buscar en SimpleWorks
      const swWhere = search ? {
        [Op.or]: [
          { propertyAddress: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ]
      } : {};
      const simpleWorks = await SimpleWork.findAll({
        where: swWhere,
        attributes: ['id', 'workNumber', 'propertyAddress', 'description', 'status', 'clientData'],
        limit: 20,
        order: [['createdAt', 'DESC']]
      });
      simpleWorks.forEach(sw => {
        const clientData = sw.clientData || {};
        const clientName = [clientData.firstName, clientData.lastName].filter(Boolean).join(' ');
        results.push({
          type: 'simpleWork',
          id: sw.id,
          address: sw.propertyAddress,
          description: sw.description,
          workNumber: sw.workNumber,
          status: sw.status,
          clientName: clientName
        });
      });

      res.json({ success: true, data: results });
    } catch (error) {
      console.error('❌ Error obteniendo direcciones:', error);
      res.status(500).json({ success: false, message: 'Error obteniendo direcciones', error: error.message });
    }
  },

  /**
   * Obtener Claims asignados al staff autenticado (para app móvil)
   */
  async getAssignedClaims(req, res) {
    try {
      const staffId = req.staff.id;
      const isCapataz = req.staff.role === 'capataz';

      const whereClause = isCapataz ? {} : { assignedStaffId: staffId };

      const claims = await Claim.findAll({
        where: whereClause,
        attributes: [
          'id', 'claimNumber', 'clientName', 'clientPhone', 'clientEmail',
          'propertyAddress', 'description', 'claimType', 'priority', 'status',
          'claimDate', 'scheduledDate', 'repairDate', 'notes', 'resolution',
          'claimImages', 'repairImages', 'createdAt', 'updatedAt'
        ],
        include: [
          { model: Staff, as: 'assignedStaff', attributes: ['id', 'name'] },
          { model: Work, as: 'linkedWork', attributes: ['idWork', 'propertyAddress'], required: false },
          { model: SimpleWork, as: 'linkedSimpleWork', attributes: ['id', 'workNumber', 'propertyAddress'], required: false }
        ],
        order: [
          ['priority', 'DESC'],
          ['scheduledDate', 'ASC'],
          ['createdAt', 'DESC']
        ]
      });

      res.status(200).json({
        error: false,
        claims,
        message: claims.length === 0 ? (isCapataz ? 'No hay reclamos' : 'No tienes reclamos asignados') : undefined
      });
    } catch (error) {
      console.error('❌ [getAssignedClaims] Error:', error);
      res.status(500).json({ error: true, claims: [], message: 'Error interno del servidor' });
    }
  }
};

module.exports = ClaimController;
