import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchWorkById, updateWork, addImagesToWork, deleteImagesFromWork } from "../../Redux/Actions/workActions";
import {
  ArrowLeftIcon,
  PhotoIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  TrashIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  CameraIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

const WorkerWorkUpload = () => {
  const { workId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { selectedWork, loading } = useSelector((state) => state.work);
  const { user, currentStaff } = useSelector((state) => state.auth);
  const authStaff = currentStaff || user;
  
  // Usar selectedWork en lugar de currentWork
  const currentWork = selectedWork;

  // Estados para las etapas
  const stages = [
    'foto previa del lugar',
    'materiales',
    'foto excavación',
    'camiones de arena',
    'sistema instalado',
    'extracción de piedras',
    'camiones de tierra',
    'trabajo cubierto'
  ];

  const stageColors = [
    '#264653',
    '#2a9d8f',
    '#e9c46a',
    '#f4a261',
    '#e76f51',
    '#e9c46a',
    '#f4a261',
    '#264653',
  ];

  const [selectedStage, setSelectedStage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [imagesByStage, setImagesByStage] = useState({});
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageComment, setImageComment] = useState('');
  const [truckCount, setTruckCount] = useState('');

  useEffect(() => {
    if (workId) {
      console.log('📥 Fetching work:', workId);
      dispatch(fetchWorkById(workId));
    }
  }, [workId, dispatch]);

  // Debug: Log cuando cambia currentWork
  useEffect(() => {
    console.log('🔄 Current work changed:', {
      loading,
      hasCurrentWork: !!currentWork,
      workId: currentWork?.idWork,
      propertyAddress: currentWork?.propertyAddress,
      staffId: currentWork?.staffId
    });
  }, [currentWork, loading]);

  // Obtener el ID del staff
  const staffId = authStaff?.idStaff || authStaff?.id;
  const isCapataz = authStaff?.role === 'capataz';

  // Verificar permisos (solo cuando currentWork esté completamente cargado)
  useEffect(() => {
    // Capataz puede ver cualquier trabajo
    if (isCapataz) return;

    if (currentWork && currentWork.idWork) {
      if (currentWork.staffId !== staffId) {
        toast.error('No tienes permiso para ver este trabajo');
        navigate('/worker');
      }
    }
  }, [currentWork?.idWork, currentWork?.staffId, staffId, isCapataz, navigate]);

  // Organizar imágenes por etapa cuando se carga el trabajo
  useEffect(() => {
    if (currentWork?.images) {
      const organized = {};
      stages.forEach(stage => {
        organized[stage] = currentWork.images.filter(img => img.stage === stage);
      });
      setImagesByStage(organized);
    }
  }, [currentWork]);

  const handleStageClick = (stage) => {
    setSelectedStage(stage);
    setModalVisible(true);
    setImageComment('');
    setTruckCount('');
  };

  const handleImageSelect = async (e) => {
    if (!selectedStage) {
      toast.warning('Selecciona una etapa primero');
      return;
    }

    const files = Array.from(e.target.files);
    const currentImages = imagesByStage[selectedStage]?.length || 0;

    if (currentImages >= 12) {
      toast.warning('Máximo 12 imágenes por etapa');
      return;
    }

    if (files.length + currentImages > 12) {
      toast.warning(`Solo puedes subir ${12 - currentImages} imágenes más en esta etapa`);
      return;
    }

    const isTruckStage = selectedStage === 'camiones de arena' || selectedStage === 'camiones de tierra';

    let truckCountValue = '';
    let commentValue = '';

    // Si es etapa de camiones, pedir cantidad
    if (isTruckStage && files.length > 0) {
      const count = window.prompt(
        `¿Cuántos camiones hay en total hasta el momento?\n(Actualmente: ${imagesByStage[selectedStage]?.reduce((max, img) => Math.max(max, img.truckCount || 0), 0) || 0})`,
        ''
      );
      
      if (count === null) return; // Cancelado
      
      const parsedCount = parseInt(count, 10);
      if (isNaN(parsedCount) || parsedCount < 0) {
        toast.error('Ingresa un número válido');
        return;
      }
      truckCountValue = parsedCount.toString();
    }

    // Pedir comentario opcional
    const comment = window.prompt('Añadir comentario (opcional):', '');
    if (comment !== null) {
      commentValue = comment;
    }

    await uploadImages(files, commentValue, truckCountValue);
  };

  const uploadImages = async (files, comment = '', truckCountParam = '') => {
    setUploadingImages(true);
    try {
      let uploadedCount = 0;
      
      // Subir imágenes una por una
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('imageFile', files[i]); // Backend espera 'imageFile'
        formData.append('stage', selectedStage);
        formData.append('dateTime', new Date().toISOString()); // ✅ Añadir fecha y hora
        
        if (comment && i === files.length - 1) {
          // Solo añadir comentario a la última imagen
          formData.append('comment', comment);
        }
        
        if (truckCountParam && i === files.length - 1) {
          // Solo añadir truck count a la última imagen
          formData.append('truckCount', truckCountParam);
          console.log('📦 Enviando truckCount:', truckCountParam);
        }

        try {
          await dispatch(addImagesToWork(workId, formData));
          uploadedCount++;
        } catch (error) {
          console.error(`Error uploading image ${i + 1}:`, error);
        }
      }

      if (uploadedCount > 0) {
        toast.success(`${uploadedCount} imagen(es) subida(s) exitosamente`);
      }
      
      // Recargar trabajo
      dispatch(fetchWorkById(workId));
      
      // Limpiar estados
      setImageComment('');
      setTruckCount('');
    } catch (error) {
      toast.error('Error al subir imágenes');
      console.error('Upload error:', error);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta imagen?')) {
      return;
    }

    try {
      await dispatch(deleteImagesFromWork(workId, [imageId]));
      toast.success('Imagen eliminada');
      dispatch(fetchWorkById(workId));
    } catch (error) {
      toast.error('Error al eliminar imagen');
    }
  };

  const handleWorkInstalled = async () => {
    const installedImages = imagesByStage['sistema instalado'] || [];
    if (installedImages.length === 0) {
      toast.warning('Debes subir al menos una imagen en "Sistema Instalado"');
      return;
    }

    if (!window.confirm('¿Marcar trabajo como instalado y solicitar inspección?')) {
      return;
    }

    try {
      await dispatch(updateWork(workId, { status: 'installed' }));
      toast.success('Trabajo marcado como instalado');
      dispatch(fetchWorkById(workId));
    } catch (error) {
      toast.error('Error al marcar trabajo');
    }
  };

  const handleMarkCovered = async () => {
    const coveredImages = imagesByStage['trabajo cubierto'] || [];
    if (coveredImages.length === 0) {
      toast.warning('Debes subir imágenes en "Trabajo Cubierto"');
      return;
    }

    if (!window.confirm('¿Marcar trabajo como cubierto?')) {
      return;
    }

    try {
      await dispatch(updateWork(workId, { status: 'covered' }));
      toast.success('Trabajo marcado como cubierto');
      dispatch(fetchWorkById(workId));
    } catch (error) {
      toast.error('Error al marcar trabajo');
    }
  };

  const openImageModal = (imageUrl) => {
    setSelectedImageUrl(imageUrl);
    setShowImageModal(true);
  };

  const openPDF = (pdfSource) => {
    if (!pdfSource) return;
    
    // Si es una URL string directa
    if (typeof pdfSource === 'string' && (pdfSource.startsWith('http://') || pdfSource.startsWith('https://'))) {
      window.open(pdfSource, '_blank');
      return;
    }
    
    // Si es un objeto con data
    if (pdfSource.data) {
      try {
        // Si data es un array de bytes
        if (Array.isArray(pdfSource.data)) {
          // Intentar convertir a string para ver si es una URL
          const text = String.fromCharCode(...pdfSource.data.slice(0, 100));
          if (text.startsWith('http://') || text.startsWith('https://')) {
            const fullUrl = String.fromCharCode(...pdfSource.data);
            window.open(fullUrl, '_blank');
            return;
          }
          
          // Si no es URL, es un PDF binario
          const blob = new Blob([new Uint8Array(pdfSource.data)], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          return;
        }
        
        // Si data es un string
        if (typeof pdfSource.data === 'string') {
          if (pdfSource.data.startsWith('http://') || pdfSource.data.startsWith('https://')) {
            window.open(pdfSource.data, '_blank');
            return;
          }
        }
        
        toast.error('Formato de PDF no reconocido');
      } catch (error) {
        console.error('Error opening PDF:', error);
        toast.error('Error al abrir PDF');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!currentWork && !loading) {
    return (
      <div className="p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Trabajo no encontrado
        </div>
      </div>
    );
  }

  if (!currentWork) {
    return null;
  }

  const canMarkInstalled = currentWork.status === 'inProgress';
  const canMarkCovered = currentWork.status === 'coverPending';
  const isRejected = currentWork.status === 'rejectedInspection' || currentWork.status === 'finalRejected';
  const isCompleted = ['covered', 'invoiceFinal', 'paymentReceived', 'maintenance'].includes(currentWork.status);

  const handleRequestReinspection = async () => {
    if (!['rejectedInspection', 'finalRejected'].includes(currentWork.status)) {
      toast.warning('Solo puedes solicitar reinspección en trabajos rechazados');
      return;
    }

    // Verificar las imágenes según el tipo de rechazo
    const isFirstInspectionRejected = currentWork.status === 'rejectedInspection';
    const requiredStage = isFirstInspectionRejected ? 'sistema instalado' : 'trabajo cubierto';
    const stageImages = imagesByStage[requiredStage] || [];
    
    if (stageImages.length === 0) {
      toast.warning(`Debes subir imágenes en "${requiredStage.toUpperCase()}" mostrando las correcciones`);
      return;
    }

    const confirmMessage = isFirstInspectionRejected
      ? '¿Confirmas que las correcciones están completas y el sistema está listo para reinspección?'
      : '¿Confirmas que las correcciones del trabajo cubierto están completas y listas para reinspección final?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const newStatus = isFirstInspectionRejected 
        ? 'firstInspectionPending'
        : 'finalInspectionPending';

      await dispatch(updateWork(workId, { 
        status: newStatus,
        rejectionReason: null
      }));
      
      toast.success('✅ Solicitud de reinspección enviada. La oficina será notificada.');
      dispatch(fetchWorkById(workId));
    } catch (error) {
      toast.error('Error al solicitar reinspección');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/worker')}
            className="flex items-center text-white hover:text-green-100 mb-3"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Volver
          </button>
          <h1 className="text-xl font-bold uppercase">{currentWork.propertyAddress || 'Trabajo'}</h1>
          <p className="text-sm text-green-100 mt-1">
            Estado: {currentWork.status === 'assigned' ? 'Asignado' :
                     currentWork.status === 'inProgress' ? 'En Progreso' :
                     currentWork.status === 'installed' ? 'Instalado' :
                     currentWork.status === 'coverPending' ? 'PARA CUBRIR' :
                     currentWork.status === 'covered' ? 'Cubierto' : 
                     currentWork.status ? currentWork.status.charAt(0).toUpperCase() + currentWork.status.slice(1) : 'Desconocido'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Rejection Banner */}
        {isRejected && (
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <XMarkIcon className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-lg font-bold text-red-700 uppercase">
                {currentWork.status === 'rejectedInspection' ? 'INSPECCIÓN RECHAZADA' : 'INSPECCIÓN FINAL RECHAZADA'}
              </h3>
            </div>
            {currentWork.rejectionReason && (
              <div className="bg-white rounded-lg p-3 mt-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">Motivo del rechazo:</p>
                <p className="text-sm text-gray-600">{currentWork.rejectionReason}</p>
              </div>
            )}
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-orange-700 mb-2">📋 Pasos a seguir:</p>
              <ol className="text-xs text-gray-700 space-y-1 ml-4 list-decimal">
                <li>Realiza las correcciones necesarias según el motivo de rechazo</li>
                <li>
                  Sube imágenes en{' '}
                  <span className="font-bold text-orange-700">
                    "{currentWork.status === 'rejectedInspection' ? 'SISTEMA INSTALADO' : 'TRABAJO CUBIERTO'}"
                  </span>
                  {' '}mostrando las correcciones
                </li>
                <li>Presiona "✓ Corregido - Solicitar Reinspección"</li>
                <li>La oficina programará una nueva inspección</li>
              </ol>
            </div>
          </div>
        )}

        {/* PDFs */}
        <div className="bg-white rounded-lg shadow-md p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Documentos</h2>
          <div className="flex gap-4">
            {(currentWork.Permit?.permitPdfUrl || currentWork.Permit?.pdfData) && (
              <button
                onClick={() => openPDF(currentWork.Permit.permitPdfUrl || currentWork.Permit.pdfData)}
                className="flex flex-col items-center p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <DocumentTextIcon className="h-12 w-12 text-gray-600 mb-2" />
                <span className="text-sm font-semibold text-gray-700">PDF Permit</span>
              </button>
            )}
            {(currentWork.Permit?.optionalDocsUrl || currentWork.Permit?.optionalDocs) && (
              <button
                onClick={() => openPDF(currentWork.Permit.optionalDocsUrl || currentWork.Permit.optionalDocs)}
                className="flex flex-col items-center p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <DocumentTextIcon className="h-12 w-12 text-gray-600 mb-2" />
                <span className="text-sm font-semibold text-gray-700">PDF Site Plan</span>
              </button>
            )}
            {currentWork.budget?.budgetPdfUrl && (
              <button
                onClick={() => openPDF(currentWork.budget.budgetPdfUrl)}
                className="flex flex-col items-center p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <DocumentTextIcon className="h-12 w-12 text-gray-600 mb-2" />
                <span className="text-sm font-semibold text-gray-700">Budget</span>
              </button>
            )}
          </div>
        </div>

        {/* Alertas de estado */}
        {currentWork.status === 'coverPending' && (
          <div className="bg-teal-50 border-l-4 border-teal-400 p-4 rounded">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-teal-800">Acción Requerida: Cubrir Instalación</h3>
                <div className="mt-2 text-sm text-teal-700">
                  <p>Asegúrate de subir imágenes a "Trabajo Cubierto" ({imagesByStage['trabajo cubierto']?.length || 0} imágenes)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentWork.status === 'covered' && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">¡Trabajo Cubierto!</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Aviso enviado a administración</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Etapas */}
        <div className="bg-white rounded-lg shadow-md p-5">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Etapas del Trabajo</h2>
          <div className="grid grid-cols-2 gap-3">
            {stages.map((stage, index) => {
              const imageCount = imagesByStage[stage]?.length || 0;
              return (
                <button
                  key={stage}
                  onClick={() => handleStageClick(stage)}
                  className="p-4 rounded-lg text-white font-semibold text-sm shadow-md hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: stageColors[index] }}
                >
                  <div className="flex flex-col items-center">
                    <span className="uppercase text-center">{stage}</span>
                    <span className="text-xs mt-1 bg-white bg-opacity-30 px-2 py-1 rounded">
                      {imageCount}/12 imágenes
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Botones de acción */}
        {!isCompleted && (
          <div className="bg-white rounded-lg shadow-md p-5 space-y-3">
            {/* Botón de Reinspección para trabajos rechazados */}
            {isRejected && (
              <button
                onClick={handleRequestReinspection}
                disabled={
                  currentWork.status === 'rejectedInspection'
                    ? !imagesByStage['sistema instalado']?.length
                    : !imagesByStage['trabajo cubierto']?.length
                }
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-lg"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                ✓ Corregido - Solicitar Reinspección
              </button>
            )}
            
            {canMarkInstalled && (
              <button
                onClick={handleWorkInstalled}
                disabled={!imagesByStage['sistema instalado']?.length}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                PEDIR INSPECCIÓN
              </button>
            )}
            
            {canMarkCovered && !isRejected && (
              <button
                onClick={handleMarkCovered}
                disabled={!imagesByStage['trabajo cubierto']?.length}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                TRABAJO CUBIERTO
              </button>
            )}

            {/* Mensajes de ayuda */}
            {isRejected && (
              currentWork.status === 'rejectedInspection'
                ? !imagesByStage['sistema instalado']?.length && (
                    <p className="text-xs text-orange-600 text-center mt-2">
                      * Debes subir imágenes en "Sistema Instalado" mostrando las correcciones antes de solicitar reinspección
                    </p>
                  )
                : !imagesByStage['trabajo cubierto']?.length && (
                    <p className="text-xs text-orange-600 text-center mt-2">
                      * Debes subir imágenes en "Trabajo Cubierto" mostrando las correcciones antes de solicitar reinspección
                    </p>
                  )
            )}
          </div>
        )}
      </div>

      {/* Modal de Etapa */}
      {modalVisible && selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase">{selectedStage}</h3>
              <button
                onClick={() => setModalVisible(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4 text-center">
                Imágenes: {imagesByStage[selectedStage]?.length || 0}/12
              </p>

              {/* Botones de Cámara y Galería */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Botón Galería */}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    disabled={uploadingImages || (imagesByStage[selectedStage]?.length >= 12)}
                    className="hidden"
                    id="gallery-input"
                  />
                  <div className={`border-2 rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    uploadingImages || (imagesByStage[selectedStage]?.length >= 12)
                      ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                      : 'border-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                  }`}>
                    <PhotoIcon className="h-10 w-10 mx-auto text-yellow-600 mb-2" />
                    <p className="text-sm font-semibold text-yellow-700">Galería</p>
                  </div>
                </label>

                {/* Botón Cámara */}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    disabled={uploadingImages || (imagesByStage[selectedStage]?.length >= 12)}
                    className="hidden"
                    id="camera-input"
                  />
                  <div className={`border-2 rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    uploadingImages || (imagesByStage[selectedStage]?.length >= 12)
                      ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                      : 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                  }`}>
                    <CameraIcon className="h-10 w-10 mx-auto text-blue-600 mb-2" />
                    <p className="text-sm font-semibold text-blue-700">Cámara</p>
                  </div>
                </label>
              </div>

              {uploadingImages && (
                <div className="text-center text-sm text-gray-600 mb-4">
                  Subiendo imágenes...
                </div>
              )}

              {/* Image Grid */}
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, index) => {
                  const image = imagesByStage[selectedStage]?.[index];
                  return (
                    <div key={index} className="relative aspect-square bg-gray-200 rounded-lg">
                      {image ? (
                        <>
                          <img
                            src={image.imageUrl || image.url}
                            alt={`${selectedStage} ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg cursor-pointer"
                            onClick={() => openImageModal(image.imageUrl || image.url)}
                          />
                          <button
                            onClick={() => handleDeleteImage(image.id)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                          {image.truckCount && (
                            <div className="absolute bottom-1 left-1 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                              {image.truckCount}
                            </div>
                          )}
                          {image.comment && (
                            <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                              💬
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {index + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {showImageModal && selectedImageUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <XMarkIcon className="h-8 w-8" />
          </button>
          <img
            src={selectedImageUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default WorkerWorkUpload;
