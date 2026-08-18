import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../utils/axios';
import MentionTextarea from '../Common/MentionTextarea';
import MessageWithMentions from '../Common/MessageWithMentions';
import NotesAlertBadge from '../Common/NotesAlertBadge';

const SalesDashboard = () => {
  const { user } = useSelector(state => state.auth);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  
  // Filtros
  const [filters, setFilters] = useState({
    budgetStatus: '',
    workStatus: '',
    month: '',  // Sin filtro de mes por defecto
    year: ''    // Sin filtro de año por defecto
  });

  // Estado de vista activa (budgets o works)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'budgets';
  const setActiveView = (v) => setSearchParams(prev => { prev.set('view', v); return prev; });
  
  // Estado para modal de notas
  const [notesModal, setNotesModal] = useState({
    isOpen: false,
    budgetId: null,
    budgetAddress: '',
    notes: [],
    loadingNotes: false
  });
  
  const [newNote, setNewNote] = useState({
    message: '',
    noteType: 'follow_up'
  });
  
  const [submittingNote, setSubmittingNote] = useState(false);
  
  // Estado para alertas de notas
  const [budgetAlerts, setBudgetAlerts] = useState({});
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Función para cargar alertas de notas
  const loadBudgetAlerts = async () => {
    try {
      setLoadingAlerts(true);
      const response = await api.get(`/budget-notes/alerts/budgets?_t=${Date.now()}`);
      setBudgetAlerts(response.data.budgetsWithAlerts || {});
    } catch (error) {
      console.error('Error al cargar alertas:', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Cargar datos del dashboard
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters.budgetStatus) params.append('status', filters.budgetStatus);
      if (filters.workStatus) params.append('workStatus', filters.workStatus);
      if (filters.month) params.append('month', filters.month);
      if (filters.year) params.append('year', filters.year);

      const response = await api.get(`/sales/my-dashboard?${params.toString()}`);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error al cargar dashboard:', err);
      setError(err.response?.data?.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  // Cargar alertas de notas al montar
  useEffect(() => {
    loadBudgetAlerts();
  }, []);

  // Función para cambiar filtros
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Formatear fecha
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Formatear estado del presupuesto
  const formatBudgetStatus = (status) => {
    const statusMap = {
      'pending': { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      'approved': { label: 'Aprobado', color: 'bg-green-100 text-green-800' },
      'signed': { label: 'Firmado', color: 'bg-blue-100 text-blue-800' },
      'rejected': { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
      'expired': { label: 'Expirado', color: 'bg-gray-100 text-gray-800' }
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  // Formatear estado del work
  const formatWorkStatus = (status) => {
    const statusMap = {
      'permit_pending': { label: 'Permit Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      'scheduled': { label: 'Programado', color: 'bg-blue-100 text-blue-800' },
      'in_progress': { label: 'En Progreso', color: 'bg-indigo-100 text-indigo-800' },
      'inspection': { label: 'Inspección', color: 'bg-purple-100 text-purple-800' },
      'completed': { label: 'Completado', color: 'bg-green-100 text-green-800' },
      'paymentReceived': { label: 'Pago Recibido', color: 'bg-emerald-100 text-emerald-800' }
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  // === FUNCIONES DE NOTAS ===
  
  // Abrir modal de notas y cargar notas del presupuesto
  const handleOpenNotes = async (budgetId, budgetAddress) => {
    setNotesModal({
      isOpen: true,
      budgetId,
      budgetAddress,
      notes: [],
      loadingNotes: true
    });
    
    try {
      const response = await api.get(`/budget-notes/budget/${budgetId}`);
      setNotesModal(prev => ({
        ...prev,
        notes: response.data.notes || [],
        loadingNotes: false
      }));
      
      // Recargar alertas al abrir el modal para asegurar que estén actualizadas
      loadBudgetAlerts();
    } catch (err) {
      console.error('Error al cargar notas:', err);
      setNotesModal(prev => ({
        ...prev,
        loadingNotes: false
      }));
    }
  };
  
  // Cerrar modal de notas
  const handleCloseNotes = () => {
    setNotesModal({
      isOpen: false,
      budgetId: null,
      budgetAddress: '',
      notes: [],
      loadingNotes: false
    });
    setNewNote({ message: '', noteType: 'follow_up' });
    setSubmittingNote(false);
    // Recargar alertas al cerrar el modal
    loadBudgetAlerts();
  };
  
  // Crear nueva nota
  const handleCreateNote = async () => {
    if (!newNote.message.trim() || submittingNote) return;
    
    setSubmittingNote(true);
    
    try {
      await api.post('/budget-notes', {
        budgetId: notesModal.budgetId,
        message: newNote.message,
        noteType: newNote.noteType
      });
      
      // Recargar notas
      const response = await api.get(`/budget-notes/budget/${notesModal.budgetId}`);
      setNotesModal(prev => ({
        ...prev,
        notes: response.data.notes || []
      }));
      
      // Limpiar formulario
      setNewNote({ message: '', noteType: 'follow_up' });
      
      // Recargar alertas para actualizar el badge
      loadBudgetAlerts();
    } catch (err) {
      console.error('Error al crear nota:', err);
      alert('Error al crear la nota');
    } finally {
      setSubmittingNote(false);
    }
  };
  
  // Marcar nota como leída
  const handleMarkAsRead = async (noteId) => {
    try {
      await api.patch(`/budget-notes/${noteId}/read`);
      
      // Recargar notas del presupuesto actual
      const response = await api.get(`/budget-notes/budget/${notesModal.budgetId}`);
      setNotesModal(prev => ({
        ...prev,
        notes: response.data.notes || []
      }));
      
      // Recargar alertas para actualizar el badge
      loadBudgetAlerts();
    } catch (err) {
      console.error('Error al marcar nota como leída:', err);
      alert('Error al marcar la nota como leída');
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">❌ {error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">📊 Mi Dashboard de Ventas</h1>
        <p className="text-blue-100">
          Bienvenido, {dashboardData?.salesRep?.name || user?.name}
        </p>
      </div>

      {/* Estadísticas Mensuales */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          📈 Resumen del Mes Actual
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({dashboardData?.monthlyStats?.month}/{dashboardData?.monthlyStats?.year})
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Presupuestos Creados</p>
            <p className="text-4xl font-bold text-blue-600">
              {dashboardData?.monthlyStats?.totalCreated || 0}
            </p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Works Concretados</p>
            <p className="text-4xl font-bold text-green-600">
              {dashboardData?.monthlyStats?.totalWorks || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">🔍 Filtros</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
            <select
              value={filters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los meses</option>
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString('es', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los años</option>
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado Budget</label>
            <select
              value={filters.budgetStatus}
              onChange={(e) => handleFilterChange('budgetStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobado</option>
              <option value="signed">Firmado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado Work</label>
            <select
              value={filters.workStatus}
              onChange={(e) => handleFilterChange('workStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="scheduled">Programado</option>
              <option value="in_progress">En Progreso</option>
              <option value="completed">Completado</option>
              <option value="paymentReceived">Pago Recibido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveView('budgets')}
            className={`flex-1 px-6 py-3 font-semibold transition-colors ${
              activeView === 'budgets'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📋 Presupuestos ({dashboardData?.budgets?.length || 0})
          </button>
          <button
            onClick={() => setActiveView('works')}
            className={`flex-1 px-6 py-3 font-semibold transition-colors ${
              activeView === 'works'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🔨 Trabajos ({dashboardData?.works?.length || 0})
          </button>
        </div>

        <div className="p-6">
          {/* Vista de Presupuestos */}
          {activeView === 'budgets' && (
            <div className="overflow-x-auto">
              {dashboardData?.budgets?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay presupuestos para mostrar</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dirección
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha Creado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Work
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData?.budgets?.map((budget) => {
                      const statusInfo = formatBudgetStatus(budget.status);
                      return (
                        <tr key={budget.idBudget} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{budget.idBudget}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{budget.client?.name}</div>
                            <div className="text-xs text-gray-500">{budget.client?.email}</div>
                            <div className="text-xs text-gray-500">{budget.client?.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{budget.propertyAddress}</div>
                            <div className="text-xs text-gray-500">Permit: {budget.permit?.permitNumber || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ${budget.totalPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            <div className="mt-1">
                              {budget.leadSource === 'sales_lead' ? (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                                  🎯 Sales Lead
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
                                  💼 Sales Rep
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(budget.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {budget.work ? (
                              <div>
                                <span className="text-xs font-medium text-green-600">✓ Concretado</span>
                                <div className="text-xs text-gray-500">{formatDate(budget.work.createdAt)}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">- Sin work</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenNotes(budget.idBudget, budget.propertyAddress)}
                              className="text-purple-600 hover:text-purple-900 p-2 rounded hover:bg-purple-50 transition-colors"
                              title="Ver notas de seguimiento"
                            >
                              <NotesAlertBadge 
                                budgetId={budget.idBudget} 
                                alertData={budgetAlerts[budget.idBudget]}
                                className="h-6 w-6"
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Vista de Trabajos */}
          {activeView === 'works' && (
            <div className="overflow-x-auto">
              {dashboardData?.works?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay trabajos concretados para mostrar</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dirección
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teléfono
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha Creado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboardData?.works?.map((work) => {
                      const statusInfo = formatWorkStatus(work.status);
                      const permit = work.budget?.permit;
                      return (
                        <tr key={work.idWork} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{permit?.propertyAddress || '-'}</div>
                            <div className="text-xs text-gray-500">Permit: {permit?.permitNumber || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{permit?.applicantEmail || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{permit?.applicantPhone || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(work.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Notas */}
      {notesModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header del Modal */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold">📝 Notas de Seguimiento</h3>
                <p className="text-sm text-blue-100 mt-1">{notesModal.budgetAddress}</p>
              </div>
              <button
                onClick={handleCloseNotes}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6">
              {/* Formulario para nueva nota */}
              <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-3">✍️ Agregar Nueva Nota</h4>
                
                <select
                  value={newNote.noteType}
                  onChange={(e) => setNewNote(prev => ({ ...prev, noteType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="follow_up">📞 Seguimiento</option>
                  <option value="client_contact">💬 Contacto con Cliente</option>
                  <option value="status_change">📋 Cambio de Estado</option>
                  <option value="problem">⚠️ Problema</option>
                  <option value="progress">✅ Progreso</option>
                  <option value="internal">🔒 Nota Interna</option>
                  <option value="payment">💰 Pago</option>
                  <option value="other">📝 Otro</option>
                </select>

                <MentionTextarea
                  value={newNote.message}
                  onChange={(message) => setNewNote(prev => ({ ...prev, message }))}
                  placeholder="Escribe tu nota de seguimiento... Usa @ para mencionar a alguien"
                  rows={3}
                  maxLength={5000}
                  className="border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={handleCreateNote}
                  disabled={!newNote.message.trim() || submittingNote}
                  className="mt-3 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {submittingNote ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    'Guardar Nota'
                  )}
                </button>
              </div>

              {/* Lista de notas */}
              <div>
                <h4 className="font-semibold mb-3">📑 Historial de Notas ({notesModal.notes.length})</h4>
                
                {notesModal.loadingNotes ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : notesModal.notes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay notas aún. ¡Agrega la primera!</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notesModal.notes.map((note) => {
                      const isMyNote = note.staffId === user?.id;
                      const isRead = note.readBy && note.readBy.includes(user?.id);
                      
                      return (
                        <div key={note.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                                {getNoteTypeLabel(note.noteType)}
                              </span>
                              {note.priority === 'high' && (
                                <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">🔴 Alta</span>
                              )}
                              {/* Botón para marcar como leída (solo si NO es tuya y NO la has leído) */}
                              {!isMyNote && !isRead && (
                                <button
                                  onClick={() => handleMarkAsRead(note.id)}
                                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs font-semibold"
                                  title="Marcar como leída"
                                >
                                  👁️ Leída
                                </button>
                              )}
                              {/* Indicador de ya leída */}
                              {!isMyNote && isRead && (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                                  ✓ Ya leída
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                          </div>
                          
                          <MessageWithMentions 
                            message={note.message} 
                            className="text-gray-700"
                          />
                          
                          <div className="mt-2 flex items-center text-xs text-gray-500">
                            <span className="font-medium">{note.Staff?.name || 'Usuario'}</span>
                            {note.relatedStatus && (
                              <span className="ml-3">Estado: {formatBudgetStatus(note.relatedStatus).label}</span>
                            )}
                            {note.readBy && note.readBy.length > 0 && (
                              <span className="ml-3 text-green-600">
                                📖 {note.readBy.length} {note.readBy.length === 1 ? 'lectura' : 'lecturas'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper para obtener etiqueta de tipo de nota
const getNoteTypeLabel = (type) => {
  const labels = {
    'follow_up': '📞 Seguimiento',
    'client_contact': '💬 Cliente',
    'status_change': '📋 Estado',
    'problem': '⚠️ Problema',
    'progress': '✅ Progreso',
    'internal': '🔒 Interna',
    'payment': '💰 Pago',
    'other': '📝 Otro'
  };
  return labels[type] || type;
};

export default SalesDashboard;
