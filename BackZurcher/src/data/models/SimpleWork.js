const { DataTypes } = require('sequelize');

/**
 * SimpleWork - Modelo para trabajos varios (no-sépticos)
 * Maneja trabajos como culvert, drainfield, concrete, etc.
 */
module.exports = (sequelize) => {
  const SimpleWork = sequelize.define('SimpleWork', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    workNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    
    workType: {
      type: DataTypes.ENUM(
        'culvert', 
        'drainfield', 
        'concrete_work', 
        'excavation', 
        'plumbing', 
        'electrical',
        'landscaping',
        'repair',
        'maintenance',
        'other'
      ),
      allowNull: false
    },
    
    propertyAddress: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    
    clientData: {
      type: DataTypes.JSON,
      allowNull: false
    },
    
    linkedWorkId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Works',
        key: 'idWork'
      }
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    
    estimatedAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    
    finalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    
    status: {
      type: DataTypes.ENUM(
        'quoted', 'sent', 'approved', 'in_progress', 
        'completed', 'invoiced', 'paid', 'cancelled'
      ),
      allowNull: false,
      defaultValue: 'quoted'
    },
    
    assignedStaffId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    assignedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    startDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    completedDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // 🆕 Fecha de envío por email
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha cuando se envió por email al cliente'
    },

    // 🆕 Token para aprobación del cliente por email
    approvalToken: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Token único para que el cliente apruebe la cotización desde el email'
    },
    
    totalPaid: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    
    totalExpenses: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    termsAndConditions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Términos y condiciones del presupuesto'
    },

    descriptionTitle: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'DESCRIPTION',
      comment: 'Título personalizable para sección Descripción en PDF'
    },

    notesTitle: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'NOTES',
      comment: 'Título personalizable para sección Notas en PDF'
    },

    termsTitle: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'TERMS & CONDITIONS',
      comment: 'Título personalizable para sección Términos en PDF'
    },
    
    attachments: {
      type: DataTypes.JSON,
      allowNull: true
    },

    // 🆕 Campos de payment agregados
    discountPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0
    },

    initialPaymentPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 100
    },

    initialPayment: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },

    // 💳 Payment method integration (matching existing financial system)
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Método de pago utilizado (Chase Bank, AMEX, Efectivo, etc.)',
      validate: {
        isIn: {
          args: [['Proyecto Septic BOFA', 'Chase Bank', 'AMEX', 'Chase Credit Card', 'Efectivo']],
          msg: 'Método de pago debe ser uno de los métodos válidos'
        },
        customPaymentMethodValidator(value) {
          // Permitir null, undefined o cadena vacía (valores "falsy")
          if (!value) {
            return;
          }
          // Si tiene valor, debe estar en la lista permitida
          const allowedMethods = ['Proyecto Septic BOFA', 'Chase Bank', 'AMEX', 'Chase Credit Card', 'Efectivo'];
          if (!allowedMethods.includes(value)) {
            throw new Error('Método de pago debe ser uno de los métodos válidos');
          }
        }
      }
    },

    createdBy: {
      type: DataTypes.UUID,
      allowNull: true
    },

    // 📸 Imágenes del trabajo y de finalización
    workImages: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Fotos del trabajo en progreso'
    },

    completionImages: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Fotos de finalización del trabajo'
    },

    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción de los trabajos realizados / resolución'
    }
  }, {
    tableName: 'SimpleWork',
    timestamps: true,
    hooks: {
      // Agregar métodos de instancia como hooks
      afterFind(instances) {
        if (!instances) return;
        
        const addInstanceMethods = (instance) => {
          if (!instance) return;
          
          // Método para obtener texto de estado
          instance.getStatusDisplay = function() {
            const statusMap = {
              quoted: 'Cotizado',
              sent: 'Enviado',
              approved: 'Aprobado',
              in_progress: 'En Progreso',
              completed: 'Completado',
              invoiced: 'Facturado',
              paid: 'Pagado',
              cancelled: 'Cancelado'
            };
            return statusMap[this.status] || this.status;
          };

          // Método para obtener texto de tipo de trabajo
          instance.getWorkTypeDisplay = function() {
            const typeMap = {
              culvert: 'Alcantarilla',
              drainfield: 'Campo de Drenaje',
              concrete_work: 'Trabajo en Concreto',
              excavation: 'Excavación',
              plumbing: 'Plomería',
              electrical: 'Eléctrico',
              landscaping: 'Jardinería',
              other: 'Otro'
            };
            return typeMap[this.workType] || this.workType;
          };

          // Método para obtener monto restante
          instance.getRemainingAmount = function() {
            const finalAmount = parseFloat(this.finalAmount || this.estimatedAmount || 0);
            const totalPaid = parseFloat(this.totalPaid || 0);
            return Math.max(0, finalAmount - totalPaid);
          };

          // Método para obtener ganancia
          instance.getProfit = function() {
            const totalPaid = parseFloat(this.totalPaid || 0);
            const totalExpenses = parseFloat(this.totalExpenses || 0);
            return totalPaid - totalExpenses;
          };
        };
        
        if (Array.isArray(instances)) {
          instances.forEach(addInstanceMethods);
        } else {
          addInstanceMethods(instances);
        }
      }
    }
  });

  // Método estático para generar número de trabajo
  SimpleWork.generateWorkNumber = async function() {
    const sequelize = require('../../../config/database');
    const year = new Date().getFullYear();
    const count = await SimpleWork.count({
      where: sequelize.where(
        sequelize.fn('YEAR', sequelize.col('createdAt')), 
        year
      )
    });
    
    const nextNumber = (count + 1).toString().padStart(3, '0');
    return `SW-${year}-${nextNumber}`;
  };

  // 🎯 Métodos de instancia útiles
  SimpleWork.prototype.getStatusDisplay = function() {
    const statusMap = {
      quoted: 'Cotizado',
      sent: 'Enviado',
      approved: 'Aprobado',
      in_progress: 'En Progreso',
      completed: 'Completado',
      invoiced: 'Facturado',
      paid: 'Pagado',
      cancelled: 'Cancelado'
    };
    return statusMap[this.status] || this.status;
  };

  SimpleWork.prototype.getWorkTypeDisplay = function() {
    const typeMap = {
      culvert: 'Alcantarilla',
      drainfield: 'Campo de Drenaje',
      concrete_work: 'Trabajo en Concreto',
      excavation: 'Excavación',
      plumbing: 'Plomería',
      electrical: 'Eléctrico',
      landscaping: 'Jardinería',
      repair: 'Reparación',
      maintenance: 'Mantenimiento',
      other: 'Otro'
    };
    return typeMap[this.workType] || this.workType;
  };

  SimpleWork.prototype.getRemainingAmount = function() {
    const finalAmount = parseFloat(this.finalAmount || this.estimatedAmount || 0);
    const totalPaid = parseFloat(this.totalPaid || 0);
    return Math.max(0, finalAmount - totalPaid);
  };

  SimpleWork.prototype.getProfit = function() {
    const finalAmount = parseFloat(this.finalAmount || this.estimatedAmount || 0);
    const totalPaid = parseFloat(this.totalPaid || 0);
    const totalExpenses = parseFloat(this.totalExpenses || 0);
    return totalPaid - totalExpenses;
  };

  // 🔢 Método estático para generar número de trabajo
  SimpleWork.generateWorkNumber = async function() {
    const year = new Date().getFullYear();
    const count = await SimpleWork.count({
      where: sequelize.where(
        sequelize.fn('EXTRACT', sequelize.literal('YEAR FROM "createdAt"')), 
        year
      )
    });
    
    const nextNumber = (count + 1).toString().padStart(3, '0');
    return `SW-${year}-${nextNumber}`;
  };

  // 🔗 Definir asociaciones
  SimpleWork.associate = (models) => {
    // Relación con Staff para assignedStaff
    SimpleWork.belongsTo(models.Staff, {
      foreignKey: 'assignedStaffId',
      as: 'assignedStaff'
    });

    // Relación con Staff para createdBy
    SimpleWork.belongsTo(models.Staff, {
      foreignKey: 'createdBy',
      as: 'creator'
    });

    // Relación con SimpleWorkPayments
    SimpleWork.hasMany(models.SimpleWorkPayment, {
      foreignKey: 'simpleWorkId',
      as: 'payments',
      onDelete: 'CASCADE'
    });

    // Relación con SimpleWorkExpenses
    SimpleWork.hasMany(models.SimpleWorkExpense, {
      foreignKey: 'simpleWorkId',
      as: 'expenses',
      onDelete: 'CASCADE'
    });

    // 🆕 Relación con SimpleWorkItems
    SimpleWork.hasMany(models.SimpleWorkItem, {
      foreignKey: 'simpleWorkId',
      as: 'items',
      onDelete: 'CASCADE'
    });

    // Relación opcional con Work (vinculación)
    if (models.Work) {
      SimpleWork.belongsTo(models.Work, {
        foreignKey: 'linkedWorkId',
        as: 'linkedWork',
        constraints: false // No crear FK constraint real
      });
    }
  };

  return SimpleWork;
};