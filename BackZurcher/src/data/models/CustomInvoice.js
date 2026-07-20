const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  return sequelize.define('CustomInvoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: () => uuidv4(),
      primaryKey: true,
    },
    invoiceType: {
      type: DataTypes.ENUM('INV', 'QUO', 'PRO', 'CRN', 'REC'),
      allowNull: false,
      defaultValue: 'INV',
    },
    invoiceNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      comment: 'Formatted number e.g. INV-2026-001. Manually overridable.',
    },
    sequenceNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Optional short title or subject',
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'viewed', 'approved', 'signed', 'paid', 'void'),
      allowNull: false,
      defaultValue: 'draft',
    },
    // Client info
    clientName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clientEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },
    clientPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clientAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clientCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Company info (overrideable defaults)
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ZURCHER CONSTRUCTION',
    },
    companyEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'admin@zurcherseptic.com',
    },
    companyPhone: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '+1 (954) 636-8200',
    },
    companyAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'SEPTIC TANK DIVISION - CFC1433240',
    },
    // Line items (flexible JSON array)
    items: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of { name, description, quantity, unitPrice, amount }',
    },
    // Financials
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountDescription: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // Content
    termsAndConditions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // How prices are displayed in the PDF: 'prices' | 'included' | 'not_included'
    priceDisplay: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'prices',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Dates
    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // Optional links
    budgetId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    workId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Client flow options
    requireSignature: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    requirePayment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    paymentPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 100,
      comment: '0-100, percentage of total required for payment',
    },
    paymentAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Computed: total * paymentPercentage / 100',
    },
    // DocuSign
    docuSignEnvelopeId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    docuSignStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    signedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Stripe
    stripePaymentLinkId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripePaymentLinkUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    stripeSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // PDF & Access
    pdfPath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    publicToken: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: () => uuidv4(),
      unique: true,
    },
    // Tracking
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Created by
    createdByStaffId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  });
};
