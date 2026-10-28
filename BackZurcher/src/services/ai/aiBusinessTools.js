/**
 * 🤖 ZurcherAI — herramientas de negocio específicas (resúmenes listos para usar)
 * Complementan las consultas genéricas de aiEntityCatalog.js.
 */
const { Op, fn, col } = require('sequelize');
const {
  Work, Permit, Income, Expense, Budget, Inspection, FinalInvoice, ChangeOrder,
  MaintenanceVisit, WorkNote, WorkStateHistory, Staff, Image,
} = require('../../data/index');
const { isEntityAllowed } = require('./aiPermissions');
const { attachReceipts } = require('./aiEntityCatalog');

const BUSINESS_TOOLS = [
  {
    name: 'get_works_summary',
    description: 'Count works grouped by status. Use when asked about total works, work counts, or breakdown by status. Optionally filter by date range.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Filter start date (YYYY-MM-DD).' },
        dateTo: { type: 'string', description: 'Filter end date (YYYY-MM-DD).' },
        dateField: {
          type: 'string',
          enum: ['createdAt', 'installationStartDate'],
          description: 'Which date field to filter on. Default: createdAt.',
        },
      },
    },
  },
  {
    name: 'get_works_by_location',
    description: 'Find works matching a city, street, or address substring. Returns matching works with their status and dates.',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name, street name, or any part of the property address (case-insensitive).' },
        status: { type: 'string', description: 'Optional: filter by work status (e.g., installed, maintenance, pending).' },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_installed_works',
    description: 'Get works installed in a date range (installationStartDate), grouped by city. Use when asked how many/which works were installed in a period.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD).' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD).' },
      },
    },
  },
  {
    name: 'get_backlog',
    description: 'Get works in backlog — pending, assigned or inProgress (not yet installed).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_revenue_summary',
    description: 'Get total income/revenue in a date range, grouped by income type.',
    input_schema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD).' },
        dateTo: { type: 'string', description: 'End date (YYYY-MM-DD).' },
      },
    },
  },
  {
    name: 'get_maintenance_summary',
    description: 'Get count and list of works currently in maintenance status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_work_details',
    description: 'Get the full picture of ONE work: permit, budget, inspections, final invoice, change orders, maintenance visits, notes and status history (and incomes/expenses if your role allows). Search by idWork or by an address substring (if several match, the list of matches is returned).',
    input_schema: {
      type: 'object',
      properties: {
        idWork: { type: 'string', description: 'Work UUID.' },
        address: { type: 'string', description: 'Part of the property address.' },
      },
    },
  },
];

const dateOnly = v => (v ? new Date(v).toISOString().split('T')[0] : null);
const money = v => Math.round(parseFloat(v || 0) * 100) / 100;

async function getWorksSummary({ dateFrom, dateTo, dateField = 'createdAt' } = {}) {
  const field = dateField === 'installationStartDate' ? 'installationStartDate' : 'createdAt';
  const where = {};
  if (dateFrom || dateTo) {
    where[field] = {};
    if (dateFrom) where[field][Op.gte] = field === 'createdAt' ? new Date(dateFrom) : dateFrom;
    if (dateTo) where[field][Op.lte] = field === 'createdAt' ? new Date(dateTo + 'T23:59:59') : dateTo;
  }
  const rows = await Work.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('idWork')), 'count']],
    group: ['status'],
    raw: true,
  });
  return {
    total: rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0),
    byStatus: rows.map(r => ({ status: r.status, count: parseInt(r.count, 10) })).sort((a, b) => b.count - a.count),
  };
}

async function getWorksByLocation({ location, status } = {}) {
  const where = { propertyAddress: { [Op.iLike]: `%${location}%` } };
  if (status) where.status = status;
  const works = await Work.findAll({
    where,
    attributes: ['idWork', 'propertyAddress', 'status', 'installationStartDate', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 50,
    raw: true,
  });
  return {
    count: works.length,
    location,
    works: works.map(w => ({
      idWork: w.idWork,
      address: w.propertyAddress,
      status: w.status,
      installationDate: w.installationStartDate,
      created: dateOnly(w.createdAt),
    })),
  };
}

async function getInstalledWorks({ dateFrom, dateTo } = {}) {
  const where = { status: { [Op.notIn]: ['pending', 'assigned', 'inProgress', 'cancelled'] } };
  if (dateFrom || dateTo) {
    where.installationStartDate = {};
    if (dateFrom) where.installationStartDate[Op.gte] = dateFrom;
    if (dateTo) where.installationStartDate[Op.lte] = dateTo;
  }
  const works = await Work.findAll({
    where,
    attributes: ['idWork', 'propertyAddress', 'status', 'installationStartDate'],
    include: [{ model: Permit, attributes: ['systemType', 'isPBTS'], required: false }],
    order: [['installationStartDate', 'DESC']],
    limit: 100,
  });
  const byCity = {};
  works.forEach(w => {
    const parts = (w.propertyAddress || '').split(',');
    const city = parts.length > 1 ? parts[parts.length - 2].trim() : w.propertyAddress;
    byCity[city] = (byCity[city] || 0) + 1;
  });
  return {
    total: works.length,
    dateRange: { from: dateFrom || null, to: dateTo || null },
    byCity: Object.entries(byCity).sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count })),
    works: works.map(w => ({
      idWork: w.idWork,
      address: w.propertyAddress,
      status: w.status,
      installationDate: w.installationStartDate,
      systemType: w.Permit?.systemType || null,
      isPBTS: w.Permit?.isPBTS || false,
    })),
  };
}

async function getBacklog() {
  const works = await Work.findAll({
    where: { status: { [Op.in]: ['pending', 'assigned', 'inProgress'] } },
    attributes: ['idWork', 'propertyAddress', 'status', 'createdAt', 'installationStartDate'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  const byStatus = {};
  works.forEach(w => { byStatus[w.status] = (byStatus[w.status] || 0) + 1; });
  return {
    total: works.length,
    byStatus,
    works: works.map(w => ({
      idWork: w.idWork,
      address: w.propertyAddress,
      status: w.status,
      scheduledDate: w.installationStartDate || null,
      addedOn: dateOnly(w.createdAt),
    })),
  };
}

async function getRevenueSummary({ dateFrom, dateTo } = {}) {
  // Income.date es STRING (YYYY-MM-DD): comparación lexicográfica
  const where = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date[Op.gte] = dateFrom;
    if (dateTo) where.date[Op.lte] = dateTo;
  }
  const rows = await Income.findAll({
    where,
    attributes: ['typeIncome', [fn('COUNT', col('idIncome')), 'transactions'], [fn('SUM', col('amount')), 'total']],
    group: ['typeIncome'],
    raw: true,
  });
  return {
    grandTotal: money(rows.reduce((sum, r) => sum + parseFloat(r.total || 0), 0)),
    dateRange: { from: dateFrom || null, to: dateTo || null },
    byType: rows
      .map(r => ({ type: r.typeIncome, transactions: parseInt(r.transactions, 10), total: money(r.total) }))
      .sort((a, b) => b.total - a.total),
  };
}

async function getMaintenanceSummary() {
  const works = await Work.findAll({
    where: { status: 'maintenance' },
    attributes: ['idWork', 'propertyAddress', 'maintenanceStartDate'],
    order: [['maintenanceStartDate', 'DESC']],
    raw: true,
  });
  return {
    total: works.length,
    works: works.map(w => ({ idWork: w.idWork, address: w.propertyAddress, maintenanceSince: dateOnly(w.maintenanceStartDate) })),
  };
}

async function getWorkDetails(role, { idWork, address } = {}) {
  let work;
  if (idWork) {
    work = await Work.findByPk(idWork, { raw: true });
  } else if (address) {
    const matches = await Work.findAll({
      where: { propertyAddress: { [Op.iLike]: `%${address}%` } },
      attributes: ['idWork', 'propertyAddress', 'status'],
      limit: 20,
      raw: true,
    });
    if (matches.length !== 1) {
      return { message: matches.length ? 'Several works match; ask which one or call again with idWork.' : 'No work found.', matches };
    }
    work = await Work.findByPk(matches[0].idWork, { raw: true });
  } else {
    throw new Error('Provide idWork or address');
  }
  if (!work) return { message: 'No work found.' };

  const id = work.idWork;
  const canSeeFinance = isEntityAllowed(role, 'Income');

  const [permit, budget, inspections, finalInvoice, changeOrders, visits, notes, history, staff, incomes, expenses, photos] = await Promise.all([
    work.idPermit ? Permit.findByPk(work.idPermit, {
      attributes: ['idPermit', 'permitNumber', 'applicant', 'applicantName', 'applicantEmail', 'applicantPhone', 'systemType', 'isPBTS', 'county', 'city', 'expirationDate', 'gpdCapacity', 'permitPdfUrl', 'optionalDocsUrl', 'ppiCloudinaryUrl'],
      raw: true,
    }) : null,
    work.idBudget ? Budget.findByPk(work.idBudget, {
      attributes: ['idBudget', 'status', 'totalPrice', 'initialPayment', 'initialPaymentPercentage', 'date', 'leadSource', 'invoiceNumber'],
      raw: true,
    }) : null,
    Inspection.findAll({
      where: { workId: id },
      attributes: ['type', 'processStatus', 'finalStatus', 'inspectorScheduledDate', 'dateInspectionPerformed', 'notes', 'resultDocumentUrl'],
      raw: true,
    }),
    FinalInvoice.findOne({
      where: { workId: id },
      attributes: ['id', 'invoiceNumber', 'invoiceDate', 'finalAmountDue', 'totalAmountPaid', 'status', 'paymentDate'],
      raw: true,
    }),
    ChangeOrder.findAll({ where: { workId: id }, attributes: ['changeOrderNumber', 'description', 'totalCost', 'status'], raw: true }),
    MaintenanceVisit.findAll({
      where: { workId: id },
      attributes: ['id', 'visitNumber', 'scheduledDate', 'actualVisitDate', 'status', 'clientStatus'],
      order: [['visitNumber', 'ASC']],
      raw: true,
    }),
    WorkNote.findAll({
      where: { workId: id },
      attributes: ['message', 'noteType', 'priority', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 20,
      raw: true,
    }),
    WorkStateHistory.findAll({
      where: { workId: id },
      attributes: ['fromStatus', 'toStatus', 'changedAt', 'reason'],
      order: [['changedAt', 'ASC']],
      raw: true,
    }),
    work.staffId ? Staff.findByPk(work.staffId, { attributes: ['name', 'role'], raw: true }) : null,
    canSeeFinance
      ? Income.findAll({ where: { workId: id }, attributes: ['idIncome', 'date', 'amount', 'typeIncome', 'paymentMethod'], raw: true }).then(r => attachReceipts(role, 'Income', r))
      : null,
    canSeeFinance
      ? Expense.findAll({ where: { workId: id }, attributes: ['idExpense', 'date', 'amount', 'typeExpense', 'vendor', 'paymentStatus'], raw: true }).then(r => attachReceipts(role, 'Expense', r))
      : null,
    Image.findAll({
      where: { idWork: id },
      attributes: ['stage', 'dateTime', 'comment', 'truckCount', 'imageUrl'],
      order: [['createdAt', 'ASC']],
      limit: 40,
      raw: true,
    }),
  ]);

  const result = {
    work: {
      idWork: id,
      address: work.propertyAddress,
      status: work.status,
      county: work.county,
      installationStartDate: work.installationStartDate,
      startDate: work.startDate,
      endDate: work.endDate,
      maintenanceStartDate: dateOnly(work.maintenanceStartDate),
      notes: work.notes,
      assignedTo: staff,
      createdAt: dateOnly(work.createdAt),
      documents: Object.fromEntries(
        ['operatingPermitUrl', 'maintenanceServiceUrl', 'maintenanceContractSignedUrl', 'noticeToOwnerDocumentUrl', 'lienDocumentUrl', 'extraDocumentUrl']
          .filter(k => work[k])
          .map(k => [k, work[k]])
      ),
    },
    photos,
    permit,
    budget,
    inspections,
    finalInvoice,
    changeOrders,
    maintenanceVisits: visits,
    recentNotes: notes,
    statusHistory: history,
  };
  if (canSeeFinance) {
    result.incomes = incomes;
    result.expenses = expenses;
    result.totals = {
      income: money(incomes.reduce((s, i) => s + parseFloat(i.amount || 0), 0)),
      expenses: money(expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)),
    };
  }
  return result;
}

async function executeBusinessTool(role, name, input) {
  switch (name) {
    case 'get_works_summary': return getWorksSummary(input);
    case 'get_works_by_location': return getWorksByLocation(input);
    case 'get_installed_works': return getInstalledWorks(input);
    case 'get_backlog': return getBacklog();
    case 'get_revenue_summary': return getRevenueSummary(input);
    case 'get_maintenance_summary': return getMaintenanceSummary();
    case 'get_work_details': return getWorkDetails(role, input);
    default: return undefined;
  }
}

module.exports = { BUSINESS_TOOLS, executeBusinessTool };
