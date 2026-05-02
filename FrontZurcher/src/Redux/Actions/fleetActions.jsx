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

// Upcoming alerts
export const FETCH_FLEET_UPCOMING_SUCCESS = 'FETCH_FLEET_UPCOMING_SUCCESS';

const handleError = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const FLEET_DASHBOARD_CACHE_MS = 15000;
let statsInFlightPromise = null;
const upcomingInFlightMap = new Map();
let assetsInFlightPromise = null;

// ─── Assets ──────────────────────────────────────────────────────────────

export const fetchFleetAssets = (params = {}, opts = {}) => async (dispatch, getState) => {
  const { force } = opts;
  const hasParams = Object.keys(params).length > 0;
  if (!force && !hasParams) {
    const { assetsFetchedAt } = getState().fleet;
    if (assetsFetchedAt && Date.now() - assetsFetchedAt < FLEET_DASHBOARD_CACHE_MS) return;
    if (assetsInFlightPromise) return assetsInFlightPromise;
  }
  dispatch({ type: FLEET_REQUEST });
  const queryString = new URLSearchParams(params).toString();
  const promise = api.get(`/fleet?${queryString}`).then(response => {
    dispatch({ type: FETCH_FLEET_ASSETS_SUCCESS, payload: response.data.data });
    if (!hasParams) assetsInFlightPromise = null;
    return response.data.data;
  }).catch(error => {
    if (!hasParams) assetsInFlightPromise = null;
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo flota') });
  });
  if (!hasParams) assetsInFlightPromise = promise;
  return promise;
};

const assetByIdInFlight = new Map();

export const fetchFleetAssetById = (id) => async (dispatch) => {
  if (assetByIdInFlight.has(id)) return assetByIdInFlight.get(id);
  dispatch({ type: FLEET_REQUEST });
  const promise = api.get(`/fleet/${id}`).then(response => {
    dispatch({ type: FETCH_FLEET_ASSET_SUCCESS, payload: response.data.data });
    assetByIdInFlight.delete(id);
    return response.data.data;
  }).catch(error => {
    assetByIdInFlight.delete(id);
    dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo activo') });
  });
  assetByIdInFlight.set(id, promise);
  return promise;
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

export const fetchFleetStats = (options = {}) => async (dispatch, getState) => {
  const { force = false } = options;
  const state = getState()?.fleet || {};

  if (!force && state.stats && state.statsFetchedAt && (Date.now() - state.statsFetchedAt) < FLEET_DASHBOARD_CACHE_MS) {
    return state.stats;
  }

  if (!force && statsInFlightPromise) {
    return statsInFlightPromise;
  }

  statsInFlightPromise = (async () => {
    try {
      const response = await api.get('/fleet/stats');
      dispatch({ type: FETCH_FLEET_STATS_SUCCESS, payload: response.data.data });
      return response.data.data;
    } catch (error) {
      dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo estadísticas') });
      throw error;
    } finally {
      statsInFlightPromise = null;
    }
  })();

  return statsInFlightPromise;
};

export const fetchFleetUpcoming = (days = 30, options = {}) => async (dispatch, getState) => {
  const { force = false } = options;
  const state = getState()?.fleet || {};
  const cacheKey = String(days);

  if (
    !force &&
    state.upcoming &&
    state.upcomingFetchedAt &&
    state.upcomingDays === days &&
    (Date.now() - state.upcomingFetchedAt) < FLEET_DASHBOARD_CACHE_MS
  ) {
    return state.upcoming;
  }

  if (!force && upcomingInFlightMap.has(cacheKey)) {
    return upcomingInFlightMap.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      const response = await api.get(`/fleet/upcoming?days=${days}`);
      dispatch({ type: FETCH_FLEET_UPCOMING_SUCCESS, payload: response.data.data, meta: { days } });
      return response.data.data;
    } catch (error) {
      dispatch({ type: FLEET_FAILURE, payload: handleError(error, 'Error obteniendo alertas próximas') });
      throw error;
    } finally {
      upcomingInFlightMap.delete(cacheKey);
    }
  })();

  upcomingInFlightMap.set(cacheKey, requestPromise);
  return requestPromise;
};
