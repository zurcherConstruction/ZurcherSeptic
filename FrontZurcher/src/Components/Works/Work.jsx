import React, { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWorks, deleteWork } from "../../Redux/Actions/workActions";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../utils/axios";
import {
  BuildingOfficeIcon,
  MapPinIcon,
  EyeIcon,
  ClockIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "pending", label: "⏳ Pending" },
  { value: "assigned", label: "👷 Assigned" },
  { value: "inProgress", label: "🔄 In Progress" },
  { value: "completed", label: "✅ Completed" },
  { value: "coverPending", label: "🏗️ Cover Pending" },
  { value: "cancelled", label: "❌ Cancelled" },
];

const SYSTEM_TYPE_OPTIONS = [
  { value: "all", label: "Todos los sistemas" },
  { value: "ATU", label: "💧 ATU (todos)" },
  { value: "ATU_PBTS", label: "🌿 ATU + PBTS" },
  { value: "ATU_NO_PBTS", label: "💧 ATU sin PBTS" },
  { value: "Regular", label: "🔧 Regular" },
];

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "completed": return "bg-green-100 text-green-800 border-green-200";
    case "inprogress":
    case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200";
    case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "cancelled": return "bg-red-100 text-red-800 border-red-200";
    case "assigned": return "bg-purple-100 text-purple-800 border-purple-200";
    case "coverpending":
    case "cover_pending": return "bg-orange-100 text-orange-800 border-orange-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusLabel = (status) => {
  const found = STATUS_OPTIONS.find(o => o.value === status);
  return found ? found.label.replace(/^[^\w]+/, "") : status || "Unknown";
};

const Works = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filtros desde URL
  const getParam = (key, def = "") => searchParams.get(key) || def;
  const [filters, setFilters] = useState({
    search: getParam("q"),
    status: getParam("status", "all"),
    county: getParam("county", "all"),
    city: getParam("city"),
    systemType: getParam("systemType", "all"),
    isPBTS: getParam("isPBTS", "all"),
    applicantName: getParam("applicantName"),
    applicantEmail: getParam("applicantEmail"),
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [countySuggestions, setCountySuggestions] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const debounceRef = useRef(null);

  const { works, pagination, loading, error } = useSelector((s) => s.work);
  const { user, currentStaff } = useSelector((s) => s.auth);
  const staff = currentStaff || user;
  const canDeleteWork = (staff?.role || "") === "owner";

  // Cargar counties para autocomplete
  useEffect(() => {
    api.get("/permit/counties").then(r => setCountySuggestions(r.data || [])).catch(() => {});
  }, []);

  const doFetch = useCallback((page, f) => {
    dispatch(fetchWorks(page, itemsPerPage, f));
  }, [dispatch]);

  // Debounce para campos de texto libre
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      doFetch(1, filters);
      // Sync URL
      const p = new URLSearchParams();
      if (filters.search) p.set("q", filters.search);
      if (filters.status !== "all") p.set("status", filters.status);
      if (filters.county !== "all") p.set("county", filters.county);
      if (filters.city) p.set("city", filters.city);
      if (filters.systemType !== "all") p.set("systemType", filters.systemType);
      if (filters.isPBTS !== "all") p.set("isPBTS", filters.isPBTS);
      if (filters.applicantName) p.set("applicantName", filters.applicantName);
      if (filters.applicantEmail) p.set("applicantEmail", filters.applicantEmail);
      setSearchParams(p, { replace: true });
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [filters]);

  useEffect(() => {
    doFetch(currentPage, filters);
  }, [currentPage]);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const clearAllFilters = () => setFilters({
    search: "", status: "all", county: "all", city: "",
    systemType: "all", isPBTS: "all", applicantName: "", applicantEmail: "",
  });

  const hasActiveFilters = filters.search || filters.status !== "all" || filters.county !== "all" ||
    filters.city || filters.systemType !== "all" || filters.isPBTS !== "all" ||
    filters.applicantName || filters.applicantEmail;

  const activeFilterCount = [
    filters.search, filters.status !== "all" && filters.status,
    filters.county !== "all" && filters.county, filters.city,
    filters.systemType !== "all" && filters.systemType,
    filters.isPBTS !== "all" && filters.isPBTS,
    filters.applicantName, filters.applicantEmail,
  ].filter(Boolean).length;

  const handleExportExcel = async (exportType = 'standard') => {
    setExportingExcel(exportType);
    try {
      const params = new URLSearchParams();
      params.append('exportType', exportType);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      if (filters.applicantName) params.append('applicantName', filters.applicantName);
      if (filters.applicantEmail) params.append('applicantEmail', filters.applicantEmail);
      if (filters.city) params.append('city', filters.city);
      if (filters.systemType === 'ATU_PBTS' || filters.systemType === 'ATU_NO_PBTS') {
        params.append('systemType', 'ATU');
        params.append('isPBTS', filters.systemType === 'ATU_PBTS' ? 'true' : 'false');
      } else {
        if (filters.systemType && filters.systemType !== 'all') params.append('systemType', filters.systemType);
        if (filters.isPBTS && filters.isPBTS !== 'all') params.append('isPBTS', filters.isPBTS);
      }
      if (filters.county && filters.county !== 'all') params.append('county', filters.county);

      const response = await api.get(`/export/works?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `works-${exportType}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (e) {
      alert('❌ Error al exportar el Excel: ' + (e.message || 'Error desconocido'));
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDeleteWork = async (work) => {
    const msg = `⚠️ ADVERTENCIA: Eliminación en Cascada\n\nSe eliminará "${work.propertyAddress}" y TODOS los datos asociados.\n\nEsta acción NO se puede deshacer.\n\n¿Continuar?`;
    if (!window.confirm(msg)) return;
    try {
      const result = await dispatch(deleteWork(work.idWork));
      if (result?.deleted) {
        const d = result.deleted;
        let s = `✅ "${work.propertyAddress}" eliminado\n`;
        if (d.images > 0) s += `📸 ${d.images} imágenes\n`;
        if (d.expenses > 0) s += `💸 ${d.expenses} gastos\n`;
        alert(s);
      } else {
        alert("✅ Trabajo eliminado exitosamente");
      }
      doFetch(currentPage, filters);
    } catch (e) {
      alert(`❌ Error: ${e.message || "Error desconocido"}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <BuildingOfficeIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Construction Works</h1>
                <p className="text-gray-500 text-sm">
                  {pagination?.total != null ? `${pagination.total} trabajos en total` : "Todos los proyectos"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-all"
                title="Exportar a Excel"
              >
                <span className="text-lg">📥</span>
                <span className="hidden sm:inline">Exportar Excel</span>
              </button>
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-medium transition-all ${
                  filtersOpen || hasActiveFilters
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Barra de búsqueda siempre visible */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilter("search", e.target.value)}
              placeholder="Buscar por dirección..."
              className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {filters.search && (
              <button onClick={() => setFilter("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Panel de filtros avanzados */}
          {filtersOpen && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FunnelIcon className="w-4 h-4" /> Filtros avanzados
                </span>
                {hasActiveFilters && (
                  <button onClick={clearAllFilters} className="text-xs text-red-600 hover:text-red-800 font-medium">
                    Limpiar todo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado del Work</label>
                  <select
                    value={filters.status}
                    onChange={e => setFilter("status", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* System Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Sistema</label>
                  <select
                    value={filters.systemType}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "ATU_PBTS") {
                        setFilters(prev => ({ ...prev, systemType: "ATU_PBTS", isPBTS: "true" }));
                      } else if (v === "ATU_NO_PBTS") {
                        setFilters(prev => ({ ...prev, systemType: "ATU_NO_PBTS", isPBTS: "false" }));
                      } else {
                        setFilters(prev => ({ ...prev, systemType: v, isPBTS: "all" }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {SYSTEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* PBTS */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">PBTS</label>
                  <select
                    value={filters.isPBTS}
                    onChange={e => setFilter("isPBTS", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">Todos</option>
                    <option value="true">✅ Es PBTS</option>
                    <option value="false">❌ No es PBTS</option>
                  </select>
                </div>

                {/* County */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">County</label>
                  <input
                    type="text"
                    list="county-filter-suggestions"
                    value={filters.county === "all" ? "" : filters.county}
                    onChange={e => setFilter("county", e.target.value || "all")}
                    placeholder="Ej: Lee County"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="county-filter-suggestions">
                    {countySuggestions.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={filters.city}
                    onChange={e => setFilter("city", e.target.value)}
                    placeholder="Ej: Fort Myers"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Applicant Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del Cliente</label>
                  <input
                    type="text"
                    value={filters.applicantName}
                    onChange={e => setFilter("applicantName", e.target.value)}
                    placeholder="Nombre del applicant..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="text"
                    value={filters.applicantEmail}
                    onChange={e => setFilter("applicantEmail", e.target.value)}
                    placeholder="email@ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filtros activos */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                  {filters.search && <FilterTag label={`Búsqueda: "${filters.search}"`} onRemove={() => setFilter("search", "")} />}
                  {filters.status !== "all" && <FilterTag label={`Estado: ${getStatusLabel(filters.status)}`} onRemove={() => setFilter("status", "all")} />}
                  {filters.county !== "all" && <FilterTag label={`County: ${filters.county}`} onRemove={() => setFilter("county", "all")} />}
                  {filters.city && <FilterTag label={`Ciudad: ${filters.city}`} onRemove={() => setFilter("city", "")} />}
                  {filters.systemType !== "all" && <FilterTag label={`Sistema: ${filters.systemType}`} onRemove={() => setFilter("systemType", "all")} />}
                  {filters.isPBTS !== "all" && <FilterTag label={filters.isPBTS === "true" ? "PBTS: Sí" : "PBTS: No"} onRemove={() => setFilter("isPBTS", "all")} />}
                  {filters.applicantName && <FilterTag label={`Cliente: ${filters.applicantName}`} onRemove={() => setFilter("applicantName", "")} />}
                  {filters.applicantEmail && <FilterTag label={`Email: ${filters.applicantEmail}`} onRemove={() => setFilter("applicantEmail", "")} />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-lg text-gray-600">Cargando proyectos...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <p className="text-red-700 font-medium">❌ {error}</p>
        </div>
      )}

      {/* Contenido */}
      {!loading && !error && (
        <>
          {works.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <BuildingOfficeIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No se encontraron proyectos</h3>
              <p className="text-gray-500 mb-4">Ningún work coincide con los filtros aplicados.</p>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  Limpiar filtros
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
                        <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Dirección / Cliente</th>
                        <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">County / Ciudad</th>
                        <th className="px-5 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Sistema</th>
                        <th className="px-5 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                        <th className="px-5 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {works.map((work, i) => {
                        const permit = work.Permit;
                        const budget = work.budget;
                        const clientName = permit?.applicantName || budget?.applicantName || "";
                        const county = permit?.county || work.county || "";
                        const city = permit?.city || "";
                        const systemType = permit?.systemType || "";
                        const isPBTS = permit?.isPBTS;
                        return (
                          <tr key={work.idWork} className={`hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow flex-shrink-0">
                                  <BuildingOfficeIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{work.propertyAddress || permit?.propertyAddress}</p>
                                  {clientName && <p className="text-xs text-gray-500">{clientName}</p>}
                                  <p className="text-xs text-gray-400">ID: {work.idWork}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm">
                                {county && <p className="font-medium text-gray-700">{county}</p>}
                                {city && <p className="text-xs text-gray-500">{city}</p>}
                                {!county && !city && <span className="text-xs text-gray-400">—</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {systemType && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                    {systemType}
                                  </span>
                                )}
                                {isPBTS && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    PBTS
                                  </span>
                                )}
                                {!systemType && !isPBTS && <span className="text-xs text-gray-400">—</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(work.status)}`}>
                                {getStatusLabel(work.status)}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => navigate(`/work/${work.idWork}`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all text-sm font-medium shadow"
                                >
                                  <EyeIcon className="w-4 h-4" />
                                  Ver
                                </button>
                                {canDeleteWork ? (
                                  <button
                                    onClick={() => handleDeleteWork(work)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all text-sm font-medium shadow"
                                    title="Eliminar trabajo"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <div className="px-3 py-2 bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed" title="Solo el owner puede eliminar">
                                    <TrashIcon className="w-4 h-4" />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="block lg:hidden space-y-3">
                {works.map((work) => {
                  const permit = work.Permit;
                  const budget = work.budget;
                  const clientName = permit?.applicantName || budget?.applicantName || "";
                  const county = permit?.county || "";
                  const city = permit?.city || "";
                  const systemType = permit?.systemType || "";
                  const isPBTS = permit?.isPBTS;
                  return (
                    <div key={work.idWork} className="bg-white rounded-2xl shadow-lg p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                          <BuildingOfficeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{work.propertyAddress || permit?.propertyAddress}</p>
                          {clientName && <p className="text-xs text-gray-500">{clientName}</p>}
                          {(county || city) && (
                            <p className="text-xs text-gray-500">{[county, city].filter(Boolean).join(" · ")}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {systemType && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">{systemType}</span>}
                            {isPBTS && <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">PBTS</span>}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(work.status)}`}>
                              {getStatusLabel(work.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/work/${work.idWork}`)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-medium shadow"
                        >
                          <EyeIcon className="w-4 h-4" />
                          Ver detalles
                        </button>
                        {canDeleteWork && (
                          <button
                            onClick={() => handleDeleteWork(work)}
                            className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl shadow"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginación */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between bg-white rounded-2xl shadow-lg p-4">
                  <p className="text-sm text-gray-600">
                    Mostrando <span className="font-semibold">{works.length}</span> de{" "}
                    <span className="font-semibold">{pagination.total}</span> — Página{" "}
                    <span className="font-semibold">{pagination.page}</span> de{" "}
                    <span className="font-semibold">{pagination.totalPages}</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPrevPage}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        pagination.hasPrevPage
                          ? "bg-blue-500 text-white hover:bg-blue-600 shadow"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <ChevronLeftIcon className="w-4 h-4" /> Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!pagination.hasNextPage}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        pagination.hasNextPage
                          ? "bg-blue-500 text-white hover:bg-blue-600 shadow"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Siguiente <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
      {/* Modal de exportación */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-800">Exportar Works a Excel</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-500 hover:text-gray-700">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {hasActiveFilters && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <p className="font-semibold mb-1">Filtros activos — el Excel respetará:</p>
                  <div className="flex flex-wrap gap-1">
                    {filters.search && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Búsqueda: {filters.search}</span>}
                    {filters.status !== 'all' && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Estado: {filters.status}</span>}
                    {filters.county !== 'all' && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">County: {filters.county}</span>}
                    {filters.city && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Ciudad: {filters.city}</span>}
                    {filters.systemType !== 'all' && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Sistema: {filters.systemType}</span>}
                    {filters.isPBTS !== 'all' && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">PBTS: {filters.isPBTS === 'true' ? 'Sí' : 'No'}</span>}
                    {filters.applicantName && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Cliente: {filters.applicantName}</span>}
                    {filters.applicantEmail && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">Email: {filters.applicantEmail}</span>}
                  </div>
                </div>
              )}

              <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                <p className="text-xs font-semibold text-blue-900 mb-1">Estándar</p>
                <p className="text-xs text-blue-700">
                  Address · Applicant · County · City · Sistema · PBTS · Email · Status · Start Date · Installation Date · Final Invoice Date
                </p>
              </div>

              <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                <p className="text-xs font-semibold text-green-900 mb-1">Completo (Control)</p>
                <p className="text-xs text-green-700">
                  Address · Applicant · County · City · Permit # · Email · Sistema · PBTS · Status · Start Date ·
                  Initial Insp. (fecha + resultado) · Final Insp. (fecha + resultado) · Fee Paid · Final Invoice Date
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t flex-wrap">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleExportExcel('standard')}
                disabled={!!exportingExcel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-400 flex items-center gap-2"
              >
                {exportingExcel === 'standard' ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /><span>Exportando...</span></>
                ) : (
                  <><span>📊</span><span>Estándar</span></>
                )}
              </button>
              <button
                onClick={() => handleExportExcel('complete')}
                disabled={!!exportingExcel}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors disabled:bg-gray-400 flex items-center gap-2"
              >
                {exportingExcel === 'complete' ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /><span>Exportando...</span></>
                ) : (
                  <><span>📋</span><span>Completo</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FilterTag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
    {label}
    <button onClick={onRemove} className="hover:text-blue-600 ml-0.5">
      <XMarkIcon className="w-3.5 h-3.5" />
    </button>
  </span>
);

export default Works;
