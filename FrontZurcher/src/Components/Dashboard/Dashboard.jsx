import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  ChartBarIcon, 
  BuildingOfficeIcon, 
  CalendarDaysIcon,
  CubeIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  FolderIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  DocumentArrowUpIcon,
  BanknotesIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  CogIcon,
  DocumentDuplicateIcon,
  PresentationChartBarIcon,
  ReceiptPercentIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline'; 

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentStaff: staff } = useSelector((state) => state.auth);

  // Redirigir workers directamente a su dashboard
  React.useEffect(() => {
    if (staff?.role === 'worker') {
      navigate('/worker');
    }
  }, [staff, navigate]);

  // Definir las opciones del Dashboard organizadas por categorías
  const dashboardSections = [
    {
      title: "Project Management",
      items: [
        {
          path: '/works',
          title: 'Works',
          description: 'Manage all construction projects',
          icon: BuildingOfficeIcon,
          gradient: 'from-blue-500 to-blue-600',
          allowedRoles: ['owner', 'admin', 'finance', 'recept'],
        },
        {
          path: '/progress-tracker',
          title: 'Progress Tracker',
          description: 'Track project progress',
          icon: ChartBarIcon,
          gradient: 'from-green-500 to-green-600',
          allowedRoles: ['owner', 'admin', 'recept', 'finance'],
        },
        {
          path: '/workCalendar',
          title: 'Calendar',
          description: 'Schedule and timeline',
          icon: CalendarDaysIcon,
          gradient: 'from-purple-500 to-purple-600',
          allowedRoles: ['owner', 'admin', 'recept'],
        },
        {
          path: '/check',
          title: 'Check Work',
          description: 'Quality control and inspection',
          icon: CheckCircleIcon,
          gradient: 'from-orange-500 to-orange-600',
          allowedRoles: ['owner'],
        },
      ]
    },
    {
      title: "Budget & Finance",
      items: [
        {
          path: '/budgets',
          title: 'Budgets',
          description: 'View project budgets',
          icon: DocumentTextIcon,
          gradient: 'from-indigo-500 to-indigo-600',
          allowedRoles: ['owner', 'admin', 'finance', 'recept'],
        },
        {
          path: '/itemBudget',
          title: 'Price Items',
          description: 'Set item prices and costs',
          icon: CurrencyDollarIcon,
          gradient: 'from-yellow-500 to-yellow-600',
          allowedRoles: ['owner', 'recept', 'admin'],
        },
        {
          path: '/editBudget',
          title: 'Edit Budgets',
          description: 'Modify existing budgets',
          icon: PencilSquareIcon,
          gradient: 'from-teal-500 to-teal-600',
          allowedRoles: ['owner', 'admin'],
        },
        {
          path: '/gestionBudgets',
          title: 'Budget Management',
          description: 'Advanced budget controls',
          icon: CogIcon,
          gradient: 'from-gray-500 to-gray-600',
          allowedRoles: ['owner', 'admin', 'finance', 'follow-up'],
        },
        {
          path: '/archive',
          title: 'Archived Budgets',
          description: 'View completed projects',
          icon: ArchiveBoxIcon,
          gradient: 'from-slate-500 to-slate-600',
          allowedRoles: ['owner', 'admin'],
        },
      ]
    },
    {
      title: "Financial Operations",
      items: [
        {
          path: '/initialPay',
          title: 'Initial Payments',
          description: 'Manage down payments',
          icon: BanknotesIcon,
          gradient: 'from-emerald-500 to-emerald-600',
          allowedRoles: ['owner', 'admin', 'finance'],
        },
        {
          path: '/attachInvoice',
          title: 'Upload Vouchers',
          description: 'Expense documentation',
          icon: DocumentArrowUpIcon,
          gradient: 'from-rose-500 to-rose-600',
          allowedRoles: ['owner', 'admin', 'recept', 'finance'],
        },
        {
          path: '/supplier-invoices',
          title: 'Supplier Invoices',
          description: 'Manage vendor invoices & payments',
          icon: ReceiptPercentIcon,
          gradient: 'from-fuchsia-500 to-fuchsia-600',
          allowedRoles: ['owner', 'finance'],
        },
        {
          path: '/balance',
          title: 'Balance',
          description: 'Financial overview',
          icon: PresentationChartBarIcon,
          gradient: 'from-cyan-500 to-cyan-600',
          allowedRoles: ['owner', 'finance'],
        },
        {
          path: '/summary',
          title: 'Income & Expenses',
          description: 'Detailed financial reports',
          icon: ClipboardDocumentListIcon,
          gradient: 'from-violet-500 to-violet-600',
          allowedRoles: ['owner', 'finance', 'finance-viewer'],
        },
      ]
    },
    {
      title: "Workers",
      items: [
        {
          path: '/worker',
          title: 'My Works',
          description: 'View assigned jobs and upload photos',
          icon: BriefcaseIcon,
          gradient: 'from-blue-600 to-indigo-700',
          allowedRoles: ['worker'],
        },
      ]
    },
    {
      title: "Resources & Administration",
      items: [
        {
          path: '/materiales',
          title: 'Materials',
          description: 'Inventory management',
          icon: CubeIcon,
          gradient: 'from-amber-500 to-amber-600',
          allowedRoles: ['owner', 'admin', 'recept'],
        },
        {
          path: '/pdf',
          title: 'Upload Permits',
          description: 'Document management',
          icon: DocumentDuplicateIcon,
          gradient: 'from-lime-500 to-lime-600',
          allowedRoles: ['owner', 'admin'],
        },
        {
          path: '/register',
          title: 'Manage Staff',
          description: 'User administration',
          icon: UserPlusIcon,
          gradient: 'from-red-500 to-red-600',
          allowedRoles: ['owner'],
        },
      ]
    }
  ];

  // Filtrar secciones y elementos según el rol
  const getFilteredSections = () => {
    return dashboardSections.map(section => ({
      ...section,
      items: section.items.filter(item => item.allowedRoles.includes(staff?.role))
    })).filter(section => section.items.length > 0);
  };

  const navigateTo = (path) => {
    navigate(path);
  };

  const getRoleTitle = (role) => {
    switch(role) {
      case 'owner': return 'Owner Dashboard';
      case 'admin': return 'Administrator Dashboard';
      case 'recept': return 'Receptionist Dashboard';
      case 'worker': return 'Worker Dashboard';
      case 'finance': return 'Finance Dashboard';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{getRoleTitle(staff?.role)}</h1>
          <p className="text-blue-100 text-lg">Welcome back, {staff?.name || 'User'}!</p>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {getFilteredSections().map((section) => (
          <div key={section.title} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-4"></div>
              {section.title}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {section.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-2"
                  >
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                    
                    {/* Card Content */}
                    <div className="relative p-6">
                      {/* Icon */}
                      <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${item.gradient} rounded-xl mb-4 shadow-lg`}>
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors">
                        {item.title}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-gray-600 text-sm leading-relaxed group-hover:text-gray-700 transition-colors">
                        {item.description}
                      </p>
                      
                      {/* Arrow Icon */}
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bottom Border */}
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;