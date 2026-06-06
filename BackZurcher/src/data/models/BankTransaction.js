const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BankTransaction = sequelize.define('BankTransaction', {
    idTransaction: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    bankAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'BankAccounts',
        key: 'idBankAccount'
      }
    },
    transactionType: {
      type: DataTypes.ENUM('deposit', 'withdrawal', 'transfer_in', 'transfer_out'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: { args: [0.01], msg: 'El monto debe ser mayor a 0' },
        isDecimal: { msg: 'El monto debe ser un número decimal' }
      }
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      get() {
        const rawValue = this.getDataValue('date');
        // Si es un objeto Date, convertirlo a string YYYY-MM-DD
        if (rawValue instanceof Date) {
          const year = rawValue.getFullYear();
          const month = String(rawValue.getMonth() + 1).padStart(2, '0');
          const day = String(rawValue.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        // Si ya es string, devolverlo tal cual
        return rawValue;
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'La descripción no puede estar vacía' }
      }
    },

    // Vinculación con registros existentes
    relatedIncomeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Incomes',
        key: 'idIncome'
      }
    },
    relatedExpenseId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Expenses',
        key: 'idExpense'
      }
    },
    relatedCreditCardPaymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'SupplierInvoices',
        key: 'idSupplierInvoice'
      }
    },
    relatedSimpleWorkPaymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Vinculación con pagos de SimpleWork'
    },

    // Para transferencias
    transferToAccountId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'BankAccounts',
        key: 'idBankAccount'
      }
    },
    transferFromAccountId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'BankAccounts',
        key: 'idBankAccount'
      }
    },
    relatedTransferId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'BankTransactions',
        key: 'idTransaction'
      }
    },

    // Metadatos
    category: {
      type: DataTypes.ENUM('income', 'expense', 'transfer', 'credit_card_payment', 'manual'),
      allowNull: false,
      defaultValue: 'manual'
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      }
    }
  }, {
    timestamps: true,
    tableName: 'BankTransactions',
    indexes: [
      { fields: ['bankAccountId'], name: 'idx_bank_transactions_account' },
      { fields: ['date'], name: 'idx_bank_transactions_date' },
      { fields: ['transactionType'], name: 'idx_bank_transactions_type' },
      { fields: ['category'], name: 'idx_bank_transactions_category' },
      { fields: ['relatedIncomeId'], name: 'idx_bank_transactions_income' },
      { fields: ['relatedExpenseId'], name: 'idx_bank_transactions_expense' },
      { fields: ['relatedCreditCardPaymentId'], name: 'idx_bank_transactions_cc_payment' }
    ]
  });

  // Métodos de instancia
  BankTransaction.prototype.getFormattedAmount = function() {
    const formatted = `$${parseFloat(this.amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    return this.transactionType === 'withdrawal' || this.transactionType === 'transfer_out' 
      ? `-${formatted}` 
      : `+${formatted}`;
  };

  BankTransaction.prototype.isDeposit = function() {
    return this.transactionType === 'deposit' || this.transactionType === 'transfer_in';
  };

  BankTransaction.prototype.isWithdrawal = function() {
    return this.transactionType === 'withdrawal' || this.transactionType === 'transfer_out';
  };

  return BankTransaction;
};
