const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QuoteRequest = sequelize.define('QuoteRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    clientName: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    clientPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    clientEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    clientAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    workType: {
      type: DataTypes.ENUM(
        'reparacion',
        'desagote',
        'instalacion',
        'plomeria',
        'inspeccion',
        'culvert',
        'drainfield',
        'otro'
      ),
      allowNull: false,
      defaultValue: 'otro',
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    urgency: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'emergency'),
      allowNull: false,
      defaultValue: 'normal',
    },

    photos: {
      type: DataTypes.JSON,
      defaultValue: [],
    },

    reportedByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      // Sin references explícito — la asociación se maneja en associate()
    },

    status: {
      type: DataTypes.ENUM('pending', 'reviewing', 'quoted', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },

    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    linkedSimpleWorkId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'QuoteRequests',
    timestamps: true,
  });

  QuoteRequest.associate = (models) => {
    QuoteRequest.belongsTo(models.Staff, {
      foreignKey: 'reportedByStaffId',
      as: 'reportedBy',
    });

    if (models.SimpleWork) {
      QuoteRequest.belongsTo(models.SimpleWork, {
        foreignKey: 'linkedSimpleWorkId',
        as: 'linkedSimpleWork',
        constraints: false,
      });
    }
  };

  return QuoteRequest;
};
