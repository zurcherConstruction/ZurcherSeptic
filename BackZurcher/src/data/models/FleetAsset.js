const { DataTypes } = require('sequelize');

/**
 * FleetAsset - Modelo para vehículos y maquinaria de la empresa
 */
module.exports = (sequelize) => {
  sequelize.define('FleetAsset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Tipo de activo
    assetType: {
      type: DataTypes.ENUM('vehicle', 'machine', 'equipment', 'trailer'),
      allowNull: false,
      defaultValue: 'vehicle',
      comment: 'Tipo: vehicle=camioneta/auto, machine=excavadora/cargadora, equipment=herramienta pesada, trailer=remolque',
    },

    // Identificación
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nombre descriptivo: ej. "Ford F-250 2020 Blanca"',
    },

    brand: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Marca: Ford, Caterpillar, John Deere...',
    },

    model: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Modelo: F-250, 320D, Skid Steer...',
    },

    year: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Placa / Patente (para vehículos)
    licensePlate: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Placa o patente del vehículo',
    },

    // Número de serie (para máquinas)
    serialNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Número de serie para maquinaria',
    },

    color: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fuelType: {
      type: DataTypes.ENUM('gasoline', 'diesel', 'electric', 'hybrid', 'propane', 'none'),
      allowNull: true,
      defaultValue: 'diesel',
    },

    // Imagen
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    imagePublicId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Métricas actuales
    currentMileage: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      defaultValue: 0,
      comment: 'Mileaje actual en millas',
    },

    currentHours: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      defaultValue: 0,
      comment: 'Horas de trabajo acumuladas (para maquinaria)',
    },

    // Estado
    status: {
      type: DataTypes.ENUM('active', 'in_repair', 'inactive', 'retired'),
      allowNull: false,
      defaultValue: 'active',
    },

    // Asignación actual
    assignedToId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Staff actualmente responsable del vehículo/máquina',
    },

    // Datos financieros
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    purchasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    // Seguro
    insuranceExpiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de vencimiento del seguro',
    },

    registrationExpiry: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de vencimiento de la registración/patente',
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'fleet_assets',
  });
};
