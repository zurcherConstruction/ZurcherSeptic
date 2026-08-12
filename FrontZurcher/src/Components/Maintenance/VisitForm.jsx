import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  updateMaintenanceVisit,
  addMaintenanceMedia,
  deleteMaintenanceMedia,
  fetchMaintenanceVisitsByWork
} from '../../Redux/Actions/maintenanceActions.jsx';
import { fetchStaff } from '../../Redux/Actions/adminActions';
import { resetLoadingStates } from '../../Redux/Reducer/maintenanceReducer';
import { normalizeDateForInput } from '../../utils/dateHelpers';
import MediaUpload from './MediaUpload';
import MediaGallery from './MediaGallery';
import Swal from 'sweetalert2';

const VisitForm = ({ visit, isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { loadingAction, uploadingMedia } = useSelector(state => state.maintenance);
  const { staffList: staff = [] } = useSelector(state => state.admin);

  const [formData, setFormData] = useState({
    scheduledDate: '',
    staffId: null
  });

  const [showMediaUpload, setShowMediaUpload] = useState(false); // Mantener para compatibilidad pero no se usa

  // Resetear estado cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      console.log('🔵 [VISIT FORM] Modal abierto, estado inicial de loadingAction:', loadingAction);
      // Si loadingAction está en true, resetear todos los estados de loading
      if (loadingAction) {
        console.warn('⚠️ [VISIT FORM] loadingAction estaba en true al abrir modal, reseteando...');
        dispatch(resetLoadingStates());
      }
    }
  }, [isOpen, loadingAction, dispatch]);

  useEffect(() => {
    if (visit) {
      setFormData({
        scheduledDate: normalizeDateForInput(visit.scheduledDate),
        staffId: visit.staffId || null
      });
      
      console.log('🔵 [VISIT FORM] Datos iniciales:', {
        original_scheduledDate: visit.scheduledDate,
        normalized_scheduledDate: normalizeDateForInput(visit.scheduledDate),
        staffId: visit.staffId
      });
    }
  }, [visit]);

  useEffect(() => {
    dispatch(fetchStaff());
  }, [dispatch]);

  // Debug logging para staff
  useEffect(() => {
    console.log('VisitForm - Staff state:', staff);
    console.log('VisitForm - Workers filtrados:', staff.filter(member => member.role === 'worker'));
    console.log('VisitForm - Visit prop:', visit);
    if (visit) {
      console.log('VisitForm - Visit ID:', visit.id, 'Type:', typeof visit.id);
    }
  }, [staff, visit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (newStatus) => {
    // Función removida - ya no se cambia status manualmente
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('🔵 [VISIT FORM] ==================== INICIO handleSubmit ====================');
    console.log('🔵 [VISIT FORM] formData:', JSON.stringify(formData, null, 2));

    // ✅ Validaciones simples
    if (!formData.scheduledDate) {
      Swal.fire({
        icon: 'warning',
        title: 'Fecha requerida',
        text: 'Debe especificar la fecha programada para la visita.',
      });
      return;
    }

    if (!formData.staffId) {
      Swal.fire({
        icon: 'warning',
        title: 'Personal requerido',
        text: 'Debe asignar un worker o maintenance a la visita.',
      });
      return;
    }

    try {
      if (!visit || !visit.id) {
        console.error('❌ [VISIT FORM] No se encontró visit.id');
        throw new Error('No se encontró el ID de la visita');
      }

      console.log('✅ [VISIT FORM] Validaciones pasadas, actualizando visita con ID:', visit.id);
      
      // Mostrar indicador de carga
      Swal.fire({
        title: 'Asignando visita...',
        html: 'Enviando notificación al personal asignado.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      // ✅ Preparar datos: al asignar fecha y staff, automáticamente se pone en estado 'scheduled'
      const dataToSend = {
        scheduledDate: formData.scheduledDate,
        staffId: formData.staffId,
        status: 'scheduled' // ✅ Automáticamente programada al asignar
      };
      
      console.log('📤 [VISIT FORM] Datos a enviar:', JSON.stringify(dataToSend, null, 2));
      
      const result = await dispatch(updateMaintenanceVisit(visit.id, dataToSend));

      console.log('✅ [VISIT FORM] Visita asignada exitosamente:', result);

      Swal.fire({
        icon: 'success',
        title: 'Visita Asignada',
        text: 'La visita ha sido programada y asignada correctamente.',
        timer: 2000
      });

      onClose();
    } catch (error) {
      console.error('❌ [VISIT FORM] Error:', error);
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.response?.data?.message || error?.message || 'Error al asignar la visita.',
      });
    } finally {
      console.log('🔵 [VISIT FORM] ==================== FIN handleSubmit ====================');
    }
  };

  const handleMediaUpload = async (files) => {
    console.log('=== INICIO handleMediaUpload ===');
    console.log('VisitForm - handleMediaUpload ejecutándose...');
    try {
      // Validar que tenemos un ID válido
      if (!visit || !visit.id) {
        throw new Error('No se encontró el ID de la visita');
      }

      console.log('VisitForm - Subiendo media para visita ID:', visit.id);
      console.log('VisitForm - Files recibidos:', files);
      
      const result = await dispatch(addMaintenanceMedia(visit.id, files));
      console.log('VisitForm - Resultado de addMaintenanceMedia:', result);

      // Actualizar la visita localmente para mostrar los nuevos archivos
      if (result && result.visit) {
        // Si el resultado incluye la visita actualizada, la podemos usar
        console.log('VisitForm - Visita actualizada recibida:', result.visit);
      }

      Swal.fire({
        icon: 'success',
        title: 'Archivos subidos',
        text: `${files.length} archivo(s) subido(s) correctamente.`,
        timer: 2000
      });

      setShowMediaUpload(false);
      
      // Recargar los datos de la visita para mostrar los archivos subidos
      console.log('VisitForm - Recargando datos de la obra:', visit.workId);
      await dispatch(fetchMaintenanceVisitsByWork(visit.workId));
    } catch (error) {
      console.error('=== ERROR en handleMediaUpload ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      Swal.fire({
        icon: 'error',
        title: 'Error al subir archivos',
        text: error.message || error || 'Error desconocido al subir los archivos.',
      });
    }
  };

  const handleMediaDelete = async (mediaId) => {
    const result = await Swal.fire({
      title: '¿Eliminar archivo?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await dispatch(deleteMaintenanceMedia({
          mediaId,
          visitId: visit.id
        }));

        Swal.fire({
          icon: 'success',
          title: 'Archivo eliminado',
          timer: 1500
        });
        
        // Recargar los datos de la visita
        await dispatch(fetchMaintenanceVisitsByWork(visit.workId));
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error || 'Error al eliminar el archivo.',
        });
      }
    }
  };

  const getStatusOptions = () => [
    { value: 'pending_scheduling', label: 'Pendiente de programar', color: 'text-gray-600' },
    { value: 'scheduled', label: 'Programada', color: 'text-blue-600' },
    { value: 'assigned', label: 'Asignada', color: 'text-yellow-600' },
    { value: 'completed', label: 'Completada', color: 'text-green-600' },
    { value: 'skipped', label: 'Omitida', color: 'text-red-600' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Asignar Visita #{visit.visitNumber}
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Programa la fecha y asigna el personal para esta visita de mantenimiento
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Info de la obra */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">Información de la Obra</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Dirección:</strong> {visit.work?.propertyAddress || 'N/A'}</p>
                  <p><strong>Cliente:</strong> {visit.work?.Permit?.applicantName || 'N/A'}</p>
                  <p><strong>Sistema:</strong> {visit.work?.Permit?.systemType || 'N/A'} {visit.work?.Permit?.isPBTS && '(PBTS)'}</p>
                </div>
              </div>

              {/* Fecha programada */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📅 Fecha Programada *
                </label>
                <input
                  type="date"
                  name="scheduledDate"
                  value={formData.scheduledDate}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Selecciona la fecha en que se realizará la visita de mantenimiento
                </p>
              </div>

              {/* Asignación de personal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  👤 Asignar Personal *
                </label>
                <select
                  name="staffId"
                  value={formData.staffId || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                >
                  <option value="">-- Selecciona un worker o maintenance --</option>
                  {staff
                    .filter(member => member.role === 'worker' || member.role === 'maintenance' || member.role === 'capataz')
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.role === 'maintenance' ? 'Maintenance' : member.role === 'capataz' ? 'Capataz' : 'Worker'})
                      </option>
                    ))
                  }
                </select>
                {formData.staffId && (
                  <p className="mt-2 text-sm text-green-600 flex items-center">
                    <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Esta persona recibirá la visita en su app móvil
                  </p>
                )}
              </div>

              {/* Nota informativa */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">ℹ️ Información importante:</p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>La visita quedará en estado <strong>"Programada"</strong> automáticamente</li>
                      <li>El personal asignado podrá ver y completar la visita desde su app móvil</li>
                      <li>Los archivos y formulario se completarán durante la visita en campo</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 font-medium shadow-lg flex items-center gap-2"
                >
                  {loadingAction ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Asignando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Asignar Visita</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisitForm;
