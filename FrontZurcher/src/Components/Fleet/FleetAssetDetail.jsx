import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaArrowLeft, FaEdit, FaWrench, FaTachometerAlt, FaClock,
  FaPlus, FaUser, FaIdCard, FaCalendarAlt, FaShieldAlt,
  FaCheckCircle, FaTimesCircle, FaHistory, FaCamera,
  FaExclamationTriangle, FaTrash, FaTruck, FaCogs, FaDollarSign,
  FaInfoCircle, FaFilePdf, FaFileImage, FaDownload, FaUpload,
  FaEye, FaFolder, FaTimes
} from 'react-icons/fa';
import api from '../../utils/axios';
import {
  fetchFleetAssetById, updateFleetAsset, deleteFleetAsset,
  logFleetMileage, fetchMileageLogs,
  uploadFleetAssetImage, deleteMaintenance
} from '../../Redux/Actions/fleetActions';
import FleetMaintenanceForm from './FleetMaintenanceForm';
import FleetAssetForm from './FleetAssetForm';
import { toast } from 'react-toastify';
import { formatDateOnly, parseDateOnly } from '../../utils/dateHelpers';
import { clearCurrentAsset } from '../../Redux/Reducer/fleetReducer';

const statusConfig = {
  active:    { label: 'Operativo', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', icon: FaCheckCircle },
  in_repair: { label: 'En Taller',  color: 'bg-amber-100 text-amber-700 border border-amber-200',     dot: 'bg-amber-500',   icon: FaWrench },
  inactive:  { label: 'Inactivo',   color: 'bg-gray-100 text-gray-500 border border-gray-200',         dot: 'bg-gray-400',    icon: FaTimesCircle },
  retired:   { label: 'Retirado',   color: 'bg-red-100 text-red-600 border border-red-200',             dot: 'bg-red-500',     icon: FaTimesCircle },
};

const maintenanceTypeLabels = {
  preventive:   'Preventivo',
  oil_change:   'Cambio aceite',
  tire_change:  'Cambio neumáticos',
  brake_service:'Frenos',
  corrective:   'Correctivo',
  repair:       'Reparación',
  inspection:   'Inspección',
  cleaning:     'Limpieza',
  other:        'Otro',
};

const maintenanceTypeColors = {
  preventive:   'bg-blue-100 text-blue-700',
  oil_change:   'bg-yellow-100 text-yellow-700',
  tire_change:  'bg-purple-100 text-purple-700',
  brake_service:'bg-red-100 text-red-700',
  corrective:   'bg-rose-100 text-rose-700',
  repair:       'bg-orange-100 text-orange-700',
  inspection:   'bg-cyan-100 text-cyan-700',
  cleaning:     'bg-teal-100 text-teal-700',
  other:        'bg-gray-100 text-gray-600',
};

const fmt$ = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function FleetAssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentAsset, maintenanceByAsset, loading } = useSelector((s) => s.fleet);
  const { currentStaff } = useSelector((s) => s.auth);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (v) => setSearchParams(prev => { prev.set('tab', v); return prev; });
  const [maintenanceYear, setMaintenanceYear]     = useState(String(new Date().getFullYear()));
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showEditForm, setShowEditForm]           = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [showMileageModal, setShowMileageModal]   = useState(false);
  const [mileageForm, setMileageForm] = useState({
    mileage: '', hours: '',
    recordedAt: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Documents
  const [docs, setDocs]                   = useState([]);
  const [docsLoading, setDocsLoading]     = useState(false);
  const [docCategory, setDocCategory]     = useState('');
  const [docName, setDocName]             = useState('');
  const [docFile, setDocFile]             = useState(null);
  const [docUploading, setDocUploading]   = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [viewerDoc, setViewerDoc]         = useState(null);

  const asset       = currentAsset && String(currentAsset.id) === String(id) ? currentAsset : null;
  const maintenances = maintenanceByAsset[id] || asset?.maintenances || [];
  const mileageLogs  = useMemo(() => [...(asset?.mileageLogs || [])].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)), [asset]);

  const isOwnerOrAdmin = ['owner', 'admin'].includes(currentStaff?.role);
  const isVehicle = asset?.assetType === 'vehicle' || asset?.assetType === 'trailer';
  const isMachine = asset?.assetType === 'machine' || asset?.assetType === 'equipment';

  const formatFleetDate = (value) => {
    const formatted = formatDateOnly(value, 'MM-DD-YYYY');
    return formatted === 'N/A' ? '' : formatted;
  };

  useEffect(() => {
    dispatch(clearCurrentAsset());
    dispatch(fetchFleetAssetById(id));
  }, [dispatch, id]);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const { data } = await api.get(`/fleet/${id}/documents`);
      setDocs(data.data || []);
    } catch {
      toast.error('Error cargando documentos');
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'documents') fetchDocs();
  }, [activeTab, fetchDocs]);

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
    if (!mileageForm.mileage && !mileageForm.hours) {
      return toast.error('Ingresá millas, horas o ambos valores');
    }
    try {
      await dispatch(logFleetMileage(id, mileageForm));
      await dispatch(fetchFleetAssetById(id));
      toast.success('Mileaje/horas registrado');
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

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docFile) return toast.error('Seleccioná un archivo');
    const form = new FormData();
    form.append('file', docFile);
    form.append('category', docCategory || 'other');
    form.append('name', docName || docFile.name);
    setDocUploading(true);
    try {
      await api.post(`/fleet/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Documento subido');
      setShowDocUpload(false);
      setDocFile(null); setDocName(''); setDocCategory('');
      fetchDocs();
    } catch {
      toast.error('Error subiendo documento');
    } finally {
      setDocUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    try {
      await api.delete(`/fleet/${id}/documents/${docId}`);
      toast.success('Documento eliminado');
      setDocs(prev => prev.filter(d => d.id !== docId));
      if (viewerDoc?.id === docId) setViewerDoc(null);
    } catch {
      toast.error('Error eliminando documento');
    }
  };

  const checkExpiry = (dateStr) => {
    if (!dateStr) return null;
    const date = parseDateOnly(dateStr);
    if (!date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { status: 'expired', label: 'Vencido', color: 'text-red-600', bg: 'bg-red-50 border-red-200' };
    if (daysLeft <= 30) return { status: 'warning', label: `Vence en ${daysLeft}d`, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
    return { status: 'ok', label: `${daysLeft}d restantes`, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  };

  // ── Context logs for mileage modal ──────────────────────────────────
  const mileageContext = useMemo(() => {
    if (!mileageForm.recordedAt || mileageLogs.length === 0) return null;
    const d = new Date(mileageForm.recordedAt);
    const sorted = [...mileageLogs].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const prev = [...sorted].filter(l => new Date(l.recordedAt) <= d).pop();
    const next = sorted.find(l => new Date(l.recordedAt) > d);
    return { prev, next };
  }, [mileageForm.recordedAt, mileageLogs]);

  const isBackdated = mileageForm.recordedAt && mileageForm.recordedAt < new Date().toISOString().split('T')[0];

  // ── Cost aggregates ──────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const fleetExpenses = asset?.fleetExpenses || [];

  // Servicios manuales (FleetMaintenance)
  const completedWithCost = maintenances.filter(m => m.status === 'completed' && Number(m.cost) > 0);
  const totalServiciosHistorico   = completedWithCost.reduce((s, m) => s + Number(m.cost), 0);
  const totalServiciosCurrentYear = completedWithCost
    .filter(m => new Date(m.serviceDate).getFullYear() === currentYear)
    .reduce((s, m) => s + Number(m.cost), 0);

  // Gastos Flota del sistema (Expense)
  const totalGastosHistorico   = fleetExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalGastosCurrentYear = fleetExpenses
    .filter(e => new Date(e.date).getFullYear() === currentYear)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  // Totales combinados
  const totalHistorico   = totalServiciosHistorico + totalGastosHistorico;
  const totalCurrentYear = totalServiciosCurrentYear + totalGastosCurrentYear;

  // Desglose por tipo de service (solo mantenimientos manuales)
  const byType = {};
  completedWithCost.forEach(m => {
    const label = maintenanceTypeLabels[m.maintenanceType] || m.maintenanceType;
    byType[label] = (byType[label] || 0) + Number(m.cost);
  });
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const availableYears = [...new Set(maintenances.map(m => new Date(m.serviceDate).getFullYear()))].sort((a, b) => b - a);
  const filteredMaintenances = maintenanceYear === 'all'
    ? maintenances
    : maintenances.filter(m => new Date(m.serviceDate).getFullYear() === parseInt(maintenanceYear));
  const filteredTotal = filteredMaintenances
    .filter(m => m.status === 'completed' && Number(m.cost) > 0)
    .reduce((s, m) => s + Number(m.cost), 0);

  // ── Loading / Not found ──────────────────────────────────────────────
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

  const statusInfo   = statusConfig[asset.status] || statusConfig.inactive;
  const StatusIcon   = statusInfo.icon;
  const companyLabel = asset.companyType === 'zurcher' ? 'ZURCHER'
    : asset.companyType === 'invertech' ? 'INVERTECH'
    : (asset.companyOtherName || 'OTRA');
  const companyColor = asset.companyType === 'zurcher'  ? 'bg-blue-600 text-white'
    : asset.companyType === 'invertech' ? 'bg-emerald-600 text-white'
    : 'bg-slate-600 text-white';

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-700 px-4 md:px-6 py-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/fleet')}
            className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
            <FaArrowLeft />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-widest">Fleet & Equipment</p>
            <h1 className="text-xl font-bold text-white truncate leading-tight">{asset.name}</h1>
          </div>
          <div className="flex gap-2">
            {isOwnerOrAdmin && (
              <button onClick={() => setShowEditForm(true)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors border border-white/20">
                <FaEdit className="text-xs" /> Editar
              </button>
            )}
            <button onClick={() => setShowMaintenanceForm(true)}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md">
              <FaWrench className="text-xs" /> Service
            </button>
            <button onClick={() => setShowMileageModal(true)}
              className="flex items-center gap-1.5 bg-white text-slate-700 hover:bg-blue-50 px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md">
              <FaTachometerAlt className="text-xs" /> Mileaje
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden mb-5">
          <div className="flex flex-col md:flex-row">
            {/* Image */}
            <div className="relative md:w-64 h-52 md:h-auto bg-gradient-to-br from-slate-700 to-slate-900 flex-shrink-0">
              {asset.imageUrl ? (
                <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-contain bg-white/80" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  {isMachine
                    ? <FaCogs className="text-6xl text-white/20" />
                    : <FaTruck className="text-6xl text-white/20" />
                  }
                </div>
              )}
              {isOwnerOrAdmin && (
                <label className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-slate-600 p-2.5 rounded-xl cursor-pointer shadow-lg transition-colors">
                  <FaCamera className="text-sm" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl font-bold text-slate-800">{asset.name}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${companyColor}`}>{companyLabel}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{[asset.brand, asset.model, asset.year].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold ${statusInfo.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                  {isOwnerOrAdmin && (
                    <select value={asset.status} onChange={(e) => handleStatusChange(e.target.value)}
                      className="text-xs border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="active">✓ Operativo</option>
                      <option value="in_repair">🔧 En Taller</option>
                      <option value="inactive">○ Inactivo</option>
                      <option value="retired">✕ Retirar</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {(isVehicle || asset.currentMileage > 0) && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                    <FaTachometerAlt className="text-blue-500 text-base mx-auto mb-1" />
                    <p className="text-lg font-bold text-blue-700 leading-tight">{Number(asset.currentMileage || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Millas</p>
                  </div>
                )}
                {(isMachine || asset.currentHours > 0) && (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                    <FaClock className="text-orange-500 text-base mx-auto mb-1" />
                    <p className="text-lg font-bold text-orange-700 leading-tight">{Number(asset.currentHours || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Horas</p>
                  </div>
                )}
                {(asset.licensePlate || asset.serialNumber) && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                    <FaIdCard className="text-slate-400 text-base mx-auto mb-1" />
                    <p className="text-sm font-bold text-slate-700 font-mono leading-tight">{asset.licensePlate || asset.serialNumber}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{asset.licensePlate ? 'Placa' : 'Serie'}</p>
                  </div>
                )}
                {asset.assignedTo && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-1">
                      <span className="text-xs text-white font-bold">{asset.assignedTo.name?.charAt(0)}</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-700 truncate leading-tight">{asset.assignedTo.name?.split(' ')[0]}</p>
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Asignado</p>
                  </div>
                )}
              </div>

              {/* Expiry badges */}
              {(asset.insuranceExpiry || asset.registrationExpiry) && (
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
                  {asset.insuranceExpiry && (() => {
                    const exp = checkExpiry(asset.insuranceExpiry);
                    return (
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium border ${exp.bg} ${exp.color}`}>
                        <FaShieldAlt className="text-[10px]" /> Seguro: {exp.label}
                      </span>
                    );
                  })()}
                  {asset.registrationExpiry && (() => {
                    const exp = checkExpiry(asset.registrationExpiry);
                    return (
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium border ${exp.bg} ${exp.color}`}>
                        <FaIdCard className="text-[10px]" /> Registración: {exp.label}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-5 bg-slate-100 rounded-2xl p-1 overflow-x-auto">
          {[
            { id: 'overview',     label: 'Resumen',                         icon: FaTruck },
            { id: 'maintenance',  label: `Servicios (${maintenances.length})`, icon: FaWrench },
            { id: 'history',      label: `Historial (${mileageLogs.length})`, icon: FaHistory },
            { id: 'documents',    label: `Documentos (${docs.length})`,     icon: FaFolder },
          ].map(({ id: tabId, label, icon: Icon }) => (
            <button key={tabId} onClick={() => setActiveTab(tabId)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tabId
                  ? 'bg-white text-blue-700 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="text-xs" /> {label}
            </button>
          ))}
        </div>

        {/* ══ Tab: Resumen ════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Programados alert */}
            {maintenances.filter(m => m.status === 'scheduled').length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="font-semibold text-amber-700 flex items-center gap-2 mb-3 text-sm">
                  <FaExclamationTriangle /> {maintenances.filter(m => m.status === 'scheduled').length} servicio(s) programado(s)
                </p>
                <div className="space-y-2">
                  {maintenances.filter(m => m.status === 'scheduled').map(m => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{m.title}</p>
                        <p className="text-xs text-slate-400">{maintenanceTypeLabels[m.maintenanceType]}</p>
                      </div>
                      {m.nextServiceDate && (
                        <span className="text-xs text-amber-600 font-semibold">{formatFleetDate(m.nextServiceDate)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info general */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 rounded-full" /> Información del activo
              </p>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {asset.color          && <><dt className="text-slate-400">Color</dt><dd className="text-slate-700 font-medium">{asset.color}</dd></>}
                {asset.purchaseDate   && <><dt className="text-slate-400">Fecha de compra</dt><dd className="text-slate-700 font-medium">{formatFleetDate(asset.purchaseDate)}</dd></>}
                {asset.purchasePrice  && <><dt className="text-slate-400">Precio de compra</dt><dd className="text-slate-700 font-medium">{fmt$(asset.purchasePrice)}</dd></>}
                {asset.insuranceExpiry    && <><dt className="text-slate-400">Seguro vence</dt><dd className="text-slate-700 font-medium">{formatFleetDate(asset.insuranceExpiry)}</dd></>}
                {asset.registrationExpiry && <><dt className="text-slate-400">Registración vence</dt><dd className="text-slate-700 font-medium">{formatFleetDate(asset.registrationExpiry)}</dd></>}
              </dl>
              {asset.notes && (
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <p className="text-xs text-slate-400 mb-1">Notas</p>
                  <p className="text-sm text-slate-600">{asset.notes}</p>
                </div>
              )}
            </div>

            {/* Último servicio */}
            {maintenances.filter(m => m.status === 'completed').length > 0 && (() => {
              const last = maintenances.filter(m => m.status === 'completed')[0];
              return (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" /> Último servicio completado
                  </p>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${maintenanceTypeColors[last.maintenanceType] || 'bg-gray-100 text-gray-600'}`}>
                        {maintenanceTypeLabels[last.maintenanceType]}
                      </span>
                      <p className="font-semibold text-slate-800 mt-2">{last.title}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{formatFleetDate(last.serviceDate)}</p>
                      {last.performedBy  && <p className="text-xs text-slate-400 mt-1">Por: {last.performedBy.name}</p>}
                      {last.externalShop && <p className="text-xs text-slate-400 mt-1">Taller: {last.externalShop}</p>}
                    </div>
                    {last.cost > 0 && (
                      <span className="text-lg font-bold text-emerald-600">{fmt$(last.cost)}</span>
                    )}
                  </div>
                  {last.nextServiceDate && (
                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5 text-xs text-orange-600">
                      <FaCalendarAlt className="text-[10px]" />
                      Próximo: {formatFleetDate(last.nextServiceDate)}
                      {last.nextServiceMileage && ` · ${Number(last.nextServiceMileage).toLocaleString()} mi`}
                      {last.nextServiceHours   && ` · ${Number(last.nextServiceHours).toLocaleString()} hs`}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Gastos de mantenimiento */}
            {totalHistorico > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full" /> Gastos del activo
                </p>

                {/* Totales histórico + año */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-center">
                    <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide mb-1">Total histórico</p>
                    <p className="text-2xl font-bold text-orange-700">{fmt$(totalHistorico)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                    <p className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-1">Año {currentYear}</p>
                    <p className="text-2xl font-bold text-blue-700">{fmt$(totalCurrentYear)}</p>
                  </div>
                </div>

                {/* Dos líneas: servicios manuales + gastos flota */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600">Servicios manuales</span>
                      <span className="text-xs text-slate-400">({completedWithCost.length})</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{fmt$(totalServiciosHistorico)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600">Gastos Flota registrados</span>
                      <span className="text-xs text-slate-400">({fleetExpenses.length})</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{fmt$(totalGastosHistorico)}</span>
                  </div>
                </div>

                {/* Desglose por tipo de service manual */}
                {topTypes.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Desglose por tipo de service</p>
                    {topTypes.map(([label, amount]) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600 font-medium">{label}</span>
                          <span className="text-slate-700 font-semibold">{fmt$(amount)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-400 rounded-full transition-all"
                            style={{ width: `${Math.round((amount / totalServiciosHistorico) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ Tab: Servicios ══════════════════════════════════════════════ */}
        {activeTab === 'maintenance' && (
          <div className="space-y-3">
            {/* Barra de filtro + totales */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FaDollarSign className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">{maintenanceYear === 'all' ? 'Total histórico' : `Total ${maintenanceYear}`}</p>
                  <p className="text-xl font-bold text-orange-600">{fmt$(filteredTotal)}</p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  {filteredMaintenances.length} registro{filteredMaintenances.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select value={maintenanceYear} onChange={e => setMaintenanceYear(e.target.value)}
                  className="text-sm border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="all">Todos los años</option>
                  {availableYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                </select>
                <button onClick={() => setShowMaintenanceForm(true)}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors">
                  <FaPlus className="text-xs" /> Nuevo
                </button>
              </div>
            </div>

            {filteredMaintenances.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
                <FaWrench className="text-4xl mx-auto mb-3 opacity-20" />
                <p className="font-medium">{maintenances.length === 0 ? 'Sin registros de servicio' : `Sin registros en ${maintenanceYear}`}</p>
                <p className="text-sm mt-1 opacity-70">Presioná el botón Nuevo para agregar el primer servicio</p>
              </div>
            ) : (
              filteredMaintenances.map((record) => (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          record.status === 'completed'  ? 'bg-emerald-100 text-emerald-700' :
                          record.status === 'scheduled'  ? 'bg-amber-100 text-amber-700' :
                          record.status === 'in_progress'? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {record.status === 'completed'  ? '✓ Completado' :
                           record.status === 'scheduled'  ? '📅 Programado' :
                           record.status === 'in_progress'? '⚙ En proceso'  : '✕ Cancelado'}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${maintenanceTypeColors[record.maintenanceType] || 'bg-gray-100 text-gray-600'}`}>
                          {maintenanceTypeLabels[record.maintenanceType]}
                        </span>
                        {record.serviceNumber && (
                          <span className="text-xs text-slate-300 font-mono">#{record.serviceNumber}</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{record.title}</p>
                      {record.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{record.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <FaCalendarAlt className="text-[10px]" /> {formatFleetDate(record.serviceDate)}
                        </span>
                        {record.mileageAtService && (
                          <span className="flex items-center gap-1">
                            <FaTachometerAlt className="text-[10px]" /> {Number(record.mileageAtService).toLocaleString()} mi
                          </span>
                        )}
                        {record.hoursAtService && (
                          <span className="flex items-center gap-1">
                            <FaClock className="text-[10px]" /> {Number(record.hoursAtService).toLocaleString()} hs
                          </span>
                        )}
                        {record.performedBy && (
                          <span className="flex items-center gap-1">
                            <FaUser className="text-[10px]" /> {record.performedBy.name}
                          </span>
                        )}
                        {record.externalShop && (
                          <span className="flex items-center gap-1">
                            <FaWrench className="text-[10px]" /> {record.externalShop}
                          </span>
                        )}
                      </div>
                      {record.nextServiceDate && (
                        <div className="mt-2 text-xs text-orange-500 flex items-center gap-1">
                          <FaCalendarAlt className="text-[10px]" />
                          Próx.: {formatFleetDate(record.nextServiceDate)}
                          {record.nextServiceMileage && ` · ${Number(record.nextServiceMileage).toLocaleString()} mi`}
                          {record.nextServiceHours   && ` · ${Number(record.nextServiceHours).toLocaleString()} hs`}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {record.cost > 0 && (
                        <span className="text-base font-bold text-emerald-600">{fmt$(record.cost)}</span>
                      )}
                      {isOwnerOrAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingMaintenance(record); setShowMaintenanceForm(true); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <FaEdit className="text-xs" />
                          </button>
                          <button onClick={() => handleDeleteMaintenance(record.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

        {/* ══ Tab: Documentos ═════════════════════════════════════════════ */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {docsLoading ? 'Cargando...' : `${docs.length} documento${docs.length !== 1 ? 's' : ''}`}
              </p>
              <button onClick={() => setShowDocUpload(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors">
                <FaUpload className="text-xs" /> Subir documento
              </button>
            </div>

            {/* Upload form */}
            {showDocUpload && (
              <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
                <p className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <FaUpload className="text-blue-500" /> Subir nuevo documento
                </p>
                <form onSubmit={handleUploadDoc} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Categoría</label>
                      <select value={docCategory} onChange={e => setDocCategory(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Otro</option>
                        <option value="registration">Registración</option>
                        <option value="insurance">Seguro</option>
                        <option value="plate">Placa</option>
                        <option value="warranty">Garantía</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre (opcional)</label>
                      <input type="text" value={docName} onChange={e => setDocName(e.target.value)}
                        placeholder="Ej: Seguro 2026"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Archivo (imagen o PDF)</label>
                    <input type="file" accept="image/*,.pdf"
                      onChange={e => setDocFile(e.target.files[0])}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-100 file:text-blue-700 file:text-xs file:font-semibold" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowDocUpload(false); setDocFile(null); setDocName(''); setDocCategory(''); }}
                      className="flex-1 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={docUploading || !docFile}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm transition-colors">
                      {docUploading ? 'Subiendo...' : 'Subir'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Empty state */}
            {!docsLoading && docs.length === 0 && !showDocUpload && (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
                <FaFolder className="text-4xl mx-auto mb-3 opacity-20" />
                <p className="font-medium">Sin documentos cargados</p>
                <p className="text-sm mt-1 opacity-70">Subí imágenes y PDFs de registración, seguro, garantías y más</p>
              </div>
            )}

            {/* Documents grid */}
            {docs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {docs.map(doc => {
                  const catLabels = { registration: 'Registración', insurance: 'Seguro', plate: 'Placa', warranty: 'Garantía', other: 'Otro' };
                  return (
                    <div key={doc.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all">
                      {/* Thumbnail */}
                      <div className="relative h-28 bg-slate-50 flex items-center justify-center cursor-pointer"
                        onClick={() => setViewerDoc(doc)}>
                        {doc.fileType === 'image' ? (
                          <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-red-400">
                            <FaFilePdf className="text-3xl" />
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">PDF</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <FaEye className="text-white opacity-0 group-hover:opacity-100 text-xl transition-all" />
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-slate-700 truncate">{doc.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            {catLabels[doc.category] || doc.category}
                          </span>
                          <div className="flex gap-1">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-1 text-slate-300 hover:text-blue-500 transition-colors" title="Descargar">
                              <FaDownload className="text-xs" />
                            </a>
                            {isOwnerOrAdmin && (
                              <button onClick={() => handleDeleteDoc(doc.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
                                <FaTrash className="text-xs" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ Tab: Historial mileaje ══════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">
                {mileageLogs.length} registro{mileageLogs.length !== 1 ? 's' : ''} de mileaje / horas
              </p>
              <button onClick={() => setShowMileageModal(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors">
                <FaPlus className="text-xs" /> Registrar lectura
              </button>
            </div>

            {mileageLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
                <FaHistory className="text-4xl mx-auto mb-3 opacity-20" />
                <p className="font-medium">Sin registros de mileaje</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-5 bottom-5 w-px bg-slate-200" />
                <div className="space-y-3">
                  {mileageLogs.map((log, idx) => {
                    const mDelta = log.mileage !== null && log.previousMileage !== null
                      ? Number(log.mileage) - Number(log.previousMileage) : null;
                    const hDelta = log.hours !== null && log.previousHours !== null
                      ? Number(log.hours) - Number(log.previousHours) : null;
                    const isFirst = idx === 0;

                    return (
                      <div key={log.id} className="flex gap-4">
                        {/* Dot */}
                        <div className={`relative z-10 w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${
                          isFirst ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'
                        }`}>
                          <FaTachometerAlt className={`text-xs ${isFirst ? 'text-white' : 'text-slate-400'}`} />
                        </div>
                        {/* Card */}
                        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-wrap gap-3 text-sm">
                                {log.mileage !== null && log.mileage !== undefined && (
                                  <span className="flex items-center gap-1.5 font-bold text-blue-700">
                                    <FaTachometerAlt className="text-xs text-blue-400" />
                                    {Number(log.mileage).toLocaleString()} mi
                                    {mDelta !== null && mDelta >= 0 && (
                                      <span className="text-xs font-normal text-slate-400">(+{mDelta.toLocaleString()})</span>
                                    )}
                                  </span>
                                )}
                                {log.hours !== null && log.hours !== undefined && (
                                  <span className="flex items-center gap-1.5 font-bold text-orange-700">
                                    <FaClock className="text-xs text-orange-400" />
                                    {Number(log.hours).toLocaleString()} hs
                                    {hDelta !== null && hDelta >= 0 && (
                                      <span className="text-xs font-normal text-slate-400">(+{hDelta.toLocaleString()})</span>
                                    )}
                                  </span>
                                )}
                              </div>
                              {log.notes && <p className="text-xs text-slate-400 mt-1.5">{log.notes}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-slate-600">{formatFleetDate(log.recordedAt)}</p>
                              {log.recordedBy && (
                                <p className="text-xs text-slate-400 mt-0.5">{log.recordedBy.name}</p>
                              )}
                              {isFirst && (
                                <span className="inline-block mt-1 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">actual</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Modal: Mileaje ══════════════════════════════════════════════ */}
      {showMileageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-blue-700 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <FaTachometerAlt /> Registrar Mileaje / Horas
              </h3>
              <button onClick={() => setShowMileageModal(false)} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleLogMileage} className="p-5 space-y-4">
              {/* Fecha */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fecha del registro</label>
                <input type="date" value={mileageForm.recordedAt}
                  onChange={(e) => setMileageForm(p => ({ ...p, recordedAt: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
              </div>

              {/* Contexto cronológico */}
              {mileageContext && (mileageContext.prev || mileageContext.next) && (
                <div className={`rounded-xl p-3 text-xs space-y-1.5 border ${isBackdated ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
                  <p className={`font-semibold flex items-center gap-1.5 ${isBackdated ? 'text-amber-700' : 'text-blue-700'}`}>
                    <FaInfoCircle /> {isBackdated ? 'Registro con fecha pasada — verificar rango:' : 'Referencias de mileaje:'}
                  </p>
                  {mileageContext.prev && (
                    <p className="text-slate-600">
                      ↑ Anterior ({formatFleetDate(mileageContext.prev.recordedAt)}):
                      {mileageContext.prev.mileage !== null && <strong> {Number(mileageContext.prev.mileage).toLocaleString()} mi</strong>}
                      {mileageContext.prev.hours   !== null && <strong> · {Number(mileageContext.prev.hours).toLocaleString()} hs</strong>}
                    </p>
                  )}
                  {mileageContext.next && (
                    <p className="text-slate-600">
                      ↓ Siguiente ({formatFleetDate(mileageContext.next.recordedAt)}):
                      {mileageContext.next.mileage !== null && <strong> {Number(mileageContext.next.mileage).toLocaleString()} mi</strong>}
                      {mileageContext.next.hours   !== null && <strong> · {Number(mileageContext.next.hours).toLocaleString()} hs</strong>}
                    </p>
                  )}
                </div>
              )}

              {/* Mileaje */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Millas</label>
                <input type="number" value={mileageForm.mileage}
                  onChange={(e) => setMileageForm(p => ({ ...p, mileage: e.target.value }))}
                  placeholder={`Actual: ${Number(asset.currentMileage || 0).toLocaleString()} mi`}
                  min="0" step="0.1"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
              </div>

              {/* Horas */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Horas</label>
                <input type="number" value={mileageForm.hours}
                  onChange={(e) => setMileageForm(p => ({ ...p, hours: e.target.value }))}
                  placeholder={`Actual: ${Number(asset.currentHours || 0).toLocaleString()} hs`}
                  min="0" step="0.1"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
              </div>

              <p className="text-xs text-slate-400">Podés ingresar solo millas, solo horas, o ambos.</p>

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notas</label>
                <input type="text" value={mileageForm.notes}
                  onChange={(e) => setMileageForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Ej: revisión semanal, retorno de viaje..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowMileageModal(false)}
                  className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm transition-colors">
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formularios overlay */}
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
            dispatch(fetchFleetAssetById(id));
          }}
        />
      )}
      {showEditForm && (
        <FleetAssetForm
          assetToEdit={asset}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => { setShowEditForm(false); dispatch(fetchFleetAssetById(id)); }}
        />
      )}

      {/* ══ Viewer modal ════════════════════════════════════════════════ */}
      {viewerDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60">
            <div>
              <p className="text-white font-semibold text-sm">{viewerDoc.name}</p>
              <p className="text-white/50 text-xs capitalize">{viewerDoc.category}</p>
            </div>
            <div className="flex items-center gap-3">
              <a href={viewerDoc.url} target="_blank" rel="noopener noreferrer" download
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition-colors">
                <FaDownload className="text-xs" /> Descargar
              </a>
              <button onClick={() => setViewerDoc(null)}
                className="text-white/60 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
                <FaTimes className="text-lg" />
              </button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            {viewerDoc.fileType === 'image' ? (
              <img src={viewerDoc.url} alt={viewerDoc.name}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
            ) : (
              <iframe src={viewerDoc.url} title={viewerDoc.name}
                className="w-full h-full rounded-xl bg-white"
                style={{ minHeight: '70vh' }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
