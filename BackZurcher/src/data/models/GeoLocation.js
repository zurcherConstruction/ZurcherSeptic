const { DataTypes } = require('sequelize');

// 🗺️ Coordenadas de cada dirección (caché de geocodificación para los mapas de trabajos).
// Se guarda por dirección normalizada: sirve para Work, SimpleWork, mantenimiento o cualquier otra dirección.
module.exports = (sequelize) => {
  return sequelize.define('GeoLocation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    addressKey: {
      type: DataTypes.STRING(300),
      allowNull: false,
      unique: true,
      comment: 'Dirección normalizada (minúsculas, sin espacios dobles)',
    },
    address: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ok', 'not_found'),
      allowNull: false,
      defaultValue: 'ok',
    },
    source: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'census | nominatim | manual',
    },
    geocodedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });
};
