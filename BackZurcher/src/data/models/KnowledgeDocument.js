const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('KnowledgeDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'KnowledgeCategories',
        key: 'id'
      },
      field: 'category_id',
      comment: 'Categoría del documento',
    },
    
    // 📄 INFORMACIÓN DEL DOCUMENTO
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Título del documento',
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción del documento',
    },
    
    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'file_url',
      comment: 'URL del archivo (Cloudinary u otro)',
    },
    
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'file_type',
      comment: 'Tipo de archivo (PDF, DOC, XLS, etc)',
    },
    
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'file_size',
      comment: 'Tamaño del archivo en bytes',
    },
    
    // 🏷️ METADATA
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Tags para búsqueda',
    },
    
    version: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Versión del documento',
    },
    
    // 🎯 ESTADO
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Documento activo',
    },
    
    isFavorite: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_favorite',
      comment: 'Documento marcado como favorito',
    },

    // 📅 VENCIMIENTO (opcional)
    expiresAt: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'expires_at',
      comment: 'Fecha de vencimiento del documento (opcional)',
    },

    expiryNotified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'expiry_notified',
      comment: 'Ya se envió la notificación de vencimiento',
    },
    
    // 👤 AUDITORÍA
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      field: 'created_by',
      comment: 'Usuario que creó el registro',
    },
    
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      field: 'updated_by',
      comment: 'Último usuario que actualizó',
    },
    
  }, {
    tableName: 'KnowledgeDocuments',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['category_id'] },
      { fields: ['active'] },
      { fields: ['is_favorite'] },
      { fields: ['tags'], using: 'gin' },
    ]
  });
};
