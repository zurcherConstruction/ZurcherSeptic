/**
 * 🤖 ZurcherAI — permisos por rol
 *
 * Único lugar donde se define qué puede consultar cada rol a través de la IA.
 * Refleja los permisos que cada rol ya tiene en el sistema (rutas + menú lateral):
 *  - owner: todo.
 *  - admin: operación completa (obras, permisos, presupuestos, inspecciones, mantenimiento,
 *    leads, claims, flota, base de conocimiento, facturas a clientes / cuentas por cobrar),
 *    SIN la parte financiera interna (ingresos/gastos, bancos, gastos fijos, facturas de
 *    proveedores) ni actividad del personal / configuración del sistema.
 *
 * Para dar acceso a otro rol en el futuro basta con agregarlo aquí y en aiRoutes.js.
 */

// Entidades que admin NO puede consultar (owner las ve todas)
const ADMIN_EXCLUDED_ENTITIES = [
  'Income',
  'Expense',
  'BankAccount',
  'BankTransaction',
  'FixedExpense',
  'FixedExpensePayment',
  'SupplierInvoice',
  'SupplierInvoiceItem',
  'SupplierInvoiceWork',
  'SupplierInvoiceSimpleWork',
  'SupplierInvoiceExpense',
  'SimpleWorkPayment',
  'SimpleWorkExpense',
  'StaffActivityLog',
  'SystemType',
  'NotificationRouting',
  'Notification', // mensajes internos de otros empleados
  'MarketingCampaign',
  'Newsletter',
  'NewsletterSubscriber',
  'NewsletterRecipient',
];

// Nunca se exponen (credenciales o datos internos de la propia IA):
// DocuSignToken, Token, AIConversation, AIMessage, NewsletterTemplate (solo HTML),
// NotificationApp (sin uso), ReminderRead (marcas de lectura)

// Herramientas de negocio que admin NO puede usar
const ADMIN_EXCLUDED_TOOLS = ['get_revenue_summary'];

// recept tiene el mismo acceso que admin
const AI_ROLES = ['owner', 'admin', 'recept'];
const ADMIN_LEVEL_ROLES = ['admin', 'recept'];

function parseMailboxList(value) {
  return (value || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Buzones de Google Workspace que puede leer cada rol.
 * AI_MAILBOXES          → lista general (ej: info@..., admin@..., sales@...)
 * AI_MAILBOXES_<ROL>    → (opcional) lista específica para un rol, ej: AI_MAILBOXES_ADMIN
 */
function getAllowedMailboxes(role) {
  const roleSpecific = process.env[`AI_MAILBOXES_${role.toUpperCase().replace('-', '_')}`];
  return parseMailboxList(roleSpecific !== undefined ? roleSpecific : process.env.AI_MAILBOXES);
}

function canUseAI(role) {
  return AI_ROLES.includes(role);
}

function isEntityAllowed(role, entityName) {
  if (role === 'owner') return true;
  if (ADMIN_LEVEL_ROLES.includes(role)) return !ADMIN_EXCLUDED_ENTITIES.includes(entityName);
  return false;
}

function isToolAllowed(role, toolName) {
  if (role === 'owner') return true;
  if (ADMIN_LEVEL_ROLES.includes(role)) return !ADMIN_EXCLUDED_TOOLS.includes(toolName);
  return false;
}

module.exports = {
  AI_ROLES,
  canUseAI,
  isEntityAllowed,
  isToolAllowed,
  getAllowedMailboxes,
};
