import React, { useState } from "react"; //probando redeploy
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  FaHome,
  FaTasks,
  FaCalendarAlt,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaDollarSign,
  FaTools,
  FaBell,
  FaUsers,
  FaChartBar,
  FaFolderOpen,
  FaEdit,
  FaCog,
  FaClipboardCheck,
  FaClipboardList,
  FaUpload,
  FaArchive,
  FaBoxes,
  FaReceipt,
  FaWrench,
  FaHistory,
  FaFileInvoice,
  FaUniversity,
  FaMapMarkedAlt, 
  FaChartPie, 
  FaCalendarCheck,
  FaImage, 
  FaListUl, 
  FaExclamationTriangle, 
  FaUserPlus, 
  FaEnvelope, 
  FaBook, 
  FaNewspaper 
} from "react-icons/fa";

const BarraLateral = () => { 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { currentStaff: staff } = useSelector((state) => state.auth);

  // New state to manage open sections
  const [openSections, setOpenSections] = useState({
    "Works Management": true, // Abrir sección Works Management por defecto
    "Maintenance & Calendar": true, // Abrir sección Maintenance & Calendar por defecto
    
  });

  const menuSections = [
    {
      name: "Dashboard",
      icon: FaHome,
      color: "text-blue-400",
      items: [
        { name: "Dashboard", path: "/dashboard", icon: FaChartBar },
      ],
    },
    {
      name: "Sales Leads",
      icon: FaUserPlus,
      color: "text-indigo-400",
      items: [
        { name: "Sales Leads", path: "/sales-leads", icon: FaUserPlus },
        { name: "Sales Dashboard", path: "/sales-dashboard", icon: FaChartBar },
        
      ],
    },
    {
      name: "Works Management",
      icon: FaTasks,
      color: "text-green-400",
      items: [
        { name: "Works", path: "/works", icon: FaTasks },
        { name: "Simple Works", path: "/simple-works", icon: FaTools },
        { name: "Claims", path: "/claims", icon: FaExclamationTriangle },
        { name: "Tracking Work", path: "/check", icon: FaClipboardCheck },
        { name: "Progress", path: "/progress-tracker", icon: FaChartBar },
        { name: "Zone Map", path: "/work-zone-map", icon: FaMapMarkedAlt }, // 🆕 Mapa de obras por zona
        { name: "Monthly Installations", path: "/monthly-installations", icon: FaChartPie }, // 🆕 Instalaciones mensuales
      ],
    },
    {
      name: "Maintenance & Calendar",
      icon: FaWrench,
      color: "text-orange-400",
      items: [
        { name: "Calendar", path: "/workCalendar", icon: FaCalendarAlt },
        { name: "Staff Attendance", path: "/staff-attendance", icon: FaCalendarCheck }, 
        { name: "Works List Maintenance", path: "/maintenance/works", icon: FaClipboardList }, 
        { name: "Zones View Maintenance", path: "/maintenance/zones", icon: FaMapMarkedAlt },
        { name: "Maintenance", path: "/maintenance", icon: FaWrench },
        { name: "Maintenance Tracker", path: "/maintenance-tracker", icon: FaListUl }, 
        { name: "Edit Maintenance", path: "/legacy-maintenance", icon: FaHistory }, 
        
      ],
    },
    {
      name: "Budgets & Permits",
      icon: FaFolderOpen,
      color: "text-purple-400",
      items: [
        { name: "Upload Permits", path: "/pdf", icon: FaUpload },
        { name: "Budgets", path: "/budgets", icon: FaFolderOpen },
        { name: "Follow-Up Budgets", path: "/follow-up-budgets", icon: FaBell }, // 🔔 Seguimiento
        { name: "Legacy Budgets", path: "/create-legacy-budget", icon: FaHistory },
        { name: "Items Budgets", path: "/itemBudget", icon: FaBoxes },
        { name: "Edit Budgets", path: "/editBudget", icon: FaEdit },
        { name: "Gestion Budgets", path: "/gestionBudgets", icon: FaCog },
        { name: "BudgetsEnd", path: "/archive", icon: FaArchive },
      ],
    },
    {
      name: "Financial",
      icon: FaMoneyBillWave,
      color: "text-yellow-400",
      items: [
        { name: "Initial Pay", path: "/initialPay", icon: FaMoneyBillWave },
        { name: "Upload Vouchers", path: "/attachInvoice", icon: FaReceipt },
        { name: "Supplier Invoices", path: "/supplier-invoices", icon: FaFileInvoice },
        { name: "Bank Accounts", path: "/bank-accounts", icon: FaUniversity }, // 🏦 NUEVO
        { name: "Balance", path: "/balance", icon: FaChartBar },
        { name: "Income & Expenses", path: "/summary", icon: FaFileInvoiceDollar },
        { name: "Fixed Expenses", path: "/fixed-expenses", icon: FaDollarSign }, // 🆕 Gastos Fijos
        { name: "Monthly Expenses", path: "/monthly-expenses", icon: FaCalendarAlt }, // 🆕 Gastos Devengados
        { name: "Accounts Receivable", path: "/accounts-receivable", icon: FaDollarSign }, // 🆕 Cuentas por cobrar
      ],
    },
    {
      name: "Administration",
      icon: FaCog,
      color: "text-red-400",
      items: [
        { name: "Materials", path: "/materiales", icon: FaTools },
        { name: "Send Message", path: "/send-notifications", icon: FaBell },
        { name: "Staff", path: "/register", icon: FaUsers },
        { name: "Knowledge Base", path: "/knowledge-base", icon: FaBook }, // 🆕 Base de Conocimiento
      ],
    },
    {
      name: "Content Management",
      icon: FaImage,
      color: "text-pink-400",
      items: [
        { name: "Gallery Manager", path: "/gallery-manager", icon: FaImage },
         { name: "Email Marketing", path: "/marketing-campaigns", icon: FaEnvelope },
         { name: "Newsletter", path: "/marketing-campaigns/newsletter", icon: FaNewspaper },
      ],
    },
  ];

  // Filtrar opciones según el rol
  const getFilteredMenuSections = () => {
    if (staff?.role === "owner") {
      return menuSections; // Acceso completo para owner, este ve todo completo
    } else if (staff?.role === "admin") {
      // Admin tiene acceso limitado: sin Tracking Work y solo Upload Vouchers en Financial
      return [
        {
          name: "Dashboard",
          icon: FaHome,
          color: "text-blue-400",
          items: [
            { name: "Dashboard", path: "/dashboard", icon: FaChartBar },
          ],
        },
        {
          name: "Sales Leads",
          icon: FaUserPlus,
          color: "text-indigo-400",
          items: [
            { name: "Sales Leads", path: "/sales-leads", icon: FaUserPlus },
            { name: "Sales Dashboard", path: "/sales-dashboard", icon: FaChartBar },
          ],
        },
        {
          name: "Works Management",
          icon: FaTasks,
          color: "text-green-400",
          items: [
            { name: "Works", path: "/works", icon: FaTasks },
            { name: "Simple Works", path: "/simple-works", icon: FaTools },
            { name: "Claims", path: "/claims", icon: FaExclamationTriangle },
            // Tracking Work removido para admin
            { name: "Progress", path: "/progress-tracker", icon: FaChartBar },
            { name: "Zone Map", path: "/work-zone-map", icon: FaMapMarkedAlt }, // 🆕 Mapa de obras por zona
            { name: "Monthly Installations", path: "/monthly-installations", icon: FaChartPie }, // 🆕 Instalaciones mensuales
          ],
        },
        {
          name: "Maintenance & Calendar",
          icon: FaWrench,
          color: "text-orange-400",
          items: [
            { name: "Calendar", path: "/workCalendar", icon: FaCalendarAlt },
            { name: "Maintenance Tracker", path: "/maintenance-tracker", icon: FaListUl },
            { name: "Works List Maintenance", path: "/maintenance/works", icon: FaClipboardList }, 
            { name: "Zones View Maintenance", path: "/maintenance/zones", icon: FaMapMarkedAlt }, // 🆕 Visitas por zona
            { name: "Maintenance", path: "/maintenance", icon: FaWrench },
            { name: "Edit Maintenance", path: "/legacy-maintenance", icon: FaHistory }, // 🆕 Editor de todos los maintenance
            { name: "Staff Attendance", path: "/staff-attendance", icon: FaCalendarCheck }, // 🆕 Asistencia del personal
          ],
        },
        {
          name: "Budgets & Permits",
          icon: FaFolderOpen,
          color: "text-purple-400",
          items: [
            { name: "Upload Permits", path: "/pdf", icon: FaUpload },
            { name: "Budgets", path: "/budgets", icon: FaFolderOpen },
            { name: "Follow-Up Budgets", path: "/follow-up-budgets", icon: FaBell }, // 🔔 Seguimiento
            { name: "Legacy Budgets", path: "/create-legacy-budget", icon: FaHistory },
            { name: "Items Budgets", path: "/itemBudget", icon: FaBoxes },
            { name: "Edit Budgets", path: "/editBudget", icon: FaEdit },
            { name: "Gestion Budgets", path: "/gestionBudgets", icon: FaCog },
            { name: "BudgetsEnd", path: "/archive", icon: FaArchive },
          ],
        },
        {
          name: "Financial",
          icon: FaMoneyBillWave,
          color: "text-yellow-400",
          items: [
            // Solo Upload Vouchers para admin
            { name: "Upload Vouchers", path: "/attachInvoice", icon: FaReceipt },
            { name: "Accounts Receivable", path: "/accounts-receivable", icon: FaDollarSign },
          ],
        },
        {
          name: "Administration",
          icon: FaCog,
          color: "text-red-400",
          items: [
            
            { name: "Send Message", path: "/send-notifications", icon: FaBell },
            { name: "Knowledge Base", path: "/knowledge-base", icon: FaBook }, 
          ],
        },
      ];
    } else if (staff?.role === "recept") {
      // Solo materiales, itemBudget, attachInvoice, send-notifications, calendario y progress tracker
      return [
        {
          name: "Sales Leads",
          icon: FaUserPlus,
          color: "text-indigo-400",
          items: [
            { name: "Sales Leads", path: "/sales-leads", icon: FaUserPlus },
            { name: "My Sales Dashboard", path: "/sales-dashboard", icon: FaChartBar },
          ],
        },
        {
          name: "Reception Tasks",
          icon: FaClipboardCheck,
          color: "text-blue-400",
          items: [
            { name: "Materials", path: "/materiales", icon: FaTools },
            { name: "Items Budgets", path: "/itemBudget", icon: FaBoxes },
            { name: "Upload Vouchers", path: "/attachInvoice", icon: FaReceipt },
            { name: "Send Message", path: "/send-notifications", icon: FaBell },
            { name: "Simple Works", path: "/simple-works", icon: FaTools },
            { name: "Claims", path: "/claims", icon: FaExclamationTriangle },
            { name: "Calendar", path: "/workCalendar", icon: FaCalendarAlt },
            { name: "Progress", path: "/progress-tracker", icon: FaChartBar },
            { name: "Works", path: "/works", icon: FaTasks },
            { name: "Zone Map", path: "/work-zone-map", icon: FaMapMarkedAlt }, // 🆕 Mapa de obras por zona
            { name: "Monthly Installations", path: "/monthly-installations", icon: FaChartPie }, // 🆕 Instalaciones mensuales
            { name: "Knowledge Base", path: "/knowledge-base", icon: FaBook }, 
          ],
        },
      ];
    } else if (staff?.role === "finance") {
      // Finance: Permisos completos + puede crear/editar
      return [
        {
          name: "Dashboard",
          icon: FaHome,
          color: "text-blue-400",
          items: [
            { name: "Dashboard", path: "/dashboard", icon: FaChartBar },
          ],
        },
        {
          name: "Works Management",
          icon: FaTasks,
          color: "text-green-400",
          items: [
            { name: "Works (View Only)", path: "/works", icon: FaTasks },
            { name: "Progress", path: "/progress-tracker", icon: FaChartBar },
            { name: "Claims", path: "/claims", icon: FaExclamationTriangle },
          ],
        },
        {
          name: "Budgets",
          icon: FaFolderOpen,
          color: "text-purple-400",
          items: [
            { name: "Budgets (View Only)", path: "/budgets", icon: FaFolderOpen },
          ],
        },
        {
          name: "Financial",
          icon: FaMoneyBillWave,
          color: "text-yellow-400",
          items: [
            { name: "Upload Vouchers", path: "/attachInvoice", icon: FaReceipt },
            { name: "Supplier Invoices", path: "/supplier-invoices", icon: FaFileInvoice },
            { name: "Bank Accounts", path: "/bank-accounts", icon: FaUniversity }, // 🏦 FINANCE
            { name: "Income & Expenses", path: "/summary", icon: FaFileInvoiceDollar },
            { name: "Fixed Expenses", path: "/fixed-expenses", icon: FaDollarSign },
            { name: "Monthly Expenses", path: "/monthly-expenses", icon: FaCalendarAlt }, // 🆕 Gastos Devengados
            { name: "Accounts Receivable", path: "/accounts-receivable", icon: FaDollarSign },
            { name: "Balance", path: "/balance", icon: FaChartBar },  
            { name: "Initial Pay", path: "/initialPay", icon: FaMoneyBillWave },
          ],
        },
      ];
    } else if (staff?.role === "finance-viewer") {
      // Finance-Viewer: Solo acceso a Summary (Income & Expenses) en modo lectura
      return [
        {
          name: "Dashboard",
          icon: FaHome,
          color: "text-blue-400",
          items: [
            { name: "Dashboard 👁️", path: "/dashboard", icon: FaChartBar },
          ],
        },
        {
          name: "Financial (Read Only)",
          icon: FaMoneyBillWave,
          color: "text-yellow-400",
          items: [
            { name: "Income & Expenses 👁️", path: "/summary", icon: FaFileInvoiceDollar },
            { name: "Monthly Expenses 👁️", path: "/monthly-expenses", icon: FaCalendarAlt }, // 🆕 Gastos Devengados
          ],
        },
      ];
    } else if (staff?.role === "follow-up") {
      // Follow-up: Solo Gestión de Budgets (ver, descargar Excel, chat y notas)
      return [
        {
          name: "Sales Leads",
          icon: FaUserPlus,
          color: "text-indigo-400",
          items: [
            { name: "Sales Leads", path: "/sales-leads", icon: FaUserPlus },
          ],
        },
        {
          name: "Client Follow-up",
          icon: FaFolderOpen,
          color: "text-purple-400",
          items: [
            { name: "Follow-Up Budgets", path: "/follow-up-budgets", icon: FaBell }, // 🔔 Presupuestos en Seguimiento
            { name: "Gestion Budgets", path: "/gestionBudgets", icon: FaCog },
          ],
        },
      ];
    } else if (staff?.role === "sales_rep" || staff?.role === "recept") {
      // Sales Rep / Recept: Dashboard de ventas con presupuestos y works
      return [
        {
          name: "Sales Leads",
          icon: FaUserPlus,
          color: "text-indigo-400",
          items: [
            { name: "Sales Leads", path: "/sales-leads", icon: FaUserPlus },
            { name: "My Sales Dashboard", path: "/sales-dashboard", icon: FaChartBar },
          ],
        },
      ];
    }
    return []; // Sin acceso por defecto
  };

  const filteredMenuSections = getFilteredMenuSections();

  const handleNavigation = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };
  
  const toggleSection = (sectionName) => {
    setOpenSections(prevOpenSections => ({
      ...prevOpenSections,
      [sectionName]: !prevOpenSections[sectionName],
    }));
  };
  
  const handleMobileNavigation = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  if (!staff || !filteredMenuSections.length) {
    return null;
  }

  const renderMenuItems = (isMobile) => (
    filteredMenuSections.map((section) => (
      <div key={section.name} className="w-full mb-2">
        <button
          onClick={() => toggleSection(section.name)}
          className={`flex items-center justify-between w-full py-3 px-4 text-sm font-semibold transition-all duration-300 text-left rounded-lg mx-2 mb-1 group hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
            openSections[section.name] ? 'bg-gradient-to-r from-gray-700 to-gray-600 text-white' : 'text-gray-300 hover:text-white'
          }`}
        >
          <div className="flex items-center">
            <section.icon className={`mr-3 text-lg ${section.color} group-hover:text-white transition-colors duration-300`} />
            <span className={`truncate ${!isDesktopMenuOpen && !isMobile ? 'hidden' : ''}`}>{section.name}</span>
          </div>
          <div className={`text-lg ml-2 flex-shrink-0 transform transition-transform duration-300 ${openSections[section.name] ? 'rotate-180' : ''} ${!isDesktopMenuOpen && !isMobile ? 'hidden' : ''}`}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          openSections[section.name] ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <ul className="pl-4 pr-2 space-y-1">
            {section.items.map((item) => (
              <li key={item.name} className="w-full">
                <button
                  onClick={() => isMobile ? handleMobileNavigation(item.path) : handleNavigation(item.path)}
                  className={`flex items-center py-2.5 px-4 text-sm font-medium transition-all duration-300 w-full text-left rounded-lg group ${
                    location.pathname === item.path 
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg transform scale-105" 
                      : "text-gray-400 hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600 hover:text-white hover:transform hover:scale-102"
                  }`}
                >
                  <item.icon className={`mr-3 text-base transition-colors duration-300 ${
                    location.pathname === item.path ? 'text-white' : 'text-gray-500 group-hover:text-blue-400'
                  }`} />
                  <span className={`${!isDesktopMenuOpen && !isMobile ? 'hidden' : ''} transition-all duration-300`}>
                    {item.name}
                  </span>
                  {location.pathname === item.path && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ))
  );

  return (
    <div className="flex">
      {/* Desktop/Tablet Sidebar */}
      <div className={`hidden md:flex flex-col bg-gradient-to-b from-gray-900 via-gray-850 to-gray-900 text-white ${isDesktopMenuOpen ? 'w-64 lg:w-72' : 'w-20'} h-screen fixed z-20 shadow-2xl transition-all duration-300 border-r border-gray-700/50 pt-16`}>
        {/* Header - Más simple sin duplicar Zurcher */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            {isDesktopMenuOpen && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                  <FaHome className="text-white text-lg" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Dashboard</h2>
                  <p className="text-xs text-gray-300 capitalize">{staff?.role || 'User'} Panel</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
              className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700/50 transition-all duration-300 ml-auto group"
            >
              <div className="w-5 h-4 flex flex-col justify-around">
                <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${!isDesktopMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${!isDesktopMenuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${!isDesktopMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
              </div>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <nav className="space-y-1">
            {renderMenuItems(false)}
          </nav>
        </div>

        {/* Footer */}
        {isDesktopMenuOpen && (
          <div className="p-4 border-t border-gray-700/50 bg-gray-800/70">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-sm font-bold">
                  {staff?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {staff?.username || 'User'}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {staff?.role || 'Role'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          className="fixed top-20 left-4 z-50 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-xl shadow-lg focus:outline-none transition-all duration-300 hover:scale-110 hover:shadow-xl"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <div className="w-5 h-4 flex flex-col justify-around">
            <span className={`block h-0.5 w-5 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-white transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </div>
        </button>

        {/* Mobile Sidebar */}
        <div className={`fixed top-0 left-0 w-80 h-screen bg-gradient-to-b from-gray-900 via-gray-850 to-gray-900 text-white z-40 transform transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-2xl border-r border-gray-700/50`}>
          {/* Mobile Header */}
          <div className="p-6 pt-20 border-b border-gray-700/50">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <FaHome className="text-white text-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Dashboard</h2>
                <p className="text-sm text-gray-300 capitalize">{staff?.role || 'User'} Panel</p>
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <nav className="space-y-1">
              {renderMenuItems(true)}
            </nav>
          </div>

          {/* Mobile Footer */}
          <div className="p-4 border-t border-gray-700/50 bg-gray-800/70">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">
                  {staff?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {staff?.username || 'User'}
                </p>
                <p className="text-sm text-gray-400 capitalize">
                  {staff?.role || 'Role'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-all duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}
      </div>

      {/* Content Spacer for Desktop */}
      <div className={`hidden md:block ${isDesktopMenuOpen ? 'w-64 lg:w-72' : 'w-20'} flex-shrink-0 transition-all duration-300`}></div>
    </div>
  );
};

export default BarraLateral;