const { KnowledgeCounty } = require('../data');
const { Op } = require('sequelize');
const cloudinary = require('cloudinary').v2;
const { uploadToCloudinary } = require('../middleware/multer');

// ─── Listar condados ───────────────────────────────────────────────────────────
exports.getAllCounties = async (req, res) => {
  try {
    const { search, region } = req.query;

    const where = { active: true };
    if (region) where.region = region;
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const counties = await KnowledgeCounty.findAll({
      where,
      order: [['order', 'ASC'], ['name', 'ASC']],
    });

    return res.json(counties);
  } catch (err) {
    console.error('getAllCounties error:', err);
    return res.status(500).json({ error: 'Error al obtener condados' });
  }
};

// ─── Obtener uno ──────────────────────────────────────────────────────────────
exports.getCountyById = async (req, res) => {
  try {
    const county = await KnowledgeCounty.findOne({
      where: { id: req.params.id, active: true },
    });
    if (!county) return res.status(404).json({ error: 'Condado no encontrado' });
    return res.json(county);
  } catch (err) {
    console.error('getCountyById error:', err);
    return res.status(500).json({ error: 'Error al obtener condado' });
  }
};

// ─── Crear ────────────────────────────────────────────────────────────────────
exports.createCounty = async (req, res) => {
  try {
    const {
      name, region, phones, emails, websites,
      systemRequirements, generalNotes, attachments, order,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'El nombre del condado es requerido' });

    const county = await KnowledgeCounty.create({
      name: name.trim(),
      region: region?.trim() || null,
      phones: phones || [],
      emails: emails || [],
      websites: websites || [],
      systemRequirements: systemRequirements || [],
      generalNotes: generalNotes || null,
      attachments: attachments || [],
      order: order ?? 0,
    });

    return res.status(201).json(county);
  } catch (err) {
    console.error('createCounty error:', err);
    return res.status(500).json({ error: 'Error al crear condado' });
  }
};

// ─── Actualizar ───────────────────────────────────────────────────────────────
exports.updateCounty = async (req, res) => {
  try {
    const county = await KnowledgeCounty.findOne({
      where: { id: req.params.id, active: true },
    });
    if (!county) return res.status(404).json({ error: 'Condado no encontrado' });

    const {
      name, region, phones, emails, websites,
      systemRequirements, generalNotes, attachments, order,
    } = req.body;

    await county.update({
      ...(name !== undefined && { name: name.trim() }),
      ...(region !== undefined && { region: region?.trim() || null }),
      ...(phones !== undefined && { phones }),
      ...(emails !== undefined && { emails }),
      ...(websites !== undefined && { websites }),
      ...(systemRequirements !== undefined && { systemRequirements }),
      ...(generalNotes !== undefined && { generalNotes }),
      ...(attachments !== undefined && { attachments }),
      ...(order !== undefined && { order }),
    });

    return res.json(county);
  } catch (err) {
    console.error('updateCounty error:', err);
    return res.status(500).json({ error: 'Error al actualizar condado' });
  }
};

// ─── Eliminar (soft-delete) ───────────────────────────────────────────────────
exports.deleteCounty = async (req, res) => {
  try {
    const county = await KnowledgeCounty.findOne({
      where: { id: req.params.id, active: true },
    });
    if (!county) return res.status(404).json({ error: 'Condado no encontrado' });

    await county.update({ active: false });
    return res.json({ success: true, message: 'Condado eliminado correctamente' });
  } catch (err) {
    console.error('deleteCounty error:', err);
    return res.status(500).json({ error: 'Error al eliminar condado' });
  }
};

// ─── Upload de documentos adjuntos ────────────────────────────────────────────
exports.uploadCountyFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    const uploaded = [];

    for (const file of req.files) {
      const mimeType = file.mimetype;
      const isPdf = mimeType === 'application/pdf';
      let resourceType = 'auto';
      if (mimeType.startsWith('image/')) resourceType = 'image';
      else if (mimeType.startsWith('video/')) resourceType = 'video';

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'knowledge-base-counties',
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
            // PDFs: guardar con extensión explícita para que Cloudinary sirva
            // Content-Type: application/pdf (no application/octet-stream)
            ...(isPdf && { format: 'pdf' }),
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        mimeType,
        resourceType: result.resource_type,
        size: result.bytes,
        originalFilename: file.originalname,
        createdAt: result.created_at,
      });
    }

    return res.json(uploaded);
  } catch (err) {
    console.error('uploadCountyFiles error:', err);
    return res.status(500).json({ error: 'Error al subir archivos' });
  }
};

// ─── Listar regiones únicas ───────────────────────────────────────────────────
exports.getRegions = async (req, res) => {
  try {
    const counties = await KnowledgeCounty.findAll({
      where: { active: true },
      attributes: ['region'],
    });
    const regions = [...new Set(counties.map(c => c.region).filter(Boolean))].sort();
    return res.json(regions);
  } catch (err) {
    console.error('getRegions error:', err);
    return res.status(500).json({ error: 'Error al obtener regiones' });
  }
};
