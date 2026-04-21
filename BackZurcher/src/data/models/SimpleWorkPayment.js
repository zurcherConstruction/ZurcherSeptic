const { DataTypes } = require('sequelize');

/**
 * SimpleWorkPayment - Modelo para pagos de trabajos varios
 */
module.exports = (sequelize) => {
  const SimpleWorkPayment = sequelize.define('SimpleWorkPayment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    simpleWorkId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    
    paymentMethod: {
      type: DataTypes.ENUM(
        // Bancos
        'Proyecto Septic BOFA',
        'Chase Bank',
        // Tarjetas
        'AMEX',
        'Chase Credit Card',
        // Otros métodos
        'Efectivo'
      ),
      allowNull: false
    },
    
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    receiptUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      }
    }
  }, {
    tableName: 'SimpleWorkPayment',
    timestamps: true,
    updatedAt: false
  });

  // 🔗 Asociaciones
  SimpleWorkPayment.associate = (models) => {
    // Relación con Staff para createdBy
    SimpleWorkPayment.belongsTo(models.Staff, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
  };

  return SimpleWorkPayment;
};