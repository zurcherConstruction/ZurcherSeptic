const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const budgetRoutes = require('./BudgetRoutes');
const budgetNoteRoutes = require('./BudgetNoteRoutes'); // 🆕 Rutas para notas de seguimiento de budgets
const workNoteRoutes = require('./WorkNoteRoutes'); // 🆕 Rutas para notas de seguimiento de obras
const pdfRoutes = require('./pdfRoutes');
const inspectionRoutes = require('./inspectionRoutes');
const materialRoutes = require('./materialRoutes');
const workRoutes = require('./workRoutes');
const permitRoutes = require('./permitRoutes');
const notificationRoutes = require('./NotificationRoutes'); // Asegúrate de que la ruta sea correcta
const archiveRoutes = require('./archiveRoutes'); // Asegúrate de que la ruta sea correcta
const receiptRoutes = require('./receiptRoutes'); // Asegúrate de que la ruta sea correcta
const incomeRoutes = require('./incomeRoutes'); // Asegúrate de que la ruta sea correcta
const expenseRoutes = require('./expenseRoutes'); // Asegúrate de que la ruta sea correcta
const fixedExpenseRoutes = require('./fixedExpenseRoutes'); // 🆕 Rutas para gastos fijos
const fixedExpensePaymentRoutes = require('./fixedExpensePaymentRoutes'); // 🆕 Rutas para pagos parciales
const supplierInvoiceRoutes = require('./supplierInvoiceRoutes'); // 🆕 Rutas para invoices de proveedores
const balanceRoutes = require('./balanceRoutes'); // Asegúrate de que la ruta sea correcta
const systemRoutes = require('./systemRoutes'); // Asegúrate de que la ruta sea correcta
const budgetItemRoutes = require('./BudgetItemRoutes'); // Asegúrate de que la ruta sea correcta
const finalInvoiceRoutes = require('./finalInvoiceRutes'); // Asegúrate de que la ruta sea correcta
const changeOrdersRoutes = require('./changeOrderRoutes'); // Asegúrate de que la ruta sea correcta
const maintenanceRoutes = require('./maintenanceRoutes'); // Asegúrate de que la ruta sea correcta
const legacyMaintenanceRoutes = require('./legacyMaintenanceRoutes'); // 🆕 Edición de Works legacy
const accountsReceivableRoutes = require('./accountsReceivableRoutes'); // 🆕 Cuentas por cobrar
const financialDashboardRoutes = require('./financialDashboardRoutes'); // 🆕 Dashboard financiero consolidado
const bankAccountRoutes = require('./bankAccountRoutes'); // 🆕 Gestión de cuentas bancarias
const bankTransactionRoutes = require('./bankTransactionRoutes'); // 🆕 Transacciones bancarias
const monthlyExpensesRoutes = require('./monthlyExpensesRoutes'); // 🆕 Gastos devengados mensuales
const workChecklistRoutes = require('./workChecklistRoutes'); // 🆕 Checklist de verificación de obras
const monthlyInstallationsRoutes = require('./monthlyInstallationsRoutes'); // 🆕 Instalaciones mensuales (covered)
const staffAttendanceRoutes = require('./staffAttendanceRoutes'); // 🆕 Asistencia del personal
//const adobeWebhookRoutes = require('./adobeWebhookRoutes'); // Asegúrate de que la ruta sea correcta
const adobeRoutes = require('./adobeRoutes'); // Asegúrate de que la ruta sea correcta

const signNowRoutes = require('./signNowRoutes'); // Asegúrate de que la ruta sea correcta
const contactRoutes = require('./contactRoutes'); // Asegúrate de que la ruta sea correcta
const galleryRoutes = require('./galleryRoutes'); // 🆕 Rutas para galería de Cloudinary
const importRoutes = require('./importRoutes'); // Rutas para importar trabajos legacy
const budgetPublicRoutes = require('./BudgetPublicRoutes');
const clientPortalRoutes = require('./ClientPortalRoutes'); // 🆕 Portal del cliente
const ppiPublicRoutes = require('./ppiPublicRoutes'); // 🆕 Rutas públicas para firma de PPI
const stripeWebhookRoutes = require('./stripeWebhookRoutes'); // 🆕 Webhooks de Stripe
const docusignRoutes = require('./docusign.routes'); // 🆕 OAuth de DocuSign
const exportRoutes = require('./exportRoutes'); // 🆕 Rutas para exportar datos a Excel
const simpleWorkRoutes = require('./simpleWorkRoutes'); // 🆕 Rutas para trabajos varios
const simpleWorkPublicRoutes = require('./simpleWorkPublicRoutes'); // 🆕 Rutas públicas para aprobación de SimpleWork
const claimRoutes = require('./claimRoutes'); // 🆕 Rutas para reclamos
const salesRoutes = require('./salesRoutes'); // 🆕 Rutas para dashboard de ventas
const reminderRoutes = require('./reminderRoutes'); // 🆕 Rutas para recordatorios
const salesLeadRoutes = require('./SalesLeadRoutes'); // 🆕 Rutas para prospectos de venta
const leadNoteRoutes = require('./LeadNoteRoutes'); // 🆕 Rutas para notas de leads
const companyEmailRoutes = require('./companyEmailRoutes'); // 🆕 Rutas para emails masivos de marketing
const knowledgeBaseRoutes = require('./knowledgeBaseRoutes'); // 🆕 Rutas para base de conocimiento
const newsletterRoutes = require('./newsletterRoutes'); // 🆕 Rutas para sistema de newsletter
const signatureDocumentRoutes = require('./signatureDocumentRoutes'); // 🆕 Rutas para documentos de firma genéricos
const fleetRoutes = require('./fleetRoutes'); // 🆕 Rutas para flota y maquinaria
// Health check endpoint (público, sin autenticación)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes); // Registro y login no requieren token
router.use('/change-orders',changeOrdersRoutes); // Ruta para change orders (incluye rutas públicas)

//router.use('/webhooks-adobe-sign', adobeWebhookRoutes); 
router.use('/stripe', stripeWebhookRoutes); // 🆕 Webhooks de Stripe (público, sin auth)
router.use('/signnow', signNowRoutes);
router.use('/contact', contactRoutes); // Ruta pública para formulario de contacto
router.use('/gallery', galleryRoutes); // 🆕 Galería de trabajos (público)
router.use('/docusign', docusignRoutes); // 🆕 OAuth de DocuSign (público, sin auth)

// 🆕 RUTAS PÚBLICAS DE BUDGETS (antes del verifyToken)
// Estas rutas permiten a los clientes revisar presupuestos sin autenticación
router.use('/budgets', budgetPublicRoutes); // Rutas públicas de presupuestos
router.use('/client-portal', clientPortalRoutes); // 🆕 Portal del cliente (público)
router.use('/ppi', ppiPublicRoutes); // 🆕 Rutas públicas de firma de PPI
router.use('/simple-works', simpleWorkPublicRoutes); // 🆕 Aprobación pública de SimpleWork
router.use('/newsletter', newsletterRoutes); // 🆕 Sistema de newsletter (incluye rutas públicas: subscribe, public-unsubscribe)

// Rutas protegidas (requieren token)
const { verifyToken } = require('../middleware/isAuth');
router.use(verifyToken); // Middleware global para rutas protegidas
router.use('/admin', adminRoutes);
router.use('/budget', budgetRoutes);
router.use('/budget-notes', budgetNoteRoutes); // 🆕 Rutas para notas de seguimiento
router.use('/work-notes', workNoteRoutes); // 🆕 Rutas para notas de seguimiento de obras
router.use('/budget-item', budgetItemRoutes); // Rutas para BudgetItems
router.use('/pdf', pdfRoutes);
router.use('/inspection', inspectionRoutes);
router.use('/material', materialRoutes);
router.use('/work', workRoutes);
router.use('/permit', permitRoutes);
router.use('/notification', notificationRoutes); // Rutas de notificaciones
router.use('/archive', archiveRoutes); // Ruta para obtener presupuestos archivados
router.use('/receipt', receiptRoutes); // Ruta para comprobantes
router.use('/balance', balanceRoutes)
router.use('/income', incomeRoutes); // Ruta para ingresos
router.use('/expense', expenseRoutes); // Ruta para gastos
router.use('/fixed-expenses', fixedExpenseRoutes); // 🆕 Ruta para gastos fijos (plural para consistencia)
router.use('/fixed-expense-payments', fixedExpensePaymentRoutes); // 🆕 Ruta para pagos parciales
router.use('/supplier-invoices', supplierInvoiceRoutes); // 🆕 Ruta para invoices de proveedores
router.use('/system', systemRoutes); // Ruta para comprobantes
router.use('/final-invoice', finalInvoiceRoutes); // Ruta para comprobantes
router.use('/maintenance', maintenanceRoutes); // Ruta para visitas de mantenimiento
router.use('/legacy-maintenance', legacyMaintenanceRoutes); // 🆕 Edición de trabajos de mantenimiento legacy
router.use('/accounts-receivable', accountsReceivableRoutes); // 🆕 Ruta para cuentas por cobrar
router.use('/financial-dashboard', financialDashboardRoutes); // 🆕 Ruta para dashboard financiero consolidado
router.use('/bank-accounts', bankAccountRoutes); // 🆕 Ruta para gestión de cuentas bancarias
router.use('/bank-transactions', bankTransactionRoutes); // 🆕 Ruta para transacciones bancarias
router.use('/monthly-expenses', monthlyExpensesRoutes); // 🆕 Ruta para gastos devengados mensuales
router.use('/works', workChecklistRoutes); // 🆕 Ruta para checklist de verificación (usa /works/:workId/checklist)
router.use('/import', importRoutes); // Ruta para importar trabajos legacy
router.use('/export', exportRoutes); // 🆕 Ruta para exportar datos a Excel
router.use('/monthly-installations', monthlyInstallationsRoutes); // 🆕 Ruta para instalaciones mensuales
router.use('/staff-attendance', staffAttendanceRoutes); // 🆕 Ruta para asistencia del personal
router.use('/simple-works', simpleWorkRoutes); // 🆕 Ruta para trabajos varios (culvert, drainfield, etc.)
router.use('/claims', claimRoutes); // 🆕 Ruta para reclamos/garantías
router.use('/sales', salesRoutes); // 🆕 Ruta para dashboard de ventas
router.use('/reminders', reminderRoutes); // 🆕 Ruta para recordatorios
router.use('/sales-leads', salesLeadRoutes); // 🆕 Ruta para prospectos de venta
router.use('/lead-notes', leadNoteRoutes); // 🆕 Ruta para notas de leads
router.use('/company-emails', companyEmailRoutes); // 🆕 Ruta para emails masivos de marketing
router.use('/knowledge-base', knowledgeBaseRoutes); // 🆕 Ruta para base de conocimiento
router.use('/fleet', fleetRoutes); // 🆕 Ruta para flota y maquinaria
router.use('/signature-documents', signatureDocumentRoutes); // 🆕 Ruta para documentos de firma genéricos (SignNow/DocuSign)

module.exports = router;