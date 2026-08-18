import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchClaims, deleteClaim, updateClaim } from '../../Redux/Actions/claimActions';
import ClaimFormModal from './ClaimFormModal';
import ClaimDetailModal from './ClaimDetailModal';
import { toast } from 'react-toastify';
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  CheckCircleIcon,
  MapPinIcon,
  UserIcon,
  PhotoIcon,
  FunnelIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import {
  ExclamationTriangleIcon as ExclamationSolid,
  FireIcon,
} from '@heroicons/react/24/solid';

const PRIORITY_CONFIG = {
  low:    { label: 'Baja',    badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Media',   badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-400' },
  high:   { label: 'Alta',    badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  urgent: { label: 'Urgente', badge: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
};

const STATUS_CONFIG = {
  pending:     { label: 'Pendiente',   badge: 'bg-slate-100 text-slate-700 ring-slate-300', icon: ClockIcon },
  scheduled:   { label: 'Agendado',    badge: 'bg-sky-50 text-sky-700 ring-sky-200', icon: CalendarDaysIcon },
  in_progress: { label: 'En Progreso', badge: 'bg-violet-50 text-violet-700 ring-violet-200', icon: WrenchScrewdriverIcon },
  completed:   { label: 'Completado',  badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: CheckCircleIcon },
  closed:      { label: 'Cerrado',     badge: 'bg-gray-100 text-gray-600 ring-gray-300', icon: CheckCircleIcon },
  cancelled:   { label: 'Cancelado',   badge: 'bg-red-50 text-red-600 ring-red-200', icon: XMarkIcon },
};

const TYPE_CONFIG = {
  warranty:  { label: 'Garantía',    color: 'text-blue-600' },
  repair:    { label: 'Reparación',  color: 'text-orange-600' },
  callback:  { label: 'Callback',    color: 'text-purple-600' },
  complaint: { label: 'Queja',       color: 'text-red-600' },
  other:     { label: 'Otro',        color: 'text-gray-600' },
};

const ClaimList = () => {
  const dispatch = useDispatch();
  const { claims, loading } = useSelector((state) => state.claim);
  const { staff } = useSelector((state) => state.auth);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const filters = {
    status:    searchParams.get('status')    || '',
    priority:  searchParams.get('priority')  || '',
    search:    searchInput,
    claimType: searchParams.get('claimType') || '',
  };

  useEffect(() => {
    dispatch(fetchClaims({ limit: 500 }));
  }, [dispatch]);

  const handleFilterChange = (field, value) => {
    if (field === 'search') {
      setSearchInput(value);
      setSearchParams(p => { if (value) p.set('q', value); else p.delete('q'); return p; }, { replace: true });
    } else {
      setSearchParams(p => { if (value) p.set(field, value); else p.delete(field); return p; });
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = filters.status || filters.priority || filters.search || filters.claimType;

  const STATUS_ORDER = { pending: 0, scheduled: 1, in_progress: 2, completed: 3, closed: 4, cancelled: 5 };
  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

  const filteredClaims = useMemo(() => {
    return (claims || [])
      .filter(claim => {
        if (filters.status && claim.status !== filters.status) return false;
        if (filters.priority && claim.priority !== filters.priority) return false;
        if (filters.claimType && claim.claimType !== filters.claimType) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const searchable = [claim.claimNumber, claim.clientName, claim.propertyAddress, claim.description]
            .filter(Boolean).join(' ').toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [claims, filters]);

  const handleViewDetail = (claim) => {
    setSelectedClaim(claim);
    setShowDetailModal(true);
  };

  const handleEdit = (claim) => {
    setEditingClaim(claim);
    setShowFormModal(true);
  };

  const handleEditFromDetail = (claim) => {
    setShowDetailModal(false);
    setSelectedClaim(null);
    setTimeout(() => {
      setEditingClaim(claim);
      setShowFormModal(true);
    }, 200);
  };

  const handleDelete = async (claim) => {
    if (!window.confirm(`¿Eliminar reclamo ${claim.claimNumber}? Esta acción no se puede deshacer.`)) return;
    try {
      await dispatch(deleteClaim(claim.id));
      toast.success('Reclamo eliminado');
    } catch (error) {
      toast.error('Error eliminando reclamo');
    }
  };

  const handleQuickStatusChange = async (claim, newStatus) => {
    try {
      await dispatch(updateClaim(claim.id, { status: newStatus }));
      toast.success(`Estado actualizado a ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      dispatch(fetchClaims({ limit: 500 }));
    } catch (error) {
      toast.error('Error actualizando estado');
    }
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setEditingClaim(null);
  };

  const handleSaved = () => {
    dispatch(fetchClaims({ limit: 500 }));
  };

  // Summary
  const summary = useMemo(() => ({
    total: claims.length,
    pending: claims.filter(c => c.status === 'pending').length,
    scheduled: claims.filter(c => c.status === 'scheduled').length,
    in_progress: claims.filter(c => c.status === 'in_progress').length,
    completed: claims.filter(c => c.status === 'completed').length,
    urgent: claims.filter(c => c.priority === 'urgent' && !['completed', 'closed', 'cancelled'].includes(c.status)).length,
  }), [claims]);

  if (loading && claims.length === 0) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-4">Cargando reclamos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* --- Header --- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
              <div className="p-2 bg-red-100 rounded-lg">
                <ExclamationSolid className="h-6 w-6 text-red-600" />
              </div>
              Reclamos
            </h1>
            <p className="text-sm text-gray-500 mt-1 ml-12">
              {summary.total} total &middot; {filteredClaims.length} mostrados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch(fetchClaims({ limit: 500 }))}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm"
              title="Actualizar"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              onClick={() => { setEditingClaim(null); setShowFormModal(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo Reclamo
            </button>
          </div>
        </div>

        {/* --- Banner filtros activos --- */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 mb-4">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <FunnelIcon className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Filtros activos:</span>
              {filters.status && <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-semibold">{STATUS_CONFIG[filters.status]?.label || filters.status}</span>}
              {filters.priority && <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-semibold">{PRIORITY_CONFIG[filters.priority]?.label || filters.priority}</span>}
              {filters.claimType && <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-semibold">{TYPE_CONFIG[filters.claimType]?.label || filters.claimType}</span>}
              {filters.search && <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-semibold">"{filters.search}"</span>}
              <span className="text-amber-600">— mostrando {filteredClaims.length} de {summary.total}</span>
            </div>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-amber-800 hover:text-amber-900 underline whitespace-nowrap ml-4"
            >
              Ver todos
            </button>
          </div>
        )}

        {/* --- Summary Cards --- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { key: 'pending',     label: 'Pendientes',  count: summary.pending,     color: 'border-slate-300 bg-white',      textColor: 'text-slate-800', onClick: () => handleFilterChange('status', filters.status === 'pending' ? '' : 'pending') },
            { key: 'scheduled',   label: 'Agendados',   count: summary.scheduled,   color: 'border-sky-300 bg-sky-50/50',     textColor: 'text-sky-800', onClick: () => handleFilterChange('status', filters.status === 'scheduled' ? '' : 'scheduled') },
            { key: 'in_progress', label: 'En Progreso', count: summary.in_progress, color: 'border-violet-300 bg-violet-50/50', textColor: 'text-violet-800', onClick: () => handleFilterChange('status', filters.status === 'in_progress' ? '' : 'in_progress') },
            { key: 'completed',   label: 'Completados', count: summary.completed,   color: 'border-emerald-300 bg-emerald-50/50', textColor: 'text-emerald-800', onClick: () => handleFilterChange('status', filters.status === 'completed' ? '' : 'completed') },
            { key: 'total',       label: 'Total',       count: summary.total,       color: 'border-gray-300 bg-white',        textColor: 'text-gray-800', onClick: clearFilters },
            ...(summary.urgent > 0 ? [{ key: 'urgent', label: 'Urgentes', count: summary.urgent, color: 'border-red-400 bg-red-50 ring-1 ring-red-200', textColor: 'text-red-700', onClick: () => handleFilterChange('priority', filters.priority === 'urgent' ? '' : 'urgent') }] : []),
          ].map(card => (
            <button
              key={card.key}
              onClick={card.onClick}
              className={`border rounded-xl p-3 text-center transition hover:shadow-md cursor-pointer ${card.color} ${
                (filters.status === card.key || filters.priority === card.key) ? 'ring-2 ring-red-400 shadow-md' : ''
              }`}
            >
              <p className={`text-2xl font-bold ${card.textColor}`}>{card.count}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{card.label}</p>
            </button>
          ))}
        </div>

        {/* --- Search + Filters --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-4 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Buscar por cliente, dirección, número..."
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
              />
              {filters.search && (
                <button onClick={() => handleFilterChange('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {/* Toggle Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border rounded-lg transition ${
                hasActiveFilters
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold">
                  {[filters.status, filters.priority, filters.claimType].filter(Boolean).length}
                </span>
              )}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-3 py-2.5 text-sm text-gray-600 hover:text-red-600 transition"
              >
                <XMarkIcon className="h-4 w-4" />
                Limpiar
              </button>
            )}
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div className="px-4 pb-4 pt-0 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Estado</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Todos los estados</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Prioridad</label>
                  <select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Todas las prioridades</option>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tipo</label>
                  <select
                    value={filters.claimType}
                    onChange={(e) => handleFilterChange('claimType', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Todos los tipos</option>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- Claims Table --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredClaims.length === 0 ? (
            <div className="p-16 text-center">
              <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-3 text-sm font-semibold text-gray-900">No se encontraron reclamos</h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasActiveFilters ? 'Intenta ajustar los filtros de búsqueda.' : 'Comienza creando un nuevo reclamo.'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-4 text-sm font-medium text-red-600 hover:text-red-700">
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reclamo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente & Dirección</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prioridad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fechas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asignado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClaims.map((claim) => {
                    const priorityCfg = PRIORITY_CONFIG[claim.priority] || PRIORITY_CONFIG.medium;
                    const statusCfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.icon;
                    const typeCfg = TYPE_CONFIG[claim.claimType] || TYPE_CONFIG.other;
                    const hasImages = (claim.claimImages?.length > 0) || (claim.repairImages?.length > 0);

                    return (
                      <tr
                        key={claim.id}
                        className={`hover:bg-gray-50/80 transition cursor-pointer ${claim.priority === 'urgent' ? 'bg-red-50/40' : ''}`}
                        onClick={() => handleViewDetail(claim)}
                      >
                        {/* Claim Number */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 font-mono">{claim.claimNumber}</span>
                            {hasImages && (
                              <PhotoIcon className="h-4 w-4 text-blue-400" title="Tiene imágenes" />
                            )}
                          </div>
                        </td>
                        {/* Client + Address */}
                        <td className="px-4 py-3.5">
                          <div className="max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-900 truncate">{claim.clientName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <MapPinIcon className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                              <span className="text-xs text-gray-500 truncate" title={claim.propertyAddress}>
                                {claim.propertyAddress}
                              </span>
                            </div>
                            {(claim.linkedWorkId || claim.linkedSimpleWorkId) && (
                              <span className="inline-flex items-center text-xs text-emerald-600 font-medium mt-0.5">
                                <CheckCircleIcon className="h-3 w-3 mr-0.5" /> Vinculado
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Type */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`text-sm font-medium ${typeCfg.color}`}>{typeCfg.label}</span>
                        </td>
                        {/* Priority */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ${priorityCfg.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${priorityCfg.dot}`}></span>
                            {priorityCfg.label}
                            {claim.priority === 'urgent' && <FireIcon className="h-3 w-3 text-red-500" />}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ${statusCfg.badge}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusCfg.label}
                          </span>
                        </td>
                        {/* Dates */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="space-y-0.5">
                            {claim.claimDate && (
                              <p className="text-xs text-gray-500">
                                {new Date(claim.claimDate).toLocaleDateString()}
                              </p>
                            )}
                            {claim.scheduledDate && (
                              <p className="text-xs text-sky-600 font-medium flex items-center gap-1">
                                <CalendarDaysIcon className="h-3 w-3" />
                                {new Date(claim.scheduledDate).toLocaleDateString()}
                              </p>
                            )}
                            {claim.repairDate && (
                              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircleIcon className="h-3 w-3" />
                                {new Date(claim.repairDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </td>
                        {/* Assigned */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {claim.assignedStaff ? (
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <UserIcon className="h-4 w-4 text-blue-600" />
                              </div>
                              <span className="text-sm text-gray-700">{claim.assignedStaff.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Sin asignar</span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <ClaimDetailModal
        isOpen={showDetailModal}
        claim={selectedClaim}
        onClose={() => { setShowDetailModal(false); setSelectedClaim(null); }}
        onEdit={handleEditFromDetail}
        onStatusChange={handleQuickStatusChange}
        onDelete={handleDelete}
      />

      {/* Form Modal */}
      <ClaimFormModal
        isOpen={showFormModal}
        onClose={handleCloseFormModal}
        editingClaim={editingClaim}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default ClaimList;
