import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFollowUpBudgets,
  toggleBudgetFollowUp,
  archiveBudget,
  fetchBudgetsWithUpcomingAlerts // 🔔 Para mostrar recordatorios próximos
} from '../../Redux/Actions/budgetActions';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import BudgetNotesModal from './BudgetNotesModal';
import NotesAlertBadge from '../Common/NotesAlertBadge';
import api from '../../utils/axios';
import { formatDateTimeInDisplayTz } from '../../utils/timezoneDisplay';

const STATUS_LABELS = {
  draft:              'Borrador',
  pending_review:     'En Revisión',
  client_approved:    'Pre-Aprobado',
  created:            'Creado',
  send:               'Enviado',
  sent_for_signature: 'Para Firma',
  signed:             'Firmado',
  approved:           'Aprobado',
  rejected:           'Rechazado',
  notResponded:       'Sin Respuesta',
  archived:           'Archivado',
};

const FollowUpBudgets = () => {
  const dispatch = useDispatch();
  
  // Estados locales
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);
  
  // Estados para modal de notas
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [budgetForNotes, setBudgetForNotes] = useState(null);
  
  // 🔔 Estados para recordatorios próximos
  const [upcomingAlertBudgets, setUpcomingAlertBudgets] = useState([]);
  const [loadingUpcomingAlerts, setLoadingUpcomingAlerts] = useState(false);
  const [alertsCollapsed, setAlertsCollapsed] = useState(true);
  const [verifyingReminders, setVerifyingReminders] = useState(false);
  // 🔔 Estado para alertas/badges de cada budget (unread, overdue, upcoming)
  const [budgetAlerts, setBudgetAlerts] = useState({});

  // 👤 Estado para popover de contacto del cliente
  const [clientPopover, setClientPopover] = useState(null); // null | budget object

  // Get user info for permissions
  const { user, currentStaff } = useSelector((state) => state.auth);
  const staff = currentStaff || user;
  const userRole = staff?.role || '';
  const isReadOnly = !['admin', 'owner', 'follow-up', 'finance'].includes(userRole);

  // Formato de fecha: MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return "Invalid Date";
    return `${month}-${day}-${year}`;
  };

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar presupuestos con seguimiento
  const loadFollowUpBudgets = async () => {
    setLoading(true);
    try {
      const result = await dispatch(fetchFollowUpBudgets({
        page,
        pageSize,
        search: debouncedSearchTerm,
        status: statusFilter
      }));

      if (result.payload) {
        setBudgets(result.payload.budgets || []);
        setTotal(result.payload.total || 0);
        setTotalPages(result.payload.totalPages || 1);
        setStats(result.payload.stats || null);
      }
    } catch (error) {
      console.error('Error al cargar budgets con seguimiento:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔔 Cargar alertas de badges para cada budget (unread, overdue, upcoming)
  const reloadBudgetAlerts = async () => {
    try {
      const response = await api.get(`/budget-notes/alerts/budgets?_t=${Date.now()}`);
      setBudgetAlerts(response.data.budgetsWithAlerts || {});
    } catch (error) {
      console.error('Error al cargar alertas de budgets:', error);
    }
  };

  // 🔔 Cargar budgets con recordatorios activos (vencidos + próximos)
  const loadUpcomingAlerts = async () => {
    try {
      setLoadingUpcomingAlerts(true);
      const result = await dispatch(fetchBudgetsWithUpcomingAlerts(7));
      if (result.payload && result.payload.budgets) {
        setUpcomingAlertBudgets(result.payload.budgets);
      }
    } catch (error) {
      console.error('Error al cargar alertas próximas:', error);
    } finally {
      setLoadingUpcomingAlerts(false);
    }
  };

  // 🔔 Verificar recordatorios manualmente (ejecutar cron)
  const handleVerifyReminders = async () => {
    if (!window.confirm(
      '¿Ejecutar ahora la verificación de recordatorios de budget?\n\n' +
      'Esto buscará recordatorios programados para mañana (24hs antes) ' +
      'y enviará notificaciones por correo si están activos.'
    )) return;

    try {
      setVerifyingReminders(true);
      const response = await api.post('/budget/check-reminders');
      
      alert(
        '✅ Verificación de recordatorios completada\n\n' +
        `${response.data.emailsSent || 0} correos enviados\n` +
        `${response.data.remindersChecked || 0} recordatorios procesados`
      );
      
      // Recargar alertas después de verificar
      await loadUpcomingAlerts();
    } catch (error) {
      console.error('Error verificando recordatorios:', error);
      alert(`❌ Error al verificar recordatorios:\n${error.response?.data?.details || error.message}`);
    } finally {
      setVerifyingReminders(false);
    }
  };

  // Cargar cuando cambian filtros o página
  useEffect(() => {
    loadFollowUpBudgets();
  }, [page, debouncedSearchTerm, statusFilter]);

  // 🔔 Cargar alertas de badges y recordatorios próximos al montar
  useEffect(() => {
    reloadBudgetAlerts();
    loadUpcomingAlerts();
    
    // Actualizar cada 5 minutos
    const interval = setInterval(() => {
      reloadBudgetAlerts();
      loadUpcomingAlerts();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Handler para remover de seguimiento
  const handleRemoveFromFollowUp = async (budgetId) => {
    if (!window.confirm('¿Este presupuesto ya no requiere seguimiento especial?\n\nNota: Los presupuestos completados (firmados/pagados) no necesitan estar en seguimiento. Use esta opción para casos donde el cliente no responde o se cancela el proyecto.')) return;
    
    try {
      await dispatch(toggleBudgetFollowUp(budgetId, false));
      // Recargar lista
      loadFollowUpBudgets();
    } catch (error) {
      console.error('Error al remover de seguimiento:', error);
      alert('Error al actualizar el estado de seguimiento');
    }
  };

  // 🗄️ Handler para archivar presupuesto
  const handleArchiveBudget = async (budgetId) => {
    if (!window.confirm(
      '¿Archivar este presupuesto?\n\n' +
      'El presupuesto cambiará a estado "archived" y aparecerá en la sección de Budgets Archivados con todas sus notas.\n\n' +
      'NOTA: El presupuesto debe tener al menos una nota explicando el motivo del archivo.'
    )) return;
    
    try {
      const result = await dispatch(archiveBudget(budgetId));
      
      // Verificar si hay error de validación (sin notas)
      if (result.error || result.payload?.needsNote) {
        const errorMsg = result.payload?.message || result.error?.message || 'Error desconocido';
        
        // Si el error es por falta de notas, ofrecer abrir el modal
        if (errorMsg.includes('nota') || result.payload?.needsNote) {
          const shouldAddNote = window.confirm(
            '⚠️ No se puede archivar sin documentación\n\n' +
            'Este presupuesto necesita al menos una nota explicando el motivo del archivo.\n\n' +
            '¿Deseas agregar una nota ahora?'
          );
          
          if (shouldAddNote) {
            // Buscar el budget en la lista actual para abrir el modal
            const budget = budgets.find(b => b.idBudget === budgetId);
            if (budget) {
              handleOpenNotes(budget);
            }
          }
        } else {
          alert('Error al archivar: ' + errorMsg);
        }
        return;
      }
      
      // Si fue exitoso, recargar lista
      loadFollowUpBudgets();
      alert('✅ Presupuesto archivado exitosamente');
    } catch (error) {
      console.error('Error al archivar presupuesto:', error);
      
      // Verificar si el error es por falta de notas
      const errorMsg = error.response?.data?.message || error.message || '';
      if (errorMsg.includes('nota') || error.response?.data?.needsNote) {
        const shouldAddNote = window.confirm(
          '⚠️ No se puede archivar sin documentación\n\n' +
          'Este presupuesto necesita al menos una nota explicando el motivo del archivo.\n\n' +
          '¿Deseas agregar una nota ahora?'
        );
        
        if (shouldAddNote) {
          const budget = budgets.find(b => b.idBudget === budgetId);
          if (budget) {
            handleOpenNotes(budget);
          }
        }
      } else {
        alert('Error al archivar el presupuesto: ' + errorMsg);
      }
    }
  };

  // Handler para abrir modal de notas
  const handleOpenNotes = (budget) => {
    setBudgetForNotes(budget);
    setShowNotesModal(true);
  };

  const handleCloseNotesModal = () => {
    setShowNotesModal(false);
    setBudgetForNotes(null);
    // Recargar lista y alertas para actualizar badges
    loadFollowUpBudgets();
    reloadBudgetAlerts();
  };

  // Colores de estado
  const getStatusColor = (status) => {
    const colors = {
      sent: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      signed: 'bg-green-100 text-green-800 border-green-300',
      archived: 'bg-gray-100 text-gray-800 border-gray-300',
      draft: 'bg-blue-100 text-blue-800 border-blue-300',
      paid: 'bg-green-100 text-green-800 border-green-300',
      legacy_maintenance: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <BellIcon className="h-8 w-8 text-yellow-500" />
          Presupuestos en Seguimiento
        </h1>
        <p className="text-gray-600 mt-2">
          Gestiona los presupuestos que requieren atención especial del equipo de seguimiento
        </p>
      </div>

          {/* Estadísticas por Estado */}
      {stats && stats.byStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(isActive ? 'all' : status); setPage(1); }}
                className={`p-4 rounded-lg shadow border text-left transition-all cursor-pointer
                  ${isActive
                    ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400'
                    : 'bg-white border-gray-200 hover:border-yellow-300 hover:shadow-md'
                  }`}
              >
                <p className={`text-sm uppercase font-semibold ${isActive ? 'text-yellow-700' : 'text-gray-600'}`}>{STATUS_LABELS[status] || status}</p>
                <p className={`text-2xl font-bold ${isActive ? 'text-yellow-600' : 'text-gray-800'}`}>{count}</p>
              </button>
            );
          })}
          <button
            onClick={() => { setStatusFilter('all'); setPage(1); }}
            className={`p-4 rounded-lg shadow border text-left transition-all cursor-pointer
              ${statusFilter === 'all'
                ? 'bg-yellow-100 border-yellow-500 ring-2 ring-yellow-500'
                : 'bg-yellow-50 border-yellow-200 hover:border-yellow-400 hover:shadow-md'
              }`}
          >
            <p className="text-sm text-yellow-800 uppercase font-semibold">Total</p>
            <p className="text-2xl font-bold text-yellow-600">{total}</p>
          </button>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, dirección o empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de Estado */}
          <div className="relative">
            <FunnelIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent appearance-none"
            >
              <option value="all">Todos los Estados</option>
              <option value="draft">Borrador</option>
              <option value="pending_review">En Revisión</option>
              <option value="client_approved">Pre-Aprobado</option>
              <option value="created">Creado</option>
              <option value="send">Enviado</option>
              <option value="sent_for_signature">Para Firma</option>
              <option value="signed">Firmado</option>
              <option value="notResponded">Sin Respuesta</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>

          {/* Contador de Resultados */}
          <div className="flex items-center justify-center md:justify-end">
            <span className="text-sm text-gray-600">
              {total} presupuestos en seguimiento
            </span>
          </div>
        </div>
      </div>

      {/* 🔔 Botón Verificar Recordatorios - Solo para admin/owner */}
      {['admin', 'owner'].includes(userRole) && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={handleVerifyReminders}
            disabled={verifyingReminders}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              verifyingReminders
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <BellIcon className="h-5 w-5" />
            {verifyingReminders ? 'Verificando...' : 'Verificar Recordatorios'}
          </button>
        </div>
      )}

      {/* 🔔 Banner de Recordatorios Activos */}
      {upcomingAlertBudgets.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-300 rounded-lg shadow-md mb-6 overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-orange-100 transition-colors rounded-t-lg"
            onClick={() => setAlertsCollapsed(!alertsCollapsed)}
          >
            <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              🔔 Budgets con Recordatorios Activos ({upcomingAlertBudgets.length})
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-orange-600 font-medium">Se mantienen hasta completar</span>
              <svg 
                className={`w-5 h-5 text-orange-600 transition-transform ${alertsCollapsed ? '' : 'rotate-180'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* Contenido colapsable */}
          {!alertsCollapsed && (
            <div className="px-6 pb-6 pt-2 space-y-3">
              {upcomingAlertBudgets.map((budget) => {
                const alert = budget.nearestAlert;
                
                return (
                  <div
                    key={budget.idBudget}
                    className={`border-l-4 rounded-lg p-4 ${
                      alert.isOverdue
                        ? 'bg-red-100 border-red-700'
                        : alert.isToday 
                        ? 'bg-red-50 border-red-600' 
                        : alert.isUrgent 
                          ? 'bg-orange-50 border-orange-500' 
                          : 'bg-white border-gray-300'
                    } hover:shadow-md transition-shadow cursor-pointer`}
                    onClick={() => {
                      setBudgetForNotes(budget);
                      setShowNotesModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">#{budget.idBudget}</span>
                          <span className="text-sm font-medium text-gray-700">{budget.propertyAddress}</span>
                          {alert.isOverdue && (
                            <span className="px-2 py-1 bg-red-700 text-white text-xs font-bold rounded-full">
                              VENCIDO
                            </span>
                          )}
                          {alert.isToday && (
                            <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                              ¡HOY!
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-gray-500">
                            📅 {formatDateTimeInDisplayTz(alert.reminderDate, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className={`px-2 py-1 rounded-full ${
                            alert.isOverdue
                              ? 'bg-red-100 text-red-700'
                              : alert.isUrgent
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {alert.isOverdue
                              ? `${Math.abs(alert.daysRemaining)} ${Math.abs(alert.daysRemaining) === 1 ? 'día vencido' : 'días vencidos'}`
                              : `${alert.daysRemaining} ${alert.daysRemaining === 1 ? 'día restante' : 'días restantes'}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
          <p className="text-gray-600 mt-4">Cargando presupuestos...</p>
        </div>
      )}

      {/* Lista de Presupuestos - Tabla Desktop */}
      {!loading && budgets.length > 0 && (
        <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgets.map((budget) => (
                  <tr key={budget.idBudget} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      #{budget.idBudget}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {budget.Permit?.applicantName || budget.applicantName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                      {budget.Permit?.propertyAddress || budget.propertyAddress || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {budget.contactCompany || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(budget.date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(budget.status)}`}>
                        {budget.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${parseFloat(budget.totalPrice || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Botón Notas y Alertas con Badge Integrado */}
                        <button
                          onClick={() => handleOpenNotes(budget)}
                          className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Ver Notas de Seguimiento y Alertas"
                        >
                          <NotesAlertBadge
                            budgetId={budget.idBudget}
                            alertData={budgetAlerts[budget.idBudget]}
                            className="h-5 w-5"
                          />
                        </button>

                        {/* 👤 Botón Datos del Cliente */}
                        <button
                          onClick={() => setClientPopover(budget)}
                          className="p-1 rounded hover:bg-indigo-100 text-indigo-500 transition-colors"
                          title="Ver datos del cliente"
                        >
                          <UserCircleIcon className="h-5 w-5" />
                        </button>

                        {/* Botón Ya No Requiere Seguimiento */}
                        {!isReadOnly && (
                          <button
                            onClick={() => handleRemoveFromFollowUp(budget.idBudget)}
                            className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Quitar de Seguimiento (no archivar)"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        )}

                        {/* 🗄️ Botón Archivar */}
                        {!isReadOnly && (
                          <button
                            onClick={() => handleArchiveBudget(budget.idBudget)}
                            className="p-1 rounded hover:bg-orange-100 text-orange-600 transition-colors"
                            title="Archivar Presupuesto"
                          >
                            <ArchiveBoxIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de Presupuestos - Cards Mobile */}
      {!loading && budgets.length > 0 && (
        <div className="block md:hidden space-y-4">
          {budgets.map((budget) => (
            <div key={budget.idBudget} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm text-gray-500">Budget #{budget.idBudget}</p>
                  <h3 className="font-semibold text-gray-900">
                    {budget.Permit?.applicantName || budget.applicantName}
                  </h3>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(budget.status)}`}>
                  {budget.status}
                </span>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <p className="text-gray-600">
                  <span className="font-medium">Dirección:</span>{' '}
                  {budget.Permit?.propertyAddress || budget.propertyAddress || 'N/A'}
                </p>
                {budget.contactCompany && (
                  <p className="text-gray-600">
                    <span className="font-medium">Empresa:</span> {budget.contactCompany}
                  </p>
                )}
                <p className="text-gray-600">
                  <span className="font-medium">Fecha:</span> {formatDate(budget.date)}
                </p>
                <p className="text-gray-900 font-semibold">
                  <span className="font-medium">Total:</span> ${parseFloat(budget.totalPrice || 0).toFixed(2)}
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => handleOpenNotes(budget)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors relative"
                >
                  <NotesAlertBadge
                    budgetId={budget.idBudget}
                    alertData={budgetAlerts[budget.idBudget]}
                    className="h-4 w-4"
                  />
                  Notas y Alertas
                </button>

                {/* 👤 Botón Datos del Cliente (mobile) */}
                <button
                  onClick={() => setClientPopover(budget)}
                  className="px-3 py-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                  title="Ver datos del cliente"
                >
                  <UserCircleIcon className="h-4 w-4" />
                </button>

                {!isReadOnly && (
                  <>
                    <button
                      onClick={() => handleRemoveFromFollowUp(budget.idBudget)}
                      className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      title="Quitar de Seguimiento"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleArchiveBudget(budget.idBudget)}
                      className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                      title="Archivar"
                    >
                      <ArchiveBoxIcon className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sin resultados */}
      {!loading && budgets.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <BellIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay presupuestos en seguimiento
          </h3>
          <p className="text-gray-600">
            Los presupuestos marcados para seguimiento aparecerán aquí
          </p>
        </div>
      )}

      {/* Paginación */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-yellow-700 transition-colors"
          >
            Anterior
          </button>
          
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-yellow-700 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal de Notas */}
      {showNotesModal && budgetForNotes && (
        <BudgetNotesModal
          budget={budgetForNotes}
          onClose={handleCloseNotesModal}
          onAlertsChange={reloadBudgetAlerts}
        />
      )}

      {/* 👤 Popover de Datos del Cliente (solo lectura) */}
      {clientPopover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setClientPopover(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <UserCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">Datos del Cliente</h3>
                  <p className="text-indigo-200 text-xs mt-0.5">Budget #{clientPopover.idBudget} · solo lectura</p>
                </div>
              </div>
              <button
                onClick={() => setClientPopover(null)}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors text-indigo-200 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              {/* Nombre */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserCircleIcon className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Nombre</p>
                  <p className="text-sm font-semibold text-gray-800 break-words">
                    {clientPopover.Permit?.applicantName || clientPopover.applicantName || <span className="text-gray-400 italic">Sin nombre</span>}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <EnvelopeIcon className="h-5 w-5 text-sky-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                  {(clientPopover.Permit?.applicantEmail || clientPopover.applicantEmail) ? (
                    <a
                      href={`mailto:${clientPopover.Permit?.applicantEmail || clientPopover.applicantEmail}`}
                      className="text-sm text-sky-600 hover:text-sky-800 hover:underline break-all font-medium"
                    >
                      {clientPopover.Permit?.applicantEmail || clientPopover.applicantEmail}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Sin email</p>
                  )}
                </div>
              </div>

              {/* Teléfono */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <PhoneIcon className="h-5 w-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Teléfono</p>
                  {(clientPopover.Permit?.applicantPhone || clientPopover.applicantPhone) ? (
                    <a
                      href={`tel:${clientPopover.Permit.applicantPhone || clientPopover.applicantPhone}`}
                      className="text-sm text-violet-600 hover:text-violet-800 hover:underline font-medium"
                    >
                      {clientPopover.Permit.applicantPhone || clientPopover.applicantPhone}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Sin teléfono</p>
                  )}
                </div>
              </div>

              {/* Empresa */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BuildingOfficeIcon className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Empresa</p>
                  <p className="text-sm font-medium text-gray-800 break-words">
                    {clientPopover.contactCompany || <span className="text-gray-400 italic">Sin empresa</span>}
                  </p>
                </div>
              </div>

              {/* Dirección */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Dirección</p>
                  <p className="text-sm font-medium text-gray-800 break-words">
                    {clientPopover.Permit?.propertyAddress || clientPopover.propertyAddress || <span className="text-gray-400 italic">Sin dirección</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setClientPopover(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpBudgets;
