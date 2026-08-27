import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  submitting: false,
  error: null,
  lastSubmitted: null,
};

const quoteRequestSlice = createSlice({
  name: 'quoteRequest',
  initialState,
  reducers: {
    submitRequest: (state) => {
      state.submitting = true;
      state.error = null;
    },
    submitSuccess: (state, action) => {
      state.submitting = false;
      state.lastSubmitted = action.payload;
      state.error = null;
    },
    submitFailure: (state, action) => {
      state.submitting = false;
      state.error = action.payload;
    },
    resetState: (state) => {
      state.submitting = false;
      state.error = null;
      state.lastSubmitted = null;
    },
  },
});

export const { submitRequest, submitSuccess, submitFailure, resetState } = quoteRequestSlice.actions;
export default quoteRequestSlice.reducer;
