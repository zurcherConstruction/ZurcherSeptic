const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FixedExpensePayment = sequelize.define('FixedExpensePayment', {
    idPayment: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    
    // 🔑 Relación con el gasto fijo principal
    fixedExpenseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'FixedExpenses',
        key: 'idFixedExpense'
      },
      comment: 'ID del gasto fijo al que pertenece este pago'
    },
    
    // 💰 Información del pago
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Monto de este pago parcial'
    },
    
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha en que se realizó este pago',
      set(value) {
        // 🔴 CRÍTICO: Asegurar que siempre se guarde como string YYYY-MM-DD
        if (!value) return;
        if (typeof value === 'string') {
          // Si ya es string en formato YYYY-MM-DD, guardar como-está
          if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            this.setDataValue('paymentDate', value);
            return;
          }
          // Si es ISO string con hora, extraer solo fecha
          if (value.includes('T')) {
            this.setDataValue('paymentDate', value.split('T')[0]);
            return;
          }
        }
        if (value instanceof Date) {
          // Convertir Date a string YYYY-MM-DD en UTC
          this.setDataValue('paymentDate', value.toISOString().split('T')[0]);
          return;
        }
        // Fallback: guardar como-está
        this.setDataValue('paymentDate', value);
      },
      get() {
        const value = this.getDataValue('paymentDate');
        if (!value) return null;
        if (typeof value === 'string') return value;
        return value.toISOString().split('T')[0];
      }
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
        'Cheque',
        'Efectivo',
        'Zelle',
        'Tarjeta Débito',
        'PayPal',
        'Otro'
      ),
      allowNull: true,
     
    },
    
    // 📎 Comprobante de pago
    receiptUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL del comprobante de pago (recibo, transferencia, etc.)'
    },
    
    receiptPublicId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Public ID de Cloudinary para el comprobante'
    },
    
    // 📝 Notas
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas o detalles sobre este pago específico'
    },

    // 🗓️ Período pagado (opcional)
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Inicio del período pagado (opcional)',
      set(value) {
        if (!value) return;
        if (typeof value === 'string') {
          if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            this.setDataValue('periodStart', value);
            return;
          }
          if (value.includes('T')) {
            this.setDataValue('periodStart', value.split('T')[0]);
            return;
          }
        }
        if (value instanceof Date) {
          this.setDataValue('periodStart', value.toISOString().split('T')[0]);
          return;
        }
        this.setDataValue('periodStart', value);
      },
      get() {
        const value = this.getDataValue('periodStart');
        if (!value) return null;
        if (typeof value === 'string') return value;
        return value.toISOString().split('T')[0];
      }
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fin del período pagado (opcional)',
      set(value) {
        if (!value) return;
        if (typeof value === 'string') {
          if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            this.setDataValue('periodEnd', value);
            return;
          }
          if (value.includes('T')) {
            this.setDataValue('periodEnd', value.split('T')[0]);
            return;
          }
        }
        if (value instanceof Date) {
          this.setDataValue('periodEnd', value.toISOString().split('T')[0]);
          return;
        }
        this.setDataValue('periodEnd', value);
      },
      get() {
        const value = this.getDataValue('periodEnd');
        if (!value) return null;
        if (typeof value === 'string') return value;
        return value.toISOString().split('T')[0];
      }
    },
    periodDueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de vencimiento del período pagado (opcional)',
      set(value) {
        if (!value) return;
        if (typeof value === 'string') {
          if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            this.setDataValue('periodDueDate', value);
            return;
          }
          if (value.includes('T')) {
            this.setDataValue('periodDueDate', value.split('T')[0]);
            return;
          }
        }
        if (value instanceof Date) {
          this.setDataValue('periodDueDate', value.toISOString().split('T')[0]);
          return;
        }
        this.setDataValue('periodDueDate', value);
      },
      get() {
        const value = this.getDataValue('periodDueDate');
        if (!value) return null;
        if (typeof value === 'string') return value;
        return value.toISOString().split('T')[0];
      }
    },
    // 🔗 Relación con Expense generado
    expenseId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Expenses',
        key: 'idExpense'
      },
      comment: 'ID del Expense que se creó automáticamente al registrar este pago'
    },
    
    // 👤 Quién registró el pago
    createdByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      comment: 'Staff que registró este pago'
    }
    
  }, {
    timestamps: true,
    tableName: 'FixedExpensePayments',
    indexes: [
      {
        fields: ['fixedExpenseId']
      },
      {
        fields: ['paymentDate']
      },
      {
        fields: ['expenseId']
      }
    ]
  });

  return FixedExpensePayment;
};
