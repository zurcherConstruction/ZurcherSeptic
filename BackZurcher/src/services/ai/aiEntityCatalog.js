/**
 * 🤖 ZurcherAI — consultas genéricas de solo lectura sobre los modelos del sistema
 *
 * En lugar de una herramienta por tabla, la IA usa tres herramientas genéricas
 * (describe_entity, query_records, aggregate_records) sobre una lista blanca de entidades.
 * Los nombres de campo se validan contra la definición del modelo, así que nunca
 * llega texto libre de la IA a SQL como identificador.
 */
const { Op, fn, col, cast } = require('sequelize');
const models = require('../../data/index');
const { isEntityAllowed } = require('./aiPermissions');

// Entidades consultables y una descripción breve para la IA
const ENTITIES = {
  Work: 'Septic installation jobs (main entity). status lifecycle, propertyAddress, installation dates, county. Links: idPermit, idBudget, staffId (assigned worker).',
  Permit: 'Septic permits: permitNumber, applicant, propertyAddress, systemType, isPBTS, county/city, expirationDate, PPI inspector data.',
  Budget: 'Quotes/budgets sent to clients: applicantName/email, propertyAddress, status, totalPrice, initialPayment, leadSource, commissions, invoiceNumber.',
  BudgetLineItem: 'Line items of a budget (budgetId): name, category, quantity, unitPrice, lineTotal, supplierName.',
  BudgetNote: 'Follow-up notes on budgets (budgetId, staffId, message, noteType, priority).',
  BudgetItem: 'Catalog of items/prices used to build budgets.',
  ChangeOrder: 'Change orders on works (workId): description, totalCost, status.',
  Claim: 'Warranty/repair claims and callbacks: client, propertyAddress, claimType, priority, status, dates, assignedStaffId.',
  ContactRequest: 'Contact form requests from the website.',
  QuoteRequest: 'Internal quote requests reported by staff: client, workType, urgency, status.',
  CustomInvoice: 'Custom invoices/quotes (INV/QUO/PRO/CRN/REC/PMP): client, total, status, paidAmount, dates.',
  FinalInvoice: 'Final invoices of works (workId, budgetId): finalAmountDue, totalAmountPaid, status (accounts receivable).',
  Inspection: 'Initial and final inspections of works (workId): type, processStatus, finalStatus, scheduled/performed dates.',
  MaintenanceVisit: 'Maintenance visits of works in maintenance (workId): visitNumber, scheduledDate, actualVisitDate, status, checklist results, clientStatus.',
  SimpleWork: 'Small/other jobs (culvert, drainfield, repair, pumping...): workNumber, workType, propertyAddress, amounts, status.',
  SimpleWorkItem: 'Line items of simple works (simpleWorkId).',
  SimpleWorkPayment: 'Payments received for simple works.',
  SimpleWorkExpense: 'Expenses of simple works.',
  SalesLead: 'Sales leads/prospects: applicant, propertyAddress, status, priority, source, estimatedValue, dates.',
  LeadNote: 'Notes on sales leads (leadId).',
  WorkNote: 'Follow-up notes on works (workId, staffId, message, noteType).',
  WorkStateHistory: 'History of work status changes (workId, fromStatus, toStatus, changedAt).',
  WorkChecklist: 'Final review checklist per work (workId).',
  Material: 'Materials used on works (workId).',
  Income: 'Money received: date, amount, typeIncome, paymentMethod, workId/simpleWorkId.',
  Expense: 'Money spent: date, amount, typeExpense, vendor, paymentMethod, paymentStatus, workId.',
  FixedExpense: 'Recurring fixed expenses (rent, insurance, salaries...): totalAmount, frequency, nextDueDate.',
  FixedExpensePayment: 'Payments of fixed expenses.',
  SupplierInvoice: 'Invoices from suppliers/vendors: vendor, totalAmount, paidAmount, paymentStatus, dueDate.',
  SupplierInvoiceItem: 'Line items of supplier invoices.',
  BankAccount: 'Company bank accounts and current balances.',
  BankTransaction: 'Bank account movements: deposits, withdrawals, transfers.',
  Receipt: 'Uploaded receipts/vouchers attached to incomes, expenses, etc.',
  Reminder: 'Task board reminders: title, priority, dueDate, linked entity.',
  StaffAttendance: 'Staff daily attendance (staffId, workDate, isPresent).',
  Staff: 'Employees: name, email, phone, role, isActive.',
  StaffActivityLog: 'Web activity log of staff (sections visited).',
  FleetAsset: 'Vehicles, machines and equipment: status, mileage, insurance/registration expiry.',
  FleetMaintenance: 'Fleet maintenance/service records (assetId): type, cost, serviceDate, nextServiceDate.',
  KnowledgeContact: 'Knowledge base: contacts of suppliers, inspectors, companies.',
  KnowledgeCounty: 'Knowledge base: county requirements, phones, emails.',
  KnowledgeProcedure: 'Knowledge base: internal procedures (steps).',
  KnowledgeDocument: 'Knowledge base: documents and their expiration.',
  SignatureDocument: 'Documents sent for e-signature and their status.',
  SystemType: 'Septic system types and base prices.',
  MarketingCampaign: 'Email marketing campaigns sent.',
  Newsletter: 'Newsletters: status, sent/opened counts.',
  NewsletterSubscriber: 'Newsletter/marketing subscribers: email, name, phone, status, source, tags.',
  NewsletterRecipient: 'Delivery of each newsletter to each subscriber (newsletterId, subscriberId): status, sent/opened/clicked/bounced dates.',
  Image: 'Photos uploaded for works (idWork): stage (e.g. installation, inspection, cover), dateTime, comment, truckCount (trucks of sand/dirt), imageUrl.',
  InstallationDetail: 'Installation day details of works (idWork): date, extraDetails, extraMaterials.',
  MaterialSet: 'Material purchases for works (workId): totalCost, purchaseDate, invoiceFile.',
  WorkExtraItem: 'Extra items added to final invoices (finalInvoiceId): description, quantity, unitPrice, lineTotal, dateAdded.',
  MaintenanceMedia: 'Photos/videos uploaded during maintenance visits (maintenanceVisitId): mediaType, originalName, fieldName, mediaUrl.',
  ContactFile: 'Files attached to website contact requests (contactRequestId).',
  FleetMileageLog: 'Mileage/hours readings of fleet assets (assetId): mileage, hours, previous values, recordedAt, recordedById.',
  FleetAssetDocument: 'Documents of fleet assets (assetId): category (registration, insurance, ...), name, url.',
  KnowledgeCategory: 'Knowledge base categories (name, description, order, active).',
  ReminderAssignment: 'Staff assigned to each task board reminder (reminderId, staffId): completed, completedAt.',
  ReminderComment: 'Comments on task board reminders (reminderId, staffId, message, taggedStaffIds).',
  Notification: 'Internal notifications/messages between staff (staffId = recipient, senderId): title, message, type, isRead.',
  NotificationRouting: 'Which staff member receives each type of automatic notification (eventType, staffId).',
  SupplierInvoiceWork: 'Links supplier invoices to works (supplierInvoiceId, workId).',
  SupplierInvoiceSimpleWork: 'Supplier invoice amounts assigned to simple works (supplierInvoiceId, simpleWorkId, assignedAmount).',
  SupplierInvoiceExpense: 'Payments of supplier invoices through expenses (supplierInvoiceId, expenseId, amountApplied).',
};

// Campos que nunca se exponen a la IA (credenciales, tokens, binarios, HTML pesado)
const SENSITIVE_FIELD = /password|token|publicid|accountnumber|idfronturl|idbackurl|htmlcontent|textcontent|^pdfdata$|^optionaldocs$|stripesession|stripepaymentintent/i;
const TEXT_TYPES = ['STRING', 'TEXT', 'CITEXT', 'CHAR'];
const NUMERIC_TYPES = ['INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL', 'NUMBER'];
const DATE_TYPES = ['DATE', 'DATEONLY'];
const SKIP_TYPES = ['BLOB', 'VIRTUAL'];

const MAX_ROWS = 100;
const MAX_TEXT_LENGTH = 800;

function typeKey(attr) {
  return attr.type?.key || attr.type?.constructor?.name || 'UNKNOWN';
}

function getEntityFields(entityName) {
  const model = models[entityName];
  if (!model) return {};
  const fields = {};
  for (const [name, attr] of Object.entries(model.rawAttributes)) {
    const key = typeKey(attr);
    if (SKIP_TYPES.includes(key) || SENSITIVE_FIELD.test(name)) continue;
    fields[name] = { type: key, values: attr.type?.values || undefined };
  }
  return fields;
}

function listEntities(role) {
  return Object.keys(ENTITIES).filter(e => models[e] && isEntityAllowed(role, e));
}

function assertEntity(role, entity) {
  if (!ENTITIES[entity] || !models[entity]) throw new Error(`Unknown entity: ${entity}`);
  if (!isEntityAllowed(role, entity)) throw new Error(`Your role does not have access to ${entity}`);
}

function assertField(fields, field, entity) {
  if (!fields[field]) throw new Error(`Field "${field}" does not exist or is not available on ${entity}. Use describe_entity first.`);
}

function coerceValue(fieldDef, value) {
  if (value === null || value === undefined) return value;
  if (fieldDef.type === 'DATE') return new Date(value);
  if (fieldDef.type === 'BOOLEAN') return value === true || value === 'true';
  return value;
}

function buildWhere(entity, fields, filters = []) {
  const where = {};
  for (const f of filters.slice(0, 15)) {
    assertField(fields, f.field, entity);
    const def = fields[f.field];
    const conds = where[f.field] || {};
    switch (f.op) {
      case 'eq': conds[Op.eq] = coerceValue(def, f.value); break;
      case 'ne': conds[Op.ne] = coerceValue(def, f.value); break;
      case 'gt': conds[Op.gt] = coerceValue(def, f.value); break;
      case 'gte': conds[Op.gte] = coerceValue(def, f.value); break;
      case 'lt': conds[Op.lt] = coerceValue(def, f.value); break;
      case 'lte': conds[Op.lte] = coerceValue(def, f.value); break;
      case 'in':
        if (!Array.isArray(f.value)) throw new Error(`"in" filter on ${f.field} requires an array value`);
        conds[Op.in] = f.value.slice(0, 100).map(v => coerceValue(def, v));
        break;
      case 'contains':
        if (!TEXT_TYPES.includes(def.type)) throw new Error(`"contains" only works on text fields (${f.field} is ${def.type})`);
        conds[Op.iLike] = `%${String(f.value).replace(/[%_\\]/g, '\\$&')}%`;
        break;
      case 'is_null': conds[Op.is] = null; break;
      case 'not_null': conds[Op.not] = null; break;
      default: throw new Error(`Unsupported filter op: ${f.op}`);
    }
    where[f.field] = conds;
  }
  return where;
}

function compactValue(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v.length > MAX_TEXT_LENGTH ? v.slice(0, MAX_TEXT_LENGTH) + '…[truncated]' : v;
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > MAX_TEXT_LENGTH ? s.slice(0, MAX_TEXT_LENGTH) + '…[truncated]' : v;
  }
  return v;
}

// --- Tools ---

function describeEntity(role, { entity }) {
  assertEntity(role, entity);
  const fields = getEntityFields(entity);
  return {
    entity,
    description: ENTITIES[entity],
    primaryKey: models[entity].primaryKeyAttribute,
    fields: Object.entries(fields).map(([name, d]) => (d.values ? { name, type: d.type, values: d.values } : { name, type: d.type })),
  };
}

async function queryRecords(role, { entity, filters, fields: selected, orderBy, limit = 25 }) {
  assertEntity(role, entity);
  const fields = getEntityFields(entity);
  const where = buildWhere(entity, fields, filters);

  let attributes = Object.keys(fields);
  if (Array.isArray(selected) && selected.length) {
    selected.forEach(f => assertField(fields, f, entity));
    attributes = selected;
  }

  const order = [];
  if (orderBy?.field) {
    assertField(fields, orderBy.field, entity);
    order.push([orderBy.field, orderBy.direction === 'asc' ? 'ASC' : 'DESC']);
  } else if (fields.createdAt) {
    order.push(['createdAt', 'DESC']);
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), MAX_ROWS);
  const model = models[entity];
  const [rows, total] = await Promise.all([
    model.findAll({ where, attributes, order, limit: safeLimit, raw: true }),
    model.count({ where }),
  ]);

  return {
    entity,
    totalMatching: total,
    returned: rows.length,
    truncated: total > rows.length,
    rows: rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, compactValue(v)]))),
  };
}

async function aggregateRecords(role, { entity, filters, groupBy = [], groupByPeriod, metrics = [{ fn: 'count' }] }) {
  assertEntity(role, entity);
  const fields = getEntityFields(entity);
  const where = buildWhere(entity, fields, filters);

  const attributes = [];
  const group = [];

  for (const g of groupBy.slice(0, 2)) {
    assertField(fields, g, entity);
    attributes.push(g);
    group.push(g);
  }

  if (groupByPeriod?.field) {
    assertField(fields, groupByPeriod.field, entity);
    const period = ['day', 'week', 'month', 'quarter', 'year'].includes(groupByPeriod.period) ? groupByPeriod.period : 'month';
    // Algunos campos de fecha son STRING (YYYY-MM-DD); se castean a timestamp
    attributes.push([fn('date_trunc', period, cast(col(groupByPeriod.field), 'timestamp')), 'period']);
    group.push('period');
  }

  const metricAliases = [];
  for (const m of metrics.slice(0, 5)) {
    const fnName = String(m.fn || 'count').toLowerCase();
    if (!['count', 'sum', 'avg', 'min', 'max'].includes(fnName)) throw new Error(`Unsupported metric: ${m.fn}`);
    if (fnName === 'count') {
      attributes.push([fn('COUNT', col(models[entity].primaryKeyAttribute)), 'count']);
      metricAliases.push('count');
      continue;
    }
    assertField(fields, m.field, entity);
    const def = fields[m.field];
    if (['sum', 'avg'].includes(fnName) && !NUMERIC_TYPES.includes(def.type)) {
      throw new Error(`${fnName} requires a numeric field (${m.field} is ${def.type})`);
    }
    const alias = `${fnName}_${m.field}`;
    attributes.push([fn(fnName.toUpperCase(), col(m.field)), alias]);
    metricAliases.push(alias);
  }

  const rows = await models[entity].findAll({
    where,
    attributes,
    group: group.length ? group : undefined,
    order: groupByPeriod?.field ? [[col('period'), 'ASC']] : undefined,
    limit: group.length ? 200 : undefined,
    raw: true,
  });

  const toNumber = v => (v === null || v === undefined ? null : Math.round(parseFloat(v) * 100) / 100);
  return {
    entity,
    groups: rows.map(r => {
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        if (metricAliases.includes(k)) out[k] = toNumber(v);
        else if (k === 'period' && v) out.period = new Date(v).toISOString().slice(0, 10);
        else out[k] = v;
      }
      return out;
    }),
  };
}

const FILTER_SCHEMA = {
  type: 'array',
  description: 'Conditions combined with AND.',
  items: {
    type: 'object',
    properties: {
      field: { type: 'string' },
      op: { type: 'string', enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'is_null', 'not_null'] },
      value: { description: 'Value to compare. Array for "in". Dates as YYYY-MM-DD. Omit for is_null/not_null.' },
    },
    required: ['field', 'op'],
  },
};

function buildEntityToolDefinitions(role) {
  const entities = listEntities(role);
  const entityList = entities.map(e => `- ${e}: ${ENTITIES[e]}`).join('\n');

  return [
    {
      name: 'describe_entity',
      description: `Get the fields (names, types and allowed enum values) of an entity before querying it. Available entities:\n${entityList}`,
      input_schema: {
        type: 'object',
        properties: { entity: { type: 'string', enum: entities } },
        required: ['entity'],
      },
    },
    {
      name: 'query_records',
      description: 'List records of any available entity with filters, sorting and field selection. Returns up to 100 rows plus the total count of matches. Use "contains" for case-insensitive text search (e.g. addresses, names). Call describe_entity first if unsure of field names or enum values.',
      input_schema: {
        type: 'object',
        properties: {
          entity: { type: 'string', enum: entities },
          filters: FILTER_SCHEMA,
          fields: { type: 'array', items: { type: 'string' }, description: 'Optional subset of fields to return (recommended to keep results small).' },
          orderBy: {
            type: 'object',
            properties: { field: { type: 'string' }, direction: { type: 'string', enum: ['asc', 'desc'] } },
          },
          limit: { type: 'integer', description: 'Max rows (1-100, default 25).' },
        },
        required: ['entity'],
      },
    },
    {
      name: 'aggregate_records',
      description: 'Count/sum/avg/min/max records of any available entity, optionally grouped by up to 2 fields and/or by a time period (day/week/month/quarter/year) of a date field. Use this for totals, breakdowns and trends instead of listing rows.',
      input_schema: {
        type: 'object',
        properties: {
          entity: { type: 'string', enum: entities },
          filters: FILTER_SCHEMA,
          groupBy: { type: 'array', items: { type: 'string' }, description: 'Up to 2 fields to group by.' },
          groupByPeriod: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Date field.' },
              period: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'] },
            },
          },
          metrics: {
            type: 'array',
            description: 'Default: [{fn:"count"}].',
            items: {
              type: 'object',
              properties: {
                fn: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] },
                field: { type: 'string', description: 'Required except for count.' },
              },
              required: ['fn'],
            },
          },
        },
        required: ['entity'],
      },
    },
  ];
}

module.exports = {
  buildEntityToolDefinitions,
  describeEntity,
  queryRecords,
  aggregateRecords,
};
