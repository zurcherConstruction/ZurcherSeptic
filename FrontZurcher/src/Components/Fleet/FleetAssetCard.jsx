import React from 'react';
import {
  FaTruck, FaCogs, FaTools, FaWrench,
  FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaTachometerAlt, FaClock, FaUser, FaIdCard
} from 'react-icons/fa';

const statusConfig = {
  active: { label: 'Operativo', dot: 'bg-green-400', badge: 'bg-green-100 text-green-700 border-green-200', icon: FaCheckCircle },
  in_repair: { label: 'En Taller', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: FaWrench },
  inactive: { label: 'Inactivo', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 border-gray-200', icon: FaTimesCircle },
  retired: { label: 'Retirado', dot: 'bg-red-400', badge: 'bg-red-100 text-red-600 border-red-200', icon: FaTimesCircle },
};

const typeConfig = {
  vehicle: { icon: FaTruck, label: 'Vehículo', gradient: 'from-blue-500 to-blue-600' },
  machine: { icon: FaCogs, label: 'Maquinaria', gradient: 'from-slate-500 to-slate-700' },
  equipment: { icon: FaTools, label: 'Equipo', gradient: 'from-indigo-500 to-indigo-600' },
  trailer: { icon: FaTruck, label: 'Remolque', gradient: 'from-cyan-500 to-cyan-600' },
};

export default function FleetAssetCard({ asset, onClick }) {
  const status = statusConfig[asset.status] || statusConfig.inactive;
  const type = typeConfig[asset.assetType] || typeConfig.vehicle;
  const TypeIcon = type.icon;

  const hasMileage = asset.assetType === 'vehicle' || asset.assetType === 'trailer';
  const hasHours = asset.assetType === 'machine' || asset.assetType === 'equipment';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden group"
    >
      {/* Imagen */}
      <div className="relative h-44 overflow-hidden">
        {asset.imageUrl ? (
          <img
            src={asset.imageUrl}
            alt={asset.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`flex items-center justify-center h-full bg-gradient-to-br ${type.gradient}`}>
            <TypeIcon className="text-5xl text-white/60" />
          </div>
        )}

        {/* Overlay sutil en hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />

        {/* Badge tipo */}
        <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-gray-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm font-medium">
          <TypeIcon className="text-xs text-blue-500" />
          {type.label}
        </span>

        {/* Badge estado */}
        <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium backdrop-blur-sm bg-white/95 ${status.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} inline-block`} />
          {status.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-gray-800 truncate text-sm mb-0.5">{asset.name}</h3>
        {(asset.brand || asset.model) && (
          <p className="text-xs text-gray-400 truncate">
            {[asset.brand, asset.model, asset.year].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Placa / Serie */}
        {(asset.licensePlate || asset.serialNumber) && (
          <div className="flex items-center gap-1.5 mt-2 bg-gray-50 rounded-lg px-2.5 py-1.5 w-fit">
            <FaIdCard className="text-gray-400 text-xs" />
            <span className="text-xs text-gray-600 font-mono font-semibold tracking-wide">
              {asset.licensePlate || asset.serialNumber}
            </span>
          </div>
        )}

        {/* Métricas */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
          {hasMileage && (
            <div className="flex items-center gap-1.5">
              <div className="bg-blue-100 p-1.5 rounded-lg">
                <FaTachometerAlt className="text-blue-600 text-xs" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700 leading-none">{Number(asset.currentMileage || 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">millas</p>
              </div>
            </div>
          )}
          {hasHours && (
            <div className="flex items-center gap-1.5">
              <div className="bg-orange-100 p-1.5 rounded-lg">
                <FaClock className="text-orange-600 text-xs" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700 leading-none">{Number(asset.currentHours || 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">horas</p>
              </div>
            </div>
          )}
          {asset.assignedTo && (
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">
                  {asset.assignedTo.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-gray-500 truncate max-w-[70px]">
                {asset.assignedTo.name?.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
