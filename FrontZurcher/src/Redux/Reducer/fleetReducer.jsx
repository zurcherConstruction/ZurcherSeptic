import { createSlice } from '@reduxjs/toolkit';
import {
  FLEET_REQUEST, FLEET_FAILURE,
  FETCH_FLEET_ASSETS_SUCCESS, FETCH_FLEET_ASSET_SUCCESS,
  CREATE_FLEET_ASSET_SUCCESS, UPDATE_FLEET_ASSET_SUCCESS, DELETE_FLEET_ASSET_SUCCESS,
  FETCH_FLEET_MAINTENANCE_SUCCESS, CREATE_FLEET_MAINTENANCE_SUCCESS,
  UPDATE_FLEET_MAINTENANCE_SUCCESS, DELETE_FLEET_MAINTENANCE_SUCCESS,
  LOG_FLEET_MILEAGE_SUCCESS, FETCH_MILEAGE_LOGS_SUCCESS,
  FETCH_FLEET_STATS_SUCCESS,
} from '../Actions/fleetActions';

const initialState = {
  assets: [],
  currentAsset: null,
  maintenanceByAsset: {}, // { [assetId]: [records] }
  mileageLogs: [],
  stats: null,
  loading: false,
  error: null,
};

const fleetSlice = createSlice({
  name: 'fleet',
  initialState,
  reducers: {
    clearCurrentAsset: (state) => { state.currentAsset = null; },
    clearFleetError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher((a) => a.type === FLEET_REQUEST, (state) => {
        state.loading = true; state.error = null;
      })
      .addMatcher((a) => a.type === FLEET_FAILURE, (state, action) => {
        state.loading = false; state.error = action.payload;
      })
      // Assets
      .addMatcher((a) => a.type === FETCH_FLEET_ASSETS_SUCCESS, (state, action) => {
        state.loading = false; state.assets = action.payload || [];
      })
      .addMatcher((a) => a.type === FETCH_FLEET_ASSET_SUCCESS, (state, action) => {
        state.loading = false; state.currentAsset = action.payload;
      })
      .addMatcher((a) => a.type === CREATE_FLEET_ASSET_SUCCESS, (state, action) => {
        state.loading = false;
        state.assets = [action.payload, ...state.assets];
      })
      .addMatcher((a) => a.type === UPDATE_FLEET_ASSET_SUCCESS, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        state.assets = state.assets.map((a) => (a.id === updated.id ? updated : a));
        if (state.currentAsset?.id === updated.id) {
          state.currentAsset = { ...state.currentAsset, ...updated };
        }
      })
      .addMatcher((a) => a.type === DELETE_FLEET_ASSET_SUCCESS, (state, action) => {
        state.loading = false;
        state.assets = state.assets.filter((a) => a.id !== action.payload);
      })
      // Maintenance
      .addMatcher((a) => a.type === FETCH_FLEET_MAINTENANCE_SUCCESS, (state, action) => {
        const { assetId, records } = action.payload;
        state.maintenanceByAsset[assetId] = records;
      })
      .addMatcher((a) => a.type === CREATE_FLEET_MAINTENANCE_SUCCESS, (state, action) => {
        state.loading = false;
        const { assetId, record } = action.payload;
        const existing = state.maintenanceByAsset[assetId] || [];
        state.maintenanceByAsset[assetId] = [record, ...existing];
        if (state.currentAsset?.id === assetId) {
          state.currentAsset = {
            ...state.currentAsset,
            maintenances: [record, ...(state.currentAsset.maintenances || [])],
          };
        }
      })
      .addMatcher((a) => a.type === UPDATE_FLEET_MAINTENANCE_SUCCESS, (state, action) => {
        state.loading = false;
        const { assetId, record } = action.payload;
        if (state.maintenanceByAsset[assetId]) {
          state.maintenanceByAsset[assetId] = state.maintenanceByAsset[assetId].map(
            (m) => (m.id === record.id ? record : m)
          );
        }
      })
      .addMatcher((a) => a.type === DELETE_FLEET_MAINTENANCE_SUCCESS, (state, action) => {
        state.loading = false;
        const { assetId, maintenanceId } = action.payload;
        if (state.maintenanceByAsset[assetId]) {
          state.maintenanceByAsset[assetId] = state.maintenanceByAsset[assetId].filter(
            (m) => m.id !== maintenanceId
          );
        }
      })
      // Mileage
      .addMatcher((a) => a.type === LOG_FLEET_MILEAGE_SUCCESS, (state, action) => {
        state.loading = false;
        const { assetId, asset } = action.payload;
        if (asset) {
          state.assets = state.assets.map((a) => (a.id === assetId ? { ...a, ...asset } : a));
          if (state.currentAsset?.id === assetId) {
            state.currentAsset = { ...state.currentAsset, ...asset };
          }
        }
      })
      .addMatcher((a) => a.type === FETCH_MILEAGE_LOGS_SUCCESS, (state, action) => {
        state.mileageLogs = action.payload || [];
      })
      // Stats
      .addMatcher((a) => a.type === FETCH_FLEET_STATS_SUCCESS, (state, action) => {
        state.stats = action.payload;
      });
  },
});

export const { clearCurrentAsset, clearFleetError } = fleetSlice.actions;
export default fleetSlice.reducer;
