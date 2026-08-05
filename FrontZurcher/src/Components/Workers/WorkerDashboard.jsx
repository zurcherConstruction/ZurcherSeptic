import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchWorks } from "../../Redux/Actions/workActions";
import { 
  BriefcaseIcon, 
  WrenchScrewdriverIcon,
  ClockIcon,
  CheckCircleIcon,
  PhotoIcon,
  CurrencyDollarIcon
} from "@heroicons/react/24/outline";

const WorkerDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { works, loading, error } = useSelector((state) => state.work);
  const { user, currentStaff } = useSelector((state) => state.auth);
  const authStaff = currentStaff || user;

  const [activeTab, setActiveTab] = useState('assigned'); // assigned, inProgress, completed

  useEffect(() => {
    const staffId = authStaff?.idStaff || authStaff?.id;
    const isCapataz = authStaff?.role === 'capataz';

    if (isCapataz) {
      // Capataz ve todos los trabajos asignados del equipo
      dispatch(fetchWorks(1, 1000));
    } else if (staffId) {
      dispatch(fetchWorks(1, 1000, { staffId }));
    } else {
      console.warn('⚠️ WorkerDashboard: No staffId found for current user');
    }
  }, [dispatch, authStaff]);

  // Ya no necesitamos filtrar aquí porque el backend ya devuelve solo los trabajos del staff
  const myWorks = works || [];

  // Separar por estado
  // Asignados: incluye assigned y coverPending (pendiente de cubrir)
  const assignedWorks = myWorks.filter(w => 
    ['assigned', 'coverPending'].includes(w.status)
  );
  const inProgressWorks = myWorks.filter(w => w.status === 'inProgress');
  const completedWorks = myWorks.filter(w => 
    ['installed', 'covered', 'invoiceFinal', 'paymentReceived', 'maintenance'].includes(w.status)
  );
  // Trabajos rechazados que requieren acción
  const rejectedWorks = myWorks.filter(w => 
    ['rejectedInspection', 'finalRejected'].includes(w.status)
  );

  const getWorksByTab = () => {
    switch(activeTab) {
      case 'assigned': 
        // Mostrar rechazados primero, luego asignados
        return [...rejectedWorks, ...assignedWorks];
      case 'inProgress': return inProgressWorks;
      case 'completed': return completedWorks;
      default: return [...rejectedWorks, ...assignedWorks];
    }
  };

  const getStatusDisplay = (status) => {
    const statusMap = {
      assigned: { label: 'Asignado', color: 'bg-blue-100 text-blue-800' },
      inProgress: { label: 'En Progreso', color: 'bg-yellow-100 text-yellow-800' },
      installed: { label: 'Instalado', color: 'bg-green-100 text-green-800' },
      coverPending: { label: 'PARA CUBRIR', color: 'bg-amber-100 text-amber-900 border border-amber-400' },
      covered: { label: 'Cubierto', color: 'bg-green-100 text-green-800' },
      maintenance: { label: 'Mantenimiento', color: 'bg-purple-100 text-purple-800' },
      rejectedInspection: { label: 'Inspección Rechazada', color: 'bg-red-100 text-red-800' },
      finalRejected: { label: 'Inspección Final Rechazada', color: 'bg-red-100 text-red-800' },
    };
    // Capitalizar el status si no está en el mapa
    const fallbackLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Desconocido';
    return statusMap[status] || { label: fallbackLabel, color: 'bg-gray-100 text-gray-800' };
  };

  const handleWorkClick = (workId) => {
    navigate(`/worker/work/${workId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 sm:p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-2">Mis Trabajos</h1>
              <p className="text-green-100 text-sm sm:text-base">Bienvenido, {authStaff?.name}</p>
            </div>
            {/* Botones de Acción */}
            <div className="flex gap-2 flex-col sm:flex-row">
              <button
                onClick={() => navigate('/worker/maintenance')}
                className="flex items-center justify-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors"
              >
                <WrenchScrewdriverIcon className="h-5 w-5" />
                <span className="font-semibold">Mantenimientos</span>
              </button>
              <button
                onClick={() => navigate('/worker/general-expense')}
                className="flex items-center justify-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors"
              >
                <CurrencyDollarIcon className="h-5 w-5" />
                <span className="font-semibold">Gastos Generales</span>
              </button>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2 sm:p-4 text-center">
              <div className="text-xl sm:text-3xl font-bold">{assignedWorks.length + rejectedWorks.length}</div>
              <div className="text-xs sm:text-sm text-green-100">Asignados</div>
              {rejectedWorks.length > 0 && (
                <div className="text-xs text-red-200 font-semibold mt-1">
                  ⚠️ {rejectedWorks.length} rechazado{rejectedWorks.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2 sm:p-4 text-center">
              <div className="text-xl sm:text-3xl font-bold">{inProgressWorks.length}</div>
              <div className="text-xs sm:text-sm text-green-100">En Progreso</div>
            </div>
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-2 sm:p-4 text-center">
              <div className="text-xl sm:text-3xl font-bold">{completedWorks.length}</div>
              <div className="text-xs sm:text-sm text-green-100">Completados</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex space-x-1 border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex-1 min-w-fit py-3 sm:py-4 px-2 sm:px-4 text-center font-medium transition-colors ${
                activeTab === 'assigned'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BriefcaseIcon className="h-4 sm:h-5 w-4 sm:w-5 inline-block mr-1 sm:mr-2" />
              <span className="text-xs sm:text-base">Asignados ({assignedWorks.length + rejectedWorks.length})</span>
              {rejectedWorks.length > 0 && (
                <span className="ml-1 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('inProgress')}
              className={`flex-1 min-w-fit py-3 sm:py-4 px-2 sm:px-4 text-center font-medium transition-colors ${
                activeTab === 'inProgress'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClockIcon className="h-4 sm:h-5 w-4 sm:w-5 inline-block mr-1 sm:mr-2" />
              <span className="text-xs sm:text-base">En Progreso ({inProgressWorks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 min-w-fit py-3 sm:py-4 px-2 sm:px-4 text-center font-medium transition-colors ${
                activeTab === 'completed'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CheckCircleIcon className="h-4 sm:h-5 w-4 sm:w-5 inline-block mr-1 sm:mr-2" />
              <span className="text-xs sm:text-base">Completados ({completedWorks.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Work List */}
      <div className="max-w-7xl mx-auto p-4">
        {getWorksByTab().length === 0 ? (
          <div className="text-center py-12">
            <BriefcaseIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">
              No tienes trabajos en esta categoría
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {getWorksByTab().map((work) => {
              const statusInfo = getStatusDisplay(work.status);
              const isRejected = ['rejectedInspection', 'finalRejected'].includes(work.status);
              const isCoverPending = work.status === 'coverPending';
              
              return (
                <div
                  key={work.idWork}
                  onClick={() => handleWorkClick(work.idWork)}
                  className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden ${
                    isRejected ? 'ring-2 ring-red-500' : 
                    isCoverPending ? 'ring-2 ring-amber-400 bg-amber-50' : ''
                  }`}
                >
                  {/* Cover Pending Banner */}
                  {isCoverPending && (
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-5 py-2.5 text-center font-bold text-sm shadow-inner">
                      🛡️ PARA CUBRIR - Acción Requerida
                    </div>
                  )}
                  
                  {/* Rejection Banner */}
                  {isRejected && (
                    <div className="bg-red-500 text-white px-5 py-2 text-center font-bold text-sm">
                      ⚠️ {work.status === 'rejectedInspection' ? 'INSPECCIÓN RECHAZADA' : 'INSPECCIÓN FINAL RECHAZADA'}
                    </div>
                  )}
                  
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 mb-1 uppercase">
                          {work.propertyAddress || 'Sin dirección'}
                        </h3>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {work.startDate 
                          ? (() => {
                              const date = new Date(work.startDate + 'T12:00:00');
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              const year = date.getFullYear();
                              return `${month}-${day}-${year}`;
                            })()
                          : 'Sin fecha de inicio'
                        }
                      </div>
                      {work.images && work.images.length > 0 && (
                        <div className="flex items-center text-green-600">
                          <PhotoIcon className="h-4 w-4 mr-1" />
                          {work.images.length} foto{work.images.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer - Quick Actions */}
                  <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                    <div className="flex justify-end">
                      <button className="text-green-600 hover:text-green-700 font-medium text-sm">
                        Ver detalles →
                      </button>
                    </div>
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

export default WorkerDashboard;
