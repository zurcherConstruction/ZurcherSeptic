import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWorksInMaintenance } from '../../Redux/Actions/maintenanceActions.jsx';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  MapPinIcon, 
  BuildingOfficeIcon,
  CalendarIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../LoadingSpinner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Definir las zonas basadas en zip code y city
const ZONES = {
  'La Belle': {
    name: 'La Belle',
    color: 'orange',
    zipCodes: ['33935', '33936', '33975'],
    cities: ['la belle', 'labelle', 'labell']
  },
  'Lehigh': {
    name: 'Lehigh Acres',
    color: 'purple',
    zipCodes: ['33971', '33972', '33973', '33974', '33976'],
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
    name: 'Poinciana / Kissimmee',
    color: 'rose',
    zipCodes: ['34758', '34759'],
    cities: ['poinciana', 'kissimmee']
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

// Estados de visitas con colores
const VISIT_STATUS_COLORS = {
  'pending_scheduling': 'bg-gray-100 text-gray-700 border-gray-300',
  'scheduled': 'bg-blue-100 text-blue-700 border-blue-300',
  'assigned': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'completed': 'bg-green-100 text-green-700 border-green-300',
  'cancelled_by_client': 'bg-red-100 text-red-700 border-red-300',
  'postponed_no_access': 'bg-orange-100 text-orange-700 border-orange-300',
  'cancelled_other': 'bg-slate-100 text-slate-700 border-slate-300',
  'skipped': 'bg-purple-100 text-purple-700 border-purple-300'
};

const VISIT_STATUS_LABELS = {
  'pending_scheduling': 'Por Agendar',
  'scheduled': 'Programada',
  'assigned': 'Asignada',
  'completed': 'Completada',
  'cancelled_by_client': 'Cancelada por Cliente',
  'postponed_no_access': 'Postergada',
  'cancelled_other': 'Cancelada',
  'skipped': 'Saltada'
};

const MaintenanceWorks = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { worksInMaintenance, loading, error } = useSelector(state => state.maintenance);
  const { user } = useSelector(state => state.auth);
  
  const [zoneData, setZoneData] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [visitsWithDateInfo, setVisitsWithDateInfo] = useState([]);

  useEffect(() => {
    dispatch(fetchWorksInMaintenance());
  }, [dispatch]);

  // Restaurar filtros cuando se vuelve desde otra vista
  useEffect(() => {
    if (location.state?.filters) {
      const { selectedMonth: savedMonth, selectedZone: savedZone } = location.state.filters;
      if (savedMonth) setSelectedMonth(savedMonth);
      if (savedZone) setSelectedZone(savedZone);
      // Limpiar el state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Función para extraer zip code de una dirección
  const extractZipCode = (address) => {
    if (!address) return null;
    // Buscar patrón de 5 dígitos
    const zipMatch = address.match(/\b\d{5}\b/);
    return zipMatch ? zipMatch[0] : null;
  };

  // Función para extraer city de una dirección
  const extractCity = (address) => {
    if (!address) return null;
    // Normalizar dirección
    const lowerAddress = address.toLowerCase().trim().replace(/\s+/g, ' ');
    return lowerAddress;
  };

  // Función para detectar la zona de una dirección
  const detectZone = (address) => {
    if (!address) return 'Other';
    
    const zipCode = extractZipCode(address);
    const cityText = extractCity(address);
    
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

  // Procesar obras y extraer todas las visitas con información de fecha
  useEffect(() => {
    if (!worksInMaintenance || worksInMaintenance.length === 0) return;

    const allVisits = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    worksInMaintenance.forEach(work => {
      if (!work.maintenanceVisits || work.maintenanceVisits.length === 0) return;

      // Filtrar visitas pendientes o programadas (no completadas, no canceladas)
      const pendingVisits = work.maintenanceVisits.filter(visit => 
        !['completed', 'skipped', 'cancelled_by_client', 'cancelled_other'].includes(visit.status)
      );

      pendingVisits.forEach(visit => {
        const scheduledDate = new Date(visit.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);
        
        const daysUntilVisit = Math.floor((scheduledDate - today) / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntilVisit < 0;
        const isToday = daysUntilVisit === 0;
        const isThisWeek = daysUntilVisit > 0 && daysUntilVisit <= 7;
        
        const zone = detectZone(work.budget?.propertyAddress || work.propertyAddress);
        
        allVisits.push({
          ...visit,
          work: work,
          zone: zone,
          daysUntilVisit: daysUntilVisit,
          isOverdue: isOverdue,
          isToday: isToday,
          isThisWeek: isThisWeek,
          propertyAddress: work.budget?.propertyAddress || work.propertyAddress,
          applicantName: work.budget?.applicantName || 'N/A'
        });
      });
    });

    // Agrupar visitas vencidas por dirección
    const addressGroups = {};
    const nonOverdueVisits = [];
    
    allVisits.forEach(visit => {
      if (visit.isOverdue) {
        const address = visit.propertyAddress || 'Sin dirección';
        if (!addressGroups[address]) {
          addressGroups[address] = [];
        }
        addressGroups[address].push(visit);
      } else {
        nonOverdueVisits.push(visit);
      }
    });

    // Consolidar visitas vencidas: una entrada por dirección si hay múltiples vencidas
    const consolidatedVisits = [];
    
    Object.entries(addressGroups).forEach(([address, visits]) => {
      if (visits.length > 1) {
        // Múltiples visitas vencidas de la misma dirección: crear una entrada consolidada
        const oldestVisit = visits.reduce((oldest, current) => 
          current.daysUntilVisit < oldest.daysUntilVisit ? current : oldest
        );
        
        consolidatedVisits.push({
          ...oldestVisit,
          isConsolidated: true,
          consolidatedCount: visits.length,
          consolidatedVisits: visits
        });
      } else {
        // Solo una visita vencida: mostrarla normalmente
        consolidatedVisits.push(visits[0]);
      }
    });

    // Ordenar visitas consolidadas por fecha más antigua
    consolidatedVisits.sort((a, b) => a.daysUntilVisit - b.daysUntilVisit);
    
    // Ordenar visitas no vencidas por fecha ascendente
    nonOverdueVisits.sort((a, b) => a.daysUntilVisit - b.daysUntilVisit);

    // Combinar: vencidas primero, luego no vencidas
    const finalVisits = [...consolidatedVisits, ...nonOverdueVisits];

    setVisitsWithDateInfo(finalVisits);
  }, [worksInMaintenance]);

  // Agrupar visitas por zona con filtros aplicados
  useEffect(() => {
    if (visitsWithDateInfo.length === 0) return;

    const grouped = {};
    
    Object.keys(ZONES).forEach(zoneName => {
      grouped[zoneName] = [];
    });

    let filteredVisits = [...visitsWithDateInfo];

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
      filteredVisits = filteredVisits.filter(visit => visit.zone === selectedZone);
    }

    // Agrupar por zona
    filteredVisits.forEach(visit => {
      grouped[visit.zone].push(visit);
    });

    setZoneData(grouped);
  }, [visitsWithDateInfo, selectedMonth, selectedZone]);

  // Generar opciones de meses (próximos 6 meses)
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
      teal: 'bg-gradient-to-r from-slate-700 to-teal-600 text-white',
      rose: 'bg-gradient-to-r from-slate-700 to-rose-600 text-white',
      cyan: 'bg-gradient-to-r from-slate-700 to-cyan-600 text-white',
      gray: 'bg-gradient-to-r from-slate-700 to-slate-600 text-white'
    };
    return colors[colorName] || colors.gray;
  };

  const formatVisitDate = (dateString, daysUntil) => {
    const date = new Date(dateString);
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

  // Función para obtener visitas pendientes de meses anteriores y mes actual
  const getPendingAndCurrentVisits = (zoneName = 'all') => {
    let visitsToExport = [];
    
    if (zoneName === 'all') {
      // Todas las zonas
      visitsToExport = visitsWithDateInfo;
    } else {
      // Zona específica
      visitsToExport = zoneData[zoneName] || [];
    }
    
    // Expandir visitas consolidadas para exportación
    const expandedVisits = [];
    visitsToExport.forEach(visit => {
      if (visit.isConsolidated && visit.consolidatedVisits) {
        // Agregar todas las visitas consolidadas individualmente
        expandedVisits.push(...visit.consolidatedVisits);
      } else {
        // Agregar visita normal
        expandedVisits.push(visit);
      }
    });
    
    // Filtrar solo visitas pendientes (no completadas, no canceladas) - sin límite de fecha
    return expandedVisits.filter(visit => {
      return !['completed', 'skipped', 'cancelled_by_client', 'cancelled_other'].includes(visit.status);
    }).sort((a, b) => {
      // Ordenar por fecha ascendente
      return new Date(a.scheduledDate) - new Date(b.scheduledDate);
    });
  };

  // Función para exportar a PDF
  const exportToPDF = (zoneName = 'all') => {
    const visits = getPendingAndCurrentVisits(zoneName);
    
    if (visits.length === 0) {
      alert('No hay visitas pendientes para exportar');
      return;
    }
    
    const doc = new jsPDF('landscape');
    const zoneName_display = zoneName === 'all' ? 'Todas las Zonas' : ZONES[zoneName]?.name || zoneName;
    
    // Título
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Visitas de Mantenimiento Pendientes - ${zoneName_display}`, 14, 20);
    
    // Subtítulo
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const today = new Date();
    const todayFormatted = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;
    doc.text(`Generado: ${todayFormatted} - ${visits.length} visitas pendientes programadas`, 14, 28);
    
    // Preparar datos para la tabla
    const tableData = visits.map(visit => {
      const visitDate = new Date(visit.scheduledDate);
      const dateFormatted = `${String(visitDate.getMonth() + 1).padStart(2, '0')}-${String(visitDate.getDate()).padStart(2, '0')}-${visitDate.getFullYear()}`;
      
      // Limpiar nombre del cliente - dejar vacío si contiene texto de placeholder
      let clientName = visit.applicantName || '';
      if (clientName.includes('EDITAR NOM') || clientName.includes('þ') || clientName.includes('&')) {
        clientName = '';
      }
      
      return [
        dateFormatted,
        `Visita ${visit.visitNumber}`,
        visit.propertyAddress || '',
        clientName,
        ZONES[visit.zone]?.name || visit.zone,
        VISIT_STATUS_LABELS[visit.status] || visit.status,
        visit.assignedStaff?.name || '',
        visit.isOverdue ? 'VENCIDA' : ''
      ];
    });
    
    autoTable(doc, {
      head: [['Fecha', 'Visita', 'Dirección', 'Cliente', 'Zona', 'Estado', 'Asignado', 'Alerta']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [200, 200, 200], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 60 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35 },
        5: { cellWidth: 25 },
        6: { cellWidth: 30 },
        7: { cellWidth: 25, halign: 'center' }
      }
    });
    
    // Guardar PDF
    const filename = `Mantenimiento_${zoneName_display.replace(/\s+/g, '_')}_${today.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Función para exportar a Excel
  const exportToExcel = (zoneName = 'all') => {
    const visits = getPendingAndCurrentVisits(zoneName);
    
    if (visits.length === 0) {
      alert('No hay visitas pendientes para exportar');
      return;
    }
    
    const zoneName_display = zoneName === 'all' ? 'Todas las Zonas' : ZONES[zoneName]?.name || zoneName;
    const today = new Date();
    
    // Preparar datos para Excel
    const excelData = visits.map(visit => {
      const visitDate = new Date(visit.scheduledDate);
      const dateFormatted = `${String(visitDate.getMonth() + 1).padStart(2, '0')}-${String(visitDate.getDate()).padStart(2, '0')}-${visitDate.getFullYear()}`;
      
      // Limpiar nombre del cliente - dejar vacío si contiene texto de placeholder
      let clientName = visit.applicantName || '';
      if (clientName.includes('EDITAR NOM') || clientName.includes('þ') || clientName.includes('&')) {
        clientName = '';
      }
      
      return {
        'Fecha Programada': dateFormatted,
        'Número de Visita': `Visita ${visit.visitNumber}`,
        'Dirección': visit.propertyAddress || '',
        'Cliente': clientName,
        'Zona': ZONES[visit.zone]?.name || visit.zone,
        'Estado': VISIT_STATUS_LABELS[visit.status] || visit.status,
        'Asignado a': visit.assignedStaff?.name || '',
        'Alerta': visit.isOverdue ? 'VENCIDA' : visit.isToday ? 'HOY' : visit.isThisWeek ? 'ESTA SEMANA' : ''
      };
    });
    
    // Crear worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Ajustar ancho de columnas
    const columnWidths = [
      { wch: 15 }, // Fecha
      { wch: 15 }, // Número Visita
      { wch: 50 }, // Dirección
      { wch: 30 }, // Cliente
      { wch: 25 }, // Zona
      { wch: 20 }, // Estado
      { wch: 25 }, // Asignado
      { wch: 15 }  // Alerta
    ];
    ws['!cols'] = columnWidths;
    
    // Crear workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visitas Pendientes');
    
    // Guardar Excel
    const filename = `Mantenimiento_${zoneName_display.replace(/\s+/g, '_')}_${today.toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const getTotalVisits = () => {
    return Object.values(zoneData).reduce((sum, visits) => sum + visits.length, 0);
  };

  const getOverdueCount = () => {
    return visitsWithDateInfo.filter(v => v.isOverdue).reduce((sum, visit) => {
      if (visit.isConsolidated) {
        return sum + visit.consolidatedCount;
      }
      return sum + 1;
    }, 0);
  };

  const isWorker = user?.role === 'worker';

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 m-6">
        Error al cargar las visitas de mantenimiento: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header con filtros */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Visitas de Mantenimiento por Zona
              </h1>
              <p className="text-gray-600 mt-1">
                Organizado por ubicación geográfica (ZIP Code / Ciudad)
              </p>
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="flex items-center">
                <CalendarIcon className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-gray-800">{getTotalVisits()}</p>
                  <p className="text-sm text-gray-600">Visitas Programadas</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-gray-800">{getOverdueCount()}</p>
                  <p className="text-sm text-gray-600">Visitas Vencidas</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {visitsWithDateInfo.filter(v => v.isThisWeek).length}
                  </p>
                  <p className="text-sm text-gray-600">Esta Semana</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <div className="flex items-center">
                <MapPinIcon className="h-8 w-8 text-orange-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {Object.values(zoneData).filter(z => z.length > 0).length}
                  </p>
                  <p className="text-sm text-gray-600">Zonas Activas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="mb-4 flex flex-col md:flex-row gap-3">
            <button
              onClick={() => navigate('/maintenance/calendar')}
              className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
            >
              <CalendarDaysIcon className="h-6 w-6" />
              Ver Calendario de Mantenimiento
            </button>
            
            <div className="flex gap-2">
              <button
                onClick={() => exportToPDF('all')}
                className="flex-1 md:flex-none px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg shadow-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
                title="Descargar PDF de todas las visitas pendientes"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                PDF Todas
              </button>
              <button
                onClick={() => exportToExcel('all')}
                className="flex-1 md:flex-none px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg shadow-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 flex items-center justify-center gap-2 font-semibold"
                title="Descargar Excel de todas las visitas pendientes"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Excel Todas
              </button>
            </div>
          </div>

          {/* Filtros */}
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

        {/* Listas de visitas por zona */}
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
                    
                    {/* Botones de exportación */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportToPDF(zoneName)}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center gap-2 text-white text-sm font-semibold backdrop-blur-sm"
                        title="Descargar PDF (pendientes hasta hoy)"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        PDF
                      </button>
                      <button
                        onClick={() => exportToExcel(zoneName)}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 flex items-center gap-2 text-white text-sm font-semibold backdrop-blur-sm"
                        title="Descargar Excel (pendientes hasta hoy)"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        Excel
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de visitas */}
                <div className="relative">
                  <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-200 hover:scrollbar-thumb-slate-600">
                    <div className="space-y-3">
                      {visitsInZone.map((visit) => {
                        const VisitItem = isWorker ? 'div' : Link;
                        const itemProps = isWorker 
                          ? {
                              className: "block p-4 bg-slate-50 border-2 border-slate-200 rounded-lg cursor-not-allowed opacity-75"
                            }
                          : {
                              to: `/maintenance/works`,
                              state: { 
                                selectedWorkId: visit.work.idWork,
                                returnTo: '/maintenance/zones',
                                returnFilters: { selectedMonth, selectedZone }
                              },
                              className: `block p-4 bg-slate-50 hover:bg-blue-50 border-2 rounded-lg transition-all duration-200 hover:shadow-md ${
                                visit.isOverdue ? 'border-red-400 bg-red-50' : 
                                visit.isToday ? 'border-yellow-400 bg-yellow-50' : 
                                'border-slate-200'
                              }`
                            };

                        return (
                          <VisitItem
                            key={visit.isConsolidated ? `consolidated-${visit.work.idWork}` : visit.id}
                            {...itemProps}
                          >
                            {/* Dirección */}
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800 line-clamp-2">
                                  {visit.propertyAddress}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Cliente: {visit.applicantName}
                                </p>
                              </div>
                              {visit.isConsolidated ? (
                                <span className="ml-2 text-xs px-2 py-1 rounded-full bg-red-500 text-white font-semibold">
                                  {visit.consolidatedCount} visitas vencidas
                                </span>
                              ) : (
                                <span className="ml-2 text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">
                                  Visita {visit.visitNumber}
                                </span>
                              )}
                            </div>

                            {/* Fecha y estado */}
                            <div className="flex items-center justify-between text-xs mt-2">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className={`h-4 w-4 ${
                                  visit.isOverdue ? 'text-red-600' : 
                                  visit.isToday ? 'text-yellow-600' : 
                                  'text-blue-600'
                                }`} />
                                <span className={`font-semibold ${
                                  visit.isOverdue ? 'text-red-700' : 
                                  visit.isToday ? 'text-yellow-700' : 
                                  'text-slate-700'
                                }`}>
                                  {visit.isConsolidated 
                                    ? `Desde ${formatVisitDate(visit.scheduledDate, visit.daysUntilVisit)}`
                                    : formatVisitDate(visit.scheduledDate, visit.daysUntilVisit)
                                  }
                                </span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${
                                VISIT_STATUS_COLORS[visit.status] || 'bg-gray-100 text-gray-700'
                              }`}>
                                {VISIT_STATUS_LABELS[visit.status] || visit.status}
                              </span>
                            </div>

                            {/* Staff asignado si existe */}
                            {visit.assignedStaff && (
                              <div className="mt-2 text-xs text-gray-600">
                                👤 Asignado a: {visit.assignedStaff.name}
                              </div>
                            )}
                            
                            {/* Mostrar detalle de visitas consolidadas */}
                            {visit.isConsolidated && (
                              <div className="mt-2 pt-2 border-t border-red-200">
                                <p className="text-xs font-semibold text-red-700 mb-1">
                                  📋 Visitas pendientes:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {visit.consolidatedVisits.map(v => (
                                    <span key={v.id} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                      Visita {v.visitNumber}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </VisitItem>
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

        {/* Mensaje si no hay visitas */}
        {getTotalVisits() === 0 && (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-slate-200">
            <CalendarIcon className="h-20 w-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 text-xl font-medium">
              No hay visitas de mantenimiento programadas
            </p>
            <p className="text-slate-500 text-sm mt-2">
              {selectedMonth !== 'all' || selectedZone !== 'all' 
                ? 'Prueba ajustando los filtros para ver más resultados.'
                : 'Todas las visitas de mantenimiento han sido completadas o canceladas.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceWorks;
