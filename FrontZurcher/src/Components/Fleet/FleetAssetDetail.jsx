import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaArrowLeft, FaEdit, FaWrench, FaTachometerAlt, FaClock,
  FaPlus, FaUser, FaIdCard, FaCalendarAlt, FaShieldAlt,
  FaCheckCircle, FaTimesCircle, FaHistory, FaCamera,
  FaExclamationTriangle, FaTrash, FaTruck, FaCogs
} from 'react-icons/fa';
import {
  fetchFleetAssetById, updateFleetAsset, deleteFleetAsset,
  fetchMaintenanceByAsset, logFleetMileage, fetchMileageLogs,
  uploadFleetAssetImage, deleteMaintenance
} from '../../Redux/Actions/fleetActions';
import FleetMaintenanceForm from './FleetMaintenanceForm';
import FleetAssetForm from './FleetAssetForm';
import { toast } from 'react-toastify';

const statusConfig = {
  active: { label: 'Operativo', color: 'bg-green-100 text-green-700 border border-green-200', dot: 'bg-green-500', icon: FaCheckCircle },
  in_repair: { label: 'En Taller', color: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500', icon: FaWrench },
  inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-600 border border-gray-200', dot: 'bg-gray-400', icon: FaTimesCircle },
  retired: { label: 'Retirado', color: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500', icon: FaTimesCircle },
};

const maintenanceTypeLabels = {
  preventive: 'Preventivo',
  oil_change: 'Cambio aceite',
  tire_change: 'Cambio neumáticos',
  brake_service: 'Frenos',
  corrective: 'Correctivo',
  repair: 'Reparación',
  inspection: 'Inspección',
  cleaning: 'Limpieza',
  other: 'Otro',
};

export default function FleetAssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentAsset, maintenanceByAsset, loading } = useSelector((state) => state.fleet);
  const { currentStaff } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('overview');
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [mileageForm, setMileageForm] = useState({ mileage: '', hours: '', recordedAt: new Date().toISOString().split('T')[0], notes: '' });

  const asset = currentAsset;
  const maintenances = maintenanceByAsset[id] || asset?.maintenances || [];

  const isOwnerOrAdmin = ['owner', 'admin'].includes(currentStaff?.role);
  const isVehicle = asset?.assetType === 'vehicle' || asset?.assetType === 'trailer';
  const isMachine = asset?.assetType === 'machine' || asset?.assetType === 'equipment';

  useEffect(() => {
    dispatch(fetchFleetAssetById(id));
    dispatch(fetchMaintenanceByAsset(id));
  }, [dispatch, id]);

  const handleStatusChange = async (newStatus) => {
    try {
      await dispatch(updateFleetAsset(id, { status: newStatus }));
      toast.success('Estado actualizado');
    } catch {
      toast.error('Error actualizando estado');
    }
  };

  const handleLogMileage = async (e) => {
    e.preventDefault();
    try {
      await dispatch(logFleetMileage(id, mileageForm));
      toast.success('Mileaje/horas actualizado');
      setShowMileageModal(false);
      setMileageForm({ mileage: '', hours: '', recordedAt: new Date().toISOString().split('T')[0], notes: '' });
    } catch (err) {
      toast.error(err.message || 'Error actualizando');
    }
  };

  const handleDeleteMaintenance = async (maintenanceId) => {
    if (!window.confirm('¿Eliminar este registro de mantenimiento?')) return;
    try {
      await dispatch(deleteMaintenance(id, maintenanceId));
      toast.success('Registro eliminado');
    } catch {
      toast.error('Error eliminando registro');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await dispatch(uploadFleetAssetImage(id, file));
      dispatch(fetchFleetAssetById(id));
      toast.success('Imagen actualizada');
    } catch {
      toast.error('Error subiendo imagen');
    }
  };

  // Verificar vencimientos próximos (30 días)
  const checkExpiry = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const daysLeft = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { status: 'expired', label: 'Vencido', color: 'text-red-600' };
    if (daysLeft <= 30) return { status: 'warning', label: `Vence en ${daysLeft}d`, color: 'text-yellow-600' };
    return { status: 'ok', label: `${daysLeft}d restantes`, color: 'text-green-600' };
  };

  if (loading && !asset) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="text-center py-16 text-gray-400">
        <FaTruck className="text-5xl mx-auto mb-3 opacity-30" />
        <p>Activo no encontrado</p>
        <button onClick={() => navigate('/fleet')} className="mt-4 text-blue-600 hover:underline text-sm">
          Volver a Flota
        </button>
      </div>
    );
  }

  const statusInfo = statusConfig[asset.status] || statusConfig.inactive;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-4 md:px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/fleet')}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <FaArrowLeft />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Fleet & Equipment</p>
            <h1 className="text-xl font-bold text-white truncate">{asset.name}</h1>
          </div>
          <div className="flex gap-2">
            {isOwnerOrAdmin && (
              <button
                onClick={() => setShowEditForm(true)}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <FaEdit /> Editar
              </button>
            )}
            <button
              onClick={() => setShowMaintenanceForm(true)}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow"
            >
              <FaWrench /> Service
            </button>
            <button
              onClick={() => setShowMileageModal(true)}
              className="flex items-center gap-1.5 bg-white text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow"
            >
              <FaTachometerAlt /> Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Imagen + Info principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        <div className="flex flex-col md:flex-row">
          {/* Imagen */}
          <div className="relative md:w-72 h-56 md:h-auto bg-gradient-to-br from-blue-600 to-blue-800 flex-shrink-0">
            {asset.imageUrl ? (
              <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full">
                {asset.assetType === 'machine' || asset.assetType === 'equipment' ? (
                  <FaCogs className="text-7xl text-white/30" />
                ) : (
                  <FaTruck className="text-7xl text-white/30" />
                )}
              </div>
            )}
            {isOwnerOrAdmin && (
              <label className="absolute bottom-3 right-3 bg-white text-gray-600 p-2.5 rounded-xl cursor-pointer hover:bg-blue-50 shadow-lg transition-colors">
                <FaCamera className="text-sm" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          {/* Datos */}
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{asset.name}</h2>
                <p className="text-gray-400 text-sm mt-0.5">
                  {[asset.brand, asset.model, asset.year].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium ${statusInfo.color}`}>
                  <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                  {statusInfo.label}
                </span>
                {isOwnerOrAdmin && (
                  <select
                    value={asset.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">✓ Marcar Operativo</option>
                    <option value="in_repair">🔧 En Taller</option>
                    <option value="inactive">○ Inactivo</option>
                    <option value="retired">✕ Retirar</option>
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Mileaje */}
              {(isVehicle || asset.currentMileage > 0) && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-100">
                  <FaTachometerAlt className="text-blue-500 text-lg mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-700">{Number(asset.currentMileage || 0).toLocaleString()}</p>
                  <p className="text-[11px] text-blue-400 font-medium uppercase tracking-wide">Millas</p>
                </div>
              )}
              {/* Horas */}
              {(isMachine || asset.currentHours > 0) && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 text-center border border-orange-100">
                  <FaClock className="text-orange-500 text-lg mx-auto mb-1" />
                  <p className="text-xl font-bold text-orange-700">{Number(asset.currentHours || 0).toLocaleString()}</p>
                  <p className="text-[11px] text-orange-400 font-medium uppercase tracking-wide">Horas</p>
                </div>
              )}
              {/* Placa */}
              {(asset.licensePlate || asset.serialNumber) && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 text-center border border-slate-100">
                  <FaIdCard className="text-slate-500 text-lg mx-auto mb-1" />
                  <p className="text-sm font-bold text-slate-700 font-mono">{asset.licensePlate || asset.serialNumber}</p>
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{asset.licensePlate ? 'Placa' : 'Serie'}</p>
                </div>
              )}
              {/* Asignado */}
              {asset.assignedTo && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center border border-green-100">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-1">
                    <span className="text-sm text-white font-bold">{asset.assignedTo.name?.charAt(0)}</span>
                  </div>
                  <p className="text-sm font-bold text-green-700 truncate">{asset.assignedTo.name?.split(' ')[0]}</p>
                  <p className="text-[11px] text-green-400 font-medium uppercase tracking-wide">Asignado</p>
                </div>
              )}
            </div>

            {/* Vencimientos */}
            {(asset.insuranceExpiry || asset.registrationExpiry) && (
              <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
                {asset.insuranceExpiry && (() => {
                  const exp = checkExpiry(asset.insuranceExpiry);
                  return (
                    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl font-medium ${
                      exp.status === 'expired' ? 'bg-red-50 text-red-600 border border-red-200' :
                      exp.status === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                      'bg-green-50 text-green-600 border border-green-200'
                    }`}>
                      <FaShieldAlt />
                      <span>Seguro: {exp.label}</span>
                    </div>
                  );
                })()}
                {asset.registrationExpiry && (() => {
                  const exp = checkExpiry(asset.registrationExpiry);
                  return (
                    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl font-medium ${
                      exp.status === 'expired' ? 'bg-red-50 text-red-600 border border-red-200' :
                      exp.status === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                      'bg-green-50 text-green-600 border border-green-200'
                    }`}>
                      <FaIdCard />
                      <span>Registración: {exp.label}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
        {[
          { id: 'overview', label: 'Resumen', icon: FaTruck },
          { id: 'maintenance', label: `Mantenimientos (${maintenances.length})`, icon: FaWrench },
          { id: 'history', label: 'Historial', icon: FaHistory },
        ].map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tabId
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="text-xs" /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Próximos mantenimientos */}
          {maintenances.filter(m => m.status === 'scheduled').length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="font-semibold text-yellow-700 flex items-center gap-2 mb-3">
                <FaExclamationTriangle /> Mantenimientos Programados
              </p>
              {maintenances.filter(m => m.status === 'scheduled').map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-yellow-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{m.title}</p>
                    <p className="text-xs text-gray-400">{maintenanceTypeLabels[m.maintenanceType]}</p>
                  </div>
                  {m.nextServiceDate && (
                    <span className="text-xs text-yellow-600 font-medium">
                      {new Date(m.nextServiceDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info general */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="w-1 h-4 bg-blue-600 rounded-full inline-block" />
              Información del activo
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {asset.color && <><dt className="text-gray-400">Color</dt><dd className="text-gray-700">{asset.color}</dd></>}
              {asset.fuelType && asset.fuelType !== 'none' && <><dt className="text-gray-400">Combustible</dt><dd className="text-gray-700 capitalize">{asset.fuelType}</dd></>}
              {asset.purchaseDate && <><dt className="text-gray-400">Fecha de compra</dt><dd className="text-gray-700">{new Date(asset.purchaseDate).toLocaleDateString()}</dd></>}
              {asset.purchasePrice && <><dt className="text-gray-400">Precio de compra</dt><dd className="text-gray-700">${Number(asset.purchasePrice).toLocaleString()}</dd></>}
              {asset.insuranceExpiry && <><dt className="text-gray-400">Seguro vence</dt><dd className="text-gray-700">{new Date(asset.insuranceExpiry).toLocaleDateString()}</dd></>}
              {asset.registrationExpiry && <><dt className="text-gray-400">Registración vence</dt><dd className="text-gray-700">{new Date(asset.registrationExpiry).toLocaleDateString()}</dd></>}
            </dl>
            {asset.notes && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1">Notas</p>
                <p className="text-sm text-gray-600">{asset.notes}</p>
              </div>
            )}
          </div>

          {/* Último mantenimiento */}
          {maintenances.filter(m => m.status === 'completed').length > 0 && (() => {
            const last = maintenances.filter(m => m.status === 'completed')[0];
            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <p className="font-semibold text-gray-700 mb-3">Último mantenimiento</p>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{last.title}</p>
                    <p className="text-sm text-gray-400">{maintenanceTypeLabels[last.maintenanceType]} · {new Date(last.serviceDate).toLocaleDateString()}</p>
                    {last.performedBy && <p className="text-xs text-gray-400 mt-1">Por: {last.performedBy.name}</p>}
                    {last.externalShop && <p className="text-xs text-gray-400 mt-1">Taller: {last.externalShop}</p>}
                  </div>
                  {last.cost > 0 && (
                    <span className="text-green-600 font-semibold">${Number(last.cost).toLocaleString()}</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: Mantenimientos */}
      {activeTab === 'maintenance' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowMaintenanceForm(true)}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              <FaPlus /> Nuevo registro
            </button>
          </div>

          {maintenances.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FaWrench className="text-4xl mx-auto mb-2 opacity-30" />
              <p>No hay registros de mantenimiento</p>
            </div>
          ) : (
            maintenances.map((record) => (
              <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        record.status === 'completed' ? 'bg-green-100 text-green-700' :
                        record.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                        record.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {record.status === 'completed' ? '✓ Completado' :
                         record.status === 'scheduled' ? '📅 Programado' :
                         record.status === 'in_progress' ? '⚙ En proceso' : '✕ Cancelado'}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{maintenanceTypeLabels[record.maintenanceType]}</span>
                      {record.serviceNumber && <span className="text-xs text-gray-300 font-mono">#{record.serviceNumber}</span>}
                    </div>
                    <p className="font-medium text-gray-800 text-sm">{record.title}</p>
                    {record.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{record.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FaCalendarAlt /> {new Date(record.serviceDate).toLocaleDateString()}
                      </span>
                      {record.mileageAtService && (
                        <span className="flex items-center gap-1">
                          <FaTachometerAlt /> {Number(record.mileageAtService).toLocaleString()} mi
                        </span>
                      )}
                      {record.hoursAtService && (
                        <span className="flex items-center gap-1">
                          <FaClock /> {Number(record.hoursAtService).toLocaleString()} hs
                        </span>
                      )}
                      {record.performedBy && (
                        <span className="flex items-center gap-1">
                          <FaUser /> {record.performedBy.name}
                        </span>
                      )}
                      {record.externalShop && (
                        <span className="flex items-center gap-1">
                          <FaWrench /> {record.externalShop}
                        </span>
                      )}
                    </div>
                    {record.nextServiceDate && (
                      <div className="mt-2 text-xs text-orange-500">
                        Próx. servicio: {new Date(record.nextServiceDate).toLocaleDateString()}
                        {record.nextServiceMileage && ` · ${Number(record.nextServiceMileage).toLocaleString()} mi`}
                        {record.nextServiceHours && ` · ${Number(record.nextServiceHours).toLocaleString()} hs`}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {record.cost > 0 && (
                      <span className="text-green-600 font-semibold text-sm">${Number(record.cost).toLocaleString()}</span>
                    )}
                    {isOwnerOrAdmin && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingMaintenance(record); setShowMaintenanceForm(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaintenance(record.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Historial Mileaje */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowMileageModal(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              <FaPlus /> Registrar lectura
            </button>
          </div>
          {(asset.mileageLogs || []).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FaHistory className="text-4xl mx-auto mb-2 opacity-30" />
              <p>No hay registros de mileaje / horas</p>
            </div>
          ) : (
            (asset.mileageLogs || []).map((log) => (
              <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex gap-4 text-sm">
                    {log.mileage !== null && log.mileage !== undefined && (
                      <span className="flex items-center gap-1.5 font-medium text-blue-700">
                        <FaTachometerAlt className="text-xs" />
                        {Number(log.mileage).toLocaleString()} mi
                        {log.previousMileage !== null && (
                          <span className="text-xs text-gray-400 font-normal">
                            (+{(Number(log.mileage) - Number(log.previousMileage)).toLocaleString()})
                          </span>
                        )}
                      </span>
                    )}
                    {log.hours !== null && log.hours !== undefined && (
                      <span className="flex items-center gap-1.5 font-medium text-orange-700">
                        <FaClock className="text-xs" />
                        {Number(log.hours).toLocaleString()} hs
                        {log.previousHours !== null && (
                          <span className="text-xs text-gray-400 font-normal">
                            (+{(Number(log.hours) - Number(log.previousHours)).toLocaleString()})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {log.notes && <p className="text-xs text-gray-400 mt-1">{log.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{new Date(log.recordedAt).toLocaleDateString()}</p>
                  {log.recordedBy && <p className="text-xs text-gray-400">{log.recordedBy.name}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Actualizar mileaje/horas */}
      {showMileageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FaTachometerAlt /> Actualizar Métricas
              </h3>
              <button onClick={() => setShowMileageModal(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
            </div>
            <form onSubmit={handleLogMileage} className="p-5 space-y-4">
              {isVehicle && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nuevo mileaje (mi)</label>
                  <input type="number" value={mileageForm.mileage}
                    onChange={(e) => setMileageForm((p) => ({ ...p, mileage: e.target.value }))}
                    placeholder={`Actual: ${Number(asset.currentMileage || 0).toLocaleString()} mi`}
                    min={asset.currentMileage || 0} step="0.1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                </div>
              )}
              {isMachine && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nuevas horas</label>
                  <input type="number" value={mileageForm.hours}
                    onChange={(e) => setMileageForm((p) => ({ ...p, hours: e.target.value }))}
                    placeholder={`Actual: ${Number(asset.currentHours || 0).toLocaleString()} hs`}
                    min={asset.currentHours || 0} step="0.1"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha</label>
                <input type="date" value={mileageForm.recordedAt}
                  onChange={(e) => setMileageForm((p) => ({ ...p, recordedAt: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notas</label>
                <input type="text" value={mileageForm.notes}
                  onChange={(e) => setMileageForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Ej: revisión semanal"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowMileageModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm">
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulario de mantenimiento */}
      {showMaintenanceForm && (
        <FleetMaintenanceForm
          assetId={id}
          assetName={asset.name}
          assetType={asset.assetType}
          recordToEdit={editingMaintenance}
          onClose={() => { setShowMaintenanceForm(false); setEditingMaintenance(null); }}
          onSuccess={() => {
            setShowMaintenanceForm(false);
            setEditingMaintenance(null);
            dispatch(fetchMaintenanceByAsset(id));
            dispatch(fetchFleetAssetById(id));
          }}
        />
      )}

      {/* Formulario de edición */}
      {showEditForm && (
        <FleetAssetForm
          assetToEdit={asset}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => { setShowEditForm(false); dispatch(fetchFleetAssetById(id)); }}
        />
      )}
    </div>
    </div>
  );
}
