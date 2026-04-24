import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchLeads,
  updateLead,
  archiveLead,
  deleteLead
} from '../../Redux/Actions/salesLeadActions';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  TagIcon,
  XCircleIcon,
  ArchiveBoxIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  BellIcon,
  PencilSquareIcon,
  TrashIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import LeadNotesModal from './LeadNotesModal';
import EditLeadModal from './EditLeadModal';
import SendProposalModal from './SendProposalModal';
import WeeklyActivityReport from './WeeklyActivityReport';
import api from '../../utils/axios';

// 🔔 Componente de badge de alertas para leads
const LeadAlertBadge = ({ leadId, alertData, className = "h-5 w-5" }) => {
  if (!alertData) {
    return <ChatBubbleLeftRightIcon className={className} />;
  }

  const { unread, overdue, upcoming, hasOverdue, hasUnread, hasUpcoming, total } = alertData;

  // Determinar color del badge según prioridad
  let badgeColor = 'bg-gray-400';
  let shouldPulse = false;

  if (hasOverdue) {
    badgeColor = 'bg-red-500';
    shouldPulse = true;
  } else if (hasUnread) {
    badgeColor = 'bg-yellow-500';
    shouldPulse = false;
  } else if (hasUpcoming) {
    badgeColor = 'bg-green-500';
    shouldPulse = false;
  }

  const hasAnyAlert = hasUnread || hasOverdue || hasUpcoming;

  return (
    <div className="relative inline-block">
      <ChatBubbleLeftRightIcon className={className} />
      {hasAnyAlert && (
        <span
          className={`absolute -top-2 -right-2 ${badgeColor} text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ${
            shouldPulse ? 'animate-pulse' : ''
          }`}
          title={
            hasOverdue 
              ? '¡Recordatorio vencido!' 
              : hasUnread 
              ? 'Notas no leídas' 
              : 'Recordatorio próximo'
          }
        >
          {total > 0 ? (total > 9 ? '9+' : total) : '!'}
        </span>
      )}
    </div>
  );
};

const STATUS_LABELS = {
  new: 'Nuevo',
  contacted: 'Contactado',
  no_answer: 'No Contesta',
  interested: 'Interesado',
  quoted: 'Cotizado',
  negotiating: 'Negociando',
  won: 'Ganado',
  lost: 'Perdido',
  archived: 'Archivado'
};

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-cyan-100 text-cyan-800',
  no_answer: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-400',
  interested: 'bg-green-100 text-green-800',
  quoted: 'bg-purple-100 text-purple-800 ring-2 ring-purple-400 font-bold',
  negotiating: 'bg-orange-100 text-orange-800',
  won: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-800'
};

const PRIORITY_COLORS = {
  low: 'border-l-4 border-gray-300',
  medium: 'border-l-4 border-yellow-400',
  high: 'border-l-4 border-orange-500',
  urgent: 'border-l-4 border-red-600'
};

const SalesLeads = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Estados de Redux
  const { leads, loading, stats, total, page: reduxPage, pageSize: reduxPageSize, totalPages } = useSelector((state) => state.salesLeads);
  const { currentStaff } = useSelector((state) => state.auth);
  const userRole = currentStaff?.role || '';

  // Verificar permisos
  const canAccess = ['admin', 'owner', 'recept', 'sales_rep', 'follow-up'].includes(userRole);

  // Estados locales
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Estados para modal de notas
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Estados para modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState(null);

  // Estados para modal de propuesta
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [leadForProposal, setLeadForProposal] = useState(null);
  const [proposalSentLeads, setProposalSentLeads] = useState(new Set());

  // 📈 Estados para métricas de actividad
  const [activityMetrics, setActivityMetrics] = useState(null);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  // � Estado para modal de reporte semanal
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);

  // �🚫 Estado para modal de limpieza sin contacto
  const [noContactLeads, setNoContactLeads] = useState([]);
  const [showNoContactModal, setShowNoContactModal] = useState(false);
  const [loadingNoContact, setLoadingNoContact] = useState(false);
  const [selectedNoContactIds, setSelectedNoContactIds] = useState(new Set());

  // 📵 Estado para leads con múltiples intentos sin respuesta
  const [noAnswerLeads, setNoAnswerLeads] = useState([]);
  const [showNoAnswerModal, setShowNoAnswerModal] = useState(false);
  const [loadingNoAnswer, setLoadingNoAnswer] = useState(false);
  const [noAnswerLeadIds, setNoAnswerLeadIds] = useState(new Set());

  // Sincronizar propuestas enviadas desde la DB (persiste entre sesiones y dispositivos)
  useEffect(() => {
    if (leads.length > 0) {
      const sentIds = leads.filter(l => l.proposalSentAt).map(l => l.id);
      if (sentIds.length > 0) {
        setProposalSentLeads(prev => new Set([...prev, ...sentIds]));
      }
    }
  }, [leads]);

  // � Agrupación por contacto duplicado
  const [groupDuplicates, setGroupDuplicates] = useState(false);

  // _groupType viene del backend cuando groupDuplicates está activo (calculado en DB,
  // funciona en TODAS las páginas, no solo la actual).
  const displayedLeads = useMemo(() => {
    if (leads.length === 0) return leads;
    if (groupDuplicates) {
      return leads.map(l => ({ ...l, _groupType: l.groupType || null }));
    }
    return leads.map(l => ({ ...l, _groupType: null }));
  }, [leads, groupDuplicates]);

  // Conteo de duplicados en la página actual (para el badge del botón)
  const duplicateCount = useMemo(() =>
    displayedLeads.filter(l => l._groupType).length,
  [displayedLeads]);
  // 🔔 Estados para alertas de notas
  const [leadAlerts, setLeadAlerts] = useState({});
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [verifyingReminders, setVerifyingReminders] = useState(false);
  const [upcomingAlertLeads, setUpcomingAlertLeads] = useState([]);
  const [alertsCollapsed, setAlertsCollapsed] = useState(true);

  // Formato de fecha
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // Formato de fecha relativa (hace X días)
  const getRelativeTime = (dateString) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return `Hace ${Math.floor(diffDays / 30)} meses`;
  };

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar leads cuando cambian filtros
  useEffect(() => {
    if (canAccess) {
      loadLeads();
    }
  }, [page, debouncedSearchTerm, statusFilter, priorityFilter, sourceFilter, groupDuplicates, canAccess]);

  const loadLeads = async () => {
    try {
      await dispatch(fetchLeads({
        page,
        pageSize,
        search: debouncedSearchTerm,
        status: statusFilter,
        priority: priorityFilter,
        source: sourceFilter,
        sortBy: groupDuplicates ? 'contact_group' : 'lastActivityDate'
      }));
    } catch (error) {
      console.error('Error al cargar leads:', error);
    }
  };

  // 🔔 Cargar alertas de notas para todos los leads
  const loadLeadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const [alertsResponse, upcomingResponse] = await Promise.all([
        api.get('/lead-notes/alerts/leads'),
        api.get('/lead-notes/alerts/upcoming?days=7')
      ]);

      const alertsMap = {};
      if (alertsResponse.data && Array.isArray(alertsResponse.data)) {
        alertsResponse.data.forEach(alertInfo => {
          alertsMap[alertInfo.leadId] = alertInfo;
        });
      }
      setLeadAlerts(alertsMap);

      if (upcomingResponse.data?.leads) {
        setUpcomingAlertLeads(upcomingResponse.data.leads);
      }
    } catch (error) {
      console.error('Error al cargar alertas de leads:', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // 📵 Cargar IDs de leads con múltiples intentos sin respuesta (para badges)
  const loadNoAnswerLeadIds = async () => {
    try {
      const response = await api.get('/sales-leads/alerts/no-answer?minAttempts=3');
      const ids = new Set((response.data.leads || []).map(l => l.id));
      setNoAnswerLeadIds(ids);
    } catch (error) {
      console.error('Error al cargar IDs de leads sin respuesta:', error);
    }
  };

  // Cargar alertas al montar y cada 5 minutos
  useEffect(() => {
    if (canAccess) {
      loadLeadAlerts();
      loadActivityMetrics();
      loadNoAnswerLeadIds();
      
      const interval = setInterval(() => {
        loadLeadAlerts();
      }, 5 * 60 * 1000); // Cada 5 minutos
      
      return () => clearInterval(interval);
    }
  }, [canAccess]);

  // 📈 Cargar métricas de actividad
  const loadActivityMetrics = async () => {
    try {
      const response = await api.get('/sales-leads/activity/metrics');
      setActivityMetrics(response.data);
    } catch (error) {
      console.error('Error al cargar métricas:', error);
    }
  };

  // 🚫 Cargar leads sin teléfono ni email
  const handleOpenNoContactModal = async () => {
    setLoadingNoContact(true);
    setShowNoContactModal(true);
    try {
      const response = await api.get('/sales-leads/no-contact');
      setNoContactLeads(response.data.leads || []);
      setSelectedNoContactIds(new Set((response.data.leads || []).map(l => l.id)));
    } catch (error) {
      alert('Error al cargar leads sin contacto: ' + error.message);
      setShowNoContactModal(false);
    } finally {
      setLoadingNoContact(false);
    }
  };

  // 📵 Cargar leads con múltiples intentos sin respuesta
  const handleOpenNoAnswerModal = async () => {
    setLoadingNoAnswer(true);
    setShowNoAnswerModal(true);
    try {
      const response = await api.get('/sales-leads/alerts/no-answer?minAttempts=3');
      setNoAnswerLeads(response.data.leads || []);
      setNoAnswerLeadIds(new Set((response.data.leads || []).map(l => l.id)));
    } catch (error) {
      alert('Error al cargar leads sin respuesta: ' + error.message);
      setShowNoAnswerModal(false);
    } finally {
      setLoadingNoAnswer(false);
    }
  };

  const handleDeleteNoContact = async () => {
    if (selectedNoContactIds.size === 0) return;
    if (!window.confirm(`⚠️ Eliminar ${selectedNoContactIds.size} leads sin teléfono ni email?\n\nEsta acción NO se puede deshacer.`)) return;
    try {
      await api.delete('/sales-leads/no-contact/bulk', { data: { ids: [...selectedNoContactIds] } });
      setShowNoContactModal(false);
      setNoContactLeads([]);
      loadLeads();
      loadActivityMetrics();
      alert(`✅ ${selectedNoContactIds.size} leads eliminados`);
      setSelectedNoContactIds(new Set());
    } catch (error) {
      alert('Error al eliminar: ' + (error.response?.data?.error || error.message));
    }
  };

  // 🔔 Verificar recordatorios manualmente (ejecuta el cron ahora)
  const handleCheckReminders = async () => {
    if (verifyingReminders) return;

    const confirm = window.confirm(
      '¿Ejecutar ahora la verificación de recordatorios de leads?\n\n' +
      'Esto buscará recordatorios programados para mañana (24hs antes) ' +
      'y enviará emails a los usuarios correspondientes.'
    );

    if (!confirm) return;

    setVerifyingReminders(true);
    try {
      const response = await api.post('/sales-leads/check-reminders');
      if (response.data.success) {
        alert('✅ Verificación de recordatorios completada\n\nRevisa los logs del servidor para ver los detalles de los emails enviados.');
        await loadLeadAlerts();
      }
    } catch (error) {
      console.error('Error verificando recordatorios:', error);
      alert(`❌ Error al verificar recordatorios:\n${error.response?.data?.details || error.message}`);
    } finally {
      setVerifyingReminders(false);
    }
  };

  // Handler para cambiar estado rápido
  const handleQuickStatusChange = async (leadId, newStatus) => {
    try {
      await dispatch(updateLead({ id: leadId, updates: { status: newStatus } }));
      loadLeads();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado del lead');
    }
  };

  // Handler para archivar
  const handleArchive = async (leadId) => {
    if (!window.confirm('¿Archivar este lead?')) return;
    
    try {
      await dispatch(archiveLead(leadId));
      loadLeads();
    } catch (error) {
      console.error('Error al archivar lead:', error);
      alert('Error al archivar el lead');
    }
  };

  // Handler para eliminar permanentemente (solo admin/owner)
  const handleDelete = async (leadId, leadName) => {
    const confirmMessage = `⚠️ ELIMINAR PERMANENTEMENTE\n\nEsto eliminará "${leadName}" y todas sus notas asociadas.\n\n¿Estás seguro? Esta acción NO se puede deshacer.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    // Doble confirmación
    const finalConfirm = window.confirm('¿Realmente deseas eliminar este lead permanentemente?');
    if (!finalConfirm) return;

    try {
      await dispatch(deleteLead(leadId));
      loadLeads();
      loadLeadAlerts();
    } catch (error) {
      console.error('Error al eliminar lead:', error);
      alert(error.response?.data?.error || 'Error al eliminar el lead');
    }
  };

  // Handler para abrir modal de notas
  const handleOpenNotes = (lead) => {
    setSelectedLead(lead);
    setShowNotesModal(true);
  };

  // Handler para cerrar modal de notas y recargar alertas
  const handleCloseNotesModal = () => {
    setShowNotesModal(false);
    setSelectedLead(null);
    // Recargar lista y alertas
    loadLeads();
    loadLeadAlerts();
  };

  // Handlers para modal de edición
  const handleOpenEdit = (lead) => {
    setLeadToEdit(lead);
    setShowEditModal(true);
  };

  const handleCloseEdit = () => {
    setShowEditModal(false);
    setLeadToEdit(null);
  };

  const handleSaveLead = async (leadId, formData) => {
    console.log('💾 Saving lead:', leadId, formData);
    await dispatch(updateLead({ id: leadId, updates: formData }));
    loadLeads();
    loadLeadAlerts();
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <UserCircleIcon className="h-7 w-7 md:h-8 md:w-8 text-blue-600" />
              Sales Leads
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Lead management and sales pipeline tracking
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 🔔 Botón Verificar Recordatorios */}
            <button
              onClick={handleCheckReminders}
              disabled={verifyingReminders}
              className={`inline-flex items-center px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium text-sm transition-all ${
                verifyingReminders
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg'
              }`}
            >
              {verifyingReminders ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verificando...
                </>
              ) : (
                <>
                  <span className="text-lg mr-2">🔔</span>
                  Verificar Recordatorios
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/sales-leads/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg hover:shadow-xl text-sm md:text-base"
            >
              <PlusIcon className="h-5 w-5" />
              New Lead
            </button>
            {/* 📊 Botón reporte semanal */}
            <button
              onClick={() => setShowWeeklyReport(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-300 hover:bg-indigo-100 text-sm font-medium transition-colors"
              title="Ver reporte semanal de actividad"
            >
              <ChartBarIcon className="h-5 w-5" />
              <span className="hidden md:inline">Reporte Semanal</span>
            </button>
            {/* 🧹 Botón limpiar sin contacto (solo admin/owner) */}
            {(currentStaff?.role === 'admin' || currentStaff?.role === 'owner') && activityMetrics?.noContactCount > 0 && (
              <button
                onClick={handleOpenNoContactModal}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 text-sm font-medium"
                title="Leads sin teléfono ni email"
              >
                🚫 Sin contacto
                <span className="px-1.5 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold">
                  {activityMetrics.noContactCount}
                </span>
              </button>
            )}
            {/* 📵 Botón leads sin respuesta */}
            {noAnswerLeadIds.size > 0 && (
              <button
                onClick={handleOpenNoAnswerModal}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100 text-sm font-medium"
                title="Leads con múltiples intentos sin respuesta"
              >
                📵 No contestan
                <span className="px-1.5 py-0.5 bg-yellow-600 text-white text-xs rounded-full font-bold">
                  {noAnswerLeadIds.size}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 📈 Panel de Métricas de Actividad */}
      {activityMetrics && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <button
            onClick={() => setMetricsExpanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📈</span>
              <span className="font-semibold text-gray-800 text-sm md:text-base">Métricas de Actividad</span>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  +{activityMetrics.new.weekly.current} nuevos esta semana
                </span>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {activityMetrics.contacted.weekly.current} contactados esta semana
                </span>
              </div>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${metricsExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {metricsExpanded && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {/* Nuevos contactos */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <span>👤</span> Nuevos Contactos
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Semanal */}
                    <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                      <p className="text-xs text-gray-500 mb-1">Esta semana</p>
                      <p className="text-2xl font-bold text-blue-600">{activityMetrics.new.weekly.current}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {activityMetrics.new.weekly.current >= activityMetrics.new.weekly.previous ? (
                          <span className="text-green-600 text-xs font-medium">▲</span>
                        ) : (
                          <span className="text-red-500 text-xs font-medium">▼</span>
                        )}
                        <span className="text-xs text-gray-400">vs {activityMetrics.new.weekly.previous} sem. ant.</span>
                      </div>
                    </div>
                    {/* Quincenal */}
                    <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                      <p className="text-xs text-gray-500 mb-1">Últimos 15 días</p>
                      <p className="text-2xl font-bold text-blue-500">{activityMetrics.new.biweekly}</p>
                    </div>
                    {/* Mensual */}
                    <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                      <p className="text-xs text-gray-500 mb-1">Último mes</p>
                      <p className="text-2xl font-bold text-blue-400">{activityMetrics.new.monthly}</p>
                    </div>
                  </div>
                </div>

                {/* Contactados */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                    <span>📞</span> Contactos Realizados
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Semanal */}
                    <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                      <p className="text-xs text-gray-500 mb-1">Esta semana</p>
                      <p className="text-2xl font-bold text-green-600">{activityMetrics.contacted.weekly.current}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {activityMetrics.contacted.weekly.current >= activityMetrics.contacted.weekly.previous ? (
                          <span className="text-green-600 text-xs font-medium">▲</span>
                        ) : (
                          <span className="text-red-500 text-xs font-medium">▼</span>
                        )}
                        <span className="text-xs text-gray-400">vs {activityMetrics.contacted.weekly.previous} sem. ant.</span>
                      </div>
                    </div>
                    {/* Quincenal */}
                    <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                      <p className="text-xs text-gray-500 mb-1">Últimos 15 días</p>
                      <p className="text-2xl font-bold text-green-500">{activityMetrics.contacted.biweekly}</p>
                    </div>
                    {/* Mensual */}
                    <div className="bg-white rounded-lg p-3 shadow-sm text-center">
                      <p className="text-xs text-gray-500 mb-1">Último mes</p>
                      <p className="text-2xl font-bold text-green-400">{activityMetrics.contacted.monthly}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas por Estado - Botones Clickeables */}
      {stats && Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          {Object.entries(stats).map(([status, count]) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => { 
                  setStatusFilter(isActive ? 'all' : status); 
                  setPage(1); 
                }}
                className={`p-4 rounded-lg shadow border text-left transition-all cursor-pointer
                  ${isActive
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400'
                    : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
              >
                <p className={`text-sm uppercase font-semibold ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>
                  {STATUS_LABELS[status] || status}
                </p>
                <p className={`text-2xl font-bold ${isActive ? 'text-blue-600' : 'text-gray-800'}`}>
                  {count}
                </p>
              </button>
            );
          })}
          <button
            onClick={() => { 
              setStatusFilter('all'); 
              setPage(1); 
            }}
            className={`p-4 rounded-lg shadow border text-left transition-all cursor-pointer
              ${statusFilter === 'all'
                ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500'
                : 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:shadow-md'
              }`}
          >
            <p className="text-sm text-blue-800 uppercase font-semibold">Total</p>
            <p className="text-2xl font-bold text-blue-600">{total || 0}</p>
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div className="md:col-span-2">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, email, teléfono, dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filtro de estado */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Filtro de prioridad */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las prioridades</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
        </div>

        {/* Botón agrupar duplicados */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={() => { setGroupDuplicates(v => !v); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              groupDuplicates
                ? 'bg-orange-600 text-white border-orange-600 hover:bg-orange-700'
                : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
            }`}
          >
            🔗 {groupDuplicates ? 'Agrupado por contacto' : 'Agrupar por contacto'}
            {duplicateCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                groupDuplicates ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-700'
              }`}>
                {duplicateCount}
              </span>
            )}
          </button>
          {groupDuplicates && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-400"></span> Mismo email</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400"></span> Mismo teléfono</span>
            </div>
          )}
        </div>
      </div>

      {/* 🔔 Panel de Alertas Próximas - DESPLEGABLE */}
      {upcomingAlertLeads.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-200 rounded-lg shadow-md mb-6">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-orange-100 transition-colors rounded-t-lg"
            onClick={() => setAlertsCollapsed(!alertsCollapsed)}
          >
            <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              🔔 Leads con Recordatorios Pendientes ({upcomingAlertLeads.length})
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-orange-600 font-medium">Hasta completarlas</span>
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

          {!alertsCollapsed && (
            <div className="px-6 pb-6 pt-2 space-y-3">
              {upcomingAlertLeads.map((lead) => {
                const alert = lead.nearestAlert;
                const priorityColors = {
                  urgent: 'bg-red-100 border-red-400 text-red-800',
                  high: 'bg-orange-100 border-orange-400 text-orange-800',
                  medium: 'bg-yellow-100 border-yellow-400 text-yellow-800',
                  low: 'bg-blue-100 border-blue-400 text-blue-800'
                };
                const priorityIcons = { urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' };

                return (
                  <div
                    key={lead.id}
                    className={`border-l-4 rounded-lg p-4 ${
                      alert.isOverdue ? 'bg-red-50 border-red-700' :
                      alert.isToday ? 'bg-red-50 border-red-600' :
                      alert.isUrgent ? 'bg-orange-50 border-orange-500' :
                      'bg-white border-gray-300'
                    } hover:shadow-md transition-shadow cursor-pointer`}
                    onClick={() => handleOpenNotes(lead)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-bold text-gray-900">{lead.applicantName}</span>
                          <span className="text-sm font-medium text-gray-700">{lead.propertyAddress}</span>
                          {alert.isOverdue && (
                            <span className="px-2 py-1 bg-red-700 text-white text-xs font-bold rounded-full animate-pulse">
                              ⚠️ VENCIDA ({Math.abs(alert.daysRemaining)}d)
                            </span>
                          )}
                          {!alert.isOverdue && alert.isToday && (
                            <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                              ¡HOY!
                            </span>
                          )}
                          {!alert.isOverdue && !alert.isToday && alert.isUrgent && (
                            <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                              {alert.daysRemaining} día{alert.daysRemaining !== 1 ? 's' : ''}
                            </span>
                          )}
                          {!alert.isOverdue && !alert.isToday && !alert.isUrgent && (
                            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full">
                              {alert.daysRemaining} día{alert.daysRemaining !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border ${priorityColors[alert.priority] || priorityColors.low}`}>
                            {priorityIcons[alert.priority] || '⚪'} {(alert.priority || 'low').toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-600">
                            {(alert.noteType || '').replace('_', ' ').toUpperCase()}
                          </span>
                          {lead.alertCount > 1 && (
                            <span className="text-xs text-gray-500">(+{lead.alertCount - 1} más)</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">{alert.message}</p>
                        {alert.author && (
                          <p className="text-xs text-gray-500 mt-2">Por: {alert.author.name}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenNotes(lead); }}
                        className="ml-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        📝 Ver Notas
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lista de Leads - Tabla Desktop */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <UserCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
          <p className="text-gray-600">Start by adding your first sales lead</p>
        </div>
      ) : (
        <>
          {/* Vista Mobile — Tarjetas */}
          <div className="block md:hidden space-y-3">
            {displayedLeads.map((lead) => (
              <div key={lead.id} className={`bg-white rounded-lg shadow-sm p-4 border-l-4 border border-gray-100 ${
                lead._groupType === 'email' ? 'border-l-orange-400' :
                lead._groupType === 'phone' ? 'border-l-blue-400' : 'border-l-gray-100'
              }`}>
                {/* Cabecera: nombre + badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{lead.applicantName}</p>
                    {lead._groupType && (
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full mt-0.5 ${
                        lead._groupType === 'email' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {lead._groupType === 'email' ? '📧 mismo email' : '📞 mismo tel.'}
                      </span>
                    )}
                    {lead.propertyAddress && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{lead.propertyAddress}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {lead.status === 'quoted' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-500 text-white flex items-center gap-1">
                        <DocumentTextIcon className="h-3 w-3" />
                        COTIZADO
                      </span>
                    )}
                    {noAnswerLeadIds.has(lead.id) && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500 text-white flex items-center gap-1">
                        📵 No responde
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      lead.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      lead.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {lead.priority === 'urgent' ? '⚡ Urgent' :
                       lead.priority === 'high' ? 'High' :
                       lead.priority === 'medium' ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>

                {/* Contacto */}
                <div className="text-sm text-gray-600 space-y-0.5 mb-3">
                  {lead.applicantPhone && (
                    <div className="flex items-center gap-1">
                      <PhoneIcon className="h-3 w-3 shrink-0" />
                      <span>{lead.applicantPhone}</span>
                    </div>
                  )}
                  {lead.applicantEmail && (
                    <div className="flex items-center gap-1">
                      <EnvelopeIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.applicantEmail}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">{getRelativeTime(lead.lastActivityDate)}</div>
                </div>

                {/* Estado + Acciones */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <select
                    value={lead.status}
                    onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                    className={`px-2 py-1 text-xs font-medium rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[lead.status]}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenNotes(lead)}
                      className="p-1.5 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                      title="Ver Notas"
                    >
                      <LeadAlertBadge leadId={lead.id} alertData={leadAlerts[lead.id]} className="h-5 w-5" />
                    </button>

                    {lead.status !== 'won' && lead.status !== 'archived' && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(lead)}
                          className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                          title="Editar"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>

                        <button
                          onClick={() => { setLeadForProposal(lead); setShowProposalModal(true); }}
                          className={`p-1.5 rounded transition-colors ${
                            proposalSentLeads.has(lead.id)
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600'
                          }`}
                          title="Enviar Propuesta"
                        >
                          <EnvelopeIcon className="h-5 w-5" />
                        </button>

                        <button
                          onClick={() => handleQuickStatusChange(lead.id, lead.status === 'lost' ? 'contacted' : 'lost')}
                          className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                          title={lead.status === 'lost' ? 'Reactivar' : 'Marcar como perdido'}
                        >
                          {lead.status === 'lost' ? <ArrowPathIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
                        </button>

                        <button
                          onClick={() => handleArchive(lead.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Archivar"
                        >
                          <ArchiveBoxIcon className="h-5 w-5" />
                        </button>

                        {(currentStaff?.role === 'admin' || currentStaff?.role === 'owner') && (
                          <button
                            onClick={() => handleDelete(lead.id, lead.applicantName)}
                            className="p-1.5 rounded hover:bg-red-100 text-red-700 transition-colors"
                            title="Eliminar"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Vista Desktop — Tabla */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Actividad</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedLeads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-gray-50 ${
                    lead._groupType === 'email' ? 'border-l-4 border-l-orange-400' :
                    lead._groupType === 'phone' ? 'border-l-4 border-l-blue-400' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-gray-900">{lead.applicantName}</span>
                        {lead._groupType && (
                          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                            lead._groupType === 'email' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {lead._groupType === 'email' ? '📧 mismo email' : '📞 mismo tel.'}
                          </span>
                        )}
                        {lead.status === 'quoted' && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500 text-white flex items-center gap-1 animate-pulse">
                            <DocumentTextIcon className="h-3 w-3" />
                            COTIZADO
                          </span>
                        )}
                        {noAnswerLeadIds.has(lead.id) && (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-white flex items-center gap-1">
                            📵 No responde
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="space-y-1">
                        {lead.applicantEmail && (
                          <div className="flex items-center gap-1">
                            <EnvelopeIcon className="h-3 w-3" />
                            <span className="truncate max-w-xs">{lead.applicantEmail}</span>
                          </div>
                        )}
                        {lead.applicantPhone && (
                          <div className="flex items-center gap-1">
                            <PhoneIcon className="h-3 w-3" />
                            <span>{lead.applicantPhone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                      {lead.propertyAddress || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => handleQuickStatusChange(lead.id, e.target.value)}
                        className={`px-2 py-1 text-xs font-medium rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 ${STATUS_COLORS[lead.status]}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        lead.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        lead.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        lead.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {lead.priority === 'urgent' && '⚡ '}
                        {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {getRelativeTime(lead.lastActivityDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenNotes(lead)}
                          className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Ver Notas y Alertas"
                        >
                          <LeadAlertBadge
                            leadId={lead.id}
                            alertData={leadAlerts[lead.id]}
                            className="h-5 w-5"
                          />
                        </button>

                        {lead.status !== 'won' && lead.status !== 'archived' && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(lead)}
                              className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                              title="Editar Lead"
                            >
                              <PencilSquareIcon className="h-5 w-5" />
                            </button>

                            <button
                              onClick={() => { setLeadForProposal(lead); setShowProposalModal(true); }}
                              className={`p-1 rounded transition-colors ${
                                proposalSentLeads.has(lead.id)
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                  : 'hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600'
                              }`}
                              title={proposalSentLeads.has(lead.id) ? '✅ Proposal sent — click to resend' : 'Send Proposal Email'}
                            >
                              <EnvelopeIcon className="h-5 w-5" />
                            </button>

                            <button
                              onClick={() => handleQuickStatusChange(lead.id, lead.status === 'lost' ? 'contacted' : 'lost')}
                              className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                              title={lead.status === 'lost' ? "Reactivar" : "Marcar como perdido"}
                            >
                              {lead.status === 'lost' ? <ArrowPathIcon className="h-5 w-5" /> : <XCircleIcon className="h-5 w-5" />}
                            </button>

                            <button
                              onClick={() => handleArchive(lead.id)}
                              className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                              title="Archivar"
                            >
                              <ArchiveBoxIcon className="h-5 w-5" />
                            </button>

                            {/* Eliminar permanentemente - Solo admin/owner */}
                            {(currentStaff?.role === 'admin' || currentStaff?.role === 'owner') && (
                              <button
                                onClick={() => handleDelete(lead.id, lead.customerName)}
                                className="p-1 rounded hover:bg-red-100 text-red-700 transition-colors"
                                title="Eliminar permanentemente (solo admin/owner)"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-wrap justify-center items-center gap-1">
          {/* Primera + Anterior */}
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
            title="Primera página"
          >
            «
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            ‹ Anterior
          </button>

          {/* Números de página con ventana deslizante */}
          {(() => {
            const pages = [];
            const delta = 2; // páginas a cada lado de la actual
            const left = Math.max(1, page - delta);
            const right = Math.min(totalPages, page + delta);

            if (left > 1) {
              pages.push(
                <button key={1} onClick={() => setPage(1)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                  1
                </button>
              );
              if (left > 2) pages.push(<span key="left-ellipsis" className="px-2 py-2 text-gray-400">…</span>);
            }

            for (let i = left; i <= right; i++) {
              pages.push(
                <button key={i} onClick={() => setPage(i)}
                  className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    i === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}>
                  {i}
                </button>
              );
            }

            if (right < totalPages) {
              if (right < totalPages - 1) pages.push(<span key="right-ellipsis" className="px-2 py-2 text-gray-400">…</span>);
              pages.push(
                <button key={totalPages} onClick={() => setPage(totalPages)}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                  {totalPages}
                </button>
              );
            }

            return pages;
          })()}

          {/* Siguiente + Última */}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            Siguiente ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-2 border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
            title="Última página"
          >
            »
          </button>

          <span className="px-3 py-2 text-sm text-gray-500">
            {total} leads
          </span>
        </div>
      )}

      {/* Modal de Notas */}
      {showNotesModal && selectedLead && (
        <LeadNotesModal
          lead={selectedLead}
          onClose={handleCloseNotesModal}
          onNoteRead={loadLeadAlerts}
        />
      )}

      {/* Modal de Edición */}
      {showEditModal && leadToEdit && (
        <EditLeadModal
          lead={leadToEdit}
          onClose={handleCloseEdit}
          onSave={handleSaveLead}
        />
      )}

      {showProposalModal && leadForProposal && (
        <SendProposalModal
          lead={leadForProposal}
          onClose={() => { setShowProposalModal(false); setLeadForProposal(null); }}
          onSent={(leadId) => {
            setProposalSentLeads(prev => new Set([...prev, leadId]));
            loadLeads();
          }}
        />
      )}

      {/* � Modal Reporte Semanal */}
      {showWeeklyReport && (
        <WeeklyActivityReport
          onClose={() => setShowWeeklyReport(false)}
        />
      )}

      {/* �🚫 Modal Leads Sin Contacto */}
      {showNoContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  🚫 Leads Sin Teléfono ni Email
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Estos contactos no pueden ser alcanzados. Podés eliminarlos para limpiar la base.
                </p>
              </div>
              <button onClick={() => setShowNoContactModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingNoContact ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  <span className="ml-3 text-gray-600">Buscando leads...</span>
                </div>
              ) : noContactLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl">✅</span>
                  <p className="mt-2 font-medium">No hay leads sin datos de contacto</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">
                      {selectedNoContactIds.size} de {noContactLeads.length} seleccionados
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedNoContactIds(new Set(noContactLeads.map(l => l.id)))}
                        className="text-xs text-blue-600 hover:underline"
                      >Seleccionar todos</button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setSelectedNoContactIds(new Set())}
                        className="text-xs text-gray-500 hover:underline"
                      >Ninguno</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {noContactLeads.map(lead => (
                      <div
                        key={lead.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedNoContactIds.has(lead.id)
                            ? 'bg-red-50 border-red-300'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedNoContactIds(prev => {
                          const next = new Set(prev);
                          next.has(lead.id) ? next.delete(lead.id) : next.add(lead.id);
                          return next;
                        })}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNoContactIds.has(lead.id)}
                          onChange={() => {}}
                          className="h-4 w-4 text-red-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{lead.applicantName || 'Sin nombre'}</p>
                          <p className="text-xs text-gray-500 truncate">{lead.propertyAddress || 'Sin dirección'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-gray-400">{lead.source || 'manual'}</span>
                          <p className="text-xs text-gray-400">
                            {new Date(lead.createdAt).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!loadingNoContact && noContactLeads.length > 0 && (
              <div className="border-t p-4 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-500">
                  {selectedNoContactIds.size} leads seleccionados para eliminar
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNoContactModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteNoContact}
                    disabled={selectedNoContactIds.size === 0}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    🗑️ Eliminar {selectedNoContactIds.size} leads
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📵 Modal Leads Sin Respuesta */}
      {showNoAnswerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b bg-yellow-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  📵 Leads con Múltiples Intentos Sin Respuesta
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  Estos leads tienen 3 o más notas de "no contestó". Requieren atención o estrategia diferente.
                </p>
              </div>
              <button onClick={() => setShowNoAnswerModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingNoAnswer ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                  <span className="ml-3 text-gray-600">Buscando leads...</span>
                </div>
              ) : noAnswerLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl">✅</span>
                  <p className="mt-2 font-medium">No hay leads con múltiples intentos sin respuesta</p>
                  <p className="text-sm text-gray-400 mt-1">Todos los leads están siendo contactados exitosamente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {noAnswerLeads.map(lead => (
                    <div
                      key={lead.id}
                      className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors cursor-pointer"
                      onClick={() => {
                        setShowNoAnswerModal(false);
                        handleShowNotes(lead);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">{lead.applicantName || 'Sin nombre'}</p>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500 text-white">
                              {lead.noAnswerCount || 3} intentos
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            {lead.propertyAddress && (
                              <p className="flex items-center gap-1">
                                <MapPinIcon className="h-3 w-3" />
                                {lead.propertyAddress}
                              </p>
                            )}
                            {lead.applicantPhone && (
                              <p className="flex items-center gap-1">
                                <PhoneIcon className="h-3 w-3" />
                                {lead.applicantPhone}
                              </p>
                            )}
                            {lead.applicantEmail && (
                              <p className="flex items-center gap-1 truncate">
                                <EnvelopeIcon className="h-3 w-3" />
                                {lead.applicantEmail}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[lead.status]}`}>
                            {STATUS_LABELS[lead.status]}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            Último intento: {lead.lastNoAnswerDate 
                              ? new Date(lead.lastNoAnswerDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-yellow-200">
                        <p className="text-xs text-gray-600">
                          💡 <strong>Sugerencia:</strong> Considera cambiar el horario de llamada, enviar un email, o actualizar el estado del lead.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loadingNoAnswer && noAnswerLeads.length > 0 && (
              <div className="border-t p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {noAnswerLeads.length} leads requieren seguimiento especial
                  </span>
                  <button
                    onClick={() => setShowNoAnswerModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesLeads;
