import api from '../../utils/axios';
import {
  fetchWorksRequest,
  fetchWorksSuccess,
  fetchWorksFailure,
  fetchWorkByIdRequest,
  fetchWorkByIdSuccess,
  fetchWorkByIdFailure,
  createWorkRequest,
  createWorkSuccess,
  createWorkFailure,
  updateWorkRequest,
  updateWorkSuccess,
  updateWorkFailure,
  addInstallationDetailRequest,
  addInstallationDetailSuccess,
  addInstallationDetailFailure,
  deleteWorkRequest,
  deleteWorkSuccess,
  deleteWorkFailure,
  createChangeOrderRequest,
  createChangeOrderSuccess,
  createChangeOrderFailure,
  updateChangeOrderRequest,
  updateChangeOrderSuccess,
  updateChangeOrderFailure,
  addImagesRequest,
  addImagesSuccess,
  addImagesFailure,
  deleteImagesRequest,
  deleteImagesSuccess,
  deleteImagesFailure,
    changeWorkStatusRequest,
    changeWorkStatusSuccess,
    changeWorkStatusFailure,
    validateStatusChangeRequest,
    validateStatusChangeSuccess,
    validateStatusChangeFailure,
    clearStatusChangeError,
    clearStatusValidationError,
  
} from '../Reducer/workReducer';

// Obtener todas las obras con filtros opcionales
export const fetchWorks = (page = 1, limit = 'all', filters = {}) => async (dispatch) => {
  dispatch(fetchWorksRequest());
  try {
    // Construir query params
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters.staffId) queryParams.append('staffId', filters.staffId);
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.county && filters.county !== 'all') queryParams.append('county', filters.county);
    if (filters.city) queryParams.append('city', filters.city);
    // ATU_PBTS y ATU_NO_PBTS son opciones combinadas del frontend — se traducen a systemType=ATU + isPBTS
    if (filters.systemType === 'ATU_PBTS' || filters.systemType === 'ATU_NO_PBTS') {
      queryParams.append('systemType', 'ATU');
      queryParams.append('isPBTS', filters.systemType === 'ATU_PBTS' ? 'true' : 'false');
    } else {
      if (filters.systemType && filters.systemType !== 'all') queryParams.append('systemType', filters.systemType);
      if (filters.isPBTS !== undefined && filters.isPBTS !== '' && filters.isPBTS !== 'all') queryParams.append('isPBTS', filters.isPBTS);
    }
    if (filters.applicantName) queryParams.append('applicantName', filters.applicantName);
    if (filters.applicantEmail) queryParams.append('applicantEmail', filters.applicantEmail);
    
    console.log(`📡 Fetching works: page=${page}, limit=${limit}, filters=${JSON.stringify(filters)}`);
    const response = await api.get(`/work?${queryParams.toString()}`);
    
    console.log('📊 Backend response:', {
      totalWorks: response.data.works?.length || 0,
      pagination: response.data.pagination,
      staffIdFilter: filters.staffId || 'none',
      coverPendingCount: response.data.works?.filter(w => w.status === 'coverPending').length || 0
    });
    
    dispatch(fetchWorksSuccess(response.data));
    return response.data; // Devolver datos para uso en componentes
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al obtener las obras';
    console.error('❌ fetchWorks error:', errorMessage);
    dispatch(fetchWorksFailure(errorMessage));
    throw error;
  }
};

// 🆕 Obtener SOLO obras en maintenance (optimizado)
export const fetchMaintenanceWorks = () => async (dispatch) => {
  dispatch(fetchWorksRequest());
  try {
    const response = await api.get('/work/maintenance'); // Endpoint optimizado
    dispatch(fetchWorksSuccess({ works: response.data, pagination: { total: response.data.length } }));
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al obtener las obras en mantenimiento';
    dispatch(fetchWorksFailure(errorMessage));
  }
};

// Obtener una obra por ID
export const fetchWorkById = (idWork) => async (dispatch) => {
  dispatch(fetchWorkByIdRequest());
  try {
    const response = await api.get(`/work/${idWork}`, { timeout: 30000 }); // Ruta del backend
    dispatch(fetchWorkByIdSuccess(response.data));
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al obtener la obra';
    dispatch(fetchWorkByIdFailure(errorMessage));
  }
};

// Crear una obra
export const createWork = (workData) => async (dispatch) => {
  dispatch(createWorkRequest());
  try {
    const response = await api.post('/work', workData); // Ruta del backend
    dispatch(createWorkSuccess(response.data)); // Actualizar el estado global con el nuevo Work
    return response.data; // Devolver el Work creado
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al crear la obra';
    dispatch(createWorkFailure(errorMessage));
    throw error; // Lanzar el error para manejarlo en el componente
  }
};

// Actualizar una obra
export const updateWork = (idWork, workData) => async (dispatch) => {
  dispatch(updateWorkRequest());
  try {
    
    
    const response = await api.put(`/work/${idWork}`, workData);
    
    // Verificar si la respuesta es exitosa
    if (response.data) {
      console.log('Trabajo actualizado:', response.data);
      dispatch(updateWorkSuccess(response.data));
      
      if (workData.staffId && workData.startDate) {
        // Verificar el estado actualizado después de un breve delay
        setTimeout(async () => {
          try {
            //  Usar modo light para verificación rápida
            const verificationResponse = await api.get(`/work/${idWork}?light=true`);
            if (verificationResponse.data.staffId === workData.staffId) {
              dispatch(updateWorkSuccess(verificationResponse.data));
            }
          } catch (verifyError) {
            console.log('Verificación silenciosa fallida:', verifyError);
          }
        }, 1000);

        return {
          success: true,
          data: response.data,
          message: 'Trabajo asignado correctamente'
        };
      }
      
      return response.data;
    }
  } catch (error) {
    console.error('Error al actualizar la obra:', error);
    
    // Si es un error de timeout pero la operación podría haber sido exitosa
    if (error.code === 'ECONNABORTED') {
      try {
        // ⚡ Intentar verificar si la actualización fue exitosa (modo light)
        const verificationResponse = await api.get(`/work/${idWork}?light=true`);
        if (verificationResponse.data.staffId === workData.staffId) {
          dispatch(updateWorkSuccess(verificationResponse.data));
          return {
            success: true,
            data: verificationResponse.data,
            message: 'Trabajo asignado correctamente (verificado)'
          };
        }
      } catch (verifyError) {
        console.log('Error en verificación:', verifyError);
      }
    }
    
    const errorMessage = error.code === 'ECONNABORTED' 
      ? 'La operación tomó más tiempo de lo esperado, pero podría haber sido exitosa. Por favor, verifique.' 
      : error.response?.data?.message || 'Error al actualizar la obra';
    
    dispatch(updateWorkFailure(errorMessage));
    throw new Error(errorMessage);
  }
};

// Eliminar una obra
export const deleteWork = (idWork) => async (dispatch) => {
  dispatch(deleteWorkRequest());
  try {
    const response = await api.delete(`/work/${idWork}`); // Ruta del backend
    dispatch(deleteWorkSuccess(idWork));
    // Retornar el detalle de la eliminación para mostrarlo en el frontend
    return response.data;
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al eliminar la obra';
    dispatch(deleteWorkFailure(errorMessage));
    throw error; // Re-lanzar el error para que el componente lo capture
  }
};
export const addInstallationDetail = (idWork, installationData) => async (dispatch) => {
  dispatch(addInstallationDetailRequest());
  try {
    const response = await api.post(`/work/${idWork}/installation-details`, installationData);

    dispatch(addInstallationDetailSuccess(response.data)); // Despacha los datos recibidos
    return response.data; // Devuelve los datos para usarlos en el componente
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || "Error al agregar el detalle de instalación";
    dispatch(addInstallationDetailFailure(errorMessage));
    throw error; // Lanza el error para manejarlo en el componente
  }
};
export const attachInvoiceToWork = (idWork, file, totalCost) => async (dispatch) => {
  dispatch(updateWorkRequest()); // Indicar que estamos actualizando
  try {
    // Crear un FormData para enviar el archivo y los datos adicionales
    const formData = new FormData();
    formData.append('invoiceFile', file); // Archivo de la factura
    formData.append('totalCost', totalCost); // Costo total

    

    // Enviar la solicitud al backend
    const response = await api.put(`/work/${idWork}/invoice`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Indicar que es un formulario
      },
    });

   
    dispatch(updateWorkSuccess(response.data)); // Actualizar el estado global con los datos de la obra
    return response.data; // Devolver los datos para usarlos en el componente
  } catch (error) {
  
    const errorMessage =
      error.response?.data?.message || 'Error al adjuntar la factura';
    dispatch(updateWorkFailure(errorMessage)); // Despachar el error al estado global
    throw error; // Lanzar el error para manejarlo en el componente
  }
};

export const recordOrUpdateChangeOrderDetails = (idWork, changeOrderId, coData) => async (dispatch, getState) => {
  const { token } = getState().auth; // Asumiendo que obtienes el token del estado de autenticación

  // Usar los action creators específicos si los tienes, o un tipo genérico
  // Aquí se asume que tienes un tipo genérico para la solicitud inicial.
  // Si usas createChangeOrderRequest y updateChangeOrderRequest, necesitarías lógica condicional.
  // Por simplicidad, usaré un tipo genérico aquí, o puedes ajustar.
  // dispatch({ type: 'RECORD_OR_UPDATE_CHANGE_ORDER_DETAILS_REQUEST' }); // O usa tus action creators específicos
  // Basado en tu código, parece que ya tienes un RECORD_OR_UPDATE_CHANGE_ORDER_DETAILS_REQUEST
  // que se despacha como un objeto literal, lo cual está bien.
  dispatch({ type: 'RECORD_OR_UPDATE_CHANGE_ORDER_DETAILS_REQUEST' });


  

  const isUpdating = !!changeOrderId;
  // Asegurar que effectiveIdWork se tome correctamente, priorizando idWork si está presente,
  // luego coData.workId si es una creación y idWork no vino como parámetro directo.
  const effectiveIdWork = idWork || (!isUpdating ? coData?.workId : null);


  if (!effectiveIdWork && !isUpdating) { // Solo es crítico si es una nueva CO y no hay idWork
    console.error('[WorkActions] recordOrUpdateChangeOrderDetails - CRITICAL: effectiveIdWork is undefined for new CO.');
    dispatch(createChangeOrderFailure({ message: 'ID de la obra es indefinido. No se puede crear la Orden de Cambio.' }));
    return { error: true, message: 'ID de la obra es indefinido.' };
  }
  if (!changeOrderId && isUpdating) { // Crítico si se intenta actualizar sin un changeOrderId
    console.error('[WorkActions] recordOrUpdateChangeOrderDetails - CRITICAL: changeOrderId is undefined for updating CO.');
    dispatch(updateChangeOrderFailure({ message: 'ID de la Orden de Cambio es indefinido. No se puede actualizar.' }));
    return { error: true, message: 'ID de la Orden de Cambio es indefinido.' };
  }


  let apiUrl = '';
  let httpMethod = '';

  if (isUpdating) {
    apiUrl = `/change-orders/${changeOrderId}`; // Ruta para actualizar una CO existente
    httpMethod = 'PUT';
    
  } else {
    // Para CREAR un CO:
    apiUrl = `/change-orders/${effectiveIdWork}/change-orders`; // Ruta para crear una nueva CO asociada a un workId
    httpMethod = 'POST';
    
  }

  try {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Incluir el token si tu API lo requiere
      },
    };

    let response;

    if (httpMethod === 'POST') {
      response = await api.post(apiUrl, coData, config);
      dispatch(createChangeOrderSuccess(response.data)); // Despachar acción de éxito para creación
    } else { // PUT
      response = await api.put(apiUrl, coData, config);
      dispatch(updateChangeOrderSuccess(response.data)); // Despachar acción de éxito para actualización
    }
    
   
    return response.data; // Devolver los datos de la respuesta

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || `Error al ${isUpdating ? 'actualizar' : 'crear'} la Orden de Cambio.`;
    console.error(`[WorkActions] Error in recordOrUpdateChangeOrderDetails (${isUpdating ? 'update' : 'create'}):`, error.response || error);
    
    // Despachar la acción de fracaso correspondiente
    dispatch(
      isUpdating 
        ? updateChangeOrderFailure({ message: errorMessage, details: error.response?.data?.details })
        : createChangeOrderFailure({ message: errorMessage, details: error.response?.data?.details })
    );

   
    return { 
      error: true, 
      message: errorMessage, 
      details: error.response?.data?.details, 
      type: isUpdating ? 'UPDATE_CHANGE_ORDER_FAILURE' : 'CREATE_CHANGE_ORDER_FAILURE' 
    };
  }
};




export const sendChangeOrderToClient = (changeOrderId) => async (dispatch, getState) => {
  // dispatch({ type: SEND_CO_TO_CLIENT_REQUEST }); // O un action creator si lo defines
  const { token } = getState().auth;
 

  if (!changeOrderId) {
    console.error('[WorkActions] sendChangeOrderToClient - CRITICAL: changeOrderId is undefined.');
    const errorMsg = 'ID de la Orden de Cambio es indefinido.';
    // dispatch({ type: SEND_CO_TO_CLIENT_FAILURE, payload: errorMsg });
    return { error: true, message: errorMsg };
  }

  try {
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        // 'Content-Type': 'application/json' // El backend no parece esperar un body, así que esto podría no ser necesario
      },
    };
    
    // El backend espera un POST a /change-orders/:changeOrderId/send-to-client.
    // Si no necesita un body, puedes pasar un objeto vacío {} o null.
    const response = await api.post(`/change-orders/${changeOrderId}/send-to-client`, {}, config);

    
    return response.data; // Devuelve la respuesta del backend

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al enviar la Orden de Cambio al cliente.';
    console.error('[WorkActions] sendChangeOrderToClient - Error:', error.response || error);
    // dispatch({ type: SEND_CO_TO_CLIENT_FAILURE, payload: errorMessage });
    return { error: true, message: errorMessage, details: error.response?.data?.details };
  }
};

export const deleteChangeOrderRequest = () => ({ type: 'DELETE_CHANGE_ORDER_REQUEST' });
export const deleteChangeOrderSuccess = (changeOrderId) => ({ type: 'DELETE_CHANGE_ORDER_SUCCESS', payload: changeOrderId });
export const deleteChangeOrderFailure = (error) => ({ type: 'DELETE_CHANGE_ORDER_FAILURE', payload: error });

export const deleteChangeOrder = (changeOrderId) => async (dispatch, getState) => {
  dispatch(deleteChangeOrderRequest());
  const { token } = getState().auth;
  try {
    await api.delete(`/change-orders/${changeOrderId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    dispatch(deleteChangeOrderSuccess(changeOrderId));
    return { success: true };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al eliminar la Orden de Cambio.';
    dispatch(deleteChangeOrderFailure(errorMessage));
    return { error: true, message: errorMessage };
  }
};

// 🆕 Aprobación Manual de Change Order
export const approveChangeOrderManually = (changeOrderId, approvalData) => async (dispatch, getState) => {
  const { token } = getState().auth;

  if (!changeOrderId) {
    console.error('[WorkActions] approveChangeOrderManually - CRITICAL: changeOrderId is undefined.');
    return { error: true, message: 'ID de la Orden de Cambio es indefinido.' };
  }

  try {
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    };
    
    const response = await api.post(`/change-orders/${changeOrderId}/manual-approval`, approvalData, config);
    
    console.log('[WorkActions] approveChangeOrderManually - Success:', response.data);
    return response.data;

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al aprobar manualmente la Orden de Cambio.';
    console.error('[WorkActions] approveChangeOrderManually - Error:', error.response || error);
    return { error: true, message: errorMessage, details: error.response?.data?.details };
  }
};

//images front 
export const addImagesToWork = (idWork, formData) => async (dispatch) => {
  dispatch(addImagesRequest());
  try {
    const response = await api.post(`/work/${idWork}/images`, formData, {
      // ... headers si son necesarios ...
    });
     
    
    // Asegúrate de que response.data y response.data.createdImage existan
    if (response.data && response.data.createdImage) {
      dispatch(addImagesSuccess(response.data)); 
      return response.data; // Devuelve { message, work, createdImage }
    } else {
      // Si la respuesta es 2xx pero no tiene la estructura esperada
      console.error('[workActions] addImagesToWork SUCCESS pero respuesta inesperada:', response.data);
      const failureMsg = 'Respuesta inesperada del servidor tras subir imagen.';
      dispatch(addImagesFailure(failureMsg));
      // No usar Alert.alert en web
      return { error: true, message: failureMsg, details: response.data };
    }
  } catch (error) {
    const backendErrorMessage = error.response?.data?.message;
    const displayErrorMessage = backendErrorMessage || 'Error al agregar las imágenes';
    
    console.error('[workActions] addImagesToWork FAILURE:', displayErrorMessage, 'Full error response:', error.response?.data);
    dispatch(addImagesFailure(displayErrorMessage)); 
    // No usar Alert.alert en web - el componente mostrará toast
    return { error: true, message: displayErrorMessage, details: error.response?.data }; 
  }
};
// ...
export const deleteImagesFromWork = (idWork, imageId) => async (dispatch) => { // Cambiado imageData por imageId
  dispatch(deleteImagesRequest()); // Acción para iniciar la solicitud
  try {
    // URL corregida, sin cuerpo (data)
    const response = await api.delete(`/work/${idWork}/images/${imageId}`);

    // Verificar si la respuesta es 204 No Content (éxito sin cuerpo)
    if (response.status === 204) {
      // Payload opcional, podría ser útil para el reducer si no se refresca
      dispatch(deleteImagesSuccess({ idWork, imageId })); // Acción para éxito
      // ✅ Refrescar el trabajo específico para actualizar la UI
      dispatch(fetchWorkById(idWork));
    } else {
      // Manejar otros códigos de estado si es necesario
      throw new Error(`Error inesperado al eliminar: ${response.status}`);
    }
    // No necesitas devolver response.data porque es 204 No Content
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || error.message || 'Error al eliminar la imagen';
    dispatch(deleteImagesFailure(errorMessage)); // Acción para error
    // El error se maneja en el reducer y componente
    throw error; // Lanzar el error para manejarlo en el componente
  }
};

// Nueva action para cambiar estado de trabajo
export const changeWorkStatus = (idWork, targetStatus, reason, force = false) => async (dispatch) => {
  dispatch(changeWorkStatusRequest());
  try {
    const response = await api.post(`/work/${idWork}/change-status`, {
      targetStatus,
      reason,
      force
    });

    
    dispatch(changeWorkStatusSuccess(response.data));
    
    // Actualizar también la obra en el estado si está cargada
    if (response.data.work) {
      dispatch(updateWorkSuccess(response.data.work));
    }
    
    return response.data;
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    const errorMessage = error.response?.data?.message || 'Error al cambiar estado del trabajo';
    
    // Si hay conflictos, incluirlos en el error
    const conflicts = error.response?.data?.conflicts || [];
    const suggestion = error.response?.data?.suggestion || '';
    
    const errorPayload = {
      message: errorMessage,
      conflicts,
      suggestion,
      details: error.response?.data
    };
    
    dispatch(changeWorkStatusFailure(errorPayload));
    throw errorPayload; // Lanzar para manejo en componente
  }
};

// Action para validar cambio de estado (preview)
export const validateStatusChange = (idWork, targetStatus) => async (dispatch) => {
  dispatch(validateStatusChangeRequest());
  try {
    const response = await api.post(`/work/${idWork}/validate-status-change`, {
      targetStatus
    });
    
    dispatch(validateStatusChangeSuccess(response.data));
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al validar cambio de estado';
    const errorPayload = {
      message: errorMessage,
      conflicts: error.response?.data?.conflicts || [],
      details: error.response?.data
    };
    
    dispatch(validateStatusChangeFailure(errorPayload));
    throw errorPayload;
  }
};