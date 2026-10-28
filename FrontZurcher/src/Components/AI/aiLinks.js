// 🔗 ZurcherAI — enlaces "#open/<Entity>/<id>" que genera la IA → rutas del sistema
const DETAIL_ROUTES = {
  Work: id => `/work/${id}`,
  SimpleWork: id => `/simple-works/${id}`,
  CustomInvoice: id => `/custom-invoices/${id}`,
  Budget: id => `/budgets/edit/${id}`,
  MaintenanceVisit: id => `/maintenance/${id}`,
  FleetAsset: id => `/fleet/${id}`,
  BankAccount: id => `/bank-accounts/${id}`,
};

// Entidades sin página de detalle: se abre el listado correspondiente
const LIST_ROUTES = {
  SalesLead: '/sales-leads',
  LeadNote: '/sales-leads',
  Claim: '/claims',
  SupplierInvoice: '/supplier-invoices',
  FixedExpense: '/fixed-expenses',
  FixedExpensePayment: '/fixed-expenses',
  Income: '/balance',
  Expense: '/balance',
  BankTransaction: '/bank-accounts',
  FinalInvoice: '/accounts-receivable',
  Reminder: '/reminders-board',
  KnowledgeContact: '/knowledge-base',
  KnowledgeCounty: '/knowledge-base',
  KnowledgeProcedure: '/knowledge-base',
  KnowledgeDocument: '/knowledge-base',
  SignatureDocument: '/signature-documents',
  MarketingCampaign: '/marketing-campaigns',
  Newsletter: '/marketing-campaigns/newsletter',
  StaffAttendance: '/staff-attendance',
  NotificationRouting: '/notification-routing',
  BudgetItem: '/itemBudget',
  QuoteRequest: '/simple-works',
  FleetMaintenance: '/fleet',
};

// Pantallas de detalle → registro que el usuario está viendo (contexto para la IA)
const SCREEN_PATTERNS = [
  [/^\/work\/([^/]+)$/, 'Work'],
  [/^\/worker\/work\/([^/]+)$/, 'Work'],
  [/^\/ver-imagenes\/([^/]+)$/, 'Work'],
  [/^\/simple-works\/(?!tracker$)([^/]+)$/, 'SimpleWork'],
  [/^\/custom-invoices\/(?!new$)([^/]+)$/, 'CustomInvoice'],
  [/^\/budgets\/edit\/([^/]+)$/, 'Budget'],
  [/^\/maintenance\/(?!works$|calendar$|zones$)([^/]+)$/, 'MaintenanceVisit'],
  [/^\/worker\/maintenance\/([^/]+)$/, 'MaintenanceVisit'],
  [/^\/fleet\/([^/]+)$/, 'FleetAsset'],
  [/^\/bank-accounts\/(?!new-transaction$|monthly-report$)([^/]+)$/, 'BankAccount'],
];

export function getScreenContext(pathname) {
  for (const [pattern, entity] of SCREEN_PATTERNS) {
    const match = pathname.match(pattern);
    if (match) return { entity, id: decodeURIComponent(match[1]) };
  }
  return null;
}

// Preguntas rápidas según lo que se está viendo
export const CONTEXT_ACTIONS = {
  Work: ['Resumime esta obra', '¿Qué falta para cerrarla?', '¿Hay correos sobre esta dirección?', 'Mostrame fotos y documentos', 'Gastos e ingresos con comprobantes'],
  SimpleWork: ['Resumime este trabajo', '¿Está pagado?', '¿Hay correos sobre esta dirección?', 'Mostrame fotos y adjuntos'],
  CustomInvoice: ['Resumime esta factura', '¿Ya se cobró?', '¿Se envió por correo? ¿Cuándo?'],
  Budget: ['Resumime este presupuesto', '¿Qué seguimiento tuvo?', '¿Hay correos con este cliente?'],
  MaintenanceVisit: ['Resumime esta visita', 'Historial de mantenimiento de esta obra', '¿El cliente confirmó?'],
  FleetAsset: ['Estado y mantenimientos de este vehículo', '¿Qué vence pronto?'],
  BankAccount: ['Movimientos de este mes', 'Resumen de esta cuenta'],
};

export const OPEN_LINK_PREFIX = '#open/';
export const EXPORT_LINK_PREFIX = '#ai-export/';

export function resolveOpenLink(href) {
  const [entity, ...rest] = href.slice(OPEN_LINK_PREFIX.length).split('/');
  const id = decodeURIComponent(rest.join('/'));
  if (DETAIL_ROUTES[entity] && id) return DETAIL_ROUTES[entity](id);
  return LIST_ROUTES[entity] || null;
}

// Solo se muestran imágenes de la cuenta de Cloudinary de la empresa
export function isCompanyImage(src) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

// Miniatura liviana usando transformaciones de Cloudinary (las imágenes originales pueden pesar varios MB)
export function thumbnailUrl(src, size = 480) {
  return src.includes('/image/upload/')
    ? src.replace('/image/upload/', `/image/upload/w_${size},h_${size},c_limit,q_auto,f_auto/`)
    : src;
}
