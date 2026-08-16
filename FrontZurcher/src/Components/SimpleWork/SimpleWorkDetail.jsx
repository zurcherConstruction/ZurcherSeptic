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
      concrete_work: 'Trabajo de Concreto',
      excavation: 'Excavación',
      plumbing: 'Plomería',
      electrical: 'Eléctrico',
      landscaping: 'Paisajismo',
      other: 'Otro'
    };
    return types[type] || type;
  };

  const handleGeneratePdf = () => {
    dispatch(generateSimpleWorkPdf(work.id));
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/simple-works')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {work.workNumber}
                </h1>
                <p className="text-sm text-gray-500">
                  {getWorkTypeDisplay(work.workType)}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(work.status)}`}>
                {getStatusDisplay(work.status)}
              </span>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <PencilSquareIcon className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={handleGeneratePdf}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span>PDF</span>
              </button>
              <button
                onClick={handleSendEmail}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <EnvelopeIcon className="h-4 w-4" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Costo Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pagado</p>
                <p className="text-2xl font-bold text-green-600">
                  ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Gastos</p>
                <p className="text-2xl font-bold text-red-600">
                  ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <ShoppingCartIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ganancia</p>
                <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 mt-1">{profitMargin}% margen</p>
              </div>
              <div className={`${profit >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full p-3`}>
                {profit >= 0 ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                ) : (
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </div>
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
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Información del Cliente
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Nombre:</span>
                        <p className="text-gray-900">{work.clientData?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Email:</span>
                        <p className="text-gray-900">{work.clientData?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Teléfono:</span>
                        <p className="text-gray-900">{work.clientData?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Dirección:</span>
                        <p className="text-gray-900">{work.propertyAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Work Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Información del Trabajo
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Tipo:</span>
                        <p className="text-gray-900">{getWorkTypeDisplay(work.workType)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Estado:</span>
                        <p className="text-gray-900">{getStatusDisplay(work.status)}</p>
                      </div>
                      {/* Staff Assignment */}
                      <div>
                        <span className="text-sm font-medium text-gray-500">Asignado a:</span>
                        <select
                          value={work.assignedStaffId || ''}
                          onChange={(e) => handleAssignStaff(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">-- Sin asignar --</option>
                          {(staffList || []).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      {work.assignedDate && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Fecha asignación:</span>
                          <p className="text-gray-900">{new Date(work.assignedDate).toLocaleDateString('es-ES')}</p>
                        </div>
                      )}
                      {work.linkedWorkId && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Trabajo Vinculado:</span>
                          <p className="text-blue-600 hover:underline cursor-pointer">
                            {work.linkedWorkId}
                          </p>
                        </div>
                      )}
                      {work.createdAt && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Fecha de Creación:</span>
                          <p className="text-gray-900">
                            {new Date(work.createdAt).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      )}
                      {work.sentAt && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Enviado al Cliente:</span>
                          <p className="text-gray-900">
                            {new Date(work.sentAt).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Descripción
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {work.description}
                  </p>
                </div>

                {/* Notes */}
                {work.notes && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Notas
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {work.notes}
                    </p>
                  </div>
                )}

                {/* Work Images (from mobile/API uploads) */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    📸 Fotos/Videos del Trabajo
                  </h3>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {/* workImages - fotos/videos de trabajo en progreso */}
                    {(work.workImages || []).map((img, idx) => {
                      const isVideo = img.url?.match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i);
                      return (
                        <button
                          key={`work-${img.id || idx}`}
                          onClick={() => setLightboxImage(img.url)}
                          className="relative group"
                        >
                          {isVideo ? (
                            <div className="relative w-24 h-24">
                              <video src={img.url} className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                                <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <img src={img.url} alt={img.originalName || 'Foto trabajo'} className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                          )}
                        </button>
                      );
                    })}
                    {/* attachments (legacy - images/videos only) */}
                    {(work.attachments || []).filter(a => a.type !== 'pdf' && /\.(jpg|jpeg|png|gif|mp4|mov|avi|mkv|webm)$/i.test(a.originalName || a.url || '')).map((img, idx) => {
                      const isVideo = (img.url || '').match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i);
                      return (
                        <button
                          key={`att-${idx}`}
                          onClick={() => setLightboxImage(img.url)}
                          className="relative group"
                        >
                          {isVideo ? (
                            <div className="relative w-24 h-24">
                              <video src={img.url} className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                                <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <img src={img.url} alt={img.originalName || 'Foto'} className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                          )}
                        </button>
                      );
                    })}
                    {(work.workImages || []).length === 0 && (!work.attachments || work.attachments.filter(a => /\.(jpg|jpeg|png|gif|mp4|mov|avi|mkv|webm)$/i.test(a.originalName || a.url || '')).length === 0) && (
                      <p className="text-sm text-gray-400">Sin fotos/videos de trabajo aún</p>
                    )}
                  </div>
                </div>

                {/* Completion Images */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    ✅ Fotos/Videos de Finalización
                  </h3>
                  <div className="flex flex-wrap gap-3 mb-3">
                    {(work.completionImages || []).map((img, idx) => {
                      const isVideo = img.url?.match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i);
                      return (
                        <button
                          key={`comp-${img.id || idx}`}
                          onClick={() => setLightboxImage(img.url)}
                          className="relative group"
                        >
                          {isVideo ? (
                            <div className="relative w-24 h-24">
                              <video src={img.url} className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg">
                                <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <img src={img.url} alt={img.originalName || 'Foto finalización'} className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:shadow-md transition-shadow" />
                          )}
                        </button>
                      );
                    })}
                    {(work.completionImages || []).length === 0 && (
                      <p className="text-sm text-gray-400">Sin fotos/videos de finalización aún</p>
                    )}
                  </div>
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md text-sm font-medium transition-colors border border-blue-200">
                    <CameraIcon className="h-4 w-4" />
                    {isUploadingCompletion ? 'Subiendo...' : 'Subir Foto/Video'}
                    <input
                      type="file"
                      onChange={handleUploadCompletionImage}
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.mkv,.webm"
                      disabled={isUploadingCompletion}
                    />
                  </label>
                </div>

                {/* Payment Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Progreso de Pago
                    </h3>
                    <span className="text-sm text-gray-600">
                      ${totalPaid.toFixed(2)} / ${totalCost.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${
                        (totalPaid / totalCost) * 100 >= 100
                          ? 'bg-green-500'
                          : (totalPaid / totalCost) * 100 >= 50
                          ? 'bg-blue-500'
                          : 'bg-yellow-500'
                      }`}
                      style={{ width: `${Math.min((totalPaid / totalCost) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((totalPaid / totalCost) * 100).toFixed(1)}% completado
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'items' && <SimpleWorkItemsTab work={work} />}
            {activeTab === 'payments' && <SimpleWorkPaymentTab workId={work.id} />}
            {activeTab === 'expenses' && <SimpleWorkExpenseTab workId={work.id} />}
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
