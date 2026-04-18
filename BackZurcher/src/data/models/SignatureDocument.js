const { DataTypes } = require('sequelize');

/**
 * SignatureDocument - Documentos genéricos para firma electrónica
 * Soporta SignNow (desarrollo) y DocuSign (producción)
 * Puede vincularse opcionalmente a contactos u otras entidades
 */
module.exports = (sequelize) => {
  const SignatureDocument = sequelize.define('SignatureDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // Información del documento
    documentName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nombre descriptivo del documento'
    },

    documentType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Tipo de documento (contrato, NDA, acuerdo, etc.)'
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción o notas sobre el documento'
    },

    // PDF original (antes de enviar)
    originalPdfUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL del PDF original en Cloudinary'
    },

    originalPdfPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Public ID en Cloudinary para el PDF original'
    },

    // Destinatario (quien debe firmar)
    signerName: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nombre del firmante'
    },

    signerEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Email del firmante'
    },

    signerPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Teléfono del firmante (opcional)'
    },

    // Vinculación opcional con contactos u otras entidades
    linkedContactId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID del KnowledgeContact vinculado (opcional)'
    },

    linkedEntityType: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Tipo de entidad vinculada (Budget, Work, Claim, etc.)'
    },

    linkedEntityId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID de la entidad vinculada'
    },

    // Proveedor de firma (SignNow o DocuSign)
    signatureProvider: {
      type: DataTypes.ENUM('signnow', 'docusign'),
      allowNull: false,
      comment: 'Proveedor usado (signnow para dev, docusign para prod)'
    },

    // IDs del proveedor
    providerDocumentId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID del documento en SignNow o DocuSign'
    },

    providerEnvelopeId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID del envelope (DocuSign) o invite (SignNow)'
    },

    // Estado del documento
    status: {
      type: DataTypes.ENUM(
        'draft',           // Borrador, no enviado aún
        'pending',         // Enviado, esperando firma
        'signed',          // Firmado completamente
        'declined',        // Rechazado por el firmante
        'failed',          // Error al enviar
        'cancelled'        // Cancelado manualmente
      ),
      allowNull: false,
      defaultValue: 'draft'
    },

    // PDF firmado (después de firmar)
    signedPdfUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL del PDF firmado en Cloudinary'
    },

    signedPdfPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Public ID en Cloudinary para el PDF firmado'
    },

    // Fechas de seguimiento
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de envío'
    },

    signedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de firma'
    },

    downloadedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de descarga del PDF firmado'
    },

    // Metadata adicional
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'Metadata adicional (responses del proveedor, campos personalizados, etc.)'
    },

    // Quién creó/envió el documento
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Staff que creó el documento'
    }

  }, {
    tableName: 'SignatureDocuments',
    timestamps: true,
    paranoid: false,
    indexes: [
      { fields: ['status'] },
      { fields: ['signatureProvider'] },
      { fields: ['linkedContactId'] },
      { fields: ['signerEmail'] },
      { fields: ['providerDocumentId'] },
      { fields: ['createdAt'] }
    ]
  });

  // Asociaciones
  SignatureDocument.associate = (models) => {
    // Vinculación con KnowledgeContact
    SignatureDocument.belongsTo(models.KnowledgeContact, {
      as: 'linkedContact',
      foreignKey: 'linkedContactId',
      constraints: false
    });

    // Creador (Staff)
    SignatureDocument.belongsTo(models.Staff, {
      as: 'creator',
      foreignKey: 'createdBy',
      constraints: false
    });
  };

  return SignatureDocument;
};
