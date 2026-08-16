import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWorks, deleteWork } from "../../Redux/Actions/workActions"; // Acción para obtener y eliminar works
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  BuildingOfficeIcon, 
  MapPinIcon, 
  EyeIcon,
  ClockIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const Works = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // 📄 Estado de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  
  const [searchParams, setSearchParams] = useSearchParams();
  // 🔍 Estado de búsqueda
  const [searchTerm, setSearchTermState] = useState(searchParams.get('q') || '');
  const setSearchTerm = (v) => { setSearchTermState(v); setSearchParams(p => { if (v) p.set('q', v); else p.delete('q'); return p; }, { replace: true }); };
  const [isSearching, setIsSearching] = useState(false);
  
  // Obtener works desde el estado de Redux
  const { works, pagination, loading, error } = useSelector((state) => state.work);

  // ✅ Get current user role for delete permissions
  const { user, currentStaff } = useSelector((state) => state.auth);
  const staff = currentStaff || user;
  const userRole = staff?.role || '';
  const canDeleteWork = userRole === 'owner';

  // Cargar works al montar el componente y cuando cambie la página o búsqueda
  useEffect(() => {
    if (searchTerm.trim()) {
      // Si hay búsqueda, cargar TODOS los works
      setIsSearching(true);
      dispatch(fetchWorks(1, 'all'));
    } else {
      // Sin búsqueda, cargar solo la página actual
      setIsSearching(false);
      dispatch(fetchWorks(currentPage, itemsPerPage));
    }
  }, [dispatch, currentPage, itemsPerPage, searchTerm]);

  // 🔍 Filtrar works según el término de búsqueda
  const filteredWorks = works.filter(work => {
    if (!searchTerm.trim()) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      work.propertyAddress?.toLowerCase().includes(search) ||
      work.idWork?.toString().includes(search) ||
      work.status?.toLowerCase().includes(search)
    );
  });

  // Funciones de paginación
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination && currentPage < pagination.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'pending': return '⏳';
      case 'cancelled': return '❌';
      default: return '📋';
    }
  };

  const handleDeleteWork = async (work) => {
    const confirmMessage = `⚠️ ADVERTENCIA: Eliminación en Cascada\n\n` +
      `Se eliminará el trabajo "${work.propertyAddress}" y TODOS los registros asociados:\n\n` +
      `🏗️ Work ID: ${work.idWork}\n` +
      `📋 Budget asociado (si existe)\n` +
      `📄 Permit asociado y sus documentos\n` +
      `🧱 Todos los materiales y sets de materiales\n` +
      `🔍 Todas las inspecciones\n` +
      `📸 Todas las imágenes\n` +
      `💰 Todos los ingresos y gastos\n` +
      `📎 Todos los comprobantes (Receipts)\n` +
      `📝 Change Orders y Final Invoice\n` +
      `🔧 Visitas de mantenimiento\n` +
      `📊 Detalles de instalación\n\n` +
      `Esta acción NO se puede deshacer.\n\n` +
      `¿Estás seguro de que deseas continuar?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const result = await dispatch(deleteWork(work.idWork));
        
        // Construir mensaje de éxito con el resumen de eliminación
        if (result && result.deleted) {
          const { deleted } = result;
          let successMessage = `✅ Trabajo "${work.propertyAddress}" eliminado exitosamente\n\n📊 Resumen de eliminación:\n\n`;
          
          if (deleted.images > 0) successMessage += `📸 Imágenes: ${deleted.images}\n`;
          if (deleted.receipts > 0) successMessage += `🧾 Receipts: ${deleted.receipts}\n`;
          if (deleted.materials > 0) successMessage += `🔨 Materiales: ${deleted.materials}\n`;
          if (deleted.inspections > 0) successMessage += `🔍 Inspecciones: ${deleted.inspections}\n`;
          if (deleted.incomes > 0) successMessage += `💰 Ingresos: ${deleted.incomes}\n`;
          if (deleted.expenses > 0) successMessage += `💸 Gastos: ${deleted.expenses}\n`;
          if (deleted.materialSets > 0) successMessage += `📦 Material Sets: ${deleted.materialSets}\n`;
          if (deleted.changeOrders > 0) successMessage += `📝 Change Orders: ${deleted.changeOrders}\n`;
          if (deleted.maintenanceVisits > 0) successMessage += `🔧 Visitas de Mantenimiento: ${deleted.maintenanceVisits}\n`;
          
          alert(successMessage);
        } else {
          alert('✅ Trabajo y todos sus datos asociados eliminados exitosamente');
        }
        
        dispatch(fetchWorks(currentPage, itemsPerPage)); // Recargar la lista con paginación
      } catch (error) {
        console.error('Error al eliminar work:', error);
        alert(`❌ Error al eliminar: ${error.message || 'Error desconocido'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <BuildingOfficeIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Construction Works</h1>
              <p className="text-gray-600">Manage and monitor all active projects</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address, ID, or status..."
              className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Search Results Counter */}
          {searchTerm && (
            <div className="text-sm text-gray-600">
              {loading ? (
                <span className="text-blue-600">🔍 Buscando en todos los proyectos...</span>
              ) : filteredWorks.length === 0 ? (
                <span className="text-red-600">❌ No results found for "{searchTerm}"</span>
              ) : (
                <span>
                  ✅ Found {filteredWorks.length} {filteredWorks.length === 1 ? 'project' : 'projects'}
                  {works.length > 0 && ` (searching across ${works.length} total projects)`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && !searchTerm && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-lg text-gray-600">Loading projects...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-center">
            <div className="text-red-500 text-xl mr-3">❌</div>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Projects</h3>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Works Content */}
      {!loading && !error && (
        <>
          {filteredWorks.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <BuildingOfficeIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                {searchTerm ? 'No Results Found' : 'No Projects Found'}
              </h3>
              <p className="text-gray-500">
                {searchTerm 
                  ? `No projects match "${searchTerm}". Try a different search term.`
                  : 'No construction projects available at the moment.'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4" />
                            Property Address
                          </div>
                        </th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          <div className="flex items-center justify-center gap-2">
                            <ClockIcon className="w-4 h-4" />
                            Status
                          </div>
                        </th>
                        <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredWorks.map((work, index) => (
                        <tr 
                          key={work.idWork} 
                          className={`hover:bg-gray-50 transition-colors duration-200 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                                <BuildingOfficeIcon className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{work.propertyAddress}</p>
                                <p className="text-sm text-gray-500">Project ID: {work.idWork}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(work.status)}`}>
                              <span>{getStatusIcon(work.status)}</span>
                              {work.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => navigate(`/work/${work.idWork}`)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                              >
                                <EyeIcon className="w-4 h-4" />
                                View Details
                              </button>
                              {canDeleteWork && (
                                <button
                                  onClick={() => handleDeleteWork(work)}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                  title="Eliminar trabajo y todos sus datos"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                  Delete
                                </button>
                              )}
                              {!canDeleteWork && (
                                <div className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed" title="Solo el owner puede eliminar works">
                                  <TrashIcon className="w-4 h-4 inline mr-1" />
                                  Delete (Owner Only)
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-4">
                {filteredWorks.map((work) => (
                  <div
                    key={work.idWork}
                    className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                        <BuildingOfficeIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate mb-1">
                          {work.propertyAddress}
                        </h3>
                        <p className="text-sm text-gray-500 mb-2">Project ID: {work.idWork}</p>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(work.status)}`}>
                          <span>{getStatusIcon(work.status)}</span>
                          {work.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/work/${work.idWork}`)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
                      >
                        <EyeIcon className="w-4 h-4" />
                        View Details
                      </button>
                      {canDeleteWork && (
                        <button
                          onClick={() => handleDeleteWork(work)}
                          className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
                          title="Eliminar trabajo"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                      {!canDeleteWork && (
                        <div className="px-4 py-3 bg-gray-200 text-gray-500 rounded-xl text-sm font-medium cursor-not-allowed" title="Solo el owner puede eliminar">
                          <TrashIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 📄 Controles de Paginación */}
              {!searchTerm && pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between bg-white rounded-2xl shadow-lg p-4">
                  <div className="text-sm text-gray-600">
                    Mostrando <span className="font-semibold">{works.length}</span> de{' '}
                    <span className="font-semibold">{pagination.total}</span> works
                    {' '}- Página <span className="font-semibold">{pagination.page}</span> de{' '}
                    <span className="font-semibold">{pagination.totalPages}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handlePreviousPage}
                      disabled={!pagination.hasPrevPage}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                        pagination.hasPrevPage
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                      Anterior
                    </button>
                    
                    <button
                      onClick={handleNextPage}
                      disabled={!pagination.hasNextPage}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                        pagination.hasNextPage
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Siguiente
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Works;