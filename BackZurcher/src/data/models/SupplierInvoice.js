const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SupplierInvoice = sequelize.define('SupplierInvoice', {
    idSupplierInvoice: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    // Información del Invoice
    invoiceNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Número de factura del proveedor'
    },
    vendor: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Nombre del proveedor/empresa'
    },
    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Fecha de emisión del invoice'
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha de vencimiento del pago'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Monto total del invoice (suma de todos los items)'
    },
    
    // Estado del Pago
    paymentStatus: {
      type: DataTypes.ENUM(
        'pending',    // Pendiente de pago
        'partial',    // Parcialmente pagado
        'paid',       // Totalmente pagado
        'overdue',    // Vencido
        'cancelled'   // Cancelado
      ),
      allowNull: false,
      defaultValue: 'pending',
      
    },
    
    // Información de Pago (cuando se paga)
    paymentMethod: {
      type: DataTypes.ENUM(
        'Proyecto Septic BOFA',
        'Chase Bank',
        'AMEX',
        'Chase Credit Card',
        'Cheque',
        'Efectivo',
        'Zelle',
        'Tarjeta Débito',
        'PayPal',
        'Otro'
      ),
      allowNull: true,
      
    },
    paymentDetails: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Detalles del pago: Check #, últimos 4 dígitos, referencia, etc.'
    },
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha en que se realizó el pago'
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Monto que se ha pagado (puede ser parcial)'
    },
    
    // 🆕 Campos para manejo de tarjeta de crédito
    transactionType: {
      type: DataTypes.ENUM('charge', 'payment', 'interest'),
      allowNull: false,
      defaultValue: 'charge',
     
    },
    isCreditCard: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si esta transacción es de tarjeta de crédito (para balance acumulado)'
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Balance de la tarjeta después de aplicar esta transacción'
    },
    
    // Metadata
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas adicionales sobre el invoice'
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el invoice ha sido verificado por finanzas'
    },
    createdByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Staffs',
        key: 'id'
      },
      comment: 'Staff que creó el registro del invoice'
    },
    
    // 🆕 Vínculo a Income (cuando el pago de tarjeta proviene de un ingreso)
    relatedIncomeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Incomes',
        key: 'idIncome'
      },
      comment: 'ID del Income que generó este pago de tarjeta (para devoluciones/créditos)'
    },
    
    // Información de contacto del proveedor (opcional)
    vendorEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Email del proveedor'
    },
    vendorPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Teléfono del proveedor'
    },
    vendorAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Dirección del proveedor'
    },
    
    // --- PDF del Invoice ---
    invoicePdfPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL del PDF del invoice en Cloudinary'
    },
    invoicePdfPublicId: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Public ID de Cloudinary del PDF del invoice'
    }
  }, {
    timestamps: true,
    tableName: 'SupplierInvoices'
  });

  return SupplierInvoice;
};
