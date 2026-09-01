import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  CameraIcon,
  UserIcon,
  MapPinIcon,
  PhoneIcon,
  AtSymbolIcon,
  CalendarDaysIcon,
  LinkIcon,
  BanknotesIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import {
  fetchSimpleWorkById,
  generateSimpleWorkPdf,
  sendSimpleWorkToClient,
  markSimpleWorkAsCompleted,
  updateSimpleWork
} from '../../Redux/Actions/simpleWorkActions';
import { fetchStaff } from '../../Redux/Actions/adminActions';
import { clearCurrentSimpleWork } from '../../Redux/Reducer/simpleWorkReducer';
import SimpleWorkPaymentTab from './SimpleWorkPaymentTab';
import SimpleWorkExpenseTab from './SimpleWorkExpenseTab';
import SimpleWorkItemsTab from './SimpleWorkItemsTab';
import AdvancedCreateSimpleWorkModal from './AdvancedCreateSimpleWorkModal';
import api from '../../utils/axios';

const SimpleWorkDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { currentSimpleWork, loading } = useSelector(state => state.simpleWork);
  const { staffList } = useSelector(state => state.admin);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (v) => setSearchParams(prev => { prev.set('tab', v); return prev; });
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUploadingCompletion, setIsUploadingCompletion] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [inspectionForm, setInspectionForm] = useState(null);
  const [savingInspection, setSavingInspection] = useState(false);

  // Document preview modal
  const [docPreview, setDocPreview] = useState(null); // { url, title, type: 'image'|'pdf' }
  // Document upload
  const [uploadingDoc, setUploadingDoc] = useState(false);
  // Quick inspection result modal
  const [quickInspModal, setQuickInspModal] = useState(null); // 'initial' | 'final'
  const [quickInspForm, setQuickInspForm] = useState({ result: '', scheduledDate: '' });
  const [savingQuickInsp, setSavingQuickInsp] = useState(false);

  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Collapsible sections in overview
  const [openSections, setOpenSections] = useState({
    payment: true, client: true, work: true, notes: false, budget: true, photos: false, receipts: true,
  });
  const toggleSection = (s) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));

  useEffect(() => {
    if (id) {
      dispatch(fetchSimpleWorkById(id));
    }
    dispatch(fetchStaff());
    return () => {
      dispatch(clearCurrentSimpleWork());
    };
  }, [id, dispatch]);

  const handleAssignStaff = async (staffId) => {
    try {
      await dispatch(updateSimpleWork(work.id, {
        assignedStaffId: staffId || null,
        ...(staffId ? { assignedDate: new Date().toISOString() } : {})
      }));
      dispatch(fetchSimpleWorkById(id));
      toast.success(staffId ? 'Staff asignado' : 'Staff desasignado');
    } catch (e) {
      toast.error('Error asignando staff');
    }
  };

  const handleUploadCompletionImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingCompletion(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/simple-works/${work.id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      dispatch(fetchSimpleWorkById(id));
      toast.success('Imagen subida exitosamente');
    } catch (e) {
      toast.error('Error subiendo imagen');
    }
    setIsUploadingCompletion(false);
  };

  // ── Document helpers ──────────────────────────────────────────────────────
  const openDocPreview = (url, title) => {
    const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url) ||
                  url.includes('image/');
    setDocPreview({ url, title, type: isImg ? 'image' : 'pdf' });
  };

  const handleUploadDoc = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/simple-works/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      dispatch(fetchSimpleWorkById(id));
      toast.success('Documento subido exitosamente');
    } catch {
      toast.error('Error subiendo documento');
    }
    setUploadingDoc(false);
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    try {
      await api.delete(`/simple-works/${id}/attachments/${attachmentId}`);
      dispatch(fetchSimpleWorkById(id));
      toast.success('Documento eliminado');
    } catch {
      toast.error('Error eliminando documento');
    }
  };

  // ── Quick inspection result ───────────────────────────────────────────────
  const openQuickInsp = (type) => {
    const prefix = type === 'initial' ? 'initial' : 'final';
    setQuickInspForm({
      result: currentSimpleWork?.[`${prefix}InspectionResult`] || '',
      scheduledDate: currentSimpleWork?.[`${prefix}InspectionScheduledDate`] || '',
    });
    setQuickInspModal(type);
  };

  const handleSaveQuickInsp = async () => {
    if (!quickInspModal) return;
    setSavingQuickInsp(true);
    const sanitize = (v) => (v === '' || v === null || v === undefined ? null : v);
    const prefix = quickInspModal === 'initial' ? 'initial' : 'final';
    try {
      await dispatch(updateSimpleWork(id, {
        [`${prefix}InspectionResult`]:       sanitize(quickInspForm.result),
        [`${prefix}InspectionScheduledDate`]: sanitize(quickInspForm.scheduledDate),
      }));
      dispatch(fetchSimpleWorkById(id));
      toast.success('Inspección actualizada');
      setQuickInspModal(null);
    } catch {
      toast.error('Error guardando inspección');
    }
    setSavingQuickInsp(false);
  };

  // Sync inspection form when work loads
  useEffect(() => {
    if (!currentSimpleWork) return;
    setInspectionForm({
      needsInitialInspection: currentSimpleWork.needsInitialInspection || false,
      initialInspectionRequestedDate: currentSimpleWork.initialInspectionRequestedDate || '',
      initialInspectionScheduledDate: currentSimpleWork.initialInspectionScheduledDate || '',
      initialInspectionResult: currentSimpleWork.initialInspectionResult || '',
      initialInspectionNotes: currentSimpleWork.initialInspectionNotes || '',
      initialInspectionInspectorEmail: currentSimpleWork.initialInspectionInspectorEmail || '',
      needsFinalInspection: currentSimpleWork.needsFinalInspection || false,
      finalInspectionRequestedDate: currentSimpleWork.finalInspectionRequestedDate || '',
      finalInspectionScheduledDate: currentSimpleWork.finalInspectionScheduledDate || '',
      finalInspectionResult: currentSimpleWork.finalInspectionResult || '',
      finalInspectionNotes: currentSimpleWork.finalInspectionNotes || '',
      finalInspectionInspectorEmail: currentSimpleWork.finalInspectionInspectorEmail || '',
    });
  }, [currentSimpleWork]);

  const handleSaveInspections = async () => {
    setSavingInspection(true);
    try {
      // Sanitize: send null for empty strings so Postgres DATE/ENUM columns don't reject
      const sanitize = (v) => (v === '' || v === null || v === undefined ? null : v);
      const payload = {
        needsInitialInspection:           inspectionForm.needsInitialInspection,
        initialInspectionRequestedDate:   sanitize(inspectionForm.initialInspectionRequestedDate),
        initialInspectionScheduledDate:   sanitize(inspectionForm.initialInspectionScheduledDate),
        initialInspectionResult:          sanitize(inspectionForm.initialInspectionResult),
        initialInspectionNotes:           sanitize(inspectionForm.initialInspectionNotes),
        initialInspectionInspectorEmail:  sanitize(inspectionForm.initialInspectionInspectorEmail),
        needsFinalInspection:             inspectionForm.needsFinalInspection,
        finalInspectionRequestedDate:     sanitize(inspectionForm.finalInspectionRequestedDate),
        finalInspectionScheduledDate:     sanitize(inspectionForm.finalInspectionScheduledDate),
        finalInspectionResult:            sanitize(inspectionForm.finalInspectionResult),
        finalInspectionNotes:             sanitize(inspectionForm.finalInspectionNotes),
        finalInspectionInspectorEmail:    sanitize(inspectionForm.finalInspectionInspectorEmail),
      };
      await dispatch(updateSimpleWork(id, payload));
      dispatch(fetchSimpleWorkById(id));
      toast.success('Inspecciones guardadas');
    } catch {
      toast.error('Error guardando inspecciones');
    }
    setSavingInspection(false);
  };

  if (loading || !currentSimpleWork) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const work = currentSimpleWork;
  const totalCost = parseFloat(work.finalAmount || work.estimatedAmount || 0);
  const totalPaid = parseFloat(work.totalPaid || 0);
  const totalExpenses = parseFloat(work.totalExpenses || 0);
  const remainingAmount = totalCost - totalPaid;
  const profit = totalPaid - totalExpenses;
  const profitMargin = totalPaid > 0 ? ((profit / totalPaid) * 100).toFixed(1) : 0;

  // Status badge color
  const getStatusBadgeColor = (status) => {
    const colors = {
      quoted: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-purple-100 text-purple-800',
      invoiced: 'bg-indigo-100 text-indigo-800',
      paid: 'bg-green-200 text-green-900',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusDisplay = (status) => {
    const displays = {
      quoted: 'Cotizado',
      sent: 'Enviado',
      approved: 'Aprobado',
      in_progress: 'En Progreso',
      completed: 'Completado',
      invoiced: 'Facturado',
      paid: 'Pagado',
      cancelled: 'Cancelado'
    };
    return displays[status] || status;
  };

  const getWorkTypeDisplay = (type) => {
    const types = {
      culvert: 'Culvert',
      drainfield: 'Drainfield',
      repair: 'Reparación',
      abandonment: 'Abandono',
      modification: 'Modificación',
      pumping: 'Desagote',
      replacement: 'Reemplazo',
      plumbing: 'Plomería',
      inspection: 'Inspección',
      installation: 'Instalación',
      maintenance: 'Mantenimiento',
      other: 'Otro',
      // Legacy
      concrete_work: 'Trabajo de Concreto',
      excavation: 'Excavación',
      electrical: 'Eléctrico',
      landscaping: 'Paisajismo',
    };
    return types[type] || type;
  };

  const handleGeneratePdf = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const response = await api.get(`/simple-works/${work.id}/pdf`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(response.data);
      setDocPreview({ url: blobUrl, title: `${work.workNumber} — Quote`, type: 'pdf', blobUrl });
    } catch {
      toast.error('Error generando PDF');
    }
    setGeneratingPdf(false);
  };

  const handleSendEmail = async () => {
    if (window.confirm('¿Deseas enviar esta cotización al cliente por email?')) {
      try {
        await dispatch(sendSimpleWorkToClient(work.id));
        toast.success('Email enviado exitosamente');
      } catch (error) {
        toast.error('Error al enviar email');
      }
    }
  };

  const handleMarkAsCompleted = async () => {
    if (window.confirm('¿Marcar este trabajo como completado?')) {
      try {
        await dispatch(markSimpleWorkAsCompleted(work.id));
        toast.success('Trabajo marcado como completado');
      } catch (error) {
        toast.error('Error al actualizar estado');
      }
    }
  };

  // Progress stages start from Approved — pre-approval stages are "not started"
  const SW_STAGES = [
    { key: 'approved',    label: 'Approved' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'invoiced',    label: 'Invoiced' },
    { key: 'paid',        label: 'Paid' },
    { key: 'completed',   label: 'Completed' },
  ];
  const STAGE_IDX_MAP = { approved: 0, in_progress: 1, invoiced: 2, paid: 3, completed: 4 };
  const stageIdx = STAGE_IDX_MAP[work.status] ?? -1;
  const PAID_IDX  = 3;
  const isPaid    = totalPaid >= totalCost && totalCost > 0;
  const isCompleted = work.status === 'completed';
  // Bar fill: advance to Paid dot if already paid, even when status hasn't reached it
  const fillIdx   = Math.max(stageIdx, isPaid ? PAID_IDX : -1);

  // Inspection alert badges shown on the progress bar
  const inspectionAlerts = [];
  const buildInspAlert = (label, result, scheduledDate, type) => {
    if (result === 'passed')
      inspectionAlerts.push({ label: `${label} ✓ Passed`, color: 'text-green-700 bg-green-50 border-green-200', pulse: false, type });
    else if (result === 'failed')
      inspectionAlerts.push({ label: `${label} ✗ Failed`, color: 'text-red-600 bg-red-50 border-red-200', pulse: true, type });
    else if (scheduledDate)
      inspectionAlerts.push({ label: `${label} — Scheduled`, color: 'text-blue-700 bg-blue-50 border-blue-200', pulse: false, type });
    else
      inspectionAlerts.push({ label: `${label} — Pending`, color: 'text-yellow-700 bg-yellow-50 border-yellow-200', pulse: true, type });
  };
  if (work.needsInitialInspection) buildInspAlert('Initial Insp.', work.initialInspectionResult, work.initialInspectionScheduledDate, 'initial');
  if (work.needsFinalInspection)   buildInspAlert('Final Insp.',   work.finalInspectionResult,   work.finalInspectionScheduledDate, 'final');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — blue banner, WorkDetail style */}
      <div className="bg-blue-500 text-white px-4 sm:px-6 lg:px-8 py-5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: back + title */}
          <div className="flex items-start gap-4 min-w-0">
            <button
              onClick={() => navigate('/simple-works')}
              className="mt-1 text-white/80 hover:text-white flex-shrink-0"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold uppercase break-words leading-tight">
                {work.propertyAddress || work.workNumber}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-blue-100 text-sm">{work.workNumber}</span>
                <span className="text-blue-200">·</span>
                <span className="text-blue-100 text-sm">{getWorkTypeDisplay(work.workType)}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-400/60 text-white border border-white/20">
                  {getStatusDisplay(work.status)}
                </span>
                {isPaid && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-400/70 text-white border border-white/20">
                    ✓ Pagado
                  </span>
                )}
                {isCompleted && !isPaid && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-400/80 text-white border border-white/20 animate-pulse">
                    ⚠ Pago pendiente
                  </span>
                )}
              </div>
              {/* Balance inline */}
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <span className="text-blue-100">Total: <strong className="text-white">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong></span>
                <span className="text-blue-100">Pagado: <strong className="text-green-300">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong></span>
                {remainingAmount > 0 && (
                  <span className="text-blue-100">Saldo: <strong className="text-orange-300">${remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong></span>
                )}
                <span className="text-blue-100">Ganancia: <strong className={profit >= 0 ? 'text-green-300' : 'text-red-300'}>${profit.toLocaleString('en-US', { minimumFractionDigits: 0 })}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg border border-white/20 flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <PencilSquareIcon className="h-4 w-4" />
              Editar
            </button>
            <button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg border border-white/20 flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-60"
            >
              <DocumentTextIcon className="h-4 w-4" />
              {generatingPdf ? 'Generando...' : 'PDF'}
            </button>
            <button
              onClick={handleSendEmail}
              className="px-3 py-2 bg-green-500/80 hover:bg-green-500 text-white rounded-lg border border-white/20 flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <EnvelopeIcon className="h-4 w-4" />
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Inspection alerts — click to set result quickly */}
          {inspectionAlerts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {inspectionAlerts.map((a, i) => (
                <button
                  key={i}
                  onClick={() => openQuickInsp(a.type)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded border transition-opacity hover:opacity-80 ${a.color}`}
                  title="Clic para actualizar resultado"
                >
                  <ExclamationTriangleIcon className={`h-3.5 w-3.5 flex-shrink-0 ${a.pulse ? 'animate-pulse' : ''}`} />
                  {a.label}
                  <PencilIcon className="h-3 w-3 opacity-60 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          {/* Stage dots */}
          <div className="hidden sm:flex relative items-center justify-between">
            <div className="absolute w-full h-2 bg-gray-200 rounded-full" />
            <div
              className="absolute h-2 bg-green-500 rounded-full transition-all duration-500"
              style={{ width: fillIdx >= 0 ? `${(fillIdx / (SW_STAGES.length - 1)) * 100}%` : '0%' }}
            />
            {SW_STAGES.map((stage, idx) => {
              const isDotCurrent   = idx === stageIdx;
              const isDotCompleted = idx < stageIdx || (isPaid && idx === PAID_IDX);
              const isDotOrange    = idx === PAID_IDX && isCompleted && !isPaid;
              const circleClass = isDotOrange
                ? 'bg-orange-400 animate-pulse'
                : isDotCompleted || isDotCurrent
                  ? 'bg-green-500'
                  : 'bg-gray-300';
              return (
                <div key={stage.key} className="relative flex flex-col items-center" style={{ width: `${100 / SW_STAGES.length}%` }}>
                  <div
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-white text-xs font-bold shadow ${circleClass} ${isDotCurrent && !isDotOrange ? 'animate-pulse' : ''}`}
                    style={{ position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)', left: '50%' }}
                  >
                    {idx + 1}
                  </div>
                  <div className="mt-12 text-center">
                    <p className={`text-xs ${isDotOrange ? 'text-orange-500 font-bold animate-pulse' : isDotCurrent ? 'text-green-600 font-bold animate-pulse' : isDotCompleted ? 'text-green-500' : 'text-gray-400'}`}>
                      {stage.label}
                      {isDotOrange && ' ⚠'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mobile */}
          <div className="sm:hidden text-sm text-gray-600 text-center">
            Stage: <span className={`font-semibold ${isCompleted && !isPaid ? 'text-orange-500' : 'text-green-600'}`}>
              {SW_STAGES[stageIdx]?.label || work.status}
              {isCompleted && !isPaid && ' — Pago pendiente'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Balance compacto */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total', value: totalCost, color: 'text-gray-900', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Pagado', value: totalPaid, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Gastos', value: totalExpenses, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: `Ganancia (${profitMargin}%)`, value: profit, color: profit >= 0 ? 'text-green-700' : 'text-red-600', bg: profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border px-4 py-3 ${card.bg}`}>
              <p className="text-xs text-gray-500 mb-0.5">{card.label}</p>
              <p className={`text-xl font-bold ${card.color}`}>
                ${Math.abs(card.value).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Resumen
              </button>
              <button
                onClick={() => setActiveTab('items')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'items'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Items ({work.items?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'payments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pagos ({(work.payments?.length || 0) + (work.linkedIncomes?.length || 0)})
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`px-6 py-3 font-medium text-sm border-b-2 ${
                  activeTab === 'expenses'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Gastos ({(work.expenses?.length || 0) + (work.linkedExpenses?.length || 0)})
              </button>
              <button
                onClick={() => setActiveTab('inspections')}
                className={`px-6 py-3 font-medium text-sm border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'inspections'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                Inspecciones
                {(work.needsInitialInspection || work.needsFinalInspection) && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-blue-500 inline-block" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-6 py-3 font-medium text-sm border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'documents'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <PaperClipIcon className="h-4 w-4" />
                Documentos
                {(work.attachments || []).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">{(work.attachments || []).length}</span>
                )}
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (() => {
              const pctPaid = totalCost > 0 ? Math.min(100, Math.round((totalPaid / totalCost) * 100)) : 0;
              const clientName = work.clientData?.firstName
                ? `${work.clientData.firstName} ${work.clientData.lastName || ''}`.trim()
                : (work.clientData?.name || '');
              const fmtDate = (d) => d ? new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

              const isImageUrl = (url) => /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url || '');
              const isPdfUrl   = (url) => /\.pdf(\?|$)/i.test(url || '');
              const getMime    = (url) => isImageUrl(url) ? 'image/jpeg' : 'application/pdf';
              const allReceipts = [];
              (work.payments || []).filter(p => p.receiptUrl).forEach(p => allReceipts.push({
                key: p.id || p.receiptUrl, url: p.receiptUrl, mime: getMime(p.receiptUrl),
                label: `$${parseFloat(p.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
                sublabel: fmtDate(p.paymentDate), badge: null,
              }));
              (work.linkedIncomes || []).forEach(inc => (inc.Receipts || []).forEach(r => r.fileUrl && allReceipts.push({
                key: r.idReceipt, url: r.fileUrl, mime: r.mimeType || getMime(r.fileUrl),
                label: `$${parseFloat(inc.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
                sublabel: fmtDate(inc.date), badge: 'income',
              })));
              (work.linkedExpenses || []).forEach(exp => (exp.Receipts || []).forEach(r => r.fileUrl && allReceipts.push({
                key: r.idReceipt, url: r.fileUrl, mime: r.mimeType || getMime(r.fileUrl),
                label: `-$${parseFloat(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`,
                sublabel: fmtDate(exp.date), badge: 'expense',
              })));
              const seen = new Set();
              const deduped = allReceipts.filter(r => { if (!r.url || seen.has(r.url)) return false; seen.add(r.url); return true; });

              // Reusable collapsible section header
              const SectionHeader = ({ label, sectionKey, badge }) => (
                <button
                  onClick={() => toggleSection(sectionKey)}
                  className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{label}</span>
                    {badge != null && (
                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
                    )}
                  </div>
                  <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${openSections[sectionKey] ? 'rotate-180' : ''}`} />
                </button>
              );

              const renderMedia = (img, key, label) => {
                const isVideo = (img.url || '').match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i);
                return (
                  <button key={key} onClick={() => setLightboxImage(img.url)} className="relative group flex-shrink-0">
                    {isVideo ? (
                      <div className="relative w-20 h-20">
                        <video src={img.url} className="w-20 h-20 object-cover rounded-xl border border-gray-200 group-hover:shadow-md transition-shadow" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
                          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    ) : (
                      <img src={img.url} alt={img.originalName || label} className="w-20 h-20 object-cover rounded-xl border border-gray-200 group-hover:shadow-md transition-shadow" />
                    )}
                  </button>
                );
              };

              const workImgs = work.workImages || [];
              const attImgs  = (work.attachments || []).filter(a =>
                /\.(jpg|jpeg|png|gif|mp4|mov|avi|mkv|webm)$/i.test(a.originalName || a.url || '')
              );
              const compImgs = work.completionImages || [];
              const totalPhotos = workImgs.length + attImgs.length + compImgs.length;

              return (
              <div className="divide-y divide-gray-100">

                {/* ── Progreso de Pago ───────────────────────────────────── */}
                <div>
                  <SectionHeader label="Progreso de Pago" sectionKey="payment"
                    badge={isPaid ? '✓ Pagado' : `${pctPaid}%`} />
                  {openSections.payment && (
                    <div className="px-4 pb-4">
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-500 ${isPaid ? 'bg-green-500' : pctPaid > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                          style={{ width: `${pctPaid}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                        <span>${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} cobrado</span>
                        <span>${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} total</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Cliente ────────────────────────────────────────────── */}
                <div>
                  <SectionHeader label="Cliente" sectionKey="client" />
                  {openSections.client && (
                    <div className="px-4 pb-4 space-y-3">
                      {clientName && (
                        <div className="flex items-center gap-3">
                          <UserIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-gray-400">Nombre</p>
                            <p className="text-sm font-semibold text-gray-800">{clientName}</p>
                          </div>
                        </div>
                      )}
                      {work.clientData?.email && (
                        <div className="flex items-center gap-3">
                          <AtSymbolIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-gray-400">Email</p>
                            <p className="text-sm text-gray-800">{work.clientData.email}</p>
                          </div>
                        </div>
                      )}
                      {work.clientData?.phone && (
                        <div className="flex items-center gap-3">
                          <PhoneIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-gray-400">Teléfono</p>
                            <p className="text-sm text-gray-800">{work.clientData.phone}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <MapPinIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">Dirección</p>
                          <p className="text-sm font-medium text-gray-800">{work.propertyAddress}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Trabajo ────────────────────────────────────────────── */}
                <div>
                  <SectionHeader label="Detalles del Trabajo" sectionKey="work" />
                  {openSections.work && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <WrenchScrewdriverIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">Tipo</p>
                          <p className="text-sm font-semibold text-gray-800">{getWorkTypeDisplay(work.workType)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircleIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">Estado</p>
                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${getStatusBadgeColor(work.status)}`}>
                            {getStatusDisplay(work.status)}
                          </span>
                        </div>
                      </div>
                      {work.createdAt && (
                        <div className="flex items-center gap-3">
                          <CalendarDaysIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-gray-400">Creado</p>
                            <p className="text-sm text-gray-800">{fmtDate(work.createdAt)}</p>
                          </div>
                        </div>
                      )}
                      {work.sentAt && (
                        <div className="flex items-center gap-3">
                          <EnvelopeIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-gray-400">Enviado al cliente</p>
                            <p className="text-sm text-gray-800">{fmtDate(work.sentAt)}</p>
                          </div>
                        </div>
                      )}
                      {work.linkedWork && (
                        <div className="flex items-center gap-3">
                          <LinkIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                          <div>
                            <p className="text-[11px] text-gray-400">Trabajo vinculado</p>
                            <p className="text-sm text-blue-600 font-medium">{work.linkedWork.propertyAddress || work.linkedWorkId}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <UserIcon className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-400 mb-1">Asignado a</p>
                          <select
                            value={work.assignedStaffId || ''}
                            onChange={(e) => handleAssignStaff(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                          >
                            <option value="">— Sin asignar —</option>
                            {(staffList || []).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Notas / Descripción ────────────────────────────────── */}
                {(work.description || work.notes) && (
                  <div>
                    <SectionHeader label="Descripción y Notas" sectionKey="notes" />
                    {openSections.notes && (
                      <div className="px-4 pb-4 space-y-3">
                        {work.description && (
                          <div>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Descripción</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{work.description}</p>
                          </div>
                        )}
                        {work.notes && (
                          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-1">Notas internas</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{work.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Presupuesto ────────────────────────────────────────── */}
                <div>
                  <SectionHeader label="Presupuesto" sectionKey="budget"
                    badge={work.items?.length ? `${work.items.length} items` : null} />
                  {openSections.budget && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{work.workNumber} · {getWorkTypeDisplay(work.workType)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={handleGeneratePdf} disabled={generatingPdf}
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60">
                            <DocumentTextIcon className="h-3.5 w-3.5" /> {generatingPdf ? '...' : 'PDF'}
                          </button>
                          <button onClick={handleSendEmail}
                            className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1.5">
                            <EnvelopeIcon className="h-3.5 w-3.5" /> Enviar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Fotos y Videos ─────────────────────────────────────── */}
                <div>
                  <SectionHeader label="Fotos y Videos" sectionKey="photos" badge={totalPhotos || null} />
                  {openSections.photos && (
                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Del trabajo</p>
                        <div className="flex flex-wrap gap-2">
                          {workImgs.map((img, i) => renderMedia(img, `w-${img.id||i}`, 'Foto'))}
                          {attImgs.map((img, i) => renderMedia(img, `a-${i}`, 'Foto'))}
                          {workImgs.length === 0 && attImgs.length === 0 && (
                            <p className="text-xs text-gray-300 italic">Sin fotos aún</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">De finalización</p>
                        <div className="flex flex-wrap gap-2">
                          {compImgs.map((img, i) => renderMedia(img, `c-${img.id||i}`, 'Foto finalización'))}
                          {compImgs.length === 0 && <p className="text-xs text-gray-300 italic">Sin fotos aún</p>}
                        </div>
                        <label className="mt-3 cursor-pointer inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-blue-100">
                          <CameraIcon className="h-3.5 w-3.5" />
                          {isUploadingCompletion ? 'Subiendo...' : 'Subir foto/video'}
                          <input type="file" onChange={handleUploadCompletionImage} className="hidden"
                            accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.mkv,.webm" disabled={isUploadingCompletion} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Comprobantes ───────────────────────────────────────── */}
                {deduped.length > 0 && (
                  <div>
                    <SectionHeader label="Comprobantes" sectionKey="receipts" badge={deduped.length} />
                    {openSections.receipts && (
                      <div className="px-4 pb-4">
                        <div className="flex flex-wrap gap-3">
                          {deduped.map((r) => {
                            const isImg = isImageUrl(r.url) || (r.mime || '').startsWith('image/');
                            const isPdf = isPdfUrl(r.url) || r.mime === 'application/pdf';
                            return (
                              <button key={r.key}
                                onClick={() => isImg ? setLightboxImage(r.url) : openDocPreview(r.url, `Comprobante ${r.label}`)}
                                className="group relative flex flex-col items-center focus:outline-none"
                                title={`${r.label} ${r.sublabel || ''}`}
                              >
                                {r.badge && (
                                  <span className={`absolute -top-1.5 -right-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full border
                                    ${r.badge === 'income' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}>
                                    {r.badge === 'income' ? 'ING' : 'GAS'}
                                  </span>
                                )}
                                {isImg ? (
                                  <img src={r.url} alt="Comprobante"
                                    className="w-20 h-20 object-cover rounded-xl border-2 border-gray-100 shadow-sm group-hover:shadow-lg group-hover:border-blue-300 transition-all" />
                                ) : (
                                  <div className="w-20 h-20 flex flex-col items-center justify-center rounded-xl border-2 border-gray-100 bg-gray-50 shadow-sm group-hover:shadow-lg group-hover:border-blue-300 transition-all">
                                    <DocumentTextIcon className="h-8 w-8 text-red-400" />
                                    <span className="text-xs text-gray-500 mt-1 font-medium">{isPdf ? 'PDF' : 'Doc'}</span>
                                  </div>
                                )}
                                <span className="text-xs text-gray-700 mt-1.5 font-semibold">{r.label}</span>
                                {r.sublabel && <span className="text-[10px] text-gray-400">{r.sublabel}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
              );
            })()}

            {activeTab === 'items' && <SimpleWorkItemsTab work={work} />}
            {activeTab === 'payments' && <SimpleWorkPaymentTab workId={work.id} />}
            {activeTab === 'expenses' && <SimpleWorkExpenseTab workId={work.id} />}

            {activeTab === 'documents' && (() => {
              const docs = work.attachments || [];
              return (
                <div className="space-y-6">
                  {/* Upload area */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Documentos Adjuntos</h3>
                    <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${uploadingDoc ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}>
                      <ArrowUpTrayIcon className="h-4 w-4" />
                      {uploadingDoc ? 'Subiendo...' : 'Subir Documento'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        disabled={uploadingDoc}
                        onChange={handleUploadDoc}
                      />
                    </label>
                  </div>

                  {docs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <PaperClipIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Sin documentos adjuntos aún.</p>
                      <p className="text-xs mt-1">Sube planos, permisos, órdenes de trabajo, etc.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {docs.map((doc, idx) => {
                        const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(doc.url || '') || (doc.type || '').startsWith('image/');
                        const isPdf = /\.pdf(\?|$)/i.test(doc.url || '') || doc.type === 'application/pdf';
                        const name = doc.originalName || doc.filename || `Documento ${idx + 1}`;
                        const date = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                        return (
                          <div key={doc.id || idx} className="group relative flex flex-col items-center">
                            <button
                              onClick={() => isImg ? setLightboxImage(doc.url) : openDocPreview(doc.url, name)}
                              className="w-full focus:outline-none"
                            >
                              {isImg ? (
                                <img
                                  src={doc.url}
                                  alt={name}
                                  className="w-full h-32 object-cover rounded-xl border-2 border-gray-200 shadow-sm group-hover:shadow-lg group-hover:border-blue-300 transition-all"
                                />
                              ) : (
                                <div className="w-full h-32 flex flex-col items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50 shadow-sm group-hover:shadow-lg group-hover:border-blue-300 transition-all">
                                  <DocumentTextIcon className={`h-10 w-10 ${isPdf ? 'text-red-400' : 'text-gray-400'}`} />
                                  <span className="text-xs font-bold text-gray-500 mt-1">{isPdf ? 'PDF' : 'DOC'}</span>
                                </div>
                              )}
                            </button>
                            <p className="text-xs text-gray-700 mt-1.5 max-w-full truncate text-center font-medium px-1" title={name}>{name}</p>
                            {date && <p className="text-xs text-gray-400">{date}</p>}
                            <button
                              onClick={() => handleDeleteAttachment(doc.id)}
                              className="absolute top-1 right-1 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow"
                              title="Eliminar"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {activeTab === 'inspections' && inspectionForm && (
              <div className="space-y-8">
                {/* ── Initial Inspection ── */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-50 px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <MagnifyingGlassIcon className="h-5 w-5 text-blue-600" />
                      <h3 className="text-base font-semibold text-gray-800">Initial Inspection</h3>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-sm text-gray-600">Requires inspection</span>
                      <div
                        onClick={() => setInspectionForm(f => ({ ...f, needsInitialInspection: !f.needsInitialInspection }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inspectionForm.needsInitialInspection ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inspectionForm.needsInitialInspection ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  </div>

                  {inspectionForm.needsInitialInspection && (
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Requested Date</label>
                        <input type="date" value={inspectionForm.initialInspectionRequestedDate}
                          onChange={e => setInspectionForm(f => ({ ...f, initialInspectionRequestedDate: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
                        <input type="date" value={inspectionForm.initialInspectionScheduledDate}
                          onChange={e => setInspectionForm(f => ({ ...f, initialInspectionScheduledDate: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Inspector Email</label>
                        <input type="email" value={inspectionForm.initialInspectionInspectorEmail} placeholder="inspector@county.gov"
                          onChange={e => setInspectionForm(f => ({ ...f, initialInspectionInspectorEmail: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
                        <div className="flex gap-3 mt-1">
                          {['', 'pending', 'passed', 'failed'].map(r => (
                            <label key={r} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
                              ${inspectionForm.initialInspectionResult === r
                                ? r === 'passed' ? 'bg-green-100 border-green-400 text-green-700'
                                  : r === 'failed' ? 'bg-red-100 border-red-400 text-red-700'
                                  : r === 'pending' ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                                  : 'bg-gray-100 border-gray-400 text-gray-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="radio" name="initialResult" value={r}
                                checked={inspectionForm.initialInspectionResult === r}
                                onChange={() => setInspectionForm(f => ({ ...f, initialInspectionResult: r }))}
                                className="hidden" />
                              {r === '' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                        <textarea rows={3} value={inspectionForm.initialInspectionNotes} placeholder="Inspection notes..."
                          onChange={e => setInspectionForm(f => ({ ...f, initialInspectionNotes: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Final Inspection ── */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-50 px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <h3 className="text-base font-semibold text-gray-800">Final Inspection</h3>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-sm text-gray-600">Requires inspection</span>
                      <div
                        onClick={() => setInspectionForm(f => ({ ...f, needsFinalInspection: !f.needsFinalInspection }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inspectionForm.needsFinalInspection ? 'bg-green-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inspectionForm.needsFinalInspection ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  </div>

                  {inspectionForm.needsFinalInspection && (
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Requested Date</label>
                        <input type="date" value={inspectionForm.finalInspectionRequestedDate}
                          onChange={e => setInspectionForm(f => ({ ...f, finalInspectionRequestedDate: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
                        <input type="date" value={inspectionForm.finalInspectionScheduledDate}
                          onChange={e => setInspectionForm(f => ({ ...f, finalInspectionScheduledDate: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Inspector Email</label>
                        <input type="email" value={inspectionForm.finalInspectionInspectorEmail} placeholder="inspector@county.gov"
                          onChange={e => setInspectionForm(f => ({ ...f, finalInspectionInspectorEmail: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
                        <div className="flex gap-3 mt-1">
                          {['', 'pending', 'passed', 'failed'].map(r => (
                            <label key={r} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
                              ${inspectionForm.finalInspectionResult === r
                                ? r === 'passed' ? 'bg-green-100 border-green-400 text-green-700'
                                  : r === 'failed' ? 'bg-red-100 border-red-400 text-red-700'
                                  : r === 'pending' ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                                  : 'bg-gray-100 border-gray-400 text-gray-700'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="radio" name="finalResult" value={r}
                                checked={inspectionForm.finalInspectionResult === r}
                                onChange={() => setInspectionForm(f => ({ ...f, finalInspectionResult: r }))}
                                className="hidden" />
                              {r === '' ? 'N/A' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                        <textarea rows={3} value={inspectionForm.finalInspectionNotes} placeholder="Inspection notes..."
                          onChange={e => setInspectionForm(f => ({ ...f, finalInspectionNotes: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Save */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveInspections}
                    disabled={savingInspection}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                  >
                    {savingInspection ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Guardando...</>
                    ) : (
                      <><CheckCircleIcon className="h-4 w-4" /> Guardar Inspecciones</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <AdvancedCreateSimpleWorkModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          editingWork={work}
          onWorkCreated={() => {
            setShowEditModal(false);
            dispatch(fetchSimpleWorkById(id));
          }}
        />
      )}

      {/* ── Quick Inspection Result Modal ────────────────────────────────── */}
      {quickInspModal && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MagnifyingGlassIcon className="h-5 w-5 text-blue-600" />
                {quickInspModal === 'initial' ? 'Initial Inspection' : 'Final Inspection'}
              </h3>
              <button onClick={() => setQuickInspModal(null)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Resultado</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'pending', label: 'Pending', cls: 'bg-yellow-50 border-yellow-400 text-yellow-700' },
                    { v: 'passed',  label: '✓ Passed',  cls: 'bg-green-50 border-green-400 text-green-700' },
                    { v: 'failed',  label: '✗ Failed',  cls: 'bg-red-50 border-red-400 text-red-700' },
                    { v: '',       label: 'N/A',       cls: 'bg-gray-50 border-gray-300 text-gray-600' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setQuickInspForm(f => ({ ...f, result: opt.v }))}
                      className={`px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all
                        ${quickInspForm.result === opt.v ? opt.cls + ' ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha Programada (opcional)</label>
                <input
                  type="date"
                  value={quickInspForm.scheduledDate}
                  onChange={e => setQuickInspForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setQuickInspModal(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveQuickInsp}
                disabled={savingQuickInsp}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {savingQuickInsp ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Preview Modal ────────────────────────────────────────── */}
      {docPreview && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
            <h3 className="text-sm font-semibold truncate">{docPreview.title}</h3>
            <button
              onClick={() => { if (docPreview?.blobUrl) window.URL.revokeObjectURL(docPreview.blobUrl); setDocPreview(null); }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-4 flex-shrink-0"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
            {docPreview.type === 'image' ? (
              <img
                src={docPreview.url}
                alt={docPreview.title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <iframe
                src={docPreview.url}
                className="w-full h-full rounded-lg"
                title={docPreview.title}
                style={{ minHeight: 'calc(100vh - 56px)' }}
              />
            )}
          </div>
        </div>
      )}

      {/* Image/Video Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
            onClick={() => setLightboxImage(null)}
          >
            <XMarkIcon className="h-6 w-6 text-white" />
          </button>
          {lightboxImage?.match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i) ? (
            <video
              src={lightboxImage}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxImage}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleWorkDetail;
