const SKIP_PATTERNS = [
  /\/health/,
  /\/notification\//,
  /\/metrics/,
  /\/alerts\//,
  /\/upcoming/,
  /\/no-answer/,
  /\/activity\/metrics/,
  /\/pdf$/,
  /\/view-pdf$/,
  /\/download-pdf$/,
  /\/staff-activity/,
];

const SECTION_MAP = [
  ['/work-notes', 'Works'],
  ['/work', 'Works'],
  ['/budget-notes', 'Budgets'],
  ['/budget-item', 'Budgets'],
  ['/budget', 'Budgets'],
  ['/maintenance', 'Maintenance'],
  ['/legacy-maintenance', 'Maintenance'],
  ['/claims', 'Claims'],
  ['/simple-works', 'Simple Works'],
  ['/final-invoice', 'Invoices'],
  ['/custom-invoices', 'Invoices'],
  ['/change-orders', 'Change Orders'],
  ['/sales-leads', 'Sales Leads'],
  ['/sales-indicators', 'Sales'],
  ['/sales', 'Sales'],
  ['/lead-notes', 'Sales Leads'],
  ['/expense', 'Expenses'],
  ['/fixed-expense', 'Expenses'],
  ['/income', 'Finance'],
  ['/balance', 'Finance'],
  ['/bank-accounts', 'Finance'],
  ['/bank-transactions', 'Finance'],
  ['/financial-dashboard', 'Finance'],
  ['/accounts-receivable', 'Finance'],
  ['/monthly-expenses', 'Finance'],
  ['/monthly-installations', 'Installations'],
  ['/completed-installations', 'Installations'],
  ['/staff-attendance', 'Attendance'],
  ['/admin/staff', 'Staff'],
  ['/admin', 'Admin'],
  ['/permit', 'Permits'],
  ['/inspection', 'Inspection'],
  ['/reminder', 'Reminders'],
  ['/fleet', 'Fleet'],
  ['/knowledge-base', 'Knowledge Base'],
  ['/company-emails', 'Marketing'],
  ['/newsletter', 'Marketing'],
  ['/signature-documents', 'Documents'],
  ['/receipt', 'Expenses'],
  ['/supplier-invoices', 'Invoices'],
  ['/ai', 'AI Assistant'],
  ['/export', 'Exports'],
  ['/import', 'Import'],
  ['/material', 'Materials'],
  ['/system', 'System'],
  ['/notification-routing', 'Notifications'],
  ['/archive', 'Budgets'],
  ['/pdf', 'Documents'],
];


const getSection = (path) => {
  for (const [prefix, label] of SECTION_MAP) {
    if (path.startsWith(prefix)) return label;
  }
  return 'Other';
};

// Debounce: solo registra si pasaron más de 2 minutos desde el último log del usuario
const DEBOUNCE_MS = 2 * 60 * 1000;
const lastLogged = new Map(); // staffId → timestamp

let StaffActivityLog = null;

const activityLogger = (req, res, next) => {
  next();

  if (!req.user?.id) return;
  if (SKIP_PATTERNS.some((p) => p.test(req.path))) return;

  const staffId = req.user.id;
  const now = Date.now();
  const last = lastLogged.get(staffId) || 0;

  if (now - last < DEBOUNCE_MS) return; // demasiado reciente, no registrar
  lastLogged.set(staffId, now);

  const endpoint = req.path.substring(0, 255);
  const method = req.method;
  const section = getSection(req.path);

  setImmediate(async () => {
    try {
      if (!StaffActivityLog) {
        StaffActivityLog = require('../data').StaffActivityLog;
      }
      if (StaffActivityLog) {
        await StaffActivityLog.create({ staffId, endpoint, method, section });
      }
    } catch (_) {}
  });
};

module.exports = activityLogger;
