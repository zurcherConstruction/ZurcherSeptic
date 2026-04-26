const { DataTypes } = require('sequelize');

/**
 * FleetMaintenance - Registros de mantenimiento para vehículos y maquinaria
 */
module.exports = (sequelize) => {
  const FleetMaintenance = sequelize.define('FleetMaintenance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    // Número de orden de servicio
    serviceNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Número de orden: SVC-2026-001',
    },

    // FK al activo
    assetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    // Tipo de mantenimiento
    maintenanceType: {
      type: DataTypes.ENUM(
        'preventive',    // Preventivo programado
        'oil_change',    // Cambio de aceite
        'tire_change',   // Cambio de neumáticos
        'brake_service', // Frenos
        'corrective',    // Correctivo (falla)
        'repair',        // Reparación
        'inspection',    // Inspección / revisión
        'cleaning',      // Limpieza
        'other'          // Otro
      ),
      allowNull: false,
      defaultValue: 'preventive',
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Título breve: "Cambio aceite 5000mi", "Reparación transmisión"',
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada del trabajo realizado',
    },

    // Métricas al momento del servicio
    mileageAtService: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      comment: 'Mileaje al momento del servicio',
    },

    hoursAtService: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      comment: 'Horas de trabajo al momento del servicio',
    },

    // Costo
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },

    // Quién realizó el mantenimiento
    performedById: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Staff interno que realizó el mantenimiento',
    },

    externalShop: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Taller o mecánico externo (si aplica)',
    },

    // Fechas
    serviceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // Próximo servicio programado
    nextServiceMileage: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      comment: 'Mileaje para el próximo servicio',
    },

    nextServiceHours: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: true,
      comment: 'Horas para el próximo servicio',
    },

    nextServiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha del próximo servicio programado',
    },

    // Estado del registro
    status: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'completed',
    },

    // Repuestos / partes usadas
    partsUsed: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '[{name, quantity, cost, brand}]',
    },

    // Imágenes/documentos adjuntos
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '[{url, publicId, type: image|document, name}]',
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Quién creó el registro
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    timestamps: true,
    tableName: 'fleet_maintenances',
  });

  return FleetMaintenance;
};
