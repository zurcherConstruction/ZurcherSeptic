const { DataTypes } = require('sequelize');

/**
 * Claim - Modelo para reclamos / garantías
 * Permite registrar, agendar, asignar y dar seguimiento a reclamos de clientes
 */
module.exports = (sequelize) => {
  const Claim = sequelize.define('Claim', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    claimNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Número único de reclamo (CLM-2026-001)'
    },

    // Datos del cliente
    clientName: {
      type: DataTypes.STRING,
      allowNull: false
    },

    clientPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },

    clientEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },

    // Dirección - puede vincularse a un Work/SimpleWork existente o ser manual
    propertyAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    // Vinculación opcional con Work o SimpleWork existentes
    linkedWorkId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Vinculación opcional con un Work existente'
    },

    linkedSimpleWorkId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Vinculación opcional con un SimpleWork existente'
    },

    // Descripción del reclamo
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Descripción detallada del reclamo'
    },

    // Tipo de reclamo
    claimType: {
      type: DataTypes.ENUM(
        'warranty',       // Garantía
        'repair',         // Reparación
        'callback',       // Llamada de retorno
        'complaint',      // Queja
        'other'           // Otro
      ),
      allowNull: false,
      defaultValue: 'repair'
    },

    // Prioridad
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },

    // Estado del reclamo
    status: {
      type: DataTypes.ENUM(
        'pending',        // Pendiente (recién creado)
        'scheduled',      // Agendado (tiene fecha programada)
        'in_progress',    // En progreso (staff asignado trabajando)
        'completed',      // Completado (reparado)
        'closed',         // Cerrado
        'cancelled'       // Cancelado
      ),
      allowNull: false,
      defaultValue: 'pending'
    },

    // Fechas de seguimiento
    claimDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha en que se recibió el reclamo'
    },

    scheduledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha programada para la reparación/visita'
    },

    repairDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha real de reparación completada'
    },

    // Staff asignado
    assignedStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Staff asignado para realizar la reparación'
    },

    // Notas internas
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // Resolución / qué se hizo
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción de la resolución / reparación realizada'
    },

    // Imágenes del reclamo (antes)
    claimImages: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Fotos del problema reportado'
    },

    // Imágenes de la reparación (después)
    repairImages: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Fotos del trabajo de reparación completado'
    },

    createdBy: {
      type: DataTypes.UUID,
      allowNull: true
    }

  }, {
    tableName: 'Claim',
    timestamps: true,
    paranoid: false
  });

  // Generar número de reclamo único (OPTIMIZADO)
  Claim.generateClaimNumber = async function() {
    const year = new Date().getFullYear();
    const prefix = `CLM-${year}-`;

    // 🚀 OPTIMIZACIÓN: Usar raw query con LIKE para aprovechar índices
    // Busca solo claims del año actual para reducir dataset
    const result = await sequelize.query(
      `SELECT "claimNumber" FROM "Claim" 
       WHERE "claimNumber" LIKE :prefix 
       ORDER BY "claimNumber" DESC 
       LIMIT 1`,
      {
        replacements: { prefix: `${prefix}%` },
        type: sequelize.QueryTypes.SELECT
      }
    );

    let nextSeq = 1;
    if (result.length > 0) {
      const lastSeq = parseInt(result[0].claimNumber.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    // Generar el número (sin validación adicional - el unique constraint protege)
    return `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  };

  // Asociaciones
  Claim.associate = (models) => {
    Claim.belongsTo(models.Staff, {
      foreignKey: 'assignedStaffId',
      as: 'assignedStaff'
    });

    Claim.belongsTo(models.Staff, {
      foreignKey: 'createdBy',
      as: 'creator'
    });

    if (models.Work) {
      Claim.belongsTo(models.Work, {
        foreignKey: 'linkedWorkId',
        as: 'linkedWork',
        constraints: false
      });
    }

    if (models.SimpleWork) {
      Claim.belongsTo(models.SimpleWork, {
        foreignKey: 'linkedSimpleWorkId',
        as: 'linkedSimpleWork',
        constraints: false
      });
    }
  };

  return Claim;
};
