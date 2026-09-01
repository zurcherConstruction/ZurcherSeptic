const { DataTypes } = require('sequelize');

/**
 * SimpleWorkItem - Modelo para items de cotización SimpleWork
 * Similar a BudgetItem pero específico para trabajos simples
 */
module.exports = (sequelize) => {
  const SimpleWorkItem = sequelize.define('SimpleWorkItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    simpleWorkId: {
      type: DataTypes.UUID,
      allowNull: false
    },

    category: {
      type: DataTypes.STRING,
      allowNull: false
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1
    },

    unit: {
      type: DataTypes.STRING,
      allowNull: true
    },

    unitCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },

    totalCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },

    discount: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0
    },

    markup: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0
    },

    finalCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    isFromTemplate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    templateItemId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID del BudgetItem template utilizado (referencia a BudgetItem.id)'
    },

    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },

    showPrice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Si false, oculta QTY/RATE/AMOUNT en el PDF para este item'
    }
  }, {
    tableName: 'SimpleWorkItems',
    timestamps: true,
    
    // Métodos de instancia
    instanceMethods: {
      /**
       * Calcular costo final aplicando descuento y markup
       */
      calculateFinalCost() {
        let cost = parseFloat(this.totalCost);
        
        // Aplicar descuento
        if (this.discount && this.discount > 0) {
          cost = cost - (cost * (this.discount / 100));
        }
        
        // Aplicar markup
        if (this.markup && this.markup > 0) {
          cost = cost + (cost * (this.markup / 100));
        }
        
        return parseFloat(cost.toFixed(2));
      },

      /**
       * Recalcular costos basado en cantidad y precio unitario
       */
      recalculateCosts() {
        this.totalCost = parseFloat((this.quantity * this.unitCost).toFixed(2));
        this.finalCost = this.calculateFinalCost();
        return this;
      }
    },

    // Hooks para recalcular automáticamente
    hooks: {
      beforeSave: (item) => {
        // Recalcular totalCost
        item.totalCost = parseFloat((item.quantity * item.unitCost).toFixed(2));
        
        // Recalcular finalCost
        let cost = item.totalCost;
        
        // Aplicar descuento
        if (item.discount && item.discount > 0) {
          cost = cost - (cost * (item.discount / 100));
        }
        
        // Aplicar markup
        if (item.markup && item.markup > 0) {
          cost = cost + (cost * (item.markup / 100));
        }
        
        item.finalCost = parseFloat(cost.toFixed(2));
      }
    }
  });

  // Definir asociaciones
  SimpleWorkItem.associate = (models) => {
    // Pertenece a SimpleWork
    SimpleWorkItem.belongsTo(models.SimpleWork, {
      foreignKey: 'simpleWorkId',
      as: 'simpleWork',
      onDelete: 'CASCADE'
    });

    // Relación opcional con BudgetItem (template)
    if (models.BudgetItem) {
      SimpleWorkItem.belongsTo(models.BudgetItem, {
        foreignKey: 'templateItemId',
        as: 'templateItem',
        constraints: false // No crear FK constraint real
      });
    }
  };

  return SimpleWorkItem;
};