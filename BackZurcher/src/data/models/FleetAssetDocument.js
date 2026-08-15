const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  sequelize.define('FleetAssetDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    assetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    category: {
      type: DataTypes.ENUM('registration', 'insurance', 'plate', 'warranty', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nombre descriptivo del documento',
    },

    fileType: {
      type: DataTypes.ENUM('image', 'pdf'),
      allowNull: false,
      defaultValue: 'image',
    },

    url: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'URL de Cloudinary',
    },

    publicId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID público de Cloudinary para eliminar',
    },

    uploadedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'fleet_asset_documents',
    indexes: [
      { fields: ['assetId'] },
      { fields: ['assetId', 'category'] },
    ],
  });
};
