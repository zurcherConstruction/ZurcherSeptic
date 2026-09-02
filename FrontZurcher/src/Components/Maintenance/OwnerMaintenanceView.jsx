import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  WrenchScrewdriverIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  UserIcon,
  HomeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import api from '../../utils/axios';

const OwnerMaintenanceView = () => {
  const navigate = useNavigate();
  
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);
  const [sendingNotifId, setSendingNotifId] = useState(null);
  const [downloadingHDId, setDownloadingHDId] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all', // ✅ Mostrar todas las visitas por defecto
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadCompletedVisits();
  }, [filters.status, filters.startDate, filters.endDate]);

  const loadCompletedVisits = async () => {
    try {
      setLoading(true);
      const params = {};
      
      // ✅ Filtrar por estados
      if (filters.status === 'active') {
        // Traer scheduled, assigned y completed
        params.status = 'scheduled,assigned,completed';
      } else if (filters.status === 'cancelled') {
        // Traer solo las canceladas y postergadas
        params.status = 'cancelled_by_client,postponed_no_access,cancelled_other';
      } else if (filters.status === 'pending') {
        // Solo pendientes de programar
        params.status = 'pending_scheduling';
      } else if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
      }
      
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get('/maintenance/completed', { params });
      console.log('📋 Visitas cargadas:', response.data);
      setVisits(response.data?.visits || []);
    } catch (error) {
      console.error('❌ Error loading visits:', error);
      toast.error(error.response?.data?.message || 'Error al cargar visitas');
      setVisits([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Sin fecha';
    // Parse como DATEONLY sin conversión de timezone
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Completada' },
      assigned: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '🔧 En Proceso' },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: '📅 Programada' },
      pending_scheduling: { bg: 'bg-gray-100', text: 'text-gray-800', label: '⏳ Pendiente' },
      cancelled_by_client: { bg: 'bg-red-100', text: 'text-red-800', label: '🚫 Cliente no quiere' },
      postponed_no_access: { bg: 'bg-purple-100', text: 'text-purple-800', label: '📍 Cliente ausente' },
      cancelled_other: { bg: 'bg-orange-100', text: 'text-orange-800', label: '❌ Cancelada' }
    };
    const badge = badges[status] || badges.pending_scheduling;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const handleViewVisit = (visit) => {
    // Navegar al detalle del mantenimiento con permisos de owner para editar
    navigate(`/worker/maintenance/${visit.id}`, { 
      state: { 
        workId: visit.workId,
        isOwner: true, // ✅ Indicar que es owner con permisos de edición
        readOnly: false // ✅ Permitir edición (eliminar/agregar imágenes)
      } 
    });
  };

  const handleDownloadPDF = async (visit) => {
    try {
      setDownloadingPdfId(visit.id);
      toast.info('Generando PDF...');

      const response = await api.get(`/maintenance/${visit.id}/download-pdf`, {
        responseType: 'blob' // Importante para recibir el archivo binario
      });

      // Crear un Blob a partir de la respuesta
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Crear un enlace temporal para descargar el archivo
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Crear nombre descriptivo: Mantenimiento_N°_Direccion.pdf
      const visitNumber = visit.visitNumber || visit.id;
      const propertyAddress = visit.work?.propertyAddress || visit.work?.Permit?.propertyAddress || 'Sin_Direccion';
      const cleanAddress = propertyAddress.replace(/[^a-zA-Z0-9]/g, '_'); // Limpiar caracteres especiales
      link.download = `Mantenimiento_N${visitNumber}_${cleanAddress}.pdf`;
      
      // Simular clic en el enlace para iniciar la descarga
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('❌ Error al descargar PDF:', error);
      toast.error(error.response?.data?.message || 'Error al descargar el PDF');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const handleCancellation = async (visit) => {
    const { value: option } = await Swal.fire({
      title: '⚠️ ¿Qué sucedió con la visita?',
      html: `
        <div class="text-left space-y-4">
          <p class="text-sm text-gray-600 mb-4">
            <strong>Visita #${visit.visitNumber || 'N/A'}</strong><br>
            <strong>Dirección:</strong> ${visit.work?.propertyAddress || 'N/A'}<br>
            Seleccione lo que sucedió durante la visita:
          </p>
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      showConfirmButton: true,
      confirmButtonText: '🚫 Cliente no quiere',
      denyButtonText: '📍 Cliente ausente',
      cancelButtonText: '❌ Otros motivos',
      confirmButtonColor: '#ea580c',
      denyButtonColor: '#7c3aed',
      cancelButtonColor: '#dc2626',
      focusConfirm: false
    });

    if (option === true) {
      await handleCancelByClient(visit);
    } else if (option === false) {
      await handlePostponeNoAccess(visit);
    } else if (option === null) {
      await handleCancelOther(visit);
    }
  };

  const handleCancelByClient = async (visit) => {
    const { value: reason } = await Swal.fire({
      title: '🚫 Cliente no quiere mantenimiento',
      html: `
        <div class="text-left space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Motivo detallado:
            </label>
            <textarea 
              id="reason" 
              rows="4"
              placeholder="Ej: Cliente dice que no necesita mantenimiento este año, sistema funciona bien..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            ></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Cancelar Visita',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#ea580c',
      preConfirm: () => {
        const reason = document.getElementById('reason').value;
        if (!reason.trim()) {
          Swal.showValidationMessage('Debe especificar el motivo');
          return false;
        }
        return reason.trim();
      }
    });

    if (reason) {
      try {
        await api.post(`/maintenance/${visit.id}/cancel-by-client`, {
          reason
        });
        
        Swal.fire({
          icon: 'success',
          title: 'Visita Cancelada',
          text: 'La visita ha sido cancelada por solicitud del cliente.',
          timer: 3000
        });
        
        // Recargar la lista
        loadCompletedVisits();
      } catch (error) {
        console.error('Error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al cancelar la visita.'
        });
      }
    }
  };

  const handlePostponeNoAccess = async (visit) => {
    const { value: formData } = await Swal.fire({
      title: '📍 Cliente no está presente',
      html: `
        <div class="text-left space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Motivo detallado:
            </label>
            <textarea 
              id="reason" 
              rows="3"
              placeholder="Ej: Nadie en casa, vecino dice que están de viaje..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            ></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Reagendar para (opcional):
            </label>
            <input 
              type="date" 
              id="rescheduleDate" 
              min="${new Date().toISOString().split('T')[0]}"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Postergar Visita',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#7c3aed',
      preConfirm: () => {
        const reason = document.getElementById('reason').value;
        const rescheduleDate = document.getElementById('rescheduleDate').value;
        
        if (!reason.trim()) {
          Swal.showValidationMessage('Debe especificar el motivo');
          return false;
        }
        
        return {
          reason: reason.trim(),
          rescheduleDate: rescheduleDate || null
        };
      }
    });

    if (formData) {
      try {
        await api.post(`/maintenance/${visit.id}/postpone-no-access`, formData);
        
        Swal.fire({
          icon: 'success',
          title: 'Visita Postergada',
          text: formData.rescheduleDate 
            ? `Visita postergada y reagendada para ${formData.rescheduleDate}`
            : 'Visita postergada por cliente ausente.',
          timer: 3000
        });
        
        // Recargar la lista
        loadCompletedVisits();
      } catch (error) {
        console.error('Error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al postergar la visita.'
        });
      }
    }
  };

  const handleCancelOther = async (visit) => {
    const { value: reason } = await Swal.fire({
      title: '❌ Cancelar por otros motivos',
      html: `
        <div class="text-left space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Motivo de cancelación:
            </label>
            <textarea 
              id="reason" 
              rows="4"
              placeholder="Ej: Clima adverso, emergencia, problema de acceso..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            ></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Cancelar Visita',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#dc2626',
      preConfirm: () => {
        const reason = document.getElementById('reason').value;
        if (!reason.trim()) {
          Swal.showValidationMessage('Debe especificar el motivo');
          return false;
        }
        return reason.trim();
      }
    });

    if (reason) {
      try {
        await api.post(`/maintenance/${visit.id}/cancel-other`, {
          reason
        });
        
        Swal.fire({
          icon: 'success',
          title: 'Visita Cancelada',
          text: 'La visita ha sido cancelada.',
          timer: 3000
        });
        
        // Recargar la lista
        loadCompletedVisits();
      } catch (error) {
        console.error('Error:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al cancelar la visita.'
        });
      }
    }
  };

  const canBeCancelled = (visit) => {
    return ['pending_scheduling', 'scheduled', 'assigned'].includes(visit.status);
  };

  const canSendNotification = (visit) => {
    return (
      ['pending_scheduling', 'scheduled', 'assigned'].includes(visit.status) &&
      !['confirmed', 'rejected', 'waived'].includes(visit.clientStatus) &&
      (visit.notificationCount || 0) < 3
    );
  };

  const canWaive = (visit) => {
    return (
      ['pending_scheduling', 'scheduled', 'assigned'].includes(visit.status) &&
      visit.clientStatus === 'notified' &&
      (visit.notificationCount || 0) >= 3
    );
  };

  const handleDownloadHDProof = async (visit) => {
    try {
      setDownloadingHDId(visit.id);
      toast.info('Generando HD Proof...');
      const res = await api.get(`/maintenance/${visit.id}/hd-proof-pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const addr = (visit.work?.propertyAddress || 'propiedad').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `HD_Proof_Visita${visit.visitNumber}_${addr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('HD Proof descargado');
    } catch (err) {
      toast.error('Error al generar el HD Proof');
    } finally {
      setDownloadingHDId(null);
    }
  };

  const handleWaive = async (visit) => {
    const { isConfirmed } = await Swal.fire({
      title: '🏛️ Eximir visita de mantenimiento',
      html: `<p class="text-sm text-gray-600">El cliente no respondió a los 3 avisos enviados.<br><br>
        <strong>Visita #${visit.visitNumber}</strong><br>
        <strong>Dirección:</strong> ${visit.work?.propertyAddress || 'N/A'}<br><br>
        Al eximirla se generará un aviso al owner y quedará registrada como <strong>eximida (HD)</strong>.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Eximir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#7c3aed',
    });
    if (!isConfirmed) return;

    try {
      await api.post(`/maintenance/${visit.id}/waive`);
      toast.success(`Visita #${visit.visitNumber} marcada como eximida`);
      loadCompletedVisits();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eximir la visita');
    }
  };

  const getClientStatusBadge = (visit) => {
    const count = visit.notificationCount || 0;
    const cs = visit.clientStatus;
    if (!cs || cs === 'pending_notification') {
      return count === 0
        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">Sin notificar</span>
        : null;
    }
    const map = {
      notified:             { bg: 'bg-yellow-100', text: 'text-yellow-700', label: `📧 Notificado (${count}/3)` },
      confirmed:            { bg: 'bg-green-100',  text: 'text-green-700',  label: '✅ Confirmado' },
      rejected:             { bg: 'bg-red-100',    text: 'text-red-700',    label: '❌ Rechazado' },
      reschedule_requested: { bg: 'bg-orange-100', text: 'text-orange-700', label: '📅 Pide reprogramar' },
      waived:               { bg: 'bg-purple-100', text: 'text-purple-700', label: '🏛️ Eximido (HD)' },
    };
    const b = map[cs];
    if (!b) return null;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${b.bg} ${b.text}`}>
        {b.label}
      </span>
    );
  };

  const handleSendNotification = async (visit) => {
    const count = visit.notificationCount || 0;
    const { isConfirmed } = await Swal.fire({
      title: `📧 Enviar aviso #${count + 1}`,
      html: `<p class="text-sm text-gray-600">Se enviará el <strong>aviso ${count + 1} de 3</strong> al email del cliente para la visita <strong>#${visit.visitNumber}</strong>.<br><br>Dirección: ${visit.work?.propertyAddress || 'N/A'}</p>`,
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1e3a8a',
    });
    if (!isConfirmed) return;

    try {
      setSendingNotifId(visit.id);
      const res = await api.post(`/maintenance/${visit.id}/send-notification`);
      toast.success(`Email enviado a ${res.data.sentTo} (intento ${res.data.attempt}/3)`);
      loadCompletedVisits();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al enviar la notificación';
      toast.error(msg);
    } finally {
      setSendingNotifId(null);
    }
  };

  // Filtrar visitas localmente por búsqueda
  const filteredVisits = visits.filter(visit => {
    if (!filters.search) return true;
    
    const searchLower = filters.search.toLowerCase();
    return (
      visit.work?.propertyAddress?.toLowerCase().includes(searchLower) ||
      visit.work?.Permit?.applicantName?.toLowerCase().includes(searchLower) ||
      visit.work?.Permit?.systemType?.toLowerCase().includes(searchLower) ||
      visit.assignedStaff?.name?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <WrenchScrewdriverIcon className="h-10 w-10 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Mantenimientos</h1>
              <p className="text-gray-600">Vista administrativa de todas las visitas</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/maintenance/calendar')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium"
            >
              <CalendarIcon className="h-5 w-5" />
              Ver Calendario
            </button>
            <button
              onClick={() => navigate('/maintenance/works')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium"
            >
              <HomeIcon className="h-5 w-5" />
              Gestionar Obras
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total de visitas</p>
              <p className="text-3xl font-bold text-blue-600">{filteredVisits.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Búsqueda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MagnifyingGlassIcon className="h-4 w-4 inline mr-1" />
              Buscar
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Dirección, cliente, worker..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FunnelIcon className="h-4 w-4 inline mr-1" />
              Estado
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">📋 Todas las Visitas</option>
              <option value="active">✅ Activas (Programadas + En Proceso + Completadas)</option>
              <option value="cancelled">❌ Problemáticas (Canceladas + Postergadas)</option>
              <option value="scheduled">📅 Solo Programadas</option>
              <option value="assigned">🔧 Solo En Proceso</option>
              <option value="completed">✅ Solo Completadas</option>
              <option value="pending">⏳ Pendientes de Programar</option>
              <option value="cancelled_by_client">🚫 Cliente no quiere</option>
              <option value="postponed_no_access">📍 Cliente ausente</option>
              <option value="cancelled_other">❌ Otros motivos</option>
            </select>
          </div>

          {/* Fecha inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Fecha fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Lista de visitas */}
      {filteredVisits.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <WrenchScrewdriverIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No se encontraron visitas</p>
          <p className="text-gray-400 text-sm mt-2">Ajusta los filtros para ver más resultados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredVisits.map((visit) => (
            <div 
              key={visit.id} 
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 border border-gray-200"
            >
              <div className="flex items-start justify-between">
                {/* Info principal */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-sm font-bold text-gray-500">Visita #{visit.visitNumber}</span>
                    {getStatusBadge(visit.status)}
                    {getClientStatusBadge(visit)}
                    {visit.clientProposedDate && visit.clientStatus === 'reschedule_requested' && (
                      <span className="text-xs text-orange-600 font-medium">
                        Propone: {formatDate(visit.clientProposedDate)}
                      </span>
                    )}
                    {visit.work?.Permit?.isPBTS && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                        PBTS/ATU
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Dirección */}
                    <div className="flex items-start gap-2">
                      <HomeIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Propiedad</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {visit.work?.propertyAddress || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Cliente */}
                    <div className="flex items-start gap-2">
                      <UserIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Cliente</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {visit.work?.Permit?.applicantName || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Sistema */}
                    <div className="flex items-start gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Sistema</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {visit.work?.Permit?.systemType || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Fecha completada */}
                    <div className="flex items-start gap-2">
                      <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Completada</p>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDate(visit.actualVisitDate)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Worker asignado */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Realizada por:</span>
                    <span className="text-sm font-medium text-blue-600">
                      {visit.assignedStaff?.name || visit.completedByStaff?.name || 'N/A'}
                    </span>
                    {visit.mediaFiles?.length > 0 && (
                      <span className="text-xs text-gray-500 ml-4">
                        📎 {visit.mediaFiles.length} archivo(s) adjunto(s)
                      </span>
                    )}
                  </div>

                  {/* Información de cancelación */}
                  {['cancelled_by_client', 'postponed_no_access', 'cancelled_other'].includes(visit.status) && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-red-700 mb-1">
                            {visit.status === 'cancelled_by_client' && '🚫 Cliente no quiere mantenimiento'}
                            {visit.status === 'postponed_no_access' && '📍 Cliente ausente'}
                            {visit.status === 'cancelled_other' && '❌ Visita cancelada'}
                          </p>
                          {visit.cancellationReason && (
                            <p className="text-xs text-red-600">
                              <strong>Motivo:</strong> {visit.cancellationReason}
                            </p>
                          )}
                          {visit.cancellationDate && (
                            <p className="text-xs text-red-600 mt-1">
                              <strong>Fecha:</strong> {formatDate(visit.cancellationDate)}
                            </p>
                          )}
                          {visit.rescheduledDate && (
                            <p className="text-xs text-purple-600 mt-1">
                              <strong>Reagendada para:</strong> {formatDate(visit.rescheduledDate)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleViewVisit(visit)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    Ver Detalle
                  </button>
                  
                  {canBeCancelled(visit) && (
                    <button
                      onClick={() => handleCancellation(visit)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      Gestionar Problema
                    </button>
                  )}

                  {canSendNotification(visit) && (
                    <button
                      onClick={() => handleSendNotification(visit)}
                      disabled={sendingNotifId === visit.id}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium text-white ${
                        sendingNotifId === visit.id
                          ? 'bg-indigo-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {sendingNotifId === visit.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="h-4 w-4" />
                          Notificar ({(visit.notificationCount || 0)}/3)
                        </>
                      )}
                    </button>
                  )}

                  {canWaive(visit) && (
                    <button
                      onClick={() => handleWaive(visit)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      🏛️ Eximir (HD)
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadPDF(visit)}
                    disabled={downloadingPdfId === visit.id}
                    className={`px-4 py-2 ${
                      downloadingPdfId === visit.id
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gray-600 hover:bg-gray-700'
                    } text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium`}
                  >
                    {downloadingPdfId === visit.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Generando...
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Descargar PDF
                      </>
                    )}
                  </button>

                  {visit.clientStatus === 'waived' && (
                    <button
                      onClick={() => handleDownloadHDProof(visit)}
                      disabled={downloadingHDId === visit.id}
                      className={`px-4 py-2 ${
                        downloadingHDId === visit.id
                          ? 'bg-purple-300 cursor-not-allowed'
                          : 'bg-purple-700 hover:bg-purple-800'
                      } text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium`}
                    >
                      {downloadingHDId === visit.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          HD Proof PDF
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OwnerMaintenanceView;
