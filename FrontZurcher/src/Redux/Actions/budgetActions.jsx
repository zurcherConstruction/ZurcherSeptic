
import api from '../../utils/axios';
import {
  fetchBudgetsRequest,
  fetchBudgetsSuccess,
  fetchBudgetsFailure,
  fetchBudgetByIdRequest,
  fetchBudgetByIdSuccess,
  fetchBudgetByIdFailure,
  createBudgetRequest,
  createBudgetSuccess,
  createBudgetFailure,
  updateBudgetRequest,
  updateBudgetSuccess,
  updateBudgetFailure,
  deleteBudgetRequest,
  deleteBudgetSuccess,
  deleteBudgetFailure,
  fetchArchivedBudgetsRequest,
  fetchArchivedBudgetsSuccess,
  fetchArchivedBudgetsFailure,

} from '../Reducer/BudgetReducer';

// Descargar PDF firmado de presupuesto
export const downloadSignedBudget = (idBudget) => async () => {
  try {
    // Usar el mismo cliente axios configurado (api)
    const response = await api.get(`/budget/${idBudget}/download-signed`, {
      responseType: 'blob',
      withCredentials: true,
    });
    // Descargar el archivo
    const blob = response.data;
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `Presupuesto_Firmado_${idBudget}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return { type: 'DOWNLOAD_SIGNED_BUDGET_SUCCESS' };
  } catch (error) {
    return { type: 'DOWNLOAD_SIGNED_BUDGET_FAILURE', payload: error.message };
  }
};

import { createAsyncThunk } from '@reduxjs/toolkit';

// Obtener todos los presupuestos
export const fetchBudgets = ({
  page = 1,
  pageSize = 10,
  search = '',
  status = '',
  month = '',
  year = '',
  signatureMethod = ''
} = {}) => async (dispatch) => {
  dispatch(fetchBudgetsRequest());
  try {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('pageSize', pageSize);
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);
    if (month && month !== 'all') params.append('month', month);
    if (year && year !== 'all') params.append('year', year);
    if (signatureMethod && signatureMethod !== 'all') params.append('signatureMethod', signatureMethod);

    const response = await api.get(`/budget/all?${params.toString()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    dispatch(fetchBudgetsSuccess(response.data)); // { budgets, total, page, pageSize, stats }
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al obtener los presupuestos';
    dispatch(fetchBudgetsFailure(errorMessage));
  }
};

// 🆕 Buscar presupuestos SIN actualizar Redux global (para componentes con estado local)
export const searchBudgets = ({
  page = 1,
  pageSize = 20,
  search = '',
  status = '',
  month = '',
  year = ''
} = {}) => async () => {
  try {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('pageSize', pageSize);
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);
    if (month && month !== 'all') params.append('month', month);
    if (year && year !== 'all') params.append('year', year);

    const response = await api.get(`/budget/all?${params.toString()}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    // Retornar los datos directamente sin actualizar Redux
    return { 
      success: true,
      data: response.data // { budgets, total, page, pageSize }
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al obtener los presupuestos';
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Obtener un presupuesto por ID
export const fetchBudgetById = (idBudget) => async (dispatch) => {
  dispatch(fetchBudgetByIdRequest());
  try {
    const response = await api.get(`/budget/${idBudget}`); // Ruta del backend
    dispatch(fetchBudgetByIdSuccess(response.data));
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al obtener el presupuesto';
    dispatch(fetchBudgetByIdFailure(errorMessage));
  }
};

// Crear un presupuesto
export const createBudget = createAsyncThunk(
  'budgets/create', // Nombre base de la acción (generará budgets/create/pending, /fulfilled, /rejected)
  async (budgetData, { rejectWithValue }) => {
    try {
      const response = await api.post('/budget', budgetData); // Ruta del backend
      return response.data;
    } catch (error) {
      // Usa rejectWithValue para enviar un payload de error estructurado.
      const errorMessage =
        error.response?.data?.message || 'Error al crear el presupuesto';
      // RTK despachará la acción 'rejected' con este payload.
      return rejectWithValue(errorMessage);
    }
  }
);

// Actualizar un presupuesto
export const updateBudget = (idBudget, budgetData) => async (dispatch) => {
  dispatch(updateBudgetRequest());
  try {
    const response = await api.put(`/budget/${idBudget}`, budgetData);
    dispatch(updateBudgetSuccess(response.data));
    return {
      type: 'UPDATE_BUDGET_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || 'Error al actualizar el presupuesto';
    dispatch(updateBudgetFailure(errorMessage));
    return {
      type: 'UPDATE_BUDGET_FAILURE',
      payload: errorMessage
    };
  }
};

// Eliminar un presupuesto
export const deleteBudget = (idBudget) => async (dispatch) => {
  dispatch(deleteBudgetRequest());
  try {
    await api.delete(`/budget/${idBudget}`); // Ruta del backend
    dispatch(deleteBudgetSuccess(idBudget));
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || 'Error al eliminar el presupuesto';
    dispatch(deleteBudgetFailure(errorMessage));
  }
};

// Obtener archivos archivados
export const fetchArchivedBudgets = () => async (dispatch) => {
  dispatch(fetchArchivedBudgetsRequest());
  try {
    const response = await api.get(`/archive?timestamp=${new Date().getTime()}`); // Agregar un parámetro único
    dispatch(fetchArchivedBudgetsSuccess(response.data));
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || "Error al obtener los archivos archivados";
    dispatch(fetchArchivedBudgetsFailure(errorMessage));
  }
};

export const uploadInvoice = (budgetId, file, uploadedAmount, onProgress, paymentMethod) => async (dispatch) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedAmount', uploadedAmount); // <--- AÑADIR ESTA LÍNEA
    if (paymentMethod) {
      formData.append('paymentMethod', paymentMethod); // 🆕 Agregar método de pago
    }

    const response = await api.post(`/budget/${budgetId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        if (onProgress) onProgress(percentCompleted);
      },
      timeout: 30000, // 30 seconds timeout
    });

    return {
      type: 'UPLOAD_INVOICE_SUCCESS',
      payload: response.data
    };

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al subir el comprobante';
    return {
      type: 'UPLOAD_INVOICE_FAILURE',
      payload: errorMessage
    };
  }
};

// 🆕 NUEVA ACCIÓN: Reenviar presupuesto editado al cliente
export const resendBudgetToClient = (idBudget) => async (dispatch) => {
  dispatch(updateBudgetRequest()); // Usar los mismos estados de loading
  try {
    const response = await api.post(`/budget/${idBudget}/send-for-review`);
    
    // Actualizar el budget en el store con el estado actualizado
    if (response.data.budget) {
      dispatch(updateBudgetSuccess(response.data.budget));
    }
    
    return {
      type: 'RESEND_BUDGET_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Error al reenviar el presupuesto';
    dispatch(updateBudgetFailure(errorMessage));
    throw new Error(errorMessage);
  }
};

// 🆕 NUEVA ACCIÓN: Enviar presupuesto aprobado a SignNow
export const sendBudgetToSignNow = (idBudget) => async (dispatch) => {
  dispatch(updateBudgetRequest());
  try {
    const response = await api.post(`/budget/${idBudget}/send-to-signnow`);
    
    // Actualizar el budget en el store
    if (response.data.data?.budgetId) {
      // Refrescar el budget específico para obtener el estado actualizado
      const budgetResponse = await api.get(`/budget/${idBudget}`);
      dispatch(updateBudgetSuccess(budgetResponse.data));
    }
    
    return {
      type: 'SEND_TO_SIGNNOW_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.details || 'Error al enviar a SignNow';
    dispatch(updateBudgetFailure(errorMessage));
    throw new Error(errorMessage);
  }
};

// 🆕 NUEVA ACCIÓN: Convertir Draft a Invoice Definitivo
export const convertDraftToInvoice = (idBudget) => async (dispatch) => {
  dispatch(updateBudgetRequest()); // Reutilizar los mismos estados de loading
  try {
    const response = await api.post(`/budget/${idBudget}/convert-to-invoice`);
    dispatch(updateBudgetSuccess(response.data.budget)); // Actualizar con el budget modificado
    return {
      type: 'CONVERT_DRAFT_TO_INVOICE_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al convertir el presupuesto a invoice';
    dispatch(updateBudgetFailure(errorMessage));
    return {
      type: 'CONVERT_DRAFT_TO_INVOICE_FAILURE',
      payload: errorMessage
    };
  }
};

// 🆕 NUEVA ACCIÓN: Exportar budgets a Excel
export const exportBudgetsToExcel = ({ search = '', status = '', month = '', year = '', signatureMethod = '' } = {}) => async () => {
  try {
    // Construir query params con los filtros
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);
    if (month && month !== 'all') params.append('month', month);
    if (year && year !== 'all') params.append('year', year);
    if (signatureMethod && signatureMethod !== 'all') params.append('signatureMethod', signatureMethod);

    const queryString = params.toString();
    const url = `/budget/export/excel${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url, {
      responseType: 'blob', // Importante para recibir archivos binarios
      withCredentials: true
    });

    // Crear un enlace temporal para descargar el archivo
    const blob = response.data;
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Obtener el nombre del archivo del header o usar uno por defecto
    const contentDisposition = response.headers['content-disposition'];
    let fileName = `Budgets_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
      if (fileNameMatch && fileNameMatch.length === 2) {
        fileName = fileNameMatch[1];
      }
    }
    
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    return {
      type: 'EXPORT_BUDGETS_TO_EXCEL_SUCCESS',
      payload: { message: 'Budgets exportados exitosamente' }
    };
  } catch (error) {
    console.error('Error al exportar budgets:', error);
    const errorMessage = error.response?.data?.message || 'Error al exportar budgets a Excel';
    return {
      type: 'EXPORT_BUDGETS_TO_EXCEL_FAILURE',
      payload: errorMessage
    };
  }
};

// 🔔 Obtener budgets con alertas próximas (para priorizar en primera página)
export const fetchBudgetsWithUpcomingAlerts = (days = 7) => async (dispatch) => {
  try {
    const response = await api.get(`/budget/upcoming-alerts?days=${days}`);
    return {
      type: 'FETCH_BUDGETS_WITH_ALERTS_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    console.error('Error al obtener budgets con alertas:', error);
    return {
      type: 'FETCH_BUDGETS_WITH_ALERTS_FAILURE',
      payload: error.message
    };
  }
};

// 🆕 Obtener lista de contactCompany únicos (para autocomplete)
export const fetchContactCompanies = () => async () => {
  try {
    const response = await api.get('/budget/contact-companies');
    console.log('✅ ContactCompanies cargados:', response.data);
    return {
      type: 'FETCH_CONTACT_COMPANIES_SUCCESS',
      payload: response.data.contactCompanies || []
    };
  } catch (error) {
    console.error('❌ Error al obtener contactCompanies:', error);
    return {
      type: 'FETCH_CONTACT_COMPANIES_FAILURE',
      payload: error.message
    };
  }
};

// 🔔 TOGGLE ESTADO DE SEGUIMIENTO (FOLLOW-UP) DE UN PRESUPUESTO
export const toggleBudgetFollowUp = (idBudget, requiresFollowUp) => async (dispatch) => {
  try {
    const response = await api.patch(`/budget/${idBudget}/follow-up`, { requiresFollowUp });
    console.log(`✅ Follow-up actualizado para presupuesto ${idBudget}:`, requiresFollowUp);
    
    // Actualizar el presupuesto en Redux
    dispatch(updateBudgetSuccess(response.data.data));
    
    return {
      type: 'TOGGLE_BUDGET_FOLLOWUP_SUCCESS',
      payload: response.data.data
    };
  } catch (error) {
    console.error('❌ Error al actualizar follow-up:', error);
    return {
      type: 'TOGGLE_BUDGET_FOLLOWUP_FAILURE',
      payload: error.response?.data?.message || 'Error al actualizar el seguimiento'
    };
  }
};

// 🔍 OBTENER PRESUPUESTOS QUE REQUIEREN SEGUIMIENTO
export const fetchFollowUpBudgets = ({
  page = 1,
  pageSize = 20,
  search = '',
  status = ''
} = {}) => async () => {
  try {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('pageSize', pageSize);
    if (search) params.append('search', search);
    if (status && status !== 'all') params.append('status', status);

    const response = await api.get(`/budget/follow-up?${params.toString()}`);
    console.log('✅ Presupuestos con seguimiento cargados:', response.data);
    
    return {
      type: 'FETCH_FOLLOWUP_BUDGETS_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    console.error('❌ Error al obtener presupuestos con seguimiento:', error);
    return {
      type: 'FETCH_FOLLOWUP_BUDGETS_FAILURE',
      payload: error.response?.data?.message || 'Error al cargar presupuestos con seguimiento'
    };
  }
};

// 🗄️ ARCHIVAR UN PRESUPUESTO
export const archiveBudget = (idBudget) => async (dispatch) => {
  try {
    const response = await api.patch(`/budget/${idBudget}/archive`);
    console.log(`✅ Budget ${idBudget} archivado exitosamente`);
    
    return {
      type: 'ARCHIVE_BUDGET_SUCCESS',
      payload: response.data.data
    };
  } catch (error) {
    console.error('❌ Error al archivar presupuesto:', error);
    
    // Retornar el error completo con toda la información del backend
    return {
      type: 'ARCHIVE_BUDGET_FAILURE',
      error: true,
      payload: {
        message: error.response?.data?.message || error.response?.data?.error || 'Error al archivar el presupuesto',
        needsNote: error.response?.data?.needsNote || false
      }
    };
  }
};

// 📋 OBTENER PRESUPUESTOS ARCHIVADOS
export const fetchArchivedBudgetsFromDB = ({
  page = 1,
  pageSize = 20,
  search = ''
} = {}) => async () => {
  try {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('pageSize', pageSize);
    if (search) params.append('search', search);

    const response = await api.get(`/budget/archived?${params.toString()}`);
    console.log('✅ Presupuestos archivados cargados:', response.data);
    
    return {
      type: 'FETCH_ARCHIVED_BUDGETS_DB_SUCCESS',
      payload: response.data
    };
  } catch (error) {
    console.error('❌ Error al obtener presupuestos archivados:', error);
    return {
      type: 'FETCH_ARCHIVED_BUDGETS_DB_FAILURE',
      payload: error.response?.data?.message || 'Error al cargar presupuestos archivados'
    };
  }
};

