const { DataTypes } = require('sequelize');

/**
 * FleetMileageLog - Historial de actualizaciones de mileaje y horas trabajadas
 */
module.exports = (sequelize) => {
  sequelize.define('FleetMileageLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    assetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Nuevo mileaje (para vehículos)
    mileage: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      comment: 'Nueva lectura de mileaje en millas',
    },

    // Nuevas horas (para maquinaria)
    hours: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      comment: 'Nueva lectura de horas trabajadas',
    },

    // Mileaje/horas previos (para calcular diferencia)
    previousMileage: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
    },

    previousHours: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
    },

    recordedById: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Staff que registró la actualización',
    },

    recordedAt: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'fleet_mileage_logs',
  });
};
