import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FaTruck, FaCogs, FaTools, FaPlus, FaSearch, FaFilter,
  FaWrench, FaCheckCircle, FaExclamationTriangle, FaTimesCircle,
  FaChartBar
} from 'react-icons/fa';
import { fetchFleetAssets, fetchFleetStats } from '../../Redux/Actions/fleetActions';
import FleetAssetCard from './FleetAssetCard';
import FleetAssetForm from './FleetAssetForm';

const assetTypeIcons = {
  vehicle: FaTruck,
  machine: FaCogs,
  equipment: FaTools,
  trailer: FaTruck,
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  in_repair: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800',
  retired: 'bg-red-100 text-red-800',
};

const statusLabels = {
  active: 'Activo',
  in_repair: 'En Reparación',
  inactive: 'Inactivo',
  retired: 'Retirado',
};

export default function FleetDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { assets, stats, loading } = useSelector((state) => state.fleet);

  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchFleetAssets());
    dispatch(fetchFleetStats());
  }, [dispatch]);

  const handleFilterChange = () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    if (filterType) params.assetType = filterType;
    if (search) params.search = search;
    dispatch(fetchFleetAssets(params));
  };

  useEffect(() => {
    const timer = setTimeout(handleFilterChange, 400);
    return () => clearTimeout(timer);
  }, [filterStatus, filterType, search]);

  const nonRetiredAssets = assets.filter((a) => a.status !== 'retired');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-6 md:py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <FaTruck className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Fleet & Equipment</h1>
              <p className="text-blue-100 text-sm mt-0.5">Control de vehículos, máquinas y equipos</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-5 py-2.5 rounded-xl font-semibold text-sm shadow transition-colors"
          >
            <FaPlus /> Agregar Activo
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <FaChartBar className="text-blue-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalAssets}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <FaCheckCircle className="text-green-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Operativos</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeAssets}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <FaWrench className="text-amber-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">En Taller</p>
                <p className="text-3xl font-bold text-amber-600">{stats.inRepair}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <FaExclamationTriangle className="text-orange-600 text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Próx. Service</p>
                <p className="text-3xl font-bold text-orange-600">{stats.upcomingMaintenance}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, marca, placa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">Todos los tipos</option>
              <option value="vehicle">Vehículos</option>
              <option value="machine">Maquinaria</option>
              <option value="equipment">Equipos</option>
              <option value="trailer">Remolques</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            >
              <option value="">Todos los estados</option>
              <option value="active">Operativos</option>
              <option value="in_repair">En Taller</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Conteo */}
        {nonRetiredAssets.length > 0 && (
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
            {nonRetiredAssets.length} {nonRetiredAssets.length === 1 ? 'activo' : 'activos'}
          </p>
        )}

        {/* Grid de activos */}
        {loading && assets.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600" />
          </div>
        ) : nonRetiredAssets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTruck className="text-3xl text-blue-300" />
            </div>
            <p className="text-lg font-semibold text-gray-600">No hay activos registrados</p>
            <p className="text-sm text-gray-400 mt-1">Agrega el primer vehículo o máquina de la flota</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium"
            >
              <FaPlus /> Agregar Activo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {nonRetiredAssets.map((asset) => (
              <FleetAssetCard
                key={asset.id}
                asset={asset}
                onClick={() => navigate(`/fleet/${asset.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal nuevo activo */}
      {showForm && (
        <FleetAssetForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            dispatch(fetchFleetAssets());
            dispatch(fetchFleetStats());
          }}
        />
      )}
    </div>
  );
}
