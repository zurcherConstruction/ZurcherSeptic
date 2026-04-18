/**
 * Signature Document Reducer
 * Maneja el estado de documentos para firma electrónica (SignNow/DocuSign)
 */

const initialState = {
  documents: {
    data: [],
    pagination: null,
    loading: false,
    error: null
  },
  currentDocument: {
    data: null,
    loading: false,
    error: null
  },
  creating: false,
  createError: null
};

const signatureDocumentReducer = (state = initialState, action) => {
  switch (action.type) {
    // ========== GET ALL DOCUMENTS ==========
    case 'GET_SIGNATURE_DOCUMENTS_REQUEST':
      return {
        ...state,
        documents: { ...state.documents, loading: true, error: null }
      };
    case 'GET_SIGNATURE_DOCUMENTS_SUCCESS':
      return {
        ...state,
        documents: {
          data: action.payload.documents || [],
          pagination: action.payload.pagination,
          loading: false,
          error: null
        }
      };
    case 'GET_SIGNATURE_DOCUMENTS_FAILURE':
      return {
        ...state,
        documents: { ...state.documents, loading: false, error: action.payload }
      };

    // ========== GET SINGLE DOCUMENT ==========
    case 'GET_SIGNATURE_DOCUMENT_REQUEST':
      return {
        ...state,
        currentDocument: { ...state.currentDocument, loading: true, error: null }
      };
    case 'GET_SIGNATURE_DOCUMENT_SUCCESS':
      return {
        ...state,
        currentDocument: {
          data: action.payload.document,
          loading: false,
          error: null
        }
      };
    case 'GET_SIGNATURE_DOCUMENT_FAILURE':
      return {
        ...state,
        currentDocument: { ...state.currentDocument, loading: false, error: action.payload }
      };

    // ========== CREATE DOCUMENT ==========
    case 'CREATE_SIGNATURE_DOCUMENT_REQUEST':
      return {
        ...state,
        creating: true,
        createError: null
      };
    case 'CREATE_SIGNATURE_DOCUMENT_SUCCESS':
      return {
        ...state,
        creating: false,
        createError: null,
        documents: {
          ...state.documents,
          data: [action.payload.document, ...state.documents.data]
        }
      };
    case 'CREATE_SIGNATURE_DOCUMENT_FAILURE':
      return {
        ...state,
        creating: false,
        createError: action.payload
      };

    // ========== CHECK STATUS ==========
    case 'CHECK_SIGNATURE_DOCUMENT_STATUS_REQUEST':
    case 'CHECK_SIGNATURE_DOCUMENT_STATUS_SUCCESS':
    case 'CHECK_SIGNATURE_DOCUMENT_STATUS_FAILURE':
      // Estas acciones se manejan localmente en el componente
      return state;

    // ========== DOWNLOAD SIGNED ==========
    case 'DOWNLOAD_SIGNED_DOCUMENT_REQUEST':
    case 'DOWNLOAD_SIGNED_DOCUMENT_SUCCESS':
    case 'DOWNLOAD_SIGNED_DOCUMENT_FAILURE':
      // Estas acciones descargan el archivo, no modifican el estado
      return state;

    // ========== CANCEL DOCUMENT ==========
    case 'CANCEL_SIGNATURE_DOCUMENT_REQUEST':
      return state;
    case 'CANCEL_SIGNATURE_DOCUMENT_SUCCESS':
      return {
        ...state,
        documents: {
          ...state.documents,
          data: state.documents.data.map(doc =>
            doc.id === action.payload.id
              ? { ...doc, status: 'cancelled' }
              : doc
          )
        }
      };
    case 'CANCEL_SIGNATURE_DOCUMENT_FAILURE':
      return state;

    // ========== DELETE DOCUMENT ==========
    case 'DELETE_SIGNATURE_DOCUMENT_REQUEST':
      return state;
    case 'DELETE_SIGNATURE_DOCUMENT_SUCCESS':
      return {
        ...state,
        documents: {
          ...state.documents,
          data: state.documents.data.filter(doc => doc.id !== action.payload.id)
        }
      };
    case 'DELETE_SIGNATURE_DOCUMENT_FAILURE':
      return state;

    // ========== TEST CONNECTION ==========
    case 'TEST_SIGNATURE_CONNECTION_REQUEST':
    case 'TEST_SIGNATURE_CONNECTION_SUCCESS':
    case 'TEST_SIGNATURE_CONNECTION_FAILURE':
      // Test de conexión no modifica el estado
      return state;

    default:
      return state;
  }
};

export default signatureDocumentReducer;
