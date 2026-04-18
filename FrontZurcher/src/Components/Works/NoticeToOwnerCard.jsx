import React, { useState } from 'react';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ClockIcon,
  DocumentTextIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import api from '../../utils/axios';

const NoticeToOwnerCard = ({ work, onUpdate, isOpen, onToggle, onDocumentUploaded }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    noticeToOwnerFiled: work.noticeToOwnerFiled || false,
    noticeToOwnerDocumentUrl: work.noticeToOwnerDocumentUrl || '',
    lienFiled: work.lienFiled || false,
    lienDocumentUrl: work.lienDocumentUrl || '',
    noticeToOwnerNotes: work.noticeToOwnerNotes || ''
  });

  // Estados para modal de preview
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Estados para file uploads
  const [noticeToOwnerFile, setNoticeToOwnerFile] = useState(null);
  const [uploadingNotice, setUploadingNotice] = useState(false);
  const [lienFile, setLienFile] = useState(null);
  const [uploadingLien, setUploadingLien] = useState(false);

  // ✅ Función para formatear fechas de YYYY-MM-DD a MM-DD-YYYY
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
    // dateString viene como "YYYY-MM-DD" del backend
    const [year, month, day] = dateString.split('-');
    
    if (!year || !month || !day) {
      return "Invalid Date";
    }
    
    // Retornar en formato MM-DD-YYYY
    return `${month}-${day}-${year}`;
  };

  // ✅ Calcular días restantes usando strings para evitar cambios de zona horaria
  const calculateDaysRemaining = () => {
    if (!work.installationStartDate) return null;
    
    // Parsear la fecha como string YYYY-MM-DD
    const [year, month, day] = work.installationStartDate.split('-');
    const startDate = new Date(year, month - 1, day); // month - 1 porque enero es 0
    
    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() + 45); // Florida: 45 días
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    const diffTime = deadline - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calcular días desde inicio
    const daysFromStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    // Formatear deadline a MM-DD-YYYY
    const deadlineMonth = String(deadline.getMonth() + 1).padStart(2, '0');
    const deadlineDay = String(deadline.getDate()).padStart(2, '0');
    const deadlineYear = deadline.getFullYear();
    const deadlineFormatted = `${deadlineMonth}-${deadlineDay}-${deadlineYear}`;
    
    // Calcular porcentaje de progreso (0-100)
    const progressPercent = Math.min(100, Math.max(0, (daysFromStart / 45) * 100));
    
    return {
      days: diffDays,
      daysFromStart: Math.max(0, daysFromStart),
      deadline: deadlineFormatted,
      isUrgent: diffDays <= 7,
      isPastDue: diffDays < 0,
      progressPercent: progressPercent
    };
  };

  const daysInfo = calculateDaysRemaining();

  // Handler para abrir preview de documentos
  const handleViewDocument = (url, title) => {
    if (!url) return;
    
    setLoadingPreview(true);
    setPreviewTitle(title);
    
    // Si es una URL de Cloudinary o externa, usar directamente
    setPreviewUrl(url);
    setShowPreviewModal(true);
    setLoadingPreview(false);
  };

  // Handler para subir Notice to Owner
  const handleUploadNoticeToOwner = async () => {
    setUploadingNotice(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('document', noticeToOwnerFile);
      
      const response = await api.post(
        `/work/${work.idWork}/notice-to-owner`,
        formDataUpload,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      if (response.data.success) {
        alert('✅ Notice to Owner subido exitosamente');
        setNoticeToOwnerFile(null);
        // Resetear el input file
        const inputElement = document.getElementById('notice-to-owner-file');
        if (inputElement) inputElement.value = '';
        if (onDocumentUploaded) onDocumentUploaded();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al subir documento: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingNotice(false);
    }
  };

  // Handler para subir Lien
  const handleUploadLien = async () => {
    setUploadingLien(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('document', lienFile);
      
      const response = await api.post(
        `/work/${work.idWork}/lien`,
        formDataUpload,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      
      if (response.data.success) {
        alert('✅ Lien subido exitosamente');
        setLienFile(null);
        // Resetear el input file
        const inputElement = document.getElementById('lien-file');
        if (inputElement) inputElement.value = '';
        if (onDocumentUploaded) onDocumentUploaded();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al subir documento: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploadingLien(false);
    }
  };

  // Si no ha empezado instalación, no mostrar
  if (!work.installationStartDate) {
    return null;
  }

  const handleSave = async () => {
    try {
      await onUpdate(formData);
      setEditing(false);
    } catch (error) {
      console.error('Error updating Notice to Owner:', error);
    }
  };

  const getAlertColor = () => {
    if (!daysInfo) return 'border-gray-500';
    if (daysInfo.isPastDue) return 'border-red-500';
    if (daysInfo.isUrgent) return 'border-yellow-500';
    if (formData.noticeToOwnerFiled && formData.lienFiled) return 'border-green-500';
    return 'border-blue-500';
  };

  const getBackgroundColor = () => {
    if (!daysInfo) return 'bg-gray-50';
    if (daysInfo.isPastDue) return 'bg-red-50';
    if (daysInfo.isUrgent) return 'bg-yellow-50';
    if (formData.noticeToOwnerFiled && formData.lienFiled) return 'bg-green-50';
    return 'bg-blue-50';
  };

  return (
    <div className={`bg-white shadow-lg rounded-lg p-4 md:p-6 border-l-4 ${getAlertColor()} ${
      daysInfo?.isPastDue ? 'ring-2 ring-red-400' : 
      daysInfo?.isUrgent ? 'ring-2 ring-yellow-300' : ''
    }`}>
      {/* Header colapsable - MEJORADO */}
      <h2
        className="text-lg md:text-xl font-bold mb-4 cursor-pointer flex justify-between items-center"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="h-7 w-7 text-blue-600" />
          <span>📋 Notice to Owner & Lien</span>
          {/* Days remaining badge en el título - MÁS LLAMATIVO */}
          {daysInfo && !formData.noticeToOwnerFiled && (
            <span className={`ml-3 px-3 py-1 rounded-full text-sm font-bold animate-pulse ${
              daysInfo.isPastDue 
                ? 'bg-red-600 text-white shadow-lg shadow-red-500' 
                : daysInfo.isUrgent 
                  ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-400'
                  : 'bg-blue-500 text-white'
            }`}>
              {daysInfo.isPastDue ? (
                <span>🚨 {Math.abs(daysInfo.days)} DÍAS VENCIDO</span>
              ) : (
                <span>⏰ {daysInfo.days} DÍAS</span>
              )}
            </span>
          )}
        </div>
        <span className="text-xl">{isOpen ? "▲" : "▼"}</span>
      </h2>

      {/* BARRA DE PROGRESO VISUAL - SOLO CUANDO ESTÁ CERRADO */}
      {daysInfo && !formData.noticeToOwnerFiled && !isOpen && (
        <div className={`mb-4 p-3 rounded-lg border-2 ${
          daysInfo.isPastDue ? 'bg-red-100 border-red-300' :
          daysInfo.isUrgent ? 'bg-yellow-100 border-yellow-300' :
          'bg-blue-100 border-blue-300'
        }`}>
          {/* Barra de progreso compacta */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1">
              <div className="text-xs text-gray-600 font-medium">Progreso</div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${daysInfo.isPastDue ? 'text-red-600' : daysInfo.isUrgent ? 'text-yellow-600' : 'text-blue-600'}`}>
                  {daysInfo.daysFromStart}
                </span>
                <span className="text-xs text-gray-500">/ 45 días</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 font-medium">Quedan</div>
              <div className={`text-lg font-bold ${
                daysInfo.isPastDue ? 'text-red-600' : 
                daysInfo.isUrgent ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {Math.max(0, daysInfo.days)}d
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden border border-gray-400">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                daysInfo.isPastDue ? 'bg-red-600' :
                daysInfo.isUrgent ? 'bg-yellow-500' :
                daysInfo.progressPercent > 75 ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${daysInfo.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {formData.noticeToOwnerFiled && (
        <div className="mb-4 p-3 rounded-lg bg-green-100 border-2 border-green-300">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
            <div>
              <div className="text-sm font-bold text-green-800">✓ Archivado</div>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <>
          {/* DETALLES COMPLETOS - SOLO CUANDO SE ABRE */}
          {daysInfo && !formData.noticeToOwnerFiled && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              daysInfo.isPastDue ? 'bg-red-100 border-red-300' :
              daysInfo.isUrgent ? 'bg-yellow-100 border-yellow-300' :
              'bg-blue-100 border-blue-300'
            }`}>
              {/* Título de contador */}
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-700">Progreso del Plazo</div>
                  <div className="text-2xl font-bold">
                    <span className={daysInfo.isPastDue ? 'text-red-600' : daysInfo.isUrgent ? 'text-yellow-600' : 'text-blue-600'}>
                      {daysInfo.daysFromStart}
                    </span>
                    <span className="text-gray-500 text-lg"> / 45 días</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600 font-medium">Quedan:</div>
                  <div className={`text-3xl font-bold ${
                    daysInfo.isPastDue ? 'text-red-600' : 
                    daysInfo.isUrgent ? 'text-yellow-600' : 
                    'text-green-600'
                  }`}>
                    {Math.max(0, daysInfo.days)}
                  </div>
                  <div className="text-xs text-gray-600">días</div>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden border border-gray-400">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    daysInfo.isPastDue ? 'bg-red-600' :
                    daysInfo.isUrgent ? 'bg-yellow-500' :
                    daysInfo.progressPercent > 75 ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${daysInfo.progressPercent}%` }}
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <div className="text-gray-600 font-medium">Inicio:</div>
                  <div className="font-semibold text-gray-800">{formatDate(work.installationStartDate)}</div>
                </div>
                <div>
                  <div className="text-gray-600 font-medium">Vencimiento:</div>
                  <div className={`font-semibold ${daysInfo.isPastDue ? 'text-red-600' : daysInfo.isUrgent ? 'text-yellow-600' : 'text-green-600'}`}>
                    {daysInfo.deadline}
                  </div>
                </div>
              </div>

              {/* Mensaje de estado */}
              {daysInfo.isPastDue && (
                <div className="mt-3 bg-red-200 border border-red-400 rounded p-2">
                  <div className="text-red-800 font-bold text-sm">⚠️ ¡URGENTE! El plazo venció hace {Math.abs(daysInfo.days)} días. ARCHIVA AHORA.</div>
                </div>
              )}
              {daysInfo.isUrgent && !daysInfo.isPastDue && (
                <div className="mt-3 bg-yellow-200 border border-yellow-400 rounded p-2">
                  <div className="text-yellow-800 font-bold text-sm">⏰ Quedan pocos días. ARCHIVA PRONTO.</div>
                </div>
              )}
            </div>
          )}

          {formData.noticeToOwnerFiled && (
            <div className="mb-6 p-4 rounded-lg bg-green-100 border-2 border-green-300">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
                <div>
                  <div className="font-bold text-green-800">✓ COMPLETADO</div>
                  <div className="text-sm text-green-700">El documento fue archivado correctamente</div>
                </div>
              </div>
            </div>
          )}

          <div className={`mb-4 p-3 rounded border ${getBackgroundColor()}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-700">📋 Notice to Owner</h4>
              {formData.noticeToOwnerFiled ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
              )}
            </div>

            <div className="text-sm">
              {work.noticeToOwnerDocumentUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <CheckCircleIcon className="h-5 w-5" />
                    Documento Archivado
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => handleViewDocument(work.noticeToOwnerDocumentUrl, 'Notice to Owner')}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Ver Documento
                    </button>
                    <a 
                      href={work.noticeToOwnerDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Abrir en nueva pestaña
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-red-700 font-semibold">⚠ Aún no fue archivado</div>
                  
                  <div className="space-y-2">
                    <input
                      id="notice-to-owner-file"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        setNoticeToOwnerFile(e.target.files[0]);
                        setLienFile(null);
                      }}
                      className="text-sm w-full"
                    />
                    
                    {noticeToOwnerFile && (
                      <button
                        onClick={handleUploadNoticeToOwner}
                        disabled={uploadingNotice}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {uploadingNotice ? 'Subiendo...' : '📤 Subir Notice to Owner'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lien Section */}
          <div className={`mb-4 p-3 rounded border ${getBackgroundColor()}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-700">🔗 Lien (Derecho de Cobro)</h4>
          {formData.lienFiled ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
          )}
        </div>

        <div className="text-sm">
          {work.lienDocumentUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <CheckCircleIcon className="h-5 w-5" />
                Documento Archivado
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleViewDocument(work.lienDocumentUrl, 'Lien')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver Documento
                </button>
                <a 
                  href={work.lienDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  Abrir en nueva pestaña
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-yellow-700 font-semibold">⚠ Pendiente de archivar</div>
              
              <div className="space-y-2">
                <input
                  id="lien-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    setLienFile(e.target.files[0]);
                    setNoticeToOwnerFile(null);
                  }}
                  className="text-sm w-full"
                />
                
                {lienFile && (
                  <button
                    onClick={handleUploadLien}
                    disabled={uploadingLien}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {uploadingLien ? 'Subiendo...' : '📤 Subir Lien'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
          </div>

          {/* Notes */}
          {editing && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                value={formData.noticeToOwnerNotes}
                onChange={(e) => setFormData({...formData, noticeToOwnerNotes: e.target.value})}
                className="w-full p-2 border rounded text-sm"
                rows="3"
                placeholder="Notas sobre Notice to Owner y Lien..."
              />
            </div>
          )}

          {!editing && work.noticeToOwnerNotes && (
            <div className={`mb-4 p-3 rounded border ${getBackgroundColor()}`}>
              <div className="text-sm font-medium text-gray-700 mb-1">📝 Notas:</div>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">{work.noticeToOwnerNotes}</div>
            </div>
          )}

          {/* Info box */}
          <div className={`mt-4 p-3 rounded text-xs text-gray-600 ${getBackgroundColor()}`}>
            💡 <strong>Florida Law:</strong> El Notice to Owner debe archivarse dentro de 45 días del inicio de la instalación para proteger el derecho de cobro.
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium"
                >
                  💾 Guardar
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      noticeToOwnerFiled: work.noticeToOwnerFiled || false,
                      noticeToOwnerDocumentUrl: work.noticeToOwnerDocumentUrl || '',
                      lienFiled: work.lienFiled || false,
                      lienDocumentUrl: work.lienDocumentUrl || '',
                      noticeToOwnerNotes: work.noticeToOwnerNotes || ''
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 text-sm font-medium"
                >
                  ✕ Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
              >
                ✏️ Editar
              </button>
            )}
          </div>
        </>
      )}

      {/* Modal para preview de documentos */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-semibold text-gray-800">{previewTitle}</h3>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewUrl('');
                  setPreviewTitle('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title={previewTitle}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeToOwnerCard;
