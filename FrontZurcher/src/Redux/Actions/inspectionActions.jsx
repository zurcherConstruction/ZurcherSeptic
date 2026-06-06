
import api from '../../utils/axios';
import {
  inspectionRequest,
  // inspectionSuccess, // Usaremos upsertInspectionSuccess o específicas
  inspectionFailure,
  fetchInspectionsByWorkSuccess,
  fetchInspectionByIdSuccess,
  upsertInspectionSuccess,
} from '../Reducer/inspectionReducer'; // Ajusta la ruta si es necesario
import { fetchWorkById } from './workActions';
import { toast } from 'react-toastify';
// 1. Solicitar Inspección Inicial
export const requestInitialInspection = (workId, inspectionData) => async (dispatch) => {
  dispatch(inspectionRequest());
  try {
    // inspectionData: { inspectorEmail, workImageId }
    const response = await api.post(`/inspection/${workId}/request-initial`, inspectionData);
    dispatch(upsertInspectionSuccess(response.data)); // response.data = { message, inspection, workStatus }
    if (response.data.workStatus && workId) {
      dispatch(fetchWorkById(workId)); // Para obtener el work actualizado con el nuevo status
  }
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al solicitar la inspección inicial.';
    dispatch(inspectionFailure(errorMessage));
    throw error;
  }
};

// 2. Registrar Respuesta de Inspectores (sube doc para aplicante)
export const registerInspectorResponse = (inspectionId, formData) => async (dispatch) => {
  // formData debe ser un objeto FormData que incluya:
  // inspectorScheduledDate (text)
  // documentForApplicantFile (file)
  // notes (text, opcional)
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${inspectionId}/schedule-received`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    dispatch(upsertInspectionSuccess(response.data)); // response.data = { message, inspection }
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al registrar la respuesta de los inspectores.';
    dispatch(inspectionFailure(errorMessage));
    throw error;
  }
};

// 3. Enviar Documento al Aplicante
export const sendDocumentToApplicant = (inspectionId, applicantData) => async (dispatch) => {
  // applicantData: { applicantEmail, applicantName }
  dispatch(inspectionRequest());
  try {
    const response = await api.post(`/inspection/${inspectionId}/send-to-applicant`, applicantData);
    dispatch(upsertInspectionSuccess(response.data)); // response.data = { message, inspection }
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al enviar el documento al aplicante.';
    dispatch(inspectionFailure(errorMessage));
    throw error;
  }
};



// 4. Registrar Documento Firmado por el Aplicante
export const registerSignedApplicantDocument = (inspectionId, formData) => async (dispatch) => {
  // formData debe ser un objeto FormData que incluya:
  // signedDocumentFile (file)
  // notes (text, opcional)
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${inspectionId}/applicant-document-received`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    dispatch(upsertInspectionSuccess(response.data)); // response.data = { message, inspection }
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al registrar el documento firmado.';
    dispatch(inspectionFailure(errorMessage));
    throw error;
  }
};

// 5. Registrar Resultado Final de la Inspección
export const registerInspectionResult = (inspectionId, formData) => async (dispatch) => {
  // formData debe ser un objeto FormData que incluya:
  // finalStatus (text: 'approved' o 'rejected')
  // dateInspectionPerformed (text: YYYY-MM-DD, opcional)
  // resultDocumentFiles (array de files, hasta 2)
  // notes (text, opcional)
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${inspectionId}/register-result`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    dispatch(upsertInspectionSuccess(response.data)); // response.data = { message, inspection, workStatus }
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al registrar el resultado de la inspección.';
    dispatch(inspectionFailure(errorMessage));
    throw error;
  }
};

// Obtener Inspecciones por Work ID
export const fetchInspectionsByWork = (workId) => async (dispatch) => {
  dispatch(inspectionRequest());
  try {
    const response = await api.get(`/inspection/work/${workId}`);
    dispatch(fetchInspectionsByWorkSuccess(response.data));
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al obtener las inspecciones de la obra.';
    dispatch(inspectionFailure(errorMessage));
  }
};

// Obtener una Inspección por ID
export const fetchInspectionById = (inspectionId) => async (dispatch) => {
  dispatch(inspectionRequest());
  try {
    const response = await api.get(`/inspection/${inspectionId}`);
    dispatch(fetchInspectionByIdSuccess(response.data));
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al obtener la inspección.';
    dispatch(inspectionFailure(errorMessage));
  }
};
// NUEVA ACCIÓN: Solicitar Reinspección
// ...existing code...
// NUEVA ACCIÓN: Solicitar Reinspección
export const requestReinspection = (workId, formData) => async (dispatch) => {
  dispatch(inspectionRequest());
  try {
    const apiResponse = await api.post(`/inspection/reinspection/${workId}`, formData, {
      // headers: { 'Content-Type': 'multipart/form-data' }, // Axios lo maneja
    });

    console.log("REDUX ACTION - requestReinspection - API Response Data:", apiResponse.data);
    // apiResponse.data debería ser { message, inspection, workStatus }
    // y apiResponse.data.inspection.processStatus debería ser 'inspection_completed_pending_result'

    if (apiResponse.data && apiResponse.data.inspection) {
      // Primero, actualiza el store con la inspección específica devuelta por el POST
      // Asegúrate que tu reducer para upsertInspectionSuccess maneje bien esto.
      // El payload para upsertInspectionSuccess debería ser solo la inspección o un objeto que el reducer entienda.
      // Si upsertInspectionSuccess espera { message, inspection, workStatus }, entonces:
      dispatch(upsertInspectionSuccess(apiResponse.data)); 
      
      toast.success(apiResponse.data.message || "Solicitud de reinspección enviada exitosamente.");

      // Actualizar el estado de la obra si se devolvió
      if (apiResponse.data.workStatus && workId) {
        dispatch(fetchWorkById(workId)); // Para obtener el work actualizado con el nuevo status
      }
      
      // Considera si este fetch es realmente necesario o si puede causar problemas de timing.
      // Por ahora, lo mantenemos para asegurar que la lista completa esté sincronizada,
      // pero si el problema persiste, esta es un área a investigar.
      // Podrías incluso comentarlo temporalmente para ver si upsertInspectionSuccess es suficiente.
      // await new Promise(resolve => setTimeout(resolve, 300)); // Pequeño delay antes de refetch (para probar)
      dispatch(fetchInspectionsByWork(workId));


      return apiResponse.data;
    } else {
      // Manejar caso donde la respuesta no es la esperada
      const errorMessage = "Respuesta inesperada del servidor al solicitar reinspección.";
      dispatch(inspectionFailure(errorMessage));
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al solicitar la reinspección.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// --- INICIO: ACCIONES PARA EL FLUJO DE INSPECCIÓN FINAL ---

// 6. Solicitar Inspección Final (puede incluir adjuntos)
export const requestFinalInspection = (workId, formData) => async (dispatch) => {
  // formData: { inspectorEmail, notes (opcional), applicantEmail, applicantName, attachments (array de files, opcional) }
  // El backend espera 'attachments' como el campo para los archivos.
  dispatch(inspectionRequest());
  try {
    const response = await api.post(`/inspection/${workId}/request-final`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Necesario para FormData con archivos
      },
    });
    // response.data = { message, inspection, workStatus }
    dispatch(upsertInspectionSuccess(response.data));
    if (response.data.workStatus && workId) {
      dispatch(fetchWorkById(workId));
    }
    toast.success(response.data.message || "Solicitud de inspección final enviada.");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al solicitar la inspección final.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// 7. Registrar Invoice del Inspector para Inspección Final
export const registerInspectorInvoiceForFinal = (inspectionId, formData) => async (dispatch) => {
  // formData: { invoiceFile (file), notes (opcional) }
  // El backend espera 'invoiceFile' como el campo para el archivo.
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${inspectionId}/register-final-invoice`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    // response.data = { message, inspection }
    dispatch(upsertInspectionSuccess(response.data));
    toast.success(response.data.message || "Invoice del inspector registrado.");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al registrar el invoice del inspector.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// 8. Enviar Invoice al Cliente para Inspección Final
export const sendInvoiceToClientForFinal = (inspectionId, clientData) => async (dispatch) => {
  // clientData: { clientEmail, clientName (opcional) }
  dispatch(inspectionRequest());
  try {
    const response = await api.post(`/inspection/${inspectionId}/send-final-invoice-to-client`, clientData);
    // response.data = { message, inspection }
    dispatch(upsertInspectionSuccess(response.data));
    toast.success(response.data.message || "Invoice enviado al cliente.");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al enviar el invoice al cliente.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// 9b. Confirmar Pago Directo para Inspección Final (admin/recept/owner paga el invoice directamente)
export const confirmDirectPaymentForFinal = (inspectionId, formData) => async (dispatch) => {
  // formData: { notes (opcional), paymentProofFile (file, requerido) }
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${inspectionId}/confirm-direct-payment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Necesario para FormData con archivos
      },
    });
    // response.data = { message, inspection }
    dispatch(upsertInspectionSuccess(response.data));
    toast.success(response.data.message || "Pago directo registrado correctamente.");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al registrar el pago directo.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// 9. Confirmar Pago del Cliente para Inspección Final
export const confirmClientPaymentForFinal = (inspectionId, formData) => async (dispatch) => {
  // formData: { paymentNotes (opcional), paymentProofFile (file, opcional) }
  // El backend espera 'paymentProofFile' como el campo para el archivo.
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${inspectionId}/confirm-client-payment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Si hay archivo
      },
    });
    // response.data = { message, inspection }
    dispatch(upsertInspectionSuccess(response.data));
    toast.success(response.data.message || "Pago del cliente confirmado.");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al confirmar el pago del cliente.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// 10. Notificar Pago al Inspector para Inspección Final
export const notifyInspectorPaymentForFinal = (inspectionId, inspectorData) => async (dispatch) => {
  // inspectorData: { inspectorEmail (opcional, si no se puede obtener de otro lado) }
  dispatch(inspectionRequest());
  try {
    const response = await api.post(`/inspection/${inspectionId}/notify-inspector-payment`, inspectorData);
    // response.data = { message, inspection }
    dispatch(upsertInspectionSuccess(response.data));
    toast.success(response.data.message || "Notificación de pago enviada al inspector.");
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al notificar el pago al inspector.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// NUEVA ACCIÓN: Registrar resultado rápido de inspección (aprobada/rechazada + imagen)
export const registerQuickInspectionResult = (workId, formData) => async (dispatch) => {
  dispatch(inspectionRequest());
  try {
    const response = await api.post(`/inspection/${workId}/quick-result`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    dispatch(upsertInspectionSuccess(response.data));
    if (response.data.workStatus && workId) {
      dispatch(fetchWorkById(workId));
    }
    toast.success(response.data.message || 'Resultado de inspección registrado.');
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al registrar el resultado rápido de la inspección.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

export const saveQuickInspectionFollowUp = (workId, payload) => async (dispatch) => {
  dispatch(inspectionRequest());
  try {
    const response = await api.put(`/inspection/${workId}/quick-follow-up`, payload);
    dispatch(upsertInspectionSuccess(response.data));
    if (response.data.workStatus && workId) {
      dispatch(fetchWorkById(workId));
    }
    toast.success(response.data.message || 'Seguimiento de inspeccion guardado.');
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al guardar seguimiento de inspeccion.';
    dispatch(inspectionFailure(errorMessage));
    toast.error(errorMessage);
    throw error;
  }
};

// --- FIN: ACCIONES PARA EL FLUJO DE INSPECCIÓN FINAL ---