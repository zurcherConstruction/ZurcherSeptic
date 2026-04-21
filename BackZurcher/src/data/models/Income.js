const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Income = sequelize.define('Income', {
   idIncome: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    staffId: {
  type: DataTypes.UUID,
  allowNull: true, // o true si puede ser opcional
  references: {
    model: 'Staffs', // nombre de la tabla Staff
    key: 'id'
  }
},
    date: {
      type: DataTypes.STRING(10), // Formato: YYYY-MM-DD
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL,
      allowNull: false,
    },
    typeIncome: {
        type: DataTypes.ENUM(
            'Factura Pago Inicial Budget',
            'Factura Pago Final Budget',
            'Factura SimpleWork', // 🆕 Pagos de SimpleWork (sincronizado con frontend)
            'DiseñoDif',
            "Comprobante Ingreso",
        ),
        allowNull: false,
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    workId: { // Add workId to Income model
      type: DataTypes.UUID,
      allowNull: true, // or false, depending on your requirements
    },
    // 🆕 SimpleWork ID - Para vincular ingresos con Simple Works
    simpleWorkId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Vincula el ingreso con un SimpleWork (trabajos varios/cotizaciones)'
    },
    // 🆕 Método/Cuenta de pago
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
        'Stripe',
        'Otro'
      ),
      allowNull: true,
      
    },
    // Detalle adicional del método de pago
    paymentDetails: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Detalles adicionales del pago (ej: Check #1234, Últimos 4 dígitos: 5678, etc.)'
    },
    // 🆕 Campo de verificación/revisión
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el ingreso ha sido verificado/revisado por el equipo de finanzas'
    },
    // 🆕 Campos para pagos de Stripe
    stripePaymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID del Payment Intent de Stripe (para tracking y reembolsos)'
    },
    stripeSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'ID de la Checkout Session de Stripe'
    }
  });

 

  return Income;
};