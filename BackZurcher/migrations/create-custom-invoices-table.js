/**
 * Crea la tabla CustomInvoices para el módulo de facturas personalizadas.
 *
 * Uso local:
 *   node migrations/create-custom-invoices-table.js
 *
 * Uso producción:
 *   $env:DB_DEPLOY="postgresql://..."; node migrations/create-custom-invoices-table.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const connectionString = process.env.DB_DEPLOY || process.env.DATABASE_URL;
if (!connectionString) { console.error('❌ Falta DB_DEPLOY o DATABASE_URL'); process.exit(1); }

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: connectionString.includes('railway') || connectionString.includes('ssl')
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

async function run() {
  await sequelize.authenticate();
  console.log('✅ Conectado a la base de datos\n');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "CustomInvoices" (
      "id"                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      "invoiceType"           VARCHAR(3)   NOT NULL DEFAULT 'INV'
                              CHECK ("invoiceType" IN ('INV','QUO','PRO','CRN','REC')),
      "invoiceNumber"         VARCHAR(30)  NOT NULL UNIQUE,
      "sequenceNumber"        INTEGER      NOT NULL DEFAULT 1,
      "year"                  INTEGER      NOT NULL,
      "title"                 VARCHAR(255),
      "status"                VARCHAR(20)  NOT NULL DEFAULT 'draft'
                              CHECK ("status" IN ('draft','sent','viewed','approved','signed','paid','void')),

      -- Client
      "clientName"            VARCHAR(255) NOT NULL,
      "clientEmail"           VARCHAR(255),
      "clientPhone"           VARCHAR(50),
      "clientAddress"         TEXT,
      "clientCompany"         VARCHAR(255),

      -- Company (overrideable)
      "companyName"           VARCHAR(255) NOT NULL DEFAULT 'ZURCHER CONSTRUCTION',
      "companyEmail"          VARCHAR(255)          DEFAULT 'admin@zurcherseptic.com',
      "companyPhone"          VARCHAR(50)           DEFAULT '+1 (954) 636-8200',
      "companyAddress"        TEXT                  DEFAULT 'SEPTIC TANK DIVISION - CFC1433240',

      -- Items
      "items"                 JSONB        NOT NULL DEFAULT '[]',

      -- Financials
      "subtotal"              DECIMAL(10,2) NOT NULL DEFAULT 0,
      "discountAmount"        DECIMAL(10,2) NOT NULL DEFAULT 0,
      "discountDescription"   VARCHAR(255),
      "taxRate"               DECIMAL(5,2)  NOT NULL DEFAULT 0,
      "taxAmount"             DECIMAL(10,2) NOT NULL DEFAULT 0,
      "total"                 DECIMAL(10,2) NOT NULL DEFAULT 0,

      -- Content
      "termsAndConditions"    TEXT,
      "priceDisplay"          VARCHAR(20)  NOT NULL DEFAULT 'prices',
      "notes"                 TEXT,

      -- Dates
      "issueDate"             DATE         NOT NULL DEFAULT CURRENT_DATE,
      "dueDate"               DATE,

      -- Optional links
      "budgetId"              INTEGER,
      "workId"                UUID,

      -- Client flow
      "requireSignature"      BOOLEAN      NOT NULL DEFAULT FALSE,
      "requirePayment"        BOOLEAN      NOT NULL DEFAULT FALSE,
      "paymentPercentage"     DECIMAL(5,2) NOT NULL DEFAULT 100,
      "paymentAmount"         DECIMAL(10,2),

      -- DocuSign
      "docuSignEnvelopeId"    VARCHAR(255),
      "docuSignStatus"        VARCHAR(50),
      "signedAt"              TIMESTAMPTZ,

      -- Stripe
      "stripePaymentLinkId"   VARCHAR(255),
      "stripePaymentLinkUrl"  TEXT,
      "paidAmount"            DECIMAL(10,2) DEFAULT 0,
      "paidAt"                TIMESTAMPTZ,
      "stripeSessionId"       VARCHAR(255),

      -- PDF & public access
      "pdfPath"               VARCHAR(500),
      "publicToken"           UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),

      -- Tracking
      "sentAt"                TIMESTAMPTZ,
      "viewedAt"              TIMESTAMPTZ,
      "approvedAt"            TIMESTAMPTZ,
      "createdByStaffId"      UUID,

      "createdAt"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "updatedAt"             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Tabla "CustomInvoices" creada (o ya existía)');

  // Index por tipo+año para acelerar auto-numeración
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "custom_invoices_type_year_idx"
    ON "CustomInvoices" ("invoiceType", "year");
  `);
  console.log('✅ Índice por tipo+año creado');

  await sequelize.close();
  console.log('\n🎉 Migración completada.');
}

run().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
