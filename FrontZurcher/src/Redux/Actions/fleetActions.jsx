import api from '../../utils/axios';

// ─── Action Types ───────────────────────────────────────────────────────
export const FLEET_REQUEST = 'FLEET_REQUEST';
export const FLEET_FAILURE = 'FLEET_FAILURE';

// Assets
export const FETCH_FLEET_ASSETS_SUCCESS = 'FETCH_FLEET_ASSETS_SUCCESS';
export const FETCH_FLEET_ASSET_SUCCESS = 'FETCH_FLEET_ASSET_SUCCESS';
export const CREATE_FLEET_ASSET_SUCCESS = 'CREATE_FLEET_ASSET_SUCCESS';
export const UPDATE_FLEET_ASSET_SUCCESS = 'UPDATE_FLEET_ASSET_SUCCESS';
export const DELETE_FLEET_ASSET_SUCCESS = 'DELETE_FLEET_ASSET_SUCCESS';

// Maintenance
export const FETCH_FLEET_MAINTENANCE_SUCCESS = 'FETCH_FLEET_MAINTENANCE_SUCCESS';
export const CREATE_FLEET_MAINTENANCE_SUCCESS = 'CREATE_FLEET_MAINTENANCE_SUCCESS';
export const UPDATE_FLEET_MAINTENANCE_SUCCESS = 'UPDATE_FLEET_MAINTENANCE_SUCCESS';
export const DELETE_FLEET_MAINTENANCE_SUCCESS = 'DELETE_FLEET_MAINTENANCE_SUCCESS';

// Mileage log
export const LOG_FLEET_MILEAGE_SUCCESS = 'LOG_FLEET_MILEAGE_SUCCESS';
export const FETCH_MILEAGE_LOGS_SUCCESS = 'FETCH_MILEAGE_LOGS_SUCCESS';

// Stats
export const FETCH_FLEET_STATS_SUCCESS = 'FETCH_FLEET_STATS_SUCCESS';

const handleError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

// ─── Assets ──────────────────────────────────────────────────────────────

export const fetchFleetAssets = (params = {}) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/fleet?${queryString}`);
    dispatch({ type: FETCH_FLEET_ASSETS_SUCCESS, payload: response.data.data });
    return response.data.data;
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo flota') });
  }
};

export const fetchFleetAssetById = (id) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const response = await api.get(`/fleet/${id}`);
    dispatch({ type: FETCH_FLEET_ASSET_SUCCESS, payload: response.data.data });
    return response.data.data;
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo activo') });
  }
};

export const createFleetAsset = (data) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const response = await api.post('/fleet', data);
    dispatch({ type: CREATE_FLEET_ASSET_SUCCESS, payload: response.data.data });
    return response.data.data;
  } catch (error) {
    const msg = handleError(error, 'Error creando activo');
    dispatch({ type: FLEET_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const updateFleetAsset = (id, data) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const response = await api.put(`/fleet/${id}`, data);
    dispatch({ type: UPDATE_FLEET_ASSET_SUCCESS, payload: response.data.data });
    return response.data.data;
  } catch (error) {
    const msg = handleError(error, 'Error actualizando activo');
    dispatch({ type: FLEET_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const deleteFleetAsset = (id) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    await api.delete(`/fleet/${id}`);
    dispatch({ type: DELETE_FLEET_ASSET_SUCCESS, payload: id });
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error eliminando activo') });
  }
};

export const uploadFleetAssetImage = (id, file) => async (dispatch) => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post(`/fleet/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    dispatch({ type: UPDATE_FLEET_ASSET_SUCCESS, payload: { id, ...response.data.data } });
    return response.data.data;
  } catch (error) {
    const msg = handleError(error, 'Error subiendo imagen');
    throw new Error(msg);
  }
};

// ─── Mileage / Hours ─────────────────────────────────────────────────────

export const logFleetMileage = (assetId, data) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const response = await api.post(`/fleet/${assetId}/mileage`, data);
    dispatch({ type: LOG_FLEET_MILEAGE_SUCCESS, payload: { assetId, log: response.data.data, asset: response.data.asset } });
    return response.data;
  } catch (error) {
    const msg = handleError(error, 'Error registrando mileaje');
    dispatch({ type: FLEET_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const fetchMileageLogs = (assetId) => async (dispatch) => {
  try {
    const response = await api.get(`/fleet/${assetId}/mileage`);
    dispatch({ type: FETCH_MILEAGE_LOGS_SUCCESS, payload: response.data.data });
    return response.data.data;
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo historial') });
  }
};

// ─── Maintenance ──────────────────────────────────────────────────────────

export const fetchMaintenanceByAsset = (assetId) => async (dispatch) => {
  try {
    const response = await api.get(`/fleet/${assetId}/maintenance`);
    dispatch({ type: FETCH_FLEET_MAINTENANCE_SUCCESS, payload: { assetId, records: response.data.data } });
    return response.data.data;
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo mantenimientos') });
  }
};

export const createMaintenance = (assetId, data) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const response = await api.post(`/fleet/${assetId}/maintenance`, data);
    dispatch({ type: CREATE_FLEET_MAINTENANCE_SUCCESS, payload: { assetId, record: response.data.data } });
    return response.data.data;
  } catch (error) {
    const msg = handleError(error, 'Error creando mantenimiento');
    dispatch({ type: FLEET_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const updateMaintenance = (assetId, maintenanceId, data) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    const response = await api.put(`/fleet/${assetId}/maintenance/${maintenanceId}`, data);
    dispatch({ type: UPDATE_FLEET_MAINTENANCE_SUCCESS, payload: { assetId, record: response.data.data } });
    return response.data.data;
  } catch (error) {
    const msg = handleError(error, 'Error actualizando mantenimiento');
    dispatch({ type: FLEET_FAILURE, payload: msg });
    throw new Error(msg);
  }
};

export const deleteMaintenance = (assetId, maintenanceId) => async (dispatch) => {
  dispatch({ type: FLEET_REQUEST });
  try {
    await api.delete(`/fleet/${assetId}/maintenance/${maintenanceId}`);
    dispatch({ type: DELETE_FLEET_MAINTENANCE_SUCCESS, payload: { assetId, maintenanceId } });
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error eliminando mantenimiento') });
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────

export const fetchFleetStats = () => async (dispatch) => {
  try {
    const response = await api.get('/fleet/stats');
    dispatch({ type: FETCH_FLEET_STATS_SUCCESS, payload: response.data.data });
    return response.data.data;
  } catch (error) {
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo estadísticas') });
  }
};
