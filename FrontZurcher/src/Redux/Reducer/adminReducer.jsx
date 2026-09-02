import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  staffList: [], // Renamed from staff to staffList for clarity
  loading: false,
  error: null,
  successMessage: null,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    // Fetch staff list
    fetchStaffRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchStaffSuccess: (state, action) => {
      state.loading = false;
      state.staffList = action.payload;
      state.error = null;
    },
    fetchStaffFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Create staff
    createStaffRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    createStaffSuccess: (state, action) => {
      state.loading = false;
      state.staffList.push(action.payload);
      state.successMessage = 'Staff creado correctamente';
      state.error = null;
    },
    createStaffFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.successMessage = null;
    },
    // Actualizar staff
    updateStaffRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateStaffSuccess: (state, action) => {
      state.loading = false;
      const index = state.staffList.findIndex((staff) => staff.id === action.payload.id);
      if (index !== -1) {
        state.staffList[index] = action.payload;
      }
    },
    updateStaffFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Desactivar staff
    deactivateStaffRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    deactivateStaffSuccess: (state, action) => {
      state.loading = false;
      const index = state.staffList.findIndex((staff) => staff.id === action.payload);
      if (index !== -1) {
        state.staffList[index].isActive = false;
      }
    },
    activateStaffSuccess: (state, action) => {
      state.loading = false;
      const index = state.staffList.findIndex((staff) => staff.id === action.payload);
      if (index !== -1) {
        state.staffList[index].isActive = true;
      }
    },
    deactivateStaffFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    deleteStaffSuccess: (state, action) => {
      state.loading = false;
      state.staffList = state.staffList.filter((staff) => staff.id !== action.payload);
    },
  },
});

export const {
  fetchStaffRequest,
  fetchStaffSuccess,
  fetchStaffFailure,
  createStaffRequest,
  createStaffSuccess,
  createStaffFailure,
  updateStaffRequest,
  updateStaffSuccess,
  updateStaffFailure,
  deactivateStaffRequest,
  deactivateStaffSuccess,
  activateStaffSuccess,
  deactivateStaffFailure,
  deleteStaffSuccess,
} = adminSlice.actions;

export default adminSlice.reducer;