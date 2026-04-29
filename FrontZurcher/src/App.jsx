import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { restoreSession } from "./Redux/Actions/authActions";
import PrivateRoute from "./Components/PrivateRoute";
import Header from "./Components/Header";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// Importa tus componentes
import Login from "./Components/Auth/Login";
import Register from "./Components/Auth/Register";
import Dashboard from "./Components/Dashboard/Dashboard";
import NotFound from "./Components/NotFound";
import Unauthorized from "./Components/Auth/Unauthorized";
//import Landing from "./Components/Landing";
import PdfReceipt from "./Components/PdfReceipt";
import BarraLateral from "./Components/Dashboard/BarraLateral";
import BudgetList from "./Components/Budget/BudgetList";
import Works from "./Components/Works/Work";
import ProgressTracker from "./Components/ProgressTracker";
import MaintenanceTracker from "./Components/MaintenanceTracker";
import WorkZoneMap from "./Components/WorkZoneMap"; //  Mapa de obras por zona
import MonthlyInstallations from "./Components/MonthlyInstallations"; // 🆕 Vista de instalaciones mensuales
import StaffAttendance from "./Components/StaffAttendance"; // 🆕 Vista de asistencia del personal
import WorkDetail from "./Components/Works/WorkDetail";
import Materiales from "./Components/Materiales";
import MaterialsCheck from "./Components/Seguimiento/WorkStatusManager";
import SendNotification from "./Components/SendNotification";
import Notifications from "./Components/Notifications";
//import InstallationForm from "./Components/Works/InstalationForm";
import CreateBudget from "./Components/Budget/CreateBudget";
import ForgotPassword from "./Components/Auth/ForgotPassword";
import ResetPassword from "./Components/Auth/ResetPassword";
import ArchveBudget from "./Components/Budget/ArchiveBudget";
import FileDetail from "./Components/Budget/FileDetail";
import PendingWorks from "./Components/Works/PendingWorks";
import AttachInvoice from "./Components/Seguimiento/AttachInvoice";
import VerImagenes from "./Components/Works/VerImagenes";
import BalanceStats from "./Components/BalanceStats";
import LoadingSpinner from "./Components/LoadingSpinner";
import UploadInitialPay from "./Components/Budget/UploadInitialPay";
import PriceBudgetManagement from "./Components/Budget/PriceBudgetManagement";
import ItemsBudgets from "./Components/Budget/ItemsBudgets";
import EditBudget from "./Components/Budget/EditBudget";
import Summary from "./Components/Summary";
import AccountsReceivable from "./Components/AccountsReceivable";
import GestionBudgets from "./Components/Budget/GestionBudgets";
import FollowUpBudgets from "./Components/Budget/FollowUpBudgets"; // 🔔 Presupuestos en Seguimiento
import CreateLegacyBudget from "./Components/Budget/CreateLegacyBudget";
import FixedExpensesManager from "./Components/FixedExpenses/FixedExpensesManager"; // 🆕 Gastos Fijos
import MonthlyExpensesView from "./Components/MonthlyExpensesView"; // 🆕 Gastos Devengados Mensuales
// 🆕 Importar página de revisión de presupuesto (pública)
import BudgetReviewPage from "./Components/Budget/BudgetReviewPage";
// Importar componentes de la Landing
import LandingClients from "./Components/Landing/LandingClients";
import AboutPage from "./Components/Landing/AboutPage";
import ServicesPage from "./Components/Landing/ServicesPage";
import ATUInstallationPage from "./Components/Landing/ATUInstallationPage";
import RegularInstallationPage from "./Components/Landing/RegularInstallationPage";
import InstallationPage from "./Components/Landing/InstallationPage";
import GalleryPage from "./Components/Landing/GalleryPage";
import MaintenancePage from "./Components/Landing/MaintenancePage";
import RepairsPage from "./Components/Landing/RepairsPage";
import ContactPage from "./Components/Landing/ContactPage";
import ThankYou from "./Components/Landing/ThankYou";
import ChangeOrderResponsePage from "./Components/Landing/ChangeOrderResponsePage";
import SimpleWorkApprovalPage from "./Components/Landing/SimpleWorkApprovalPage";
import PrivacyPolicy from "./Components/PrivacyPolicy";
// Importar componentes de Mantenimiento
import MaintenanceList from "./Components/Maintenance/MaintenanceList";
import MaintenanceWorks from "./Components/Maintenance/MaintenanceWorks"; // 🆕 Visitas por zona
import MaintenanceForm from "./pages/MaintenanceForm";
import OwnerMaintenanceView from "./Components/Maintenance/OwnerMaintenanceView";
import LegacyMaintenanceEditor from "./Components/Maintenance/LegacyMaintenanceEditor"; // 🆕 Editor de trabajos legacy
import MaintenanceCalendar from "./Components/Maintenance/MaintenanceCalendar"; // 🆕 Calendario de mantenimiento
import SupplierInvoiceManager from './Components/SupplierInvoices/SupplierInvoiceManager';
// Importar componentes de Bank Accounts
import BankAccountsDashboard from './Components/BankAccounts/BankAccountsDashboard';
import BankAccountDetail from './Components/BankAccounts/BankAccountDetail';
import BankAccountMonthlyReport from './Components/BankAccounts/BankAccountMonthlyReport';
import NewTransactionModal from './Components/BankAccounts/NewTransactionModal';
// Importar componentes de Workers
import WorkerDashboard from "./Components/Workers/WorkerDashboard";
import WorkerWorkUpload from "./Components/Workers/WorkerWorkUpload";
import WorkerMaintenanceDashboard from "./Components/Workers/WorkerMaintenanceDashboard";
import WorkerMaintenanceDetail from "./Components/Workers/WorkerMaintenanceDetail";
import WorkerGeneralExpense from "./Components/Workers/WorkerGeneralExpense";
import SimpleWorkList from "./Components/SimpleWork/SimpleWorkList";
import SimpleWorkDetail from "./Components/SimpleWork/SimpleWorkDetail";
import ClaimList from "./Components/Claims/ClaimList";
import GalleryManager from "./Components/Admin/GalleryManager";
import ClientPortalDashboard from "./Components/ClientPortal/ClientPortalDashboard";
import ClientPortalAdmin from "./Components/ClientPortal/ClientPortalAdmin";
import SalesDashboard from './Components/Sales/SalesDashboard'; // 🆕 Dashboard de ventas
import MarketingCampaigns from './Components/Sales/MarketingCampaigns'; // 🆕 Email marketing campaigns
import NewsletterDashboard from './Components/Newsletter/NewsletterDashboard'; // 🆕 Newsletter system
import SignatureDocumentsDashboard from './Components/SignatureDocuments/SignatureDocumentsDashboard'; // 🆕 Signature documents system
import ReminderPanel from './Components/Reminders/ReminderPanel'; // 🆕 Recordatorios
import ReminderPopup from './Components/Reminders/ReminderPopup'; // 🆕 Popup de recordatorios
import SalesLeads from './Components/SalesLeads/SalesLeads'; // 🆕 Sales Leads Management
import NewLeadForm from './Components/SalesLeads/NewLeadForm'; // 🆕 New lead form
import KnowledgeBase from './Components/KnowledgeBase/KnowledgeBase'; // 🆕 Base de Conocimiento
import FleetDashboard from './Components/Fleet/FleetDashboard'; // 🆕 Flota y Maquinaria
import FleetAssetDetail from './Components/Fleet/FleetAssetDetail'; // 🆕 Detalle de activo de flota

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAuthenticated } = useSelector((state) => state.auth);
  const [isSessionRestored, setIsSessionRestored] = useState(false);

  useEffect(() => {
    dispatch(restoreSession()).finally(() => setIsSessionRestored(true));
  }, [dispatch]);

  useEffect(() => {
    // Lista de rutas públicas que no requieren redirección automática
    const publicRoutes = [
      "/", "/about", "/services", "/services/atu-installation", "/services/regular-installation",
      "/installation", "/gallery", "/maintenance-services", "/repairs", "/contact",
      "/thank-you", "/change-order-response", "/privacy-policy", "/login", "/forgot-password", "/maintenance-form"
    ];
    const isPublicRoute = publicRoutes.some(route =>
      location.pathname === route || 
      location.pathname.startsWith("/reset-password") ||
      location.pathname.startsWith("/client-portal/") ||
      location.pathname.startsWith("/simple-work-approve/")
    );

    // No redirigir automáticamente desde la landing principal
    // Los usuarios usarán el login modal para acceder al dashboard
  }, [isAuthenticated, location.pathname, navigate]);

  if (!isSessionRestored) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-lg">Cargando...</div>
    </div>;
  }

  // Determinar si estamos en una ruta pública de la landing
  const publicLandingRoutes = [
    "/", "/about", "/services", "/services/atu-installation", "/services/regular-installation",
    "/installation", "/gallery", "/maintenance-services", "/repairs", "/contact",
    "/thank-you", "/change-order-response", "/privacy-policy", "/maintenance-form"
  ];
  const isSimpleWorkApproveRoute = location.pathname.startsWith("/simple-work-approve/");
  const isBudgetReviewRoute = location.pathname.startsWith("/budget-review/");
  const isClientPortalRoute = location.pathname.startsWith("/client-portal/");
  const isPublicLandingRoute = publicLandingRoutes.includes(location.pathname) || isBudgetReviewRoute || isClientPortalRoute || isSimpleWorkApproveRoute;

  // Determinar si mostrar header y sidebar
  const shouldShowLayout = isAuthenticated && !isPublicLandingRoute;

  return (
    <>
      {shouldShowLayout && <Header />}
      {isAuthenticated && <ReminderPopup />}
      <LoadingSpinner />
      <div className={`flex ${shouldShowLayout ? "pt-16 md:pt-20" : ""} min-h-screen bg-gray-50`}>
        {shouldShowLayout && <BarraLateral />}
        <div className="flex-1 w-full overflow-x-hidden">
          <div className={`w-full max-w-none ${shouldShowLayout ? "px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6" : ""}`}>
            <Routes>
              {/* Rutas públicas */}
              <Route path="/" element={<LandingClients />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/atu-installation" element={<ATUInstallationPage />} />
              <Route path="/services/regular-installation" element={<RegularInstallationPage />} />
              <Route path="/installation" element={<InstallationPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/maintenance-services" element={<MaintenancePage />} />
              <Route path="/repairs" element={<RepairsPage />} />
              <Route path="/contact" element={<ContactPage />} />

              <Route path="/thank-you" element={<ThankYou />} />
              <Route path="/change-order-response" element={<ChangeOrderResponsePage />} />
              <Route path="/simple-work-approve/:token" element={<SimpleWorkApprovalPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />

              {/* 🆕 Ruta pública para revisión de presupuestos */}
              <Route path="/budget-review/:budgetId/:reviewToken" element={<BudgetReviewPage />} />

              {/* 🆕 Ruta pública para formulario de mantenimiento (protegida por token en query params) */}
              <Route path="/maintenance-form" element={<MaintenanceForm />} />
              
              {/* 🆕 Ruta pública para portal de clientes (protegida por token) */}
              <Route path="/client-portal/:token" element={<ClientPortalDashboard />} />

              {/* Rutas privadas */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "finance", "finance-viewer"]}>
                    <Dashboard />
                  </PrivateRoute>
                }
              />

              {/* Rutas privadas */}
              <Route
                path="/gestionBudgets"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "follow-up", "finance"]}>
                    <GestionBudgets />
                  </PrivateRoute>
                }
              />

              <Route
                path="/progress-tracker"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "finance"]}>
                    <ProgressTracker />
                  </PrivateRoute>
                }
              />

              <Route
                path="/maintenance-tracker"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "finance"]}>
                    <MaintenanceTracker />
                  </PrivateRoute>
                }
              />

              <Route
                path="/maintenance/zones"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "finance"]}>
                    <MaintenanceWorks />
                  </PrivateRoute>
                }
              />

              <Route
                path="/work-zone-map"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "finance", "worker"]}>
                    <WorkZoneMap />
                  </PrivateRoute>
                }
              />

              <Route
                path="/monthly-installations"
                element={
                  <PrivateRoute allowedRoles={["admin", "recept", "owner", "finance", "worker"]}>
                    <MonthlyInstallations />
                  </PrivateRoute>
                }
              />

              <Route
                path="/staff-attendance"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "finance"]}>
                    <StaffAttendance />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Dashboard de ventas para sales_rep */}
              <Route
                path="/sales-dashboard"
                element={
                  <PrivateRoute allowedRoles={["sales_rep", "recept", "admin", "owner"]}>
                    <SalesDashboard />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Sales Leads Management */}
              <Route
                path="/sales-leads"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "recept", "sales_rep", "follow-up"]}>
                    <SalesLeads />
                  </PrivateRoute>
                }
              />
              <Route
                path="/sales-leads/new"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "recept", "sales_rep", "follow-up"]}>
                    <NewLeadForm />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Marketing Campaigns - Email masivo */}
              <Route
                path="/marketing-campaigns"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner"]}>
                    <MarketingCampaigns />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Newsletter System */}
              <Route
                path="/marketing-campaigns/newsletter"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner"]}>
                    <NewsletterDashboard />
                  </PrivateRoute>
                }
              />

              {/* Base de Conocimiento */}
              <Route
                path="/knowledge-base"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "recept"]}>
                    <KnowledgeBase />
                  </PrivateRoute>
                }
              />

              <Route
                path="/works"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "recept", "finance"]}>
                    <Works />
                  </PrivateRoute>
                }
              />
              <Route
                path="/simple-works"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "recept"]}>
                    <SimpleWorkList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/simple-works/:id"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "recept"]}>
                    <SimpleWorkDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/claims"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "recept", "finance"]}>
                    <ClaimList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/work/:idWork"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance", "recept"]}>
                    <WorkDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/workCalendar"
                element={
                  <PrivateRoute allowedRoles={["owner", "recept", "admin"]}>
                    <PendingWorks />
                  </PrivateRoute>
                }
              />
              {/* <Route
              path="/installation"
              element={
                <PrivateRoute
                  allowedRoles={["owner", "admin", "user", "worker"]}
                >
                  <InstallationForm />
                </PrivateRoute>
              }
            /> */}
              <Route
                path="/materiales"
                element={
                  <PrivateRoute allowedRoles={["owner", "recept"]}>
                    <Materiales />
                  </PrivateRoute>
                }
              />
              <Route
                path="/itemBudget"
                element={
                  <PrivateRoute allowedRoles={["owner", "recept", "admin"]}>
                    <ItemsBudgets />
                  </PrivateRoute>
                }
              />
              <Route
                path="/check"
                element={
                  <PrivateRoute allowedRoles={["owner"]}>
                    <MaterialsCheck />
                  </PrivateRoute>
                }
              />
              <Route
                path="/budgets"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance", "recept"]}>
                    <BudgetList />
                  </PrivateRoute>
                }
              />
              <Route
                path="/follow-up-budgets"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance", "follow-up"]}>
                    <FollowUpBudgets />
                  </PrivateRoute>
                }
              />
              <Route
                path="/editBudget"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <EditBudget />
                  </PrivateRoute>
                }
              />
              <Route
                path="/budgets/edit/:budgetId"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <EditBudget />
                  </PrivateRoute>
                }
              />
              <Route
                path="/pdf"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <PdfReceipt />
                  </PrivateRoute>
                }
              />
              <Route
                path="/createBudget"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <CreateBudget />
                  </PrivateRoute>
                }
              />
              <Route
                path="/create-legacy-budget"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <CreateLegacyBudget />
                  </PrivateRoute>
                }
              />
              <Route
                path="/archive"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <ArchveBudget />
                  </PrivateRoute>
                }
              />
              <Route path="/archives/:folder/:file" element={<FileDetail />} />

              <Route
                path="/send-notifications"
                element={
                  <PrivateRoute
                    allowedRoles={["owner", "recept", "worker", "admin", "maintenance", "finance", "follow-up"]}
                  >
                    <SendNotification />
                  </PrivateRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <PrivateRoute
                    allowedRoles={["owner", "recept", "worker", "admin"]}
                  >
                    <Notifications />
                  </PrivateRoute>
                }
              />
              <Route
                path="/attachInvoice"
                element={
                  <PrivateRoute allowedRoles={["owner", "recept", "admin", "finance"]}>
                    <AttachInvoice />
                  </PrivateRoute>
                }
              />
              <Route
                path="/balance"
                element={
                  <PrivateRoute allowedRoles={["owner", "finance"]}>
                    <BalanceStats />
                  </PrivateRoute>
                }
              />
              <Route
                path="/fixed-expenses"
                element={
                  <PrivateRoute allowedRoles={["owner", "finance"]}>
                    <FixedExpensesManager />
                  </PrivateRoute>
                }
              />

              <Route
                path="/monthly-expenses"
                element={
                  <PrivateRoute allowedRoles={["owner", "finance"]}>
                    <MonthlyExpensesView />
                  </PrivateRoute>
                }
              />

              {/* Gallery Manager - Solo Owner */}
              <Route
                path="/gallery-manager"
                element={
                  <PrivateRoute allowedRoles={["owner"]}>
                    <GalleryManager />
                  </PrivateRoute>
                }
              />

              {/* Client Portal Admin - Owner y Admin */}
              <Route
                path="/client-portal-admin"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <ClientPortalAdmin />
                  </PrivateRoute>
                }
              />

              <Route
                path="/supplier-invoices"
                element={
                  <PrivateRoute allowedRoles={["owner", "finance"]}>
                    <SupplierInvoiceManager />
                  </PrivateRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PrivateRoute allowedRoles={["owner"]}>
                    <Register />
                  </PrivateRoute>
                }
              />
              <Route
                path="/ver-imagenes/:idWork"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <VerImagenes />
                  </PrivateRoute>
                }
              />

              <Route
                path="/initialPay"
                element={
                  <PrivateRoute allowedRoles={["owner", "finance"]}>
                    <UploadInitialPay />
                  </PrivateRoute>
                }
              />

              <Route
                path="/priceBudget"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <PriceBudgetManagement />
                  </PrivateRoute>
                }
              />

              <Route
                path="/summary"
                element={
                  <PrivateRoute allowedRoles={["owner", "finance", "finance-viewer"]}>
                    <Summary />
                  </PrivateRoute>
                }
              />

              <Route
                path="/accounts-receivable"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "finance"]}>
                    <AccountsReceivable />
                  </PrivateRoute>
                }
              />

              {/* Rutas de Mantenimiento */}
              <Route
                path="/maintenance"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <OwnerMaintenanceView />
                  </PrivateRoute>
                }
              />

              {/* 🏦 Rutas de Bank Accounts */}
              <Route
                path="/bank-accounts"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance"]}>
                    <BankAccountsDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/bank-accounts/monthly-report"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance"]}>
                    <BankAccountMonthlyReport />
                  </PrivateRoute>
                }
              />
              <Route
                path="/bank-accounts/:id"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance"]}>
                    <BankAccountDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/bank-accounts/new-transaction"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "finance"]}>
                    <NewTransactionModal />
                  </PrivateRoute>
                }
              />

              <Route
                path="/maintenance/works"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <MaintenanceList />
                  </PrivateRoute>
                }
              />
              {/* 🆕 Calendario de visitas de mantenimiento */}
              <Route
                path="/maintenance/calendar"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "maintenance"]}>
                    <MaintenanceCalendar />
                  </PrivateRoute>
                }
              />
              <Route
                path="/maintenance/:visitId"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin", "worker", "maintenance"]}>
                    <WorkerMaintenanceDetail />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Ruta para editar trabajos legacy de mantenimiento */}
              <Route
                path="/legacy-maintenance"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "maintenance"]}>
                    <LegacyMaintenanceEditor />
                  </PrivateRoute>
                }
              />

              {/* Rutas de Workers */}
              <Route
                path="/worker"
                element={
                  <PrivateRoute allowedRoles={["worker", "owner", "maintenance"]}>
                    <WorkerDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/worker/work/:workId"
                element={
                  <PrivateRoute allowedRoles={["worker", "owner"]}>
                    <WorkerWorkUpload />
                  </PrivateRoute>
                }
              />
              <Route
                path="/worker/maintenance"
                element={
                  <PrivateRoute allowedRoles={["worker", "maintenance", "owner"]}>
                    <WorkerMaintenanceDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/worker/maintenance/:visitId"
                element={
                  <PrivateRoute allowedRoles={["admin", "worker", "maintenance", "owner"]}>
                    <WorkerMaintenanceDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/worker/general-expense"
                element={
                  <PrivateRoute allowedRoles={["worker", "owner"]}>
                    <WorkerGeneralExpense />
                  </PrivateRoute>
                }
              />

              {/* Rutas de autenticación */}
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

              {/* Recordatorios */}
              <Route
                path="/reminders"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "recept", "finance", "finance-viewer", "follow-up", "worker", "maintenance"]}>
                    <ReminderPanel />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Signature Documents - Firma Electrónica */}
              <Route
                path="/signature-documents"
                element={
                  <PrivateRoute allowedRoles={["admin", "owner", "recept"]}>
                    <SignatureDocumentsDashboard />
                  </PrivateRoute>
                }
              />

              {/* 🆕 Fleet Management - Flota y Maquinaria */}
              <Route
                path="/fleet"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <FleetDashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/fleet/:id"
                element={
                  <PrivateRoute allowedRoles={["owner", "admin"]}>
                    <FleetAssetDetail />
                  </PrivateRoute>
                }
              />

              {/* Ruta por defecto para 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </div>
      <ToastContainer
        position="top-right"
        className="mt-16 md:mt-20"
        toastClassName="text-sm"
      />
    </>
  );
}

export default App;
