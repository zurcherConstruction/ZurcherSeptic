import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  WrenchScrewdriverIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  HomeIcon,
  CalendarIcon,
  DocumentTextIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import api from '../../utils/axios';

// Definir las zonas basadas en zip code y city
const ZONES = {
  'La Belle': {
    name: 'La Belle',
    color: 'orange',
    zipCodes: ['33935', '33975'],
    cities: ['la belle', 'labelle', 'la bell', 'labell']
  },
  'Lehigh': {
    name: 'Lehigh Acres',
    color: 'purple',
    zipCodes: ['33936', '33971', '33972', '33973', '33974', '33976'],
    cities: ['lehigh', 'lehigh acres', 'lehigh acre']
  },
  'North Port': {
    name: 'North Port / Port Charlotte',
    color: 'green',
    zipCodes: ['34286', '34287', '34288', '34289', '34291', '33948', '33949', '33952', '33953', '33954'],
    cities: ['north port', 'northport', 'n port', 'port charlotte', 'charlotte', 'pt charlotte']
  },
  'Cape Coral': {
    name: 'Cape Coral',
    color: 'blue',
    zipCodes: ['33904', '33909', '33914', '33990', '33991', '33993'],
    cities: ['cape coral', 'cape', 'c coral', 'capecoral']
  },
  'Fort Myers': {
    name: 'Fort Myers',
    color: 'indigo',
    zipCodes: ['33901', '33905', '33907', '33908', '33912', '33913', '33916', '33919'],
    cities: ['fort myers', 'ft myers', 'ft. myers', 'myers']
  },
  'Deltona': {
    name: 'Deltona',
    color: 'teal',
    zipCodes: ['32725', '32738'],
    cities: ['deltona']
  },
  'Poinciana': {
    name: 'Poinciana',
    color: 'rose',
    zipCodes: ['34758', '34759'],
    cities: ['poinciana']
  },
  'Orlando': {
    name: 'Orlando',
    color: 'cyan',
    zipCodes: ['32801', '32803', '32804', '32805', '32806', '32807', '32808', '32809', '32810', '32811', '32812', '32814', '32816', '32817', '32818', '32819', '32821', '32822', '32824', '32825', '32826', '32827', '32828', '32829', '32830', '32831', '32832', '32833', '32835', '32836', '32837', '32839'],
    cities: ['orlando']
  },
  'Other': {
    name: 'Otras Zonas',
    color: 'gray',
    zipCodes: [],
    cities: []
  }
};

const WorkerMaintenanceDashboard = () => {
  const navigate = useNavigate();
  const { user, currentStaff } = useSelector((state) => state.auth);
  const authStaff = currentStaff || user;
  
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab     = searchParams.get('tab')   || 'pending';
  const selectedMonth = searchParams.get('month') || 'all';
  const selectedZone  = searchParams.get('zone')  || 'all';
  const setActiveTab     = (v) => setSearchParams(p => { p.set('tab', v); return p; });
  const setSelectedMonth = (v) => setSearchParams(p => { if (v === 'all') p.delete('month'); else p.set('month', v); return p; });
  const setSelectedZone  = (v) => setSearchParams(p => { if (v === 'all') p.delete('zone');  else p.set('zone',  v); return p; });
  const [zoneData, setZoneData] = useState({});

  // ✅ FIX: Usar useMemo para evitar recalcular staffId en cada render
  const staffId = React.useMemo(() => authStaff?.idStaff || authStaff?.id, [authStaff?.idStaff, authStaff?.id]);
  
  // ✅ FIX: Prevenir llamadas duplicadas con useRef
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    console.log('🔧 MaintenanceDashboard - staffId:', staffId);
    console.log('🔧 MaintenanceDashboard - authStaff:', authStaff);
    
    // ✅ FIX: Solo cargar si no estamos ya cargando y tenemos staffId
    if (staffId && !isLoadingRef.current && !hasLoadedRef.current) {
      loadMaintenances();
    } else if (!staffId) {
      console.error('🔧 No staffId disponible');
      setLoading(false);
    }
  }, [staffId]);

  const loadMaintenances = async () => {
    // ✅ FIX: Prevenir llamadas concurrentes
    if (isLoadingRef.current) {
      console.log('⏸️ Ya hay una carga en progreso, omitiendo...');
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      console.log('🔧 Llamando a /maintenance/assigned con workerId:', staffId);
      const response = await api.get('/maintenance/assigned', {
        params: { workerId: staffId }
      });
      console.log('📋 Mantenimientos cargados:', response.data);
      // El backend devuelve {message, visits, count}
      const visits = response.data?.visits || [];
      console.log('🔍 Primera visita para debug:', visits[0]);
      if (visits[0]) {
        console.log('   - extractedZipCode:', visits[0].extractedZipCode);
        console.log('   - extractedCity:', visits[0].extractedCity);
        console.log('   - fullAddress:', visits[0].fullAddress);
      }
      setMaintenances(visits);
      hasLoadedRef.current = true; // ✅ Marcar como cargado exitosamente
    } catch (error) {
      console.error('❌ Error loading maintenances:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error(error.response?.data?.message || 'Error al cargar mantenimientos');
      setMaintenances([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Función para detectar la zona de una visita
  const detectZone = (visit) => {
    const zipCode = visit.extractedZipCode;
    const cityText = visit.extractedCity?.toLowerCase() || '';
    
    // Primero intentar por ZIP code
    if (zipCode) {
      for (const [zoneName, zoneInfo] of Object.entries(ZONES)) {
        if (zoneName === 'Other') continue;
        if (zoneInfo.zipCodes.includes(zipCode)) {
          return zoneName;
        }
      }
    }
    
    // Si no hay match por ZIP, intentar por city
    if (cityText) {
      for (const [zoneName, zoneInfo] of Object.entries(ZONES)) {
        if (zoneName === 'Other') continue;
        for (const cityKeyword of zoneInfo.cities) {
          if (cityText.includes(cityKeyword.toLowerCase())) {
            return zoneName;
          }
        }
      }
    }
    
    return 'Other';
  };

  // Filtrar y agrupar visitas por zona
  useEffect(() => {
    if (maintenances.length === 0) return;

    // Filtrar por tab (pending/completed)
    let filteredVisits = activeTab === 'pending'
      ? maintenances.filter(m => m.status !== 'completed' && m.status !== 'skipped')
      : maintenances.filter(m => m.status === 'completed' || m.status === 'skipped');

    // Filtrar por mes si está seleccionado
    if (selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-').map(Number);
      filteredVisits = filteredVisits.filter(visit => {
        const visitDate = new Date(visit.scheduledDate);
        return visitDate.getFullYear() === year && visitDate.getMonth() + 1 === month;
      });
    }

    // Filtrar por zona si está seleccionada
    if (selectedZone !== 'all') {
      filteredVisits = filteredVisits.filter(visit => {
        const zone = detectZone(visit);
        return zone === selectedZone;
      });
    }

    // Agrupar por zona
    const grouped = {};
    Object.keys(ZONES).forEach(zoneName => {
      grouped[zoneName] = [];
    });

    filteredVisits.forEach(visit => {
      const zone = detectZone(visit);
      grouped[zone].push(visit);
    });

    setZoneData(grouped);
  }, [maintenances, activeTab, selectedMonth, selectedZone]);

  const getStatusColor = (status) => {
    const colors = {
      pending_scheduling: 'bg-gray-100 text-gray-700 border-gray-300',
      scheduled: 'bg-blue-100 text-blue-700 border-blue-300',
      assigned: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      completed: 'bg-green-100 text-green-700 border-green-300',
      skipped: 'bg-red-100 text-red-700 border-red-300',
      cancelled_by_client: 'bg-red-100 text-red-700 border-red-300',
      postponed_no_access: 'bg-orange-100 text-orange-700 border-orange-300',
      cancelled_other: 'bg-slate-100 text-slate-700 border-slate-300'
    };
    return colors[status] || colors.pending_scheduling;
  };

  const getStatusText = (status) => {
    const texts = {
      pending_scheduling: 'Pendiente',
      scheduled: 'Programada',
      assigned: 'Asignada',
      completed: 'Completada',
      skipped: 'Omitida',
      cancelled_by_client: 'Cancelada por Cliente',
      postponed_no_access: 'Postergada',
      cancelled_other: 'Cancelada'
    };
    return texts[status] || status;
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending_scheduling: '⏳',
      scheduled: '📅',
      assigned: '👤',
      completed: '✅',
      skipped: '⏭️',
      cancelled_by_client: '❌',
      postponed_no_access: '🔄',
      cancelled_other: '⛔'
    };
    return icons[status] || '📋';
  };

  const formatVisitDate = (dateString, daysUntil) => {
    const date = new Date(dateString + 'T12:00:00');
    const formatted = date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
    
    if (daysUntil < 0) {
      return `${formatted} (Vencida hace ${Math.abs(daysUntil)} días)`;
    } else if (daysUntil === 0) {
      return `${formatted} (HOY)`;
    } else if (daysUntil === 1) {
      return `${formatted} (Mañana)`;
    } else if (daysUntil <= 7) {
      return `${formatted} (En ${daysUntil} días)`;
    }
    return formatted;
  };

  // Generar opciones de meses (año anterior completo + año actual completo)
  const getMonthOptions = () => {
    const options = [{ value: 'all', label: 'Todos los meses' }];
    
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Mostrar año anterior completo + año actual completo
    const startYear = currentYear - 1; // Año anterior
    const endYear = currentYear;        // Año actual
    
    // Generar todos los meses del rango
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 0; month <= 11; month++) {
        const date = new Date(year, month, 1);
        const value = `${year}-${(month + 1).toString().padStart(2, '0')}`;
        const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
      }
    }
    
    return options;
  };

  const getZoneHeaderColorClasses = (colorName) => {
    const colors = {
      blue: 'bg-gradient-to-r from-slate-700 to-blue-600 text-white',
      green: 'bg-gradient-to-r from-slate-700 to-green-600 text-white',
      purple: 'bg-gradient-to-r from-slate-700 to-purple-600 text-white',
      orange: 'bg-gradient-to-r from-slate-700 to-orange-600 text-white',
      indigo: 'bg-gradient-to-r from-slate-700 to-indigo-600 text-white',
      gray: 'bg-gradient-to-r from-slate-700 to-slate-600 text-white'
    };
    return colors[colorName] || colors.gray;
  };

  const getTotalVisits = () => {
    return Object.values(zoneData).reduce((sum, visits) => sum + visits.length, 0);
  };

  const handleVisitClick = (visit) => {
    navigate(`/worker/maintenance/${visit.id}`, {
      state: { 
        workId: visit.workId,
        from: '/worker/maintenance' // ✅ Guardar ruta de origen
      }
    });
  };

  const pendingMaintenances = maintenances.filter(m => m.status !== 'completed' && m.status !== 'skipped');
  const completedMaintenances = maintenances.filter(m => m.status === 'completed' || m.status === 'skipped');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mantenimientos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/worker')}
            className="flex items-center text-white hover:text-blue-100 mb-3"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Volver
          </button>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Mis Mantenimientos por Zona</h1>
              <p className="text-blue-100 text-sm mt-1">
                {authStaff?.name || 'Worker'}
              </p>
            </div>
            <WrenchScrewdriverIcon className="h-12 w-12 text-blue-200" />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">{pendingMaintenances.length}</div>
              <div className="text-sm text-blue-100">Pendientes</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-3xl font-bold">{completedMaintenances.length}</div>
              <div className="text-sm text-blue-100">Completadas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1 border-b">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-4 px-4 text-center font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClockIcon className="h-5 w-5 inline-block mr-2" />
              Pendientes ({pendingMaintenances.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-4 px-4 text-center font-medium transition-colors ${
                activeTab === 'completed'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircleIcon className="h-5 w-5 inline-block mr-2" />
              Completadas ({completedMaintenances.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      {activeTab === 'pending' && pendingMaintenances.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <FunnelIcon className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtro de mes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por mes
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {getMonthOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro de zona */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por zona
                </label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todas las zonas</option>
                  {Object.entries(ZONES).map(([key, zone]) => (
                    <option key={key} value={key}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance List por Zonas */}
      <div className="max-w-7xl mx-auto p-4">
        {getTotalVisits() === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <WrenchScrewdriverIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">
              {activeTab === 'pending' 
                ? 'No tienes mantenimientos pendientes' 
                : 'No tienes mantenimientos completados'}
            </p>
            {(selectedMonth !== 'all' || selectedZone !== 'all') && (
              <p className="text-sm text-gray-400 mt-2">
                Prueba ajustando los filtros para ver más resultados.
              </p>
            )}
            <button
              onClick={loadMaintenances}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Actualizar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(ZONES).map(([zoneName, zoneInfo]) => {
              const visitsInZone = zoneData[zoneName] || [];
              if (visitsInZone.length === 0) return null;

              return (
                <div 
                  key={zoneName}
                  className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-slate-200"
                >
                  {/* Header de la Zona */}
                  <div className={`${getZoneHeaderColorClasses(zoneInfo.color)} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BuildingOfficeIcon className="h-7 w-7" />
                        <div>
                          <h2 className="text-xl font-bold">
                            {zoneInfo.name}
                          </h2>
                          <p className="text-sm opacity-90">
                            {visitsInZone.length} {visitsInZone.length === 1 ? 'visita' : 'visitas'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lista de visitas */}
                  <div className="relative">
                    <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-200">
                      <div className="space-y-3">
                        {visitsInZone.map((visit) => {
                          const permitData = visit.work?.Permit || visit.work?.permit;
                          
                          return (
                            <div
                              key={visit.id}
                              onClick={() => handleVisitClick(visit)}
                              className={`bg-slate-50 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer overflow-hidden border-2 p-4 ${
                                visit.isOverdue ? 'border-red-400 bg-red-50' : 
                                visit.daysUntilVisit === 0 ? 'border-yellow-400 bg-yellow-50' : 
                                'border-slate-200'
                              }`}
                            >
                              {/* Header */}
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{getStatusIcon(visit.status)}</span>
                                  <h3 className="font-bold text-lg text-gray-800">
                                    Visita #{visit.visitNumber}
                                  </h3>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(visit.status)}`}>
                                  {getStatusText(visit.status)}
                                </span>
                              </div>

                              {/* Property Info */}
                              {permitData && (
                                <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
                                  <div className="flex items-start gap-3">
                                    <HomeIcon className="h-6 w-6 text-gray-600 flex-shrink-0 mt-1" />
                                    <div className="flex-1">
                                      <p className="text-xs text-gray-500 mb-1">Propiedad:</p>
                                      <p className="font-semibold text-gray-800 text-sm">
                                        {permitData.propertyAddress || visit.fullAddress || 'Sin dirección'}
                                      </p>
                                      {permitData.applicantName && (
                                        <p className="text-sm text-gray-600 mt-1">
                                          Cliente: {permitData.applicantName}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Scheduled Date */}
                              {visit.scheduledDate && (
                                <div className="flex items-center gap-2 mb-3 text-sm">
                                  <CalendarIcon className={`h-4 w-4 ${
                                    visit.isOverdue ? 'text-red-600' : 
                                    visit.daysUntilVisit === 0 ? 'text-yellow-600' : 
                                    'text-blue-600'
                                  }`} />
                                  <div>
                                    <span className="text-xs text-gray-500">Fecha programada:</span>
                                    <p className={`font-semibold ${
                                      visit.isOverdue ? 'text-red-700' : 
                                      visit.daysUntilVisit === 0 ? 'text-yellow-700' : 
                                      'text-gray-800'
                                    }`}>
                                      {formatVisitDate(visit.scheduledDate, visit.daysUntilVisit)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* System Type */}
                              {permitData?.systemType && (
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs text-gray-600">Sistema:</span>
                                  <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-semibold">
                                    {permitData.systemType}
                                  </span>
                                </div>
                              )}

                              {/* CTA */}
                              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                <span className="text-sm font-semibold text-blue-600">
                                  {visit.status === 'completed' ? 'Ver detalles' : 'Completar inspección'}
                                </span>
                                <ArrowRightIcon className="h-5 w-5 text-blue-600" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Indicador de scroll */}
                    {visitsInZone.length > 5 && (
                      <div className="px-4 pb-3 pt-2 text-center text-xs font-semibold text-slate-600 bg-gradient-to-t from-white via-white to-transparent">
                        ⬇️ Scroll para ver todas ({visitsInZone.length} visitas) ⬇️
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerMaintenanceDashboard;
