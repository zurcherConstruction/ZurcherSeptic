const { DataTypes } = require('sequelize');

/**
 * KnowledgeCounty — Información operativa por condado de Florida.
 *
 * Almacena teléfonos, correos, links (página NOC, portal), documentos requeridos,
 * proceso paso a paso y requisitos específicos por tipo de sistema (REGULAR, ATU, DRIP).
 */
module.exports = (sequelize) => {
  return sequelize.define('KnowledgeCounty', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre del condado (e.g. Lee, Collier)',
    },

    region: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Región geográfica (e.g. Costa Oeste / Suroeste)',
    },

    // [{label, number, notes}]
    phones: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Teléfonos de contacto del condado',
    },

    // [{label, email, notes}]
    emails: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Emails de contacto del condado',
    },

    // [{label, url, description}]  — NOC search page, portal, etc.
    websites: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Links útiles del condado (NOC, portal búsqueda, etc.)',
    },

    // [{
    //   systemType: 'REGULAR'|'ATU'|'DRIP',
    //   requiredDocs: String[],
    //   steps: [{order, title, description, notes}],
    //   fees: String,
    //   turnaroundTime: String,
    //   notes: String
    // }]
    systemRequirements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Requisitos y pasos por tipo de sistema',
    },

    generalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas generales del condado',
    },

    // [{name, url, publicId, mimeType, size}]
    attachments: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Documentos adjuntos del condado',
    },

    order: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Orden de visualización',
    },

    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

  }, {
    tableName: 'KnowledgeCounties',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['name'] },
      { fields: ['active'] },
      { fields: ['region'] },
    ],
  });
};
