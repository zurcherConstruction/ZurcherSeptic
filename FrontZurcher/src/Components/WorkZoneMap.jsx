import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWorks } from "../Redux/Actions/workActions";
import { Link } from "react-router-dom";
import { 
  MapPinIcon, 
  BuildingOfficeIcon 
} from '@heroicons/react/24/outline';
import useAutoRefresh from "../utils/useAutoRefresh";
import useFetchAllWorks from "../hooks/useFetchAllWorks";

// Definir las zonas y sus variantes de nombres
const ZONES = {
  'La Belle': {
    name: 'La Belle',
    color: 'orange',
    keywords: [
      'la belle', 'labelle', 'labell',
      'la. belle', 'l belle'
    ]
  },
  'Lehigh': {
    name: 'Lehigh Acres',
    color: 'purple',
    keywords: [
      'lehigh', 'lehigh acres', 'lehigh acre', 'leigh', 
      'leheigh', 'leihgh', 'l acres'
    ]
  },
  'North Port': {
    name: 'North Port / Port Charlotte',
    color: 'green',
    keywords: [
      // North Port variantes
      'north port', 'northport', 'n port', 'n. port', 'nport',
      'north pt', 'n pt', 'norht port', 'noth port',
      // Port Charlotte variantes
      'port charlotte', 'pt charlotte', 'portcharlotte', 'pt. charlotte',
      'charlotte', 'port char', 'p charlotte', 'pcharlotte',
      'port charlot', 'charlote'
    ]
  },
  'Cape Coral': {
    name: 'Cape Coral',
    color: 'blue',
    keywords: [
      'cape coral', 'cape', 'cc', 'c coral', 'capecoral',
      'cap coral', 'c. coral', 'coral'
    ]
  },
  'Other': {
    name: 'Otras Zonas',
    color: 'gray',
    keywords: []
  }
};

// Estados de campo que debe controlar (solo trabajo de campo activo)
const FIELD_WORK_STATUSES = [
  'pending',                    // Sin progreso - necesita asignación
  'assigned',                   // Asignado - compra en progreso
  'inProgress',                 // Instalando - trabajadores en campo
  'installed',                  // Instalado - esperando inspección
  'firstInspectionPending',     // Primera inspección pendiente
  'rejectedInspection',         // Inspección rechazada - necesita reinspección
  'coverPending'                // Cover pendiente
];

// Orden de progreso para sorting (menor número = menos progreso)
const STATUS_ORDER = {
  'pending': 0,
  'assigned': 0,                // Mismo nivel que pending (ambos en COMENZAR)
  'inProgress': 1,
  'installed': 2,
  'firstInspectionPending': 2,
  'rejectedInspection': 2,      // Mismo nivel que firstInspectionPending (ambos esperan inspección)
  'coverPending': 3
};

const STATUS_LABELS = {
  'pending': 'COMENZAR',
  'assigned': 'COMENZAR',
  'inProgress': 'INSTALANDO',
  'installed': 'INSPECCIÓN',
  'firstInspectionPending': 'INSPECCIÓN',
  'rejectedInspection': 'INSPECCIÓN',
  'coverPending': 'CUBRIR'
};

const STATUS_COLORS = {
  'pending': 'bg-gray-100 text-gray-700 border-gray-300',
  'assigned': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'inProgress': 'bg-blue-100 text-blue-700 border-blue-300',
  'installed': 'bg-purple-100 text-purple-700 border-purple-300',
  'firstInspectionPending': 'bg-purple-100 text-purple-700 border-purple-300',
  'rejectedInspection': 'bg-red-100 text-red-700 border-red-300',
  'coverPending': 'bg-orange-100 text-orange-700 border-orange-300'
};

const WorkZoneMap = () => {
  const dispatch = useDispatch();
  const { works, loading, error } = useSelector((state) => state.work);
  const { user } = useSelector((state) => state.auth); // Obtener usuario actual
  const [zoneData, setZoneData] = useState({});

  // ✅ Verificar si el usuario es worker (solo lectura)
  const isWorker = user?.role === 'worker';

  useEffect(() => {
    if (isWorker) {
      // 🎯 WORKERS: Solo obtener sus trabajos asignados
      const staffId = user?.idStaff || user?.id;
      if (staffId) {
        console.log(`🚀 WorkZoneMap (Worker): Obteniendo trabajos para staffId: ${staffId}...`);
        dispatch(fetchWorks(1, 1000, { staffId }));
      }
    } else {
      // 👥 ADMIN/MANAGER: Obtener todos los trabajos
      console.log('🚀 WorkZoneMap (Admin): Obteniendo TODOS los trabajos...');
      dispatch(fetchWorks(1, 'all')); 
    }
  }, [dispatch, isWorker, user]);

  // Auto-refresh cada 5 minutos con el mismo patrón de filtrado
  useAutoRefresh(() => {
    if (isWorker) {
      const staffId = user?.idStaff || user?.id;
      if (staffId) {
        return fetchWorks(1, 1000, { staffId });
      }
    } else {
      return fetchWorks(1, 'all');
    }
  }, 300000, [isWorker, user]);

  // Función para detectar la zona de una dirección
  const detectZone = (address) => {
    if (!address) return 'Other';
    
    // Convertir a minúsculas y eliminar espacios extras
    const lowerAddress = address.toLowerCase().trim().replace(/\s+/g, ' ');
    
    for (const [zoneName, zoneInfo] of Object.entries(ZONES)) {
      if (zoneName === 'Other') continue; // Skip 'Other' en la búsqueda
      
      for (const keyword of zoneInfo.keywords) {
        // Convertir keyword a minúsculas y comparar
        const lowerKeyword = keyword.toLowerCase();
        if (lowerAddress.includes(lowerKeyword)) {
          return zoneName;
        }
      }
    }
    
    return 'Other';
  };

  // Agrupar obras por zona
  useEffect(() => {
    if (!works) return;

    console.log('🔍 DEBUG WorkZoneMap - Total works:', works.length);
    console.log('🔍 DEBUG WorkZoneMap - Works coverPending:', works.filter(w => w.status === 'coverPending'));
    console.log('🔍 DEBUG WorkZoneMap - All statuses:', works.map(w => ({ id: w.idWork, address: w.propertyAddress, status: w.status })));

    // Filtrar solo obras de campo (estados que requieren trabajo en campo)
    const fieldWorks = works.filter(work => 
      FIELD_WORK_STATUSES.includes(work.status)
    );

    console.log('🔍 DEBUG WorkZoneMap - Field works:', fieldWorks.length);

    // Agrupar por zona
    const grouped = {};
    
    Object.keys(ZONES).forEach(zoneName => {
      grouped[zoneName] = [];
    });

    fieldWorks.forEach(work => {
      const zone = detectZone(work.propertyAddress);
      if (work.status === 'coverPending') {
        console.log('🔍 DEBUG Work coverPending:', work.propertyAddress, '→ Zona:', zone);
      }
      grouped[zone].push(work);
    });

    // Ordenar obras dentro de cada zona por progreso (menos progreso primero)
    Object.keys(grouped).forEach(zone => {
      grouped[zone].sort((a, b) => {
        const orderA = STATUS_ORDER[a.status] ?? 999;
        const orderB = STATUS_ORDER[b.status] ?? 999;
        return orderA - orderB;
      });
    });

    setZoneData(grouped);
  }, [works]);

  const getZoneHeaderColorClasses = (colorName) => {
    const colors = {
      blue: 'bg-gradient-to-r from-slate-700 to-blue-600 text-white',
      green: 'bg-gradient-to-r from-slate-700 to-green-600 text-white',
      purple: 'bg-gradient-to-r from-slate-700 to-purple-600 text-white',
      orange: 'bg-gradient-to-r from-slate-700 to-orange-600 text-white',
      gray: 'bg-gradient-to-r from-slate-700 to-slate-600 text-white'
    };
    return colors[colorName] || colors.gray;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error al cargar las obras: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-6">
        {/* Listas de Obras por Zona - TODAS ABIERTAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(ZONES).map(([zoneName, zoneInfo]) => {
            const worksInZone = zoneData[zoneName] || [];
            if (worksInZone.length === 0) return null;

            return (
              <div 
                key={zoneName}
                className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-slate-200"
              >
                {/* Header de la Zona - NO ES CLICKEABLE */}
                <div className={`${getZoneHeaderColorClasses(zoneInfo.color)} p-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BuildingOfficeIcon className="h-7 w-7" />
                      <div>
                        <h2 className="text-xl font-bold">
                          {zoneInfo.name}
                        </h2>
                        <p className="text-sm opacity-90">
                          {worksInZone.length} {worksInZone.length === 1 ? 'obra' : 'obras'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lista Simple - SIEMPRE VISIBLE con Scroll */}
                <div className="relative">
                  <div className="p-4 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-200 hover:scrollbar-thumb-slate-600">
                    <div className="space-y-2">
                      {worksInZone.map((work, index) => {
                      // Si es worker, renderizar div (solo lectura), si no, renderizar Link
                      const WorkItem = isWorker ? 'div' : Link;
                      const itemProps = isWorker 
                        ? {
                            className: "flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed opacity-75"
                          }
                        : {
                            to: `/work/${work.idWork}`,
                            className: "flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition-all duration-200 hover:border-blue-400 hover:shadow-md group"
                          };

                      return (
                        <WorkItem
                          key={work.idWork}
                          {...itemProps}
                        >
                          {/* Dirección */}
                          <div className="flex-1 mr-3">
                            <p className={`text-sm font-semibold ${isWorker ? 'text-slate-600' : 'text-slate-800 group-hover:text-blue-700'} line-clamp-2`}>
                              {work.propertyAddress}
                            </p>
                          </div>

                          {/* Estado */}
                          <div className="flex-shrink-0">
                            <span className={`text-xs px-3 py-1.5 rounded-full border font-bold whitespace-nowrap ${STATUS_COLORS[work.status] || 'bg-slate-100 text-slate-800'}`}>
                              {STATUS_LABELS[work.status] || work.status}
                            </span>
                          </div>
                        </WorkItem>
                      );
                    })}
                    </div>
                  </div>
                  
                  {/* Indicador de scroll si hay muchos items */}
                  {worksInZone.length > 5 && (
                    <div className="px-4 pb-3 pt-2 text-center text-xs font-semibold text-slate-600 bg-gradient-to-t from-white via-white to-transparent">
                      ⬇️ Scroll para ver todos los trabajos ({worksInZone.length} total) ⬇️
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mensaje si no hay obras */}
        {Object.values(zoneData).every(arr => arr.length === 0) && (
          <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-slate-200">
            <BuildingOfficeIcon className="h-20 w-20 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 text-xl font-medium">
              No hay trabajos de campo pendientes en este momento
            </p>
            <p className="text-slate-500 text-sm mt-2">
              (Pending, Inspection Pending, Cover Pending)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkZoneMap;
