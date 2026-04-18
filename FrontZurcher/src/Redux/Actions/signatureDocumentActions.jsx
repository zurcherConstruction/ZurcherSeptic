import api from '../../utils/axios';

// Action Types
export const GET_SIGNATURE_DOCUMENTS_REQUEST = 'GET_SIGNATURE_DOCUMENTS_REQUEST';
export const GET_SIGNATURE_DOCUMENTS_SUCCESS = 'GET_SIGNATURE_DOCUMENTS_SUCCESS';
export const GET_SIGNATURE_DOCUMENTS_FAILURE = 'GET_SIGNATURE_DOCUMENTS_FAILURE';

export const CREATE_SIGNATURE_DOCUMENT_REQUEST = 'CREATE_SIGNATURE_DOCUMENT_REQUEST';
export const CREATE_SIGNATURE_DOCUMENT_SUCCESS = 'CREATE_SIGNATURE_DOCUMENT_SUCCESS';
export const CREATE_SIGNATURE_DOCUMENT_FAILURE = 'CREATE_SIGNATURE_DOCUMENT_FAILURE';

export const GET_SIGNATURE_DOCUMENT_REQUEST = 'GET_SIGNATURE_DOCUMENT_REQUEST';
export const GET_SIGNATURE_DOCUMENT_SUCCESS = 'GET_SIGNATURE_DOCUMENT_SUCCESS';
export const GET_SIGNATURE_DOCUMENT_FAILURE = 'GET_SIGNATURE_DOCUMENT_FAILURE';

export const CHECK_DOCUMENT_STATUS_REQUEST = 'CHECK_DOCUMENT_STATUS_REQUEST';
export const CHECK_DOCUMENT_STATUS_SUCCESS = 'CHECK_DOCUMENT_STATUS_SUCCESS';
export const CHECK_DOCUMENT_STATUS_FAILURE = 'CHECK_DOCUMENT_STATUS_FAILURE';

export const DOWNLOAD_SIGNED_DOCUMENT_REQUEST = 'DOWNLOAD_SIGNED_DOCUMENT_REQUEST';
export const DOWNLOAD_SIGNED_DOCUMENT_SUCCESS = 'DOWNLOAD_SIGNED_DOCUMENT_SUCCESS';
export const DOWNLOAD_SIGNED_DOCUMENT_FAILURE = 'DOWNLOAD_SIGNED_DOCUMENT_FAILURE';

export const CANCEL_SIGNATURE_DOCUMENT_REQUEST = 'CANCEL_SIGNATURE_DOCUMENT_REQUEST';
export const CANCEL_SIGNATURE_DOCUMENT_SUCCESS = 'CANCEL_SIGNATURE_DOCUMENT_SUCCESS';
export const CANCEL_SIGNATURE_DOCUMENT_FAILURE = 'CANCEL_SIGNATURE_DOCUMENT_FAILURE';

export const DELETE_SIGNATURE_DOCUMENT_REQUEST = 'DELETE_SIGNATURE_DOCUMENT_REQUEST';
export const DELETE_SIGNATURE_DOCUMENT_SUCCESS = 'DELETE_SIGNATURE_DOCUMENT_SUCCESS';
export const DELETE_SIGNATURE_DOCUMENT_FAILURE = 'DELETE_SIGNATURE_DOCUMENT_FAILURE';

export const TEST_SIGNATURE_CONNECTION_REQUEST = 'TEST_SIGNATURE_CONNECTION_REQUEST';
export const TEST_SIGNATURE_CONNECTION_SUCCESS = 'TEST_SIGNATURE_CONNECTION_SUCCESS';
export const TEST_SIGNATURE_CONNECTION_FAILURE = 'TEST_SIGNATURE_CONNECTION_FAILURE';

/**
 * Obtener todos los documentos de firma
 */
export const getSignatureDocuments = (filters = {}) => async (dispatch) => {
  try {
    dispatch({ type: GET_SIGNATURE_DOCUMENTS_REQUEST });

    const queryParams = new URLSearchParams();
    
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.linkedContactId) queryParams.append('linkedContactId', filters.linkedContactId);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);

    const response = await api.get(`/signature-documents?${queryParams.toString()}`);

    dispatch({
      type: GET_SIGNATURE_DOCUMENTS_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: GET_SIGNATURE_DOCUMENTS_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Crear y enviar documento para firma
 */
export const createSignatureDocument = (formData) => async (dispatch) => {
  try {
    dispatch({ type: CREATE_SIGNATURE_DOCUMENT_REQUEST });

    const response = await api.post('/signature-documents', formData);

    dispatch({
      type: CREATE_SIGNATURE_DOCUMENT_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: CREATE_SIGNATURE_DOCUMENT_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Obtener un documento específico
 */
export const getSignatureDocument = (id) => async (dispatch) => {
  try {
    dispatch({ type: GET_SIGNATURE_DOCUMENT_REQUEST });

    const response = await api.get(`/signature-documents/${id}`);

    dispatch({
      type: GET_SIGNATURE_DOCUMENT_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: GET_SIGNATURE_DOCUMENT_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Verificar estado de firma de un documento
 */
export const checkDocumentStatus = (id) => async (dispatch) => {
  try {
    dispatch({ type: CHECK_DOCUMENT_STATUS_REQUEST });

    const response = await api.get(`/signature-documents/${id}/status`);

    dispatch({
      type: CHECK_DOCUMENT_STATUS_SUCCESS,
      payload: { id, ...response.data }
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: CHECK_DOCUMENT_STATUS_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Descargar documento firmado
 * @param {string} id - ID del documento
 * @param {boolean} openInNewTab - Abrir en nueva pestaña (default: true)
 */
export const downloadSignedDocument = (id, openInNewTab = true) => async (dispatch) => {
  try {
    dispatch({ type: DOWNLOAD_SIGNED_DOCUMENT_REQUEST });

    const response = await api.get(`/signature-documents/${id}/download-signed`);

    dispatch({
      type: DOWNLOAD_SIGNED_DOCUMENT_SUCCESS,
      payload: { id, ...response.data }
    });

    // Abrir PDF en nueva pestaña (solo si openInNewTab es true)
    if (openInNewTab && response.data.signedPdfUrl) {
      window.open(response.data.signedPdfUrl, '_blank');
    }

    return response.data;
  } catch (error) {
    dispatch({
      type: DOWNLOAD_SIGNED_DOCUMENT_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Cancelar documento pendiente
 */
export const cancelSignatureDocument = (id) => async (dispatch) => {
  try {
    dispatch({ type: CANCEL_SIGNATURE_DOCUMENT_REQUEST });

    const response = await api.put(`/signature-documents/${id}/cancel`, {});

    dispatch({
      type: CANCEL_SIGNATURE_DOCUMENT_SUCCESS,
      payload: { id }
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: CANCEL_SIGNATURE_DOCUMENT_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Eliminar documento
 */
export const deleteSignatureDocument = (id) => async (dispatch) => {
  try {
    dispatch({ type: DELETE_SIGNATURE_DOCUMENT_REQUEST });

    const response = await api.delete(`/signature-documents/${id}`);

    dispatch({
      type: DELETE_SIGNATURE_DOCUMENT_SUCCESS,
      payload: { id }
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: DELETE_SIGNATURE_DOCUMENT_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

/**
 * Test de conexión con el proveedor activo
 */
export const testSignatureConnection = () => async (dispatch) => {
  try {
    dispatch({ type: TEST_SIGNATURE_CONNECTION_REQUEST });

    const response = await api.get('/signature-documents/test-connection');

    dispatch({
      type: TEST_SIGNATURE_CONNECTION_SUCCESS,
      payload: response.data
    });

    return response.data;
  } catch (error) {
    dispatch({
      type: TEST_SIGNATURE_CONNECTION_FAILURE,
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};
