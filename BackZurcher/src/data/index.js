require('dotenv').config();
const { Sequelize } = require('sequelize');

const fs = require('fs');
const path = require('path');
const {
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_DEPLOY,
  NODE_ENV
  } = require('../config/envs');

//-------------------------------- CONFIGURACION UNIFICADA (LOCAL Y DEPLOY) -----------------------------------
// Usar DB_DEPLOY si existe (Railway/Producción), sino usar configuración local
const sequelize = (DB_DEPLOY && DB_DEPLOY.startsWith('postgresql://'))
  ? new Sequelize(DB_DEPLOY, {
      logging: false,
      native: false,
      timezone: 'America/New_York',
      pool: {
        max: 20,            // ✅ Reducido a 20 (Railway free tier limit ~20-25)
        min: 5,             // ✅ Reducido a 5 conexiones warm
        acquire: 60000,     // ✅ 60 segundos para adquirir conexión
        idle: 60000,        // ✅ Aumentado a 60 segundos antes de cerrar idle
        evict: 30000,       // ✅ Verificar cada 30 segundos
        maxUses: 5000       // ✅ Reciclar después de 5000 usos
      },
      retry: {
        max: 5,             // 🆕 Reintentar 5 veces en caso de error (Railway puede tardar)
        timeout: 60000      // ✅ 60 segundos (igual que acquire) para evitar TimeoutError en operaciones lentas
      },
      isolationLevel: 'READ COMMITTED',
      dialectOptions: {
        ssl: NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false,
        connectTimeout: 30000,     // ⏰ 30 segundos para conectar (Railway cold start)
        statement_timeout: 60000,  // ⏰ 60 segundos para queries pesadas
        keepAlive: true,           // 🆕 Mantener conexiones vivas
        keepAliveInitialDelayMillis: 10000  // 🆕 Enviar keepalive cada 10s
      }
    })
  : new Sequelize(
      `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
      {
        logging: false,
        native: false,
        pool: {
          max: 50,
          min: 10,
          acquire: 60000,
          idle: 20000,
          evict: 10000,
          maxUses: 5000
        },
        dialectOptions: {
          statement_timeout: 30000,
        }
      }
    );

// 🔍 LOG para debug de conexión
if (DB_DEPLOY) {
  const urlParts = DB_DEPLOY.split('@');
  const hostInfo = urlParts[1] ? urlParts[1].split('/')[0] : 'unknown';
  console.log(`📊 Base de datos: RAILWAY (Producción)`);
  console.log(`🔗 Conectando a: ${hostInfo}`);
  console.log(`🚀 Pool: max=${sequelize.options.pool.max}, min=${sequelize.options.pool.min}`);
} else {
  console.log(`📊 Base de datos: LOCAL (Desarrollo)`);
}

const basename = path.basename(__filename);

const modelDefiners = [];

// Leemos todos los archivos de la carpeta Models, los requerimos y agregamos al arreglo modelDefiners
fs.readdirSync(path.join(__dirname, '/models'))
  .filter(
    (file) =>
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
  )
  .forEach((file) => {
    modelDefiners.push(require(path.join(__dirname, '/models', file)));
  });

// Injectamos la conexion (sequelize) a todos los modelos
modelDefiners.forEach((model) => model(sequelize));
// Capitalizamos los nombres de los modelos ie: product => Product
let entries = Object.entries(sequelize.models);
let capsEntries = entries.map((entry) => [
  entry[0][0].toUpperCase() + entry[0].slice(1),
  entry[1],
]);
sequelize.models = Object.fromEntries(capsEntries);

// En sequelize.models están todos los modelos importados como propiedades
// Para relacionarlos hacemos un destructuring
const { Staff, Permit, Income, ChangeOrder, Expense, Budget, Work, Material, Inspection, Notification, InstallationDetail, MaterialSet, Image, Receipt, NotificationApp, BudgetItem, BudgetLineItem, FinalInvoice, WorkExtraItem, MaintenanceVisit, MaintenanceMedia, ContactFile, ContactRequest, FixedExpense, FixedExpensePayment, SupplierInvoice, SupplierInvoiceExpense, SupplierInvoiceWork, SupplierInvoiceSimpleWork, SupplierInvoiceItem, BudgetNote, WorkNote, WorkStateHistory, BankAccount, BankTransaction, WorkChecklist, StaffAttendance, SimpleWork, SimpleWorkPayment, SimpleWorkExpense, SimpleWorkItem, Claim, Reminder, ReminderAssignment, ReminderComment, SalesLead, LeadNote, MarketingCampaign, KnowledgeCategory, KnowledgeContact, KnowledgeProcedure, KnowledgeDocument, NewsletterSubscriber, NewsletterTemplate, Newsletter, NewsletterRecipient, SignatureDocument } = sequelize.models;

ContactRequest.hasMany(ContactFile, { foreignKey: 'contactRequestId', as: 'files' });
ContactFile.belongsTo(ContactRequest, { foreignKey: 'contactRequestId' });

// Relaciones - Usando idPermit como FK principal (más eficiente)
Permit.hasMany(Work, { foreignKey: 'idPermit', sourceKey: 'idPermit' });
Work.belongsTo(Permit, { foreignKey: 'idPermit', targetKey: 'idPermit' });

// Permit.hasMany(Budget, { foreignKey: 'propertyAddress', sourceKey: 'propertyAddress' });
// Budget.belongsTo(Permit, { foreignKey: 'propertyAddress', targetKey: 'propertyAddress' });

Work.hasMany(Material, { foreignKey: 'workId' });
Material.belongsTo(Work, { foreignKey: 'workId' });

Staff.hasMany(Material, { foreignKey: 'staffId' });
Material.belongsTo(Staff, { foreignKey: 'staffId' });

Work.hasMany(Inspection, { foreignKey: 'workId', as: 'inspections' }); // 'inspections' como alias
Inspection.belongsTo(Work, { foreignKey: 'workId' });

Staff.hasMany(Work, { foreignKey: 'staffId' });
Work.belongsTo(Staff, { foreignKey: 'staffId' });

// Relaciones entre Staff y Income/Expense
Staff.hasMany(Income, { foreignKey: 'staffId', as: 'incomes' });
Income.belongsTo(Staff, { foreignKey: 'staffId', as: 'Staff' });

Staff.hasMany(Expense, { foreignKey: 'staffId', as: 'expenses' });
Expense.belongsTo(Staff, { foreignKey: 'staffId', as: 'Staff' });

// Work.belongsTo(Budget, { foreignKey: 'idBudget', as: 'budget' });
// Budget.hasMany(Work, { foreignKey: 'idBudget' });
// Relación entre Staff y Notification
Notification.belongsTo(Staff, { as: "sender", foreignKey: "senderId" });
Staff.hasMany(Notification, { as: "sentNotifications", foreignKey: "senderId" });

Notification.hasMany(Notification, { as: "responses", foreignKey: "parentId" });
Notification.belongsTo(Notification, { as: "parent", foreignKey: "parentId" });

Work.hasMany(InstallationDetail, { foreignKey: 'idWork', as: 'installationDetails' });
InstallationDetail.belongsTo(Work, { foreignKey: 'idWork', as: 'work' });

Work.hasMany(Image, { foreignKey: 'idWork', as: 'images' });
Image.belongsTo(Work, { foreignKey: 'idWork', as: 'work' });

MaterialSet.hasMany(Material, { foreignKey: 'materialSetId' });
Material.belongsTo(MaterialSet, { foreignKey: 'materialSetId' });
// Relación entre Work y MaterialSet
Work.hasMany(MaterialSet, { foreignKey: 'workId', as: 'MaterialSets' });
MaterialSet.belongsTo(Work, { foreignKey: 'workId', as: 'Work' });

// Relación lógica con Inspection
Inspection.hasMany(Receipt, { foreignKey: 'relatedId', constraints: false, scope: { relatedModel: 'Inspection' } });
Receipt.belongsTo(Inspection, { foreignKey: 'relatedId', constraints: false });

// Relación lógica con MaterialSet
MaterialSet.hasMany(Receipt, { foreignKey: 'relatedId', constraints: false, scope: { relatedModel: 'MaterialSet' } });
Receipt.belongsTo(MaterialSet, { foreignKey: 'relatedId', constraints: false });

// Relación entre Work y Receipt
Work.hasMany(Receipt, { foreignKey: 'relatedId', constraints: false, scope: { relatedModel: 'Work' } });
Receipt.belongsTo(Work, { foreignKey: 'relatedId', constraints: false });

//Relaciones Work, Income, Expense
Work.hasMany(Income, {
  foreignKey: 'workId', // CAMBIO: 'idWork' -> 'workId'
  as: 'incomes',
});
Income.belongsTo(Work, {
  foreignKey: 'workId', // CAMBIO: 'idWork' -> 'workId'
  as: 'work',
});

Work.hasMany(Expense, {
  foreignKey: 'workId', // CAMBIO: 'idWork' -> 'workId'
  as: 'expenses',
});
Expense.belongsTo(Work, {
  foreignKey: 'workId', // CAMBIO: 'idWork' -> 'workId'
  as: 'work',
});
// Relación entre Staff y NotificationApp
NotificationApp.belongsTo(Staff, { as: 'sender', foreignKey: 'senderId' });
Staff.hasMany(NotificationApp, { as: 'notifications', foreignKey: 'staffId' }); // <-- FK diferente
NotificationApp.hasMany(NotificationApp, { as: 'responses', foreignKey: 'parentId' });
NotificationApp.belongsTo(NotificationApp, { as: 'parent', foreignKey: 'parentId' });


// --- NUEVAS RELACIONES PARA BUDGET ITEMS ---

// Un Budget tiene muchas BudgetLineItems
Budget.hasMany(BudgetLineItem, {
  foreignKey: 'budgetId', // La clave foránea en BudgetLineItem que apunta a Budget
  as: 'lineItems'         // Alias para usar al incluir BudgetLineItems en consultas de Budget
});

// Una BudgetLineItem pertenece a un Budget
BudgetLineItem.belongsTo(Budget, {
  foreignKey: 'budgetId'
});

// Un BudgetItem (del catálogo) puede estar en muchas BudgetLineItems (en diferentes presupuestos)
BudgetItem.hasMany(BudgetLineItem, {
  foreignKey: 'budgetItemId' // La clave foránea en BudgetLineItem que apunta a BudgetItem
});

// Una BudgetLineItem pertenece a un BudgetItem (referencia al item del catálogo)
BudgetLineItem.belongsTo(BudgetItem, {
  foreignKey: 'budgetItemId',
  as: 'itemDetails'       // Alias para usar al incluir detalles del BudgetItem en consultas de BudgetLineItem
});

// filepath: c:\Users\yaniz\Documents\ZurcherApi\BackZurcher\src\data\index.js
// ...
Permit.hasMany(Budget, { foreignKey: 'PermitIdPermit' });
Budget.belongsTo(Permit, { foreignKey: 'PermitIdPermit' });

// Permit.hasMany(Work, { foreignKey: 'idPermit' });
// Work.belongsTo(Permit, { foreignKey: 'idPermit' });


Budget.hasOne(Work, { foreignKey: 'idBudget' }); // O hasMany si un budget puede tener varios works
Work.belongsTo(Budget, { foreignKey: 'idBudget', as: 'budget' });

// Relación Budget - Staff (para vendedores/sales_rep)
Budget.belongsTo(Staff, {
  foreignKey: 'createdByStaffId',
  as: 'createdByStaff'
});
Staff.hasMany(Budget, {
  foreignKey: 'createdByStaffId',
  as: 'budgetsCreated'
});

// ...
// Relación lógica con Income
Income.hasMany(Receipt, { foreignKey: 'relatedId', constraints: false, scope: { relatedModel: 'Income' }, as: 'Receipts' }); // Añadir alias
Receipt.belongsTo(Income, { foreignKey: 'relatedId', constraints: false });

// Relación lógica con Expense
Expense.hasMany(Receipt, { foreignKey: 'relatedId', constraints: false, scope: { relatedModel: 'Expense' }, as: 'Receipts' }); // Añadir alias
Receipt.belongsTo(Expense, { foreignKey: 'relatedId', constraints: false });

// Un Work tiene una FinalInvoice
Work.hasOne(FinalInvoice, {
  foreignKey: 'workId', // La clave foránea en FinalInvoice que apunta a Work
  as: 'finalInvoice'    // Alias para incluir FinalInvoice en consultas de Work
});
// Una FinalInvoice pertenece a un Work
FinalInvoice.belongsTo(Work, {
  foreignKey: 'workId'
});

// Un Budget tiene una FinalInvoice (opcional, pero útil para referencia)
Budget.hasOne(FinalInvoice, {
  foreignKey: 'budgetId', // La clave foránea en FinalInvoice que apunta a Budget
  as: 'finalInvoice'
});
// Una FinalInvoice pertenece a un Budget
FinalInvoice.belongsTo(Budget, {
  foreignKey: 'budgetId'
});

// Una FinalInvoice tiene muchos WorkExtraItems
FinalInvoice.hasMany(WorkExtraItem, {
  foreignKey: 'finalInvoiceId', // La clave foránea en WorkExtraItem que apunta a FinalInvoice
  as: 'extraItems'         // Alias para incluir WorkExtraItems en consultas de FinalInvoice
});
// Un WorkExtraItem pertenece a una FinalInvoice
WorkExtraItem.belongsTo(FinalInvoice, {
  foreignKey: 'finalInvoiceId'
});

// --- RELACIONES PARA CHANGE ORDER ---
Work.hasMany(ChangeOrder, {
  foreignKey: 'workId', // La clave foránea en ChangeOrder que apunta a Work
  as: 'changeOrders'    // Alias para usar al incluir ChangeOrders en consultas de Work
});
ChangeOrder.belongsTo(Work, {
  foreignKey: 'workId',
  as: 'work'             // Alias para usar al incluir Work en consultas de ChangeOrder
});

//mantenimiento
Work.hasMany(MaintenanceVisit, {
  foreignKey: 'workId',
  as: 'maintenanceVisits'
});
MaintenanceVisit.belongsTo(Work, {
  foreignKey: 'workId',
  as: 'work'
});

MaintenanceVisit.hasMany(MaintenanceMedia, {
  foreignKey: 'maintenanceVisitId',
  as: 'mediaFiles'
});
MaintenanceMedia.belongsTo(MaintenanceVisit, {
  foreignKey: 'maintenanceVisitId',
  as: 'maintenanceVisit'
});
// Dentro del método associate si lo usas, o después de definir el modelo
MaintenanceVisit.belongsTo(Staff, { // <--- CAMBIO AQUÍ: Usa 'Staff' directamente
  foreignKey: 'staffId', 
  as: 'assignedStaff' 
});

// MaintenanceVisit también puede tener un completedByStaff
MaintenanceVisit.belongsTo(Staff, {
  foreignKey: 'completed_by_staff_id',
  as: 'completedByStaff'
});

// Un Staff puede tener muchas MaintenanceVisits asignadas
Staff.hasMany(MaintenanceVisit, { // <--- CAMBIO AQUÍ: Usa 'MaintenanceVisit' directamente
  foreignKey: 'staffId', 
  as: 'maintenanceVisitsAssigned' 
});

// --- RELACIONES PARA GASTOS FIJOS (FIXED EXPENSES) ---
Staff.hasMany(FixedExpense, {
  foreignKey: 'createdByStaffId',
  as: 'fixedExpensesCreated'
});
FixedExpense.belongsTo(Staff, {
  foreignKey: 'createdByStaffId',
  as: 'createdBy'
});

// --- RELACIONES PARA SUPPLIER INVOICES (INVOICES DE PROVEEDORES) ---

// 🆕 Asociación con SupplierInvoiceWork para vincular invoices con works
SupplierInvoice.belongsToMany(Work, {
  through: SupplierInvoiceWork,
  foreignKey: 'supplierInvoiceId',
  otherKey: 'workId',
  as: 'linkedWorks'
});
Work.belongsToMany(SupplierInvoice, {
  through: SupplierInvoiceWork,
  foreignKey: 'workId',
  otherKey: 'supplierInvoiceId',
  as: 'linkedInvoices'
});

// Para acceder directamente al modelo intermedio
SupplierInvoiceWork.belongsTo(SupplierInvoice, {
  foreignKey: 'supplierInvoiceId',
  as: 'invoice'
});
SupplierInvoiceWork.belongsTo(Work, {
  foreignKey: 'workId',
  as: 'work'
});
SupplierInvoice.hasMany(SupplierInvoiceWork, {
  foreignKey: 'supplierInvoiceId',
  as: 'workLinks'
});
Work.hasMany(SupplierInvoiceWork, {
  foreignKey: 'workId',
  as: 'invoiceLinks'
});

// 🆕 Asociación con SupplierInvoiceSimpleWork para vincular invoices con SimpleWorks
SupplierInvoice.belongsToMany(SimpleWork, {
  through: SupplierInvoiceSimpleWork,
  foreignKey: 'supplierInvoiceId',
  otherKey: 'simpleWorkId',
  as: 'linkedSimpleWorks'
});
SimpleWork.belongsToMany(SupplierInvoice, {
  through: SupplierInvoiceSimpleWork,
  foreignKey: 'simpleWorkId',
  otherKey: 'supplierInvoiceId',
  as: 'linkedInvoices'
});

// Para acceder directamente al modelo intermedio
SupplierInvoiceSimpleWork.belongsTo(SupplierInvoice, {
  foreignKey: 'supplierInvoiceId',
  as: 'invoice'
});
SupplierInvoiceSimpleWork.belongsTo(SimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'simpleWork'
});
SupplierInvoice.hasMany(SupplierInvoiceSimpleWork, {
  foreignKey: 'supplierInvoiceId',
  as: 'simpleWorkLinks'
});
SimpleWork.hasMany(SupplierInvoiceSimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'invoiceLinks'
});

// 🆕 FixedExpense tiene muchos pagos parciales
FixedExpense.hasMany(FixedExpensePayment, {
  foreignKey: 'fixedExpenseId',
  as: 'payments'
});
FixedExpensePayment.belongsTo(FixedExpense, {
  foreignKey: 'fixedExpenseId',
  as: 'fixedExpense'
});

// 🆕 Cada pago parcial puede generar un Expense
Expense.hasOne(FixedExpensePayment, {
  foreignKey: 'expenseId',
  as: 'relatedPayment'
});
FixedExpensePayment.belongsTo(Expense, {
  foreignKey: 'expenseId',
  as: 'generatedExpense'
});

// 🆕 NUEVA ASOCIACIÓN: Expense puede estar relacionado directamente con FixedExpense
Expense.belongsTo(FixedExpense, {
  foreignKey: 'relatedFixedExpenseId',
  as: 'fixedExpense',
  constraints: false
});

// 🆕 Un Staff puede registrar pagos parciales
Staff.hasMany(FixedExpensePayment, {
  foreignKey: 'createdByStaffId',
  as: 'fixedExpensePaymentsCreated'
});
FixedExpensePayment.belongsTo(Staff, {
  foreignKey: 'createdByStaffId',
  as: 'createdBy'
});


// Un SupplierInvoice fue creado por un Staff
Staff.hasMany(SupplierInvoice, {
  foreignKey: 'createdByStaffId',
  as: 'supplierInvoicesCreated'
});
SupplierInvoice.belongsTo(Staff, {
  foreignKey: 'createdByStaffId',
  as: 'createdBy'
});

// 🆕 Relación entre SupplierInvoice y SupplierInvoiceItem
SupplierInvoice.hasMany(SupplierInvoiceItem, {
  foreignKey: 'supplierInvoiceId',
  as: 'items'
});
SupplierInvoiceItem.belongsTo(SupplierInvoice, {
  foreignKey: 'supplierInvoiceId',
  as: 'invoice'
});

// Relación polimórfica con Receipt (para adjuntar comprobantes PDF del invoice)
SupplierInvoice.hasMany(Receipt, { 
  foreignKey: 'relatedId', 
  constraints: false, 
  scope: { relatedModel: 'SupplierInvoice' },
  as: 'Receipts'
});
Receipt.belongsTo(SupplierInvoice, { 
  foreignKey: 'relatedId', 
  constraints: false 
});

// 🆕 --- RELACIONES PARA VINCULAR SUPPLIER INVOICES CON EXPENSES EXISTENTES ---

// Relación muchos a muchos: Un SupplierInvoice puede pagar múltiples Expenses
// y un Expense puede estar vinculado a múltiples SupplierInvoices (pago parcial)
SupplierInvoice.belongsToMany(Expense, {
  through: SupplierInvoiceExpense,
  foreignKey: 'supplierInvoiceId',
  otherKey: 'expenseId',
  as: 'linkedExpenses'
});
Expense.belongsToMany(SupplierInvoice, {
  through: SupplierInvoiceExpense,
  foreignKey: 'expenseId',
  otherKey: 'supplierInvoiceId',
  as: 'supplierInvoices'
});

// Relaciones directas con la tabla intermedia
SupplierInvoiceExpense.belongsTo(SupplierInvoice, {
  foreignKey: 'supplierInvoiceId',
  as: 'invoice'
});
SupplierInvoiceExpense.belongsTo(Expense, {
  foreignKey: 'expenseId',
  as: 'expense'
});
SupplierInvoiceExpense.belongsTo(Staff, {
  foreignKey: 'linkedByStaffId',
  as: 'linkedBy'
});

// --- RELACIONES PARA BUDGET NOTES (SEGUIMIENTO DE PRESUPUESTOS) ---

// Un Budget tiene muchas BudgetNotes (notas de seguimiento)
Budget.hasMany(BudgetNote, {
  foreignKey: 'budgetId',
  as: 'notes'
});
BudgetNote.belongsTo(Budget, {
  foreignKey: 'budgetId',
  as: 'budget'
});

// Un Staff puede crear muchas BudgetNotes
Staff.hasMany(BudgetNote, {
  foreignKey: 'staffId',
  as: 'budgetNotes'
});
BudgetNote.belongsTo(Staff, {
  foreignKey: 'staffId',
  as: 'author'
});

// --- RELACIONES PARA SALES LEADS (PROSPECTOS DE VENTA) ---

// Un SalesLead tiene muchas LeadNotes (notas de seguimiento)
SalesLead.hasMany(LeadNote, {
  foreignKey: 'leadId',
  as: 'leadNotes'
});
LeadNote.belongsTo(SalesLead, {
  foreignKey: 'leadId',
  as: 'lead'
});

// Un Staff puede crear muchos SalesLeads
Staff.hasMany(SalesLead, {
  foreignKey: 'createdBy',
  as: 'createdLeads'
});
SalesLead.belongsTo(Staff, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// Un Staff puede crear muchas LeadNotes
Staff.hasMany(LeadNote, {
  foreignKey: 'staffId',
  as: 'leadNotes'
});
LeadNote.belongsTo(Staff, {
  foreignKey: 'staffId',
  as: 'author'
});

// Un SalesLead puede convertirse en un Budget
SalesLead.belongsTo(Budget, {
  foreignKey: 'convertedToBudgetId',
  as: 'convertedBudget'
});
Budget.hasOne(SalesLead, {
  foreignKey: 'convertedToBudgetId',
  as: 'originLead'
});

// --- RELACIONES PARA WORK NOTES (SEGUIMIENTO DE OBRAS) ---

// Un Work tiene muchas WorkNotes (notas de seguimiento)
Work.hasMany(WorkNote, {
  foreignKey: 'workId',
  as: 'workNotes' // Cambiado de 'notes' a 'workNotes' para evitar conflicto con el campo notes del modelo
});
WorkNote.belongsTo(Work, {
  foreignKey: 'workId',
  as: 'work'
});

// Un Staff puede crear muchas WorkNotes
Staff.hasMany(WorkNote, {
  foreignKey: 'staffId',
  as: 'workNotes'
});
WorkNote.belongsTo(Staff, {
  foreignKey: 'staffId',
  as: 'author'
});

// --- RELACIONES PARA WORK STATE HISTORY (HISTORIAL DE CAMBIOS DE ESTADO) ---

// Un Work tiene muchos registros de WorkStateHistory
Work.hasMany(WorkStateHistory, {
  foreignKey: 'workId',
  as: 'stateHistory'
});
WorkStateHistory.belongsTo(Work, {
  foreignKey: 'workId',
  as: 'work'
});

// Un Staff puede haber realizado muchos cambios de estado
Staff.hasMany(WorkStateHistory, {
  foreignKey: 'changedBy',
  as: 'stateChanges'
});
WorkStateHistory.belongsTo(Staff, {
  foreignKey: 'changedBy',
  as: 'changedByStaff'
});

// --- RELACIONES PARA WORK CHECKLIST (VERIFICACIÓN MANUAL) ---

// Un Work tiene un WorkChecklist (relación 1:1)
Work.hasOne(WorkChecklist, {
  foreignKey: 'workId',
  as: 'checklist'
});
WorkChecklist.belongsTo(Work, {
  foreignKey: 'workId',
  as: 'work'
});

// Un Staff puede haber revisado muchos checklists
Staff.hasMany(WorkChecklist, {
  foreignKey: 'reviewedBy',
  as: 'checklistsReviewed'
});
WorkChecklist.belongsTo(Staff, {
  foreignKey: 'reviewedBy',
  as: 'reviewer'
});

// --- RELACIONES PARA BANK ACCOUNTS Y TRANSACCIONES ---

// Un BankAccount tiene muchas BankTransactions
BankAccount.hasMany(BankTransaction, {
  foreignKey: 'bankAccountId',
  as: 'transactions'
});
BankTransaction.belongsTo(BankAccount, {
  foreignKey: 'bankAccountId',
  as: 'account'
});

// Relaciones de BankTransaction con Income, Expense, SupplierInvoice
BankTransaction.belongsTo(Income, {
  foreignKey: 'relatedIncomeId',
  as: 'relatedIncome'
});
Income.hasMany(BankTransaction, {
  foreignKey: 'relatedIncomeId',
  as: 'bankTransactions'
});

BankTransaction.belongsTo(Expense, {
  foreignKey: 'relatedExpenseId',
  as: 'relatedExpense'
});
Expense.hasMany(BankTransaction, {
  foreignKey: 'relatedExpenseId',
  as: 'bankTransactions'
});

BankTransaction.belongsTo(SupplierInvoice, {
  foreignKey: 'relatedCreditCardPaymentId',
  as: 'relatedCreditCardPayment'
});
SupplierInvoice.hasMany(BankTransaction, {
  foreignKey: 'relatedCreditCardPaymentId',
  as: 'bankTransactions'
});

// Relaciones para transferencias entre cuentas
BankTransaction.belongsTo(BankAccount, {
  foreignKey: 'transferToAccountId',
  as: 'transferToAccount'
});
BankAccount.hasMany(BankTransaction, {
  foreignKey: 'transferToAccountId',
  as: 'transfersIn'
});

BankTransaction.belongsTo(BankAccount, {
  foreignKey: 'transferFromAccountId',
  as: 'transferFromAccount'
});
BankAccount.hasMany(BankTransaction, {
  foreignKey: 'transferFromAccountId',
  as: 'transfersOut'
});

// Relación de transacción con transacción relacionada (para transferencias)
BankTransaction.belongsTo(BankTransaction, {
  foreignKey: 'relatedTransferId',
  as: 'relatedTransfer'
});

// Staff que creó la transacción
BankTransaction.belongsTo(Staff, {
  foreignKey: 'createdByStaffId',
  as: 'createdBy'
});
Staff.hasMany(BankTransaction, {
  foreignKey: 'createdByStaffId',
  as: 'bankTransactions'
});

// ========================= STAFF ATTENDANCE ASSOCIATIONS ========================= //
// Staff puede tener muchos registros de asistencia
Staff.hasMany(StaffAttendance, {
  foreignKey: 'staffId',
  as: 'attendanceRecords'
});

// Cada registro de asistencia pertenece a un Staff
StaffAttendance.belongsTo(Staff, {
  foreignKey: 'staffId',
  as: 'Staff'
});

// Staff que creó el registro de asistencia (quien marcó)
Staff.hasMany(StaffAttendance, {
  foreignKey: 'createdBy',
  as: 'markedAttendanceRecords'
});

// Cada registro de asistencia pertenece a un Staff que lo creó
StaffAttendance.belongsTo(Staff, {
  foreignKey: 'createdBy',
  as: 'CreatedByStaff'
});

// ========================= SIMPLE WORK ASSOCIATIONS ========================= //
// 🔗 SimpleWork tiene muchos pagos
SimpleWork.hasMany(SimpleWorkPayment, {
  foreignKey: 'simpleWorkId',
  as: 'payments'
});

// SimpleWorkPayment pertenece a SimpleWork
SimpleWorkPayment.belongsTo(SimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'simpleWork'
});

// 🔗 SimpleWork tiene muchos gastos
SimpleWork.hasMany(SimpleWorkExpense, {
  foreignKey: 'simpleWorkId',
  as: 'expenses'
});

// SimpleWorkExpense pertenece a SimpleWork
SimpleWorkExpense.belongsTo(SimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'simpleWork'
});

// 🔗 SimpleWork tiene muchos Income vinculados (ingresos generales)
SimpleWork.hasMany(Income, {
  foreignKey: 'simpleWorkId',
  as: 'linkedIncomes'
});

// Income opcionalmente vinculado a SimpleWork
Income.belongsTo(SimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'simpleWork'
});

// 🔗 SimpleWork tiene muchos Expense vinculados (gastos generales)
SimpleWork.hasMany(Expense, {
  foreignKey: 'simpleWorkId',
  as: 'linkedExpenses'
});

// Expense opcionalmente vinculado a SimpleWork
Expense.belongsTo(SimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'simpleWork'
});

// 🔗 SimpleWork tiene muchos items
SimpleWork.hasMany(SimpleWorkItem, {
  foreignKey: 'simpleWorkId',
  as: 'items'
});

// SimpleWorkItem pertenece a SimpleWork
SimpleWorkItem.belongsTo(SimpleWork, {
  foreignKey: 'simpleWorkId',
  as: 'simpleWork'
});

// 🔗 SimpleWork pertenece a Staff (asignado)
SimpleWork.belongsTo(Staff, {
  foreignKey: 'assignedStaffId',
  as: 'assignedStaff'
});

// Staff puede tener muchos SimpleWork asignados
Staff.hasMany(SimpleWork, {
  foreignKey: 'assignedStaffId',
  as: 'assignedSimpleWorks'
});

// 🔗 SimpleWork pertenece a Staff (creado por)
SimpleWork.belongsTo(Staff, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// Staff puede crear muchos SimpleWork
Staff.hasMany(SimpleWork, {
  foreignKey: 'createdBy',
  as: 'createdSimpleWorks'
});

// 🔗 SimpleWork opcionalmente vinculado a Work
SimpleWork.belongsTo(Work, {
  foreignKey: 'linkedWorkId',
  as: 'linkedWork'
});

// Work puede tener muchos SimpleWork vinculados
Work.hasMany(SimpleWork, {
  foreignKey: 'linkedWorkId',
  as: 'linkedSimpleWorks'
});

// 🔗 SimpleWorkPayment creado por Staff
SimpleWorkPayment.belongsTo(Staff, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// Staff puede crear muchos pagos de SimpleWork
Staff.hasMany(SimpleWorkPayment, {
  foreignKey: 'createdBy',
  as: 'createdSimpleWorkPayments'
});

// 🔗 SimpleWorkExpense creado por Staff
SimpleWorkExpense.belongsTo(Staff, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// Staff puede crear muchos gastos de SimpleWork
Staff.hasMany(SimpleWorkExpense, {
  foreignKey: 'createdBy',
  as: 'createdSimpleWorkExpenses'
});

// 🆕 Asociaciones de Claim (Reclamos)
Claim.belongsTo(Staff, { foreignKey: 'assignedStaffId', as: 'assignedStaff' });
Claim.belongsTo(Staff, { foreignKey: 'createdBy', as: 'claimCreator' });
Claim.belongsTo(Work, { foreignKey: 'linkedWorkId', as: 'linkedWork', constraints: false });
Claim.belongsTo(SimpleWork, { foreignKey: 'linkedSimpleWorkId', as: 'linkedSimpleWork', constraints: false });
Staff.hasMany(Claim, { foreignKey: 'assignedStaffId', as: 'assignedClaims' });

// ========================= REMINDER ASSOCIATIONS ========================= //
Reminder.belongsTo(Staff, { foreignKey: 'created_by', as: 'creator' });
Staff.hasMany(Reminder, { foreignKey: 'created_by', as: 'createdReminders' });

Reminder.hasMany(ReminderAssignment, { foreignKey: 'reminder_id', as: 'assignments' });
ReminderAssignment.belongsTo(Reminder, { foreignKey: 'reminder_id', as: 'reminder' });
ReminderAssignment.belongsTo(Staff, { foreignKey: 'staff_id', as: 'staff' });
Staff.hasMany(ReminderAssignment, { foreignKey: 'staff_id', as: 'reminderAssignments' });

Reminder.hasMany(ReminderComment, { foreignKey: 'reminder_id', as: 'comments' });
ReminderComment.belongsTo(Reminder, { foreignKey: 'reminder_id', as: 'reminder' });
ReminderComment.belongsTo(Staff, { foreignKey: 'staff_id', as: 'author' });
Staff.hasMany(ReminderComment, { foreignKey: 'staff_id', as: 'reminderComments' });

// ========================= MARKETING CAMPAIGN ASSOCIATIONS ========================= //
MarketingCampaign.belongsTo(Staff, { foreignKey: 'sentByStaffId', as: 'sentBy' });
Staff.hasMany(MarketingCampaign, { foreignKey: 'sentByStaffId', as: 'marketingCampaigns' });

// ========================= KNOWLEDGE BASE ASSOCIATIONS ========================= //
// 📚 Una categoría tiene muchos contactos, procedimientos y documentos
KnowledgeCategory.hasMany(KnowledgeContact, {
  foreignKey: 'categoryId',
  as: 'contacts'
});
KnowledgeContact.belongsTo(KnowledgeCategory, {
  foreignKey: 'categoryId',
  as: 'category'
});

KnowledgeCategory.hasMany(KnowledgeProcedure, {
  foreignKey: 'categoryId',
  as: 'procedures'
});
KnowledgeProcedure.belongsTo(KnowledgeCategory, {
  foreignKey: 'categoryId',
  as: 'category'
});

KnowledgeCategory.hasMany(KnowledgeDocument, {
  foreignKey: 'categoryId',
  as: 'documents'
});
KnowledgeDocument.belongsTo(KnowledgeCategory, {
  foreignKey: 'categoryId',
  as: 'category'
});

// 👤 Relaciones con Staff para auditoría
Staff.hasMany(KnowledgeContact, { foreignKey: 'createdBy', as: 'knowledgeContactsCreated' });
KnowledgeContact.belongsTo(Staff, { foreignKey: 'createdBy', as: 'creator' });
KnowledgeContact.belongsTo(Staff, { foreignKey: 'updatedBy', as: 'updater' });

Staff.hasMany(KnowledgeProcedure, { foreignKey: 'createdBy', as: 'knowledgeProceduresCreated' });
KnowledgeProcedure.belongsTo(Staff, { foreignKey: 'createdBy', as: 'creator' });
KnowledgeProcedure.belongsTo(Staff, { foreignKey: 'updatedBy', as: 'updater' });

Staff.hasMany(KnowledgeDocument, { foreignKey: 'createdBy', as: 'knowledgeDocumentsCreated' });
KnowledgeDocument.belongsTo(Staff, { foreignKey: 'createdBy', as: 'creator' });
KnowledgeDocument.belongsTo(Staff, { foreignKey: 'updatedBy', as: 'updater' });

// ==================== NEWSLETTER ASSOCIATIONS ====================
// Newsletter Template - Staff
Staff.hasMany(NewsletterTemplate, { foreignKey: 'createdByStaffId', as: 'newsletterTemplates' });
NewsletterTemplate.belongsTo(Staff, { foreignKey: 'createdByStaffId', as: 'creator' });

// Newsletter - Staff
Staff.hasMany(Newsletter, { foreignKey: 'createdByStaffId', as: 'newsletters' });
Newsletter.belongsTo(Staff, { foreignKey: 'createdByStaffId', as: 'creator' });

// Newsletter - Template
Newsletter.belongsTo(NewsletterTemplate, { foreignKey: 'templateId', as: 'template' });
NewsletterTemplate.hasMany(Newsletter, { foreignKey: 'templateId', as: 'newsletters' });

// Newsletter - Recipients (many-to-many through NewsletterRecipient)
Newsletter.hasMany(NewsletterRecipient, { foreignKey: 'newsletterId', as: 'recipients' });
NewsletterRecipient.belongsTo(Newsletter, { foreignKey: 'newsletterId', as: 'newsletter' });

NewsletterSubscriber.hasMany(NewsletterRecipient, { foreignKey: 'subscriberId', as: 'newsletters' });
NewsletterRecipient.belongsTo(NewsletterSubscriber, { foreignKey: 'subscriberId', as: 'subscriber' });

// Newsletter - Subscribers (through table)
Newsletter.belongsToMany(NewsletterSubscriber, {
  through: NewsletterRecipient,
  foreignKey: 'newsletterId',
  otherKey: 'subscriberId',
  as: 'subscribers'
});

NewsletterSubscriber.belongsToMany(Newsletter, {
  through: NewsletterRecipient,
  foreignKey: 'subscriberId',
  otherKey: 'newsletterId',
  as: 'newslettersSent'
});

// --- RELACIONES PARA SIGNATURE DOCUMENTS (DOCUMENTOS PARA FIRMA) ---

// Un SignatureDocument puede estar vinculado a un KnowledgeContact
SignatureDocument.belongsTo(KnowledgeContact, {
  foreignKey: 'linkedContactId',
  as: 'linkedContact'
});
KnowledgeContact.hasMany(SignatureDocument, {
  foreignKey: 'linkedContactId',
  as: 'signatureDocuments'
});

// Un SignatureDocument fue creado por un Staff
SignatureDocument.belongsTo(Staff, {
  foreignKey: 'createdBy',
  as: 'creator'
});
Staff.hasMany(SignatureDocument, {
  foreignKey: 'createdBy',
  as: 'signatureDocumentsCreated'
});

//---------------------------------------------------------------------------------//
module.exports = {
  ...sequelize.models, // para poder importar los modelos así: const { Product, User } = require('./db.js');
  conn: sequelize, // para importart la conexión { conn } = require('./db.js');
  sequelize,
 
}; //  // para importart la conexión { conn } = require('./db.js');