import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  categories: [],
  contacts: [],
  procedures: [],
  documents: [],
  selectedCategory: null,
  loading: false,
  error: null,
  successMessage: null,
};

const knowledgeBaseSlice = createSlice({
  name: 'knowledgeBase',
  initialState,
  reducers: {
    // ========== CATEGORIES ==========
    fetchCategoriesRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchCategoriesSuccess: (state, action) => {
      state.loading = false;
      // Eliminar duplicados por ID
      const uniqueCategories = [];
      const seenIds = new Set();
      
      for (const cat of action.payload) {
        if (!seenIds.has(cat.id)) {
          seenIds.add(cat.id);
          uniqueCategories.push(cat);
        }
      }
      
      state.categories = uniqueCategories;
      state.error = null;
    },
    fetchCategoriesFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    setSelectedCategory: (state, action) => {
      state.selectedCategory = action.payload;
    },

    // ========== CONTACTS ==========
    fetchContactsRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchContactsSuccess: (state, action) => {
      state.loading = false;
      state.contacts = action.payload;
      state.error = null;
    },
    fetchContactsFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    createContactRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    createContactSuccess: (state, action) => {
      state.loading = false;
      state.contacts.push(action.payload);
      state.successMessage = 'Contacto creado correctamente';
      state.error = null;
    },
    createContactFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.successMessage = null;
    },

    updateContactRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateContactSuccess: (state, action) => {
      state.loading = false;
      const index = state.contacts.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.contacts[index] = action.payload;
      }
      state.successMessage = 'Contacto actualizado correctamente';
    },
    updateContactFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    deleteContactRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteContactSuccess: (state, action) => {
      state.loading = false;
      state.contacts = state.contacts.filter((c) => c.id !== action.payload);
      state.successMessage = 'Contacto eliminado correctamente';
    },
    deleteContactFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    toggleContactFavoriteSuccess: (state, action) => {
      const index = state.contacts.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.contacts[index].isFavorite = action.payload.isFavorite;
      }
    },

    // ========== PROCEDURES ==========
    fetchProceduresRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchProceduresSuccess: (state, action) => {
      state.loading = false;
      state.procedures = action.payload;
      state.error = null;
    },
    fetchProceduresFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    createProcedureRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    createProcedureSuccess: (state, action) => {
      state.loading = false;
      state.procedures.push(action.payload);
      state.successMessage = 'Procedimiento creado correctamente';
      state.error = null;
    },
    createProcedureFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.successMessage = null;
    },

    updateProcedureRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateProcedureSuccess: (state, action) => {
      state.loading = false;
      const index = state.procedures.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.procedures[index] = action.payload;
      }
      state.successMessage = 'Procedimiento actualizado correctamente';
    },
    updateProcedureFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    deleteProcedureRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteProcedureSuccess: (state, action) => {
      state.loading = false;
      state.procedures = state.procedures.filter((p) => p.id !== action.payload);
      state.successMessage = 'Procedimiento eliminado correctamente';
    },
    deleteProcedureFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    toggleProcedureFavoriteSuccess: (state, action) => {
      const index = state.procedures.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.procedures[index].isFavorite = action.payload.isFavorite;
      }
    },

    // ========== DOCUMENTS ==========
    fetchDocumentsRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchDocumentsSuccess: (state, action) => {
      state.loading = false;
      state.documents = action.payload;
      state.error = null;
    },
    fetchDocumentsFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    createDocumentRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    createDocumentSuccess: (state, action) => {
      state.loading = false;
      state.documents.push(action.payload);
      state.successMessage = 'Documento creado correctamente';
      state.error = null;
    },
    createDocumentFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.successMessage = null;
    },

    updateDocumentRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    updateDocumentSuccess: (state, action) => {
      state.loading = false;
      const index = state.documents.findIndex((d) => d.id === action.payload.id);
      if (index !== -1) {
        state.documents[index] = action.payload;
      }
      state.successMessage = 'Documento actualizado correctamente';
    },
    updateDocumentFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    deleteDocumentRequest: (state) => {
      state.loading = true;
      state.error = null;
    },
    deleteDocumentSuccess: (state, action) => {
      state.loading = false;
      state.documents = state.documents.filter((d) => d.id !== action.payload);
      state.successMessage = 'Documento eliminado correctamente';
    },
    deleteDocumentFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },

    toggleDocumentFavoriteSuccess: (state, action) => {
      const index = state.documents.findIndex((d) => d.id === action.payload.id);
      if (index !== -1) {
        state.documents[index].isFavorite = action.payload.isFavorite;
      }
    },

    // ========== CLEAR MESSAGES ==========
    clearMessages: (state) => {
      state.successMessage = null;
      state.error = null;
    },
  },
});

export const {
  fetchCategoriesRequest,
  fetchCategoriesSuccess,
  fetchCategoriesFailure,
  setSelectedCategory,
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
  clearMessages,
} = knowledgeBaseSlice.actions;

export default knowledgeBaseSlice.reducer;
