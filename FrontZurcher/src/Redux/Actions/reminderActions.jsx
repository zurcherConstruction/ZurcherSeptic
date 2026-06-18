import api from '../../utils/axios';

// Action Types
export const REMINDER_REQUEST = 'REMINDER_REQUEST';
export const REMINDER_FAILURE = 'REMINDER_FAILURE';
export const FETCH_MY_REMINDERS_SUCCESS = 'FETCH_MY_REMINDERS_SUCCESS';
export const FETCH_ALL_REMINDERS_SUCCESS = 'FETCH_ALL_REMINDERS_SUCCESS';
export const CREATE_REMINDER_SUCCESS = 'CREATE_REMINDER_SUCCESS';
export const UPDATE_REMINDER_SUCCESS = 'UPDATE_REMINDER_SUCCESS';
export const DELETE_REMINDER_SUCCESS = 'DELETE_REMINDER_SUCCESS';
export const TOGGLE_COMPLETE_SUCCESS = 'TOGGLE_COMPLETE_SUCCESS';
export const ADD_COMMENT_SUCCESS = 'ADD_COMMENT_SUCCESS';
export const DELETE_COMMENT_SUCCESS = 'DELETE_COMMENT_SUCCESS';
export const UPDATE_COMMENT_SUCCESS = 'UPDATE_COMMENT_SUCCESS';

const handleError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

export const fetchMyReminders = () => async (dispatch) => {
  dispatch({ type: REMINDER_REQUEST });
  try {
    const response = await api.get('/reminders');
    dispatch({ type: FETCH_MY_REMINDERS_SUCCESS, payload: response.data.reminders });
    return response.data.reminders;
  } catch (error) {
    dispatch({ type: REMINDER_FAILURE, payload: handleError(error, 'Error obteniendo recordatorios') });
  }
};

export const fetchAllReminders = () => async (dispatch) => {
  dispatch({ type: REMINDER_REQUEST });
  try {
    const response = await api.get('/reminders/all');
    dispatch({ type: FETCH_ALL_REMINDERS_SUCCESS, payload: response.data.reminders });
    return response.data.reminders;
  } catch (error) {
    dispatch({ type: REMINDER_FAILURE, payload: handleError(error, 'Error obteniendo todos los recordatorios') });
  }
};

export const createReminder = (data) => async (dispatch) => {
  dispatch({ type: REMINDER_REQUEST });
  try {
    const response = await api.post('/reminders', data);
    dispatch({ type: CREATE_REMINDER_SUCCESS, payload: response.data.reminder });
    return response.data.reminder;
  } catch (error) {
    const msg = handleError(error, 'Error creando recordatorio');
    dispatch({ type: REMINDER_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const updateReminder = (id, data) => async (dispatch) => {
  dispatch({ type: REMINDER_REQUEST });
  try {
    const response = await api.patch(`/reminders/${id}`, data);
    dispatch({ type: UPDATE_REMINDER_SUCCESS, payload: response.data.reminder });
    return response.data.reminder;
  } catch (error) {
    const msg = handleError(error, 'Error actualizando recordatorio');
    dispatch({ type: REMINDER_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const deleteReminder = (id) => async (dispatch) => {
  dispatch({ type: REMINDER_REQUEST });
  try {
    await api.delete(`/reminders/${id}`);
    dispatch({ type: DELETE_REMINDER_SUCCESS, payload: id });
  } catch (error) {
    dispatch({ type: REMINDER_FAILURE, payload: handleError(error, 'Error eliminando recordatorio') });
  }
};

export const toggleComplete = (id) => async (dispatch) => {
  try {
    const response = await api.patch(`/reminders/${id}/complete`);
    dispatch({ type: TOGGLE_COMPLETE_SUCCESS, payload: { id, ...response.data } });
    return response.data;
  } catch (error) {
    dispatch({ type: REMINDER_FAILURE, payload: handleError(error, 'Error actualizando estado') });
  }
};

export const addComment = (reminderId, message, taggedStaffIds = []) => async (dispatch) => {
  try {
    const response = await api.post(`/reminders/${reminderId}/comments`, { message, taggedStaffIds });
    dispatch({ type: ADD_COMMENT_SUCCESS, payload: { reminderId, comment: response.data.comment } });
    return response.data.comment;
  } catch (error) {
    const msg = handleError(error, 'Error agregando comentario');
    dispatch({ type: REMINDER_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const deleteComment = (reminderId, commentId) => async (dispatch) => {
  try {
    await api.delete(`/reminders/${reminderId}/comments/${commentId}`);
    dispatch({ type: DELETE_COMMENT_SUCCESS, payload: { reminderId, commentId } });
  } catch (error) {
    dispatch({ type: REMINDER_FAILURE, payload: handleError(error, 'Error eliminando comentario') });
  }
};

export const updateComment = (reminderId, commentId, message, taggedStaffIds) => async (dispatch) => {
  try {
    const payload = taggedStaffIds === undefined ? { message } : { message, taggedStaffIds };
    const response = await api.patch(`/reminders/${reminderId}/comments/${commentId}`, payload);
    dispatch({ type: UPDATE_COMMENT_SUCCESS, payload: { reminderId, comment: response.data.comment } });
    return response.data.comment;
  } catch (error) {
    const msg = handleError(error, 'Error editando comentario');
    dispatch({ type: REMINDER_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

// ── Plain async helpers (not Redux thunks) — for entity-link search ──────────

export const searchWorksForLink = async (query) => {
  try {
    const response = await api.get('/work', { params: { page: 1, limit: 15, search: query } });
    return response.data.works || [];
  } catch {
    return [];
  }
};

export const searchBudgetsForLink = async (query) => {
  try {
    const response = await api.get('/budget/all', { params: { page: 1, pageSize: 15, search: query } });
    return response.data.budgets || [];
  } catch {
    return [];
  }
};
