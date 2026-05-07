const { KnowledgeCategory, KnowledgeContact, KnowledgeProcedure, KnowledgeDocument, Staff } = require('../data');
const { Op } = require('sequelize');

/**
 *  CONTROLADOR DE BASE DE CONOCIMIENTO
 * Gestiona categorías, contactos, procedimientos y documentos
 */

// ========== CATEGORÍAS ==========

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await KnowledgeCategory.findAll({
      where: { active: true },
      order: [['order', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: KnowledgeContact,
          as: 'contacts',
          attributes: ['id'],
          where: { active: true },
          required: false
        },
        {
          model: KnowledgeProcedure,
          as: 'procedures',
          attributes: ['id'],
          where: { active: true },
          required: false
        },
        {
          model: KnowledgeDocument,
          as: 'documents',
          attributes: ['id'],
          where: { active: true },
          required: false
        }
      ]
    });

    // Agregar contadores
    const categoriesWithCounts = categories.map(cat => ({
      ...cat.toJSON(),
      contactsCount: cat.contacts?.length || 0,
      proceduresCount: cat.procedures?.length || 0,
      documentsCount: cat.documents?.length || 0
    }));

    res.status(200).json(categoriesWithCounts);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await KnowledgeCategory.create(req.body);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await KnowledgeCategory.update(req.body, {
      where: { id }
    });
    
    if (updated) {
      const category = await KnowledgeCategory.findByPk(id);
      res.status(200).json(category);
    } else {
      res.status(404).json({ error: 'Categoría no encontrada' });
    }
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await KnowledgeCategory.update(
      { active: false },
      { where: { id } }
    );
    res.status(200).json({ message: 'Categoría desactivada' });
  } catch (error) {
    console.error('Error al desactivar categoría:', error);
    res.status(500).json({ error: 'Error al desactivar categoría' });
  }
};

// ========== CONTACTOS ==========

exports.getAllContacts = async (req, res) => {
  try {
    const { categoryId, search, favorite } = req.query;
    
    const where = { active: true };
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (favorite === 'true') {
      where.isFavorite = true;
    }
    
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.iLike]: `%${search}%` } },
        { contactPerson: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { contactType: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const contacts = await KnowledgeContact.findAll({
      where,
      include: [
        {
          model: KnowledgeCategory,
          as: 'category',
          attributes: ['id', 'name', 'icon', 'color']
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name']
        }
      ],
      order: [
        ['isFavorite', 'DESC'],
        ['companyName', 'ASC']
      ]
    });

    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error al obtener contactos:', error);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
};

exports.getContactById = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await KnowledgeContact.findByPk(id, {
      include: [
        {
          model: KnowledgeCategory,
          as: 'category'
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name']
        },
        {
          model: Staff,
          as: 'updater',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    res.status(200).json(contact);
  } catch (error) {
    console.error('Error al obtener contacto:', error);
    res.status(500).json({ error: 'Error al obtener contacto' });
  }
};

exports.createContact = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const contact = await KnowledgeContact.create({
      ...req.body,
      createdBy: staffId,
      updatedBy: staffId
    });

    const newContact = await KnowledgeContact.findByPk(contact.id, {
      include: [
        { model: KnowledgeCategory, as: 'category' },
        { model: Staff, as: 'creator', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json(newContact);
  } catch (error) {
    console.error('Error al crear contacto:', error);
    res.status(500).json({ error: 'Error al crear contacto' });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.user?.id;
    
    const [updated] = await KnowledgeContact.update(
      { ...req.body, updatedBy: staffId },
      { where: { id } }
    );

    if (updated) {
      const contact = await KnowledgeContact.findByPk(id, {
        include: [
          { model: KnowledgeCategory, as: 'category' },
          { model: Staff, as: 'creator', attributes: ['id', 'name'] },
          { model: Staff, as: 'updater', attributes: ['id', 'name'] }
        ]
      });
      res.status(200).json(contact);
    } else {
      res.status(404).json({ error: 'Contacto no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar contacto:', error);
    res.status(500).json({ error: 'Error al actualizar contacto' });
  }
};

exports.toggleFavoriteContact = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await KnowledgeContact.findByPk(id);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }

    contact.isFavorite = !contact.isFavorite;
    await contact.save();

    res.status(200).json(contact);
  } catch (error) {
    console.error('Error al marcar/desmarcar favorito:', error);
    res.status(500).json({ error: 'Error al actualizar favorito' });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    await KnowledgeContact.update(
      { active: false },
      { where: { id } }
    );
    res.status(200).json({ message: 'Contacto eliminado' });
  } catch (error) {
    console.error('Error al eliminar contacto:', error);
    res.status(500).json({ error: 'Error al eliminar contacto' });
  }
};

// ========== PROCEDIMIENTOS ==========

exports.getAllProcedures = async (req, res) => {
  try {
    const { categoryId, search, favorite } = req.query;
    
    const where = { active: true };
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (favorite === 'true') {
      where.isFavorite = true;
    }
    
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const procedures = await KnowledgeProcedure.findAll({
      where,
      include: [
        {
          model: KnowledgeCategory,
          as: 'category',
          attributes: ['id', 'name', 'icon', 'color']
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name']
        }
      ],
      order: [
        ['isFavorite', 'DESC'],
        ['title', 'ASC']
      ]
    });

    res.status(200).json(procedures);
  } catch (error) {
    console.error('Error al obtener procedimientos:', error);
    res.status(500).json({ error: 'Error al obtener procedimientos' });
  }
};

exports.getProcedureById = async (req, res) => {
  try {
    const { id } = req.params;
    const procedure = await KnowledgeProcedure.findByPk(id, {
      include: [
        {
          model: KnowledgeCategory,
          as: 'category'
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name']
        },
        {
          model: Staff,
          as: 'updater',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!procedure) {
      return res.status(404).json({ error: 'Procedimiento no encontrado' });
    }

    res.status(200).json(procedure);
  } catch (error) {
    console.error('Error al obtener procedimiento:', error);
    res.status(500).json({ error: 'Error al obtener procedimiento' });
  }
};

exports.createProcedure = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const procedure = await KnowledgeProcedure.create({
      ...req.body,
      createdBy: staffId,
      updatedBy: staffId
    });

    const newProcedure = await KnowledgeProcedure.findByPk(procedure.id, {
      include: [
        { model: KnowledgeCategory, as: 'category' },
        { model: Staff, as: 'creator', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json(newProcedure);
  } catch (error) {
    console.error('Error al crear procedimiento:', error);
    res.status(500).json({ error: 'Error al crear procedimiento' });
  }
};

exports.updateProcedure = async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.user?.id;
    
    const [updated] = await KnowledgeProcedure.update(
      { ...req.body, updatedBy: staffId },
      { where: { id } }
    );

    if (updated) {
      const procedure = await KnowledgeProcedure.findByPk(id, {
        include: [
          { model: KnowledgeCategory, as: 'category' },
          { model: Staff, as: 'creator', attributes: ['id', 'name'] },
          { model: Staff, as: 'updater', attributes: ['id', 'name'] }
        ]
      });
      res.status(200).json(procedure);
    } else {
      res.status(404).json({ error: 'Procedimiento no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar procedimiento:', error);
    res.status(500).json({ error: 'Error al actualizar procedimiento' });
  }
};

exports.toggleFavoriteProcedure = async (req, res) => {
  try {
    const { id } = req.params;
    const procedure = await KnowledgeProcedure.findByPk(id);
    
    if (!procedure) {
      return res.status(404).json({ error: 'Procedimiento no encontrado' });
    }

    procedure.isFavorite = !procedure.isFavorite;
    await procedure.save();

    res.status(200).json(procedure);
  } catch (error) {
    console.error('Error al marcar/desmarcar favorito:', error);
    res.status(500).json({ error: 'Error al actualizar favorito' });
  }
};

exports.deleteProcedure = async (req, res) => {
  try {
    const { id } = req.params;
    await KnowledgeProcedure.update(
      { active: false },
      { where: { id } }
    );
    res.status(200).json({ message: 'Procedimiento eliminado' });
  } catch (error) {
    console.error('Error al eliminar procedimiento:', error);
    res.status(500).json({ error: 'Error al eliminar procedimiento' });
  }
};

// ========== DOCUMENTOS ==========

exports.getAllDocuments = async (req, res) => {
  try {
    const { categoryId, search, favorite } = req.query;
    
    const where = { active: true };
    
    if (categoryId) {
      where.categoryId = categoryId;
    }
    
    if (favorite === 'true') {
      where.isFavorite = true;
    }
    
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const documents = await KnowledgeDocument.findAll({
      where,
      include: [
        {
          model: KnowledgeCategory,
          as: 'category',
          attributes: ['id', 'name', 'icon', 'color']
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name']
        }
      ],
      order: [
        ['isFavorite', 'DESC'],
        ['title', 'ASC']
      ]
    });

    res.status(200).json(documents);
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await KnowledgeDocument.findByPk(id, {
      include: [
        {
          model: KnowledgeCategory,
          as: 'category'
        },
        {
          model: Staff,
          as: 'creator',
          attributes: ['id', 'name']
        },
        {
          model: Staff,
          as: 'updater',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.status(200).json(document);
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({ error: 'Error al obtener documento' });
  }
};

exports.createDocument = async (req, res) => {
  try {
    const staffId = req.user?.id;
    const document = await KnowledgeDocument.create({
      ...req.body,
      createdBy: staffId,
      updatedBy: staffId
    });

    const newDocument = await KnowledgeDocument.findByPk(document.id, {
      include: [
        { model: KnowledgeCategory, as: 'category' },
        { model: Staff, as: 'creator', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json(newDocument);
  } catch (error) {
    console.error('Error al crear documento:', error);
    res.status(500).json({ error: 'Error al crear documento' });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const staffId = req.user?.id;
    
    // Si cambia la fecha de vencimiento, resetear la notificación para que vuelva a avisar
    const updateData = { ...req.body, updatedBy: staffId };
    if (req.body.expiresAt !== undefined) {
      const current = await KnowledgeDocument.findByPk(id, { attributes: ['expiresAt'] });
      if (current && req.body.expiresAt !== current.expiresAt) {
        updateData.expiryNotified = false;
      }
    }

    const [updated] = await KnowledgeDocument.update(updateData, { where: { id } });

    if (updated) {
      const document = await KnowledgeDocument.findByPk(id, {
        include: [
          { model: KnowledgeCategory, as: 'category' },
          { model: Staff, as: 'creator', attributes: ['id', 'name'] },
          { model: Staff, as: 'updater', attributes: ['id', 'name'] }
        ]
      });
      res.status(200).json(document);
    } else {
      res.status(404).json({ error: 'Documento no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({ error: 'Error al actualizar documento' });
  }
};

exports.toggleFavoriteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await KnowledgeDocument.findByPk(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    document.isFavorite = !document.isFavorite;
    await document.save();

    res.status(200).json(document);
  } catch (error) {
    console.error('Error al marcar/desmarcar favorito:', error);
    res.status(500).json({ error: 'Error al actualizar favorito' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    await KnowledgeDocument.update(
      { active: false },
      { where: { id } }
    );
    res.status(200).json({ message: 'Documento eliminado' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
};

// 📤 Upload de archivos a Cloudinary
exports.uploadDocumentFiles = async (req, res) => {
  try {
    const { uploadBufferToCloudinary } = require('../utils/cloudinaryUploader');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    console.log(`📤 Uploading ${req.files.length} archivos a Cloudinary...`);

    const uploadPromises = req.files.map(async (file) => {
      try {
        // Determinar el tipo de recurso basado en mimetype
        let resourceType = 'auto';
        if (file.mimetype.startsWith('image/')) {
          resourceType = 'image';
        } else if (file.mimetype.startsWith('video/')) {
          resourceType = 'video';
        } else if (file.mimetype === 'application/pdf') {
          resourceType = 'raw'; // 'raw' preserva el PDF original sin convertirlo a imagen
        }

        const result = await uploadBufferToCloudinary(file.buffer, {
          folder: 'knowledge-base-documents',
          resource_type: resourceType,
        });

        // Para raw, Cloudinary no devuelve format → inferirlo del mimetype/nombre
        const inferredFormat = result.format
          || (file.mimetype === 'application/pdf' ? 'pdf' : null)
          || file.originalname.split('.').pop()?.toLowerCase()
          || 'bin';

        return {
          url: result.secure_url,
          publicId: result.public_id,
          format: inferredFormat,
          mimeType: file.mimetype,
          resourceType: result.resource_type,
          size: result.bytes,
          originalFilename: file.originalname,
          createdAt: result.created_at
        };
      } catch (uploadError) {
        console.error(`❌ Error uploading file ${file.originalname}:`, uploadError);
        throw uploadError;
      }
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    
    console.log(`✅ Successfully uploaded ${uploadedFiles.length} archivos`);
    return res.status(200).json({ files: uploadedFiles });
  } catch (error) {
    console.error('❌ Error al subir archivos:', error.message);
    return res.status(500).json({ error: 'Error al subir archivos a Cloudinary', details: error.message });
  }
};

// ========== BÚSQUEDA GLOBAL ==========

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Búsqueda debe tener al menos 2 caracteres' });
    }

    const [contacts, procedures, documents] = await Promise.all([
      KnowledgeContact.findAll({
        where: {
          active: true,
          [Op.or]: [
            { companyName: { [Op.iLike]: `%${q}%` } },
            { contactPerson: { [Op.iLike]: `%${q}%` } },
            { phone: { [Op.iLike]: `%${q}%` } },
            { email: { [Op.iLike]: `%${q}%` } },
            { contactType: { [Op.iLike]: `%${q}%` } }
          ]
        },
        include: [{ model: KnowledgeCategory, as: 'category', attributes: ['id', 'name', 'icon'] }],
        limit: 10
      }),
      KnowledgeProcedure.findAll({
        where: {
          active: true,
          [Op.or]: [
            { title: { [Op.iLike]: `%${q}%` } },
            { description: { [Op.iLike]: `%${q}%` } }
          ]
        },
        include: [{ model: KnowledgeCategory, as: 'category', attributes: ['id', 'name', 'icon'] }],
        limit: 10
      }),
      KnowledgeDocument.findAll({
        where: {
          active: true,
          [Op.or]: [
            { title: { [Op.iLike]: `%${q}%` } },
            { description: { [Op.iLike]: `%${q}%` } }
          ]
        },
        include: [{ model: KnowledgeCategory, as: 'category', attributes: ['id', 'name', 'icon'] }],
        limit: 10
      })
    ]);

    res.status(200).json({
      contacts: contacts.map(c => ({ ...c.toJSON(), type: 'contact' })),
      procedures: procedures.map(p => ({ ...p.toJSON(), type: 'procedure' })),
      documents: documents.map(d => ({ ...d.toJSON(), type: 'document' })),
      totalResults: contacts.length + procedures.length + documents.length
    });
  } catch (error) {
    console.error('Error en búsqueda global:', error);
    res.status(500).json({ error: 'Error en búsqueda global' });
  }
};
