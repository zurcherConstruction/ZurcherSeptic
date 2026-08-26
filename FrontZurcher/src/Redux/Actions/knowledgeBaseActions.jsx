import api from '../../utils/axios';
import {
  fetchCountiesRequest,
  fetchCountiesSuccess,
  fetchCountiesFailure,
  createCountyRequest,
  createCountySuccess,
  createCountyFailure,
  updateCountyRequest,
  updateCountySuccess,
  updateCountyFailure,
  deleteCountyRequest,
  deleteCountySuccess,
  deleteCountyFailure,
  fetchCategoriesRequest,
  fetchCategoriesSuccess,
  fetchCategoriesFailure,
  fetchContactsRequest,
  fetchContactsSuccess,
  fetchContactsFailure,
  createContactRequest,
  createContactSuccess,
  createContactFailure,
  updateContactRequest,
  updateContactSuccess,
  updateContactFailure,
  deleteContactRequest,
  deleteContactSuccess,
  deleteContactFailure,
  toggleContactFavoriteSuccess,
  fetchProceduresRequest,
  fetchProceduresSuccess,
  fetchProceduresFailure,
  createProcedureRequest,
  createProcedureSuccess,
  createProcedureFailure,
  updateProcedureRequest,
  updateProcedureSuccess,
  updateProcedureFailure,
  deleteProcedureRequest,
  deleteProcedureSuccess,
  deleteProcedureFailure,
  toggleProcedureFavoriteSuccess,
  fetchDocumentsRequest,
  fetchDocumentsSuccess,
  fetchDocumentsFailure,
  createDocumentRequest,
  createDocumentSuccess,
  createDocumentFailure,
  updateDocumentRequest,
  updateDocumentSuccess,
  updateDocumentFailure,
  deleteDocumentRequest,
  deleteDocumentSuccess,
  deleteDocumentFailure,
  toggleDocumentFavoriteSuccess,
} from '../Reducer/knowledgeBaseReducer';

// ========== CATEGORIES ==========

export const fetchCategories = () => async (dispatch) => {
  dispatch(fetchCategoriesRequest());
  try {
    const response = await api.get('/knowledge-base/categories');
    dispatch(fetchCategoriesSuccess(response.data));
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al obtener categorías';
    dispatch(fetchCategoriesFailure(errorMessage));
  }
};

// ========== CONTACTS ==========

export const fetchContacts = (params = {}) => async (dispatch) => {
  dispatch(fetchContactsRequest());
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/knowledge-base/contacts?${queryString}`);
    dispatch(fetchContactsSuccess(response.data));
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al obtener contactos';
    dispatch(fetchContactsFailure(errorMessage));
  }
};

export const createContact = (contactData) => async (dispatch) => {
  dispatch(createContactRequest());
  try {
    const response = await api.post('/knowledge-base/contacts', contactData);
    dispatch(createContactSuccess(response.data));
    return { success: true, message: 'Contacto creado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al crear contacto';
    dispatch(createContactFailure(errorMessage));
    throw error;
  }
};

export const updateContact = (id, contactData) => async (dispatch) => {
  dispatch(updateContactRequest());
  try {
    const response = await api.put(`/knowledge-base/contacts/${id}`, contactData);
    dispatch(updateContactSuccess(response.data));
    return { success: true, message: 'Contacto actualizado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al actualizar contacto';
    dispatch(updateContactFailure(errorMessage));
    throw error;
  }
};

export const deleteContact = (id) => async (dispatch) => {
  dispatch(deleteContactRequest());
  try {
    await api.delete(`/knowledge-base/contacts/${id}`);
    dispatch(deleteContactSuccess(id));
    return { success: true, message: 'Contacto eliminado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al eliminar contacto';
    dispatch(deleteContactFailure(errorMessage));
    throw error;
  }
};

export const toggleContactFavorite = (id) => async (dispatch) => {
  try {
    const response = await api.patch(`/knowledge-base/contacts/${id}/favorite`);
    dispatch(toggleContactFavoriteSuccess(response.data));
  } catch (error) {
    console.error('Error al actualizar favorito:', error);
  }
};

// ========== PROCEDURES ==========

export const fetchProcedures = (params = {}) => async (dispatch) => {
  dispatch(fetchProceduresRequest());
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/knowledge-base/procedures?${queryString}`);
    dispatch(fetchProceduresSuccess(response.data));
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al obtener procedimientos';
    dispatch(fetchProceduresFailure(errorMessage));
  }
};

export const createProcedure = (procedureData) => async (dispatch) => {
  dispatch(createProcedureRequest());
  try {
    const response = await api.post('/knowledge-base/procedures', procedureData);
    dispatch(createProcedureSuccess(response.data));
    return { success: true, message: 'Procedimiento creado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al crear procedimiento';
    dispatch(createProcedureFailure(errorMessage));
    throw error;
  }
};

export const updateProcedure = (id, procedureData) => async (dispatch) => {
  dispatch(updateProcedureRequest());
  try {
    const response = await api.put(`/knowledge-base/procedures/${id}`, procedureData);
    dispatch(updateProcedureSuccess(response.data));
    return { success: true, message: 'Procedimiento actualizado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al actualizar procedimiento';
    dispatch(updateProcedureFailure(errorMessage));
    throw error;
  }
};

export const deleteProcedure = (id) => async (dispatch) => {
  dispatch(deleteProcedureRequest());
  try {
    await api.delete(`/knowledge-base/procedures/${id}`);
    dispatch(deleteProcedureSuccess(id));
    return { success: true, message: 'Procedimiento eliminado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al eliminar procedimiento';
    dispatch(deleteProcedureFailure(errorMessage));
    throw error;
  }
};

export const toggleProcedureFavorite = (id) => async (dispatch) => {
  try {
    const response = await api.patch(`/knowledge-base/procedures/${id}/favorite`);
    dispatch(toggleProcedureFavoriteSuccess(response.data));
  } catch (error) {
    console.error('Error al actualizar favorito:', error);
  }
};

// ========== DOCUMENTS ==========

export const fetchDocuments = (params = {}) => async (dispatch) => {
  dispatch(fetchDocumentsRequest());
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/knowledge-base/documents?${queryString}`);
    dispatch(fetchDocumentsSuccess(response.data));
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al obtener documentos';
    dispatch(fetchDocumentsFailure(errorMessage));
  }
};

export const createDocument = (documentData) => async (dispatch) => {
  dispatch(createDocumentRequest());
  try {
    const response = await api.post('/knowledge-base/documents', documentData);
    dispatch(createDocumentSuccess(response.data));
    return { success: true, message: 'Documento creado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al crear documento';
    dispatch(createDocumentFailure(errorMessage));
    throw error;
  }
};

export const updateDocument = (id, documentData) => async (dispatch) => {
  dispatch(updateDocumentRequest());
  try {
    const response = await api.put(`/knowledge-base/documents/${id}`, documentData);
    dispatch(updateDocumentSuccess(response.data));
    return { success: true, message: 'Documento actualizado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al actualizar documento';
    dispatch(updateDocumentFailure(errorMessage));
    throw error;
  }
};

export const deleteDocument = (id) => async (dispatch) => {
  dispatch(deleteDocumentRequest());
  try {
    await api.delete(`/knowledge-base/documents/${id}`);
    dispatch(deleteDocumentSuccess(id));
    return { success: true, message: 'Documento eliminado correctamente' };
  } catch (error) {
    const errorMessage = error.response?.data?.error || 'Error al eliminar documento';
    dispatch(deleteDocumentFailure(errorMessage));
    throw error;
  }
};

export const toggleDocumentFavorite = (id) => async (dispatch) => {
  try {
    const response = await api.patch(`/knowledge-base/documents/${id}/favorite`);
    dispatch(toggleDocumentFavoriteSuccess(response.data));
  } catch (error) {
    console.error('Error al actualizar favorito:', error);
  }
};

// ========== COUNTIES ==========

export const fetchCounties = (params = {}) => async (dispatch) => {
  dispatch(fetchCountiesRequest());
  try {
    const qs = new URLSearchParams(params).toString();
    const response = await api.get(`/knowledge-base/counties?${qs}`);
    dispatch(fetchCountiesSuccess(response.data));
  } catch (error) {
    dispatch(fetchCountiesFailure(error.response?.data?.error || 'Error al obtener condados'));
  }
};

export const createCounty = (data) => async (dispatch) => {
  dispatch(createCountyRequest());
  try {
    const response = await api.post('/knowledge-base/counties', data);
    dispatch(createCountySuccess(response.data));
    return { success: true };
  } catch (error) {
    const msg = error.response?.data?.error || 'Error al crear condado';
    dispatch(createCountyFailure(msg));
    throw error;
  }
};

export const updateCounty = (id, data) => async (dispatch) => {
  dispatch(updateCountyRequest());
  try {
    const response = await api.put(`/knowledge-base/counties/${id}`, data);
    dispatch(updateCountySuccess(response.data));
    return { success: true };
  } catch (error) {
    const msg = error.response?.data?.error || 'Error al actualizar condado';
    dispatch(updateCountyFailure(msg));
    throw error;
  }
};

export const deleteCounty = (id) => async (dispatch) => {
  dispatch(deleteCountyRequest());
  try {
    await api.delete(`/knowledge-base/counties/${id}`);
    dispatch(deleteCountySuccess(id));
    return { success: true };
  } catch (error) {
    const msg = error.response?.data?.error || 'Error al eliminar condado';
    dispatch(deleteCountyFailure(msg));
    throw error;
  }
};

// ========== SEARCH ==========

export const globalSearch = async (query) => {
  try {
    const response = await api.get(`/knowledge-base/search?q=${query}`);
    return response.data;
  } catch (error) {
    console.error('Error en búsqueda global:', error);
    throw error;
  }
};
