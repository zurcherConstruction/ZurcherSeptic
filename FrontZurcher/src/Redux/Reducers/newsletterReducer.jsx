const initialState = {
  subscribers: {
    data: [],
    pagination: null,
    loading: false,
    error: null
  },
  templates: {
    data: [],
    loading: false,
    error: null
  },
  newsletters: {
    data: [],
    pagination: null,
    loading: false,
    error: null
  },
  currentNewsletter: {
    data: null,
    loading: false,
    error: null
  },
  stats: {
    data: null,
    loading: false,
    error: null
  },
  images: {
    data: [],
    loading: false,
    error: null
  }
};

const newsletterReducer = (state = initialState, action) => {
  switch (action.type) {
    // ========== SUBSCRIBERS ==========
    case 'GET_SUBSCRIBERS_REQUEST':
      return {
        ...state,
        subscribers: { ...state.subscribers, loading: true, error: null }
      };
    case 'GET_SUBSCRIBERS_SUCCESS':
      return {
        ...state,
        subscribers: {
          data: action.payload.data,
          pagination: action.payload.pagination,
          loading: false,
          error: null
        }
      };
    case 'GET_SUBSCRIBERS_FAILURE':
      return {
        ...state,
        subscribers: { ...state.subscribers, loading: false, error: action.payload }
      };
      
    case 'CREATE_SUBSCRIBER_REQUEST':
    case 'UPDATE_SUBSCRIBER_REQUEST':
    case 'DELETE_SUBSCRIBER_REQUEST':
      return state; // No cambiamos el estado durante estas operaciones
      
    case 'CREATE_SUBSCRIBER_SUCCESS':
      return {
        ...state,
        subscribers: {
          ...state.subscribers,
          data: [action.payload.data, ...state.subscribers.data]
        }
      };
      
    case 'UPDATE_SUBSCRIBER_SUCCESS':
      return {
        ...state,
        subscribers: {
          ...state.subscribers,
          data: state.subscribers.data.map(sub =>
            sub.id === action.payload.data.id ? action.payload.data : sub
          )
        }
      };
      
    case 'DELETE_SUBSCRIBER_SUCCESS':
      return {
        ...state,
        subscribers: {
          ...state.subscribers,
          data: state.subscribers.data.filter(sub => sub.id !== action.payload.id)
        }
      };

    // ========== TEMPLATES ==========
    case 'GET_TEMPLATES_REQUEST':
      return {
        ...state,
        templates: { ...state.templates, loading: true, error: null }
      };
    case 'GET_TEMPLATES_SUCCESS':
      return {
        ...state,
        templates: {
          data: action.payload.data,
          loading: false,
          error: null
        }
      };
    case 'GET_TEMPLATES_FAILURE':
      return {
        ...state,
        templates: { ...state.templates, loading: false, error: action.payload }
      };
      
    case 'CREATE_TEMPLATE_SUCCESS':
      return {
        ...state,
        templates: {
          ...state.templates,
          data: [action.payload.data, ...state.templates.data]
        }
      };
      
    case 'UPDATE_TEMPLATE_SUCCESS':
      return {
        ...state,
        templates: {
          ...state.templates,
          data: state.templates.data.map(tpl =>
            tpl.id === action.payload.data.id ? action.payload.data : tpl
          )
        }
      };
      
    case 'DELETE_TEMPLATE_SUCCESS':
      return {
        ...state,
        templates: {
          ...state.templates,
          data: state.templates.data.filter(tpl => tpl.id !== action.payload.id)
        }
      };

    // ========== NEWSLETTERS ==========
    case 'GET_NEWSLETTERS_REQUEST':
      return {
        ...state,
        newsletters: { ...state.newsletters, loading: true, error: null }
      };
    case 'GET_NEWSLETTERS_SUCCESS':
      return {
        ...state,
        newsletters: {
          data: action.payload.data,
          pagination: action.payload.pagination,
          loading: false,
          error: null
        }
      };
    case 'GET_NEWSLETTERS_FAILURE':
      return {
        ...state,
        newsletters: { ...state.newsletters, loading: false, error: action.payload }
      };
      
    case 'GET_NEWSLETTER_REQUEST':
      return {
        ...state,
        currentNewsletter: { data: null, loading: true, error: null }
      };
    case 'GET_NEWSLETTER_SUCCESS':
      return {
        ...state,
        currentNewsletter: {
          data: action.payload.data,
          loading: false,
          error: null
        }
      };
    case 'GET_NEWSLETTER_FAILURE':
      return {
        ...state,
        currentNewsletter: { data: null, loading: false, error: action.payload }
      };
      
    case 'CREATE_NEWSLETTER_SUCCESS':
      return {
        ...state,
        newsletters: {
          ...state.newsletters,
          data: [action.payload.data, ...state.newsletters.data]
        }
      };
      
    case 'UPDATE_NEWSLETTER_SUCCESS':
      return {
        ...state,
        newsletters: {
          ...state.newsletters,
          data: state.newsletters.data.map(nl =>
            nl.id === action.payload.data.id ? action.payload.data : nl
          )
        },
        currentNewsletter: {
          ...state.currentNewsletter,
          data: action.payload.data
        }
      };
      
    case 'SEND_NEWSLETTER_SUCCESS':
      return {
        ...state,
        newsletters: {
          ...state.newsletters,
          data: state.newsletters.data.map(nl =>
            nl.id === action.payload.data.newsletterId
              ? { ...nl, status: 'sending' }
              : nl
          )
        }
      };
      
    case 'DELETE_NEWSLETTER_SUCCESS':
      return {
        ...state,
        newsletters: {
          ...state.newsletters,
          data: state.newsletters.data.filter(nl => nl.id !== action.payload.id)
        }
      };

    // ========== STATS ==========
    case 'GET_NEWSLETTER_STATS_REQUEST':
      return {
        ...state,
        stats: { data: null, loading: true, error: null }
      };
    case 'GET_NEWSLETTER_STATS_SUCCESS':
      return {
        ...state,
        stats: {
          data: action.payload.data,
          loading: false,
          error: null
        }
      };
    case 'GET_NEWSLETTER_STATS_FAILURE':
      return {
        ...state,
        stats: { data: null, loading: false, error: action.payload }
      };

    // ========== IMAGES ==========
    case 'GET_NEWSLETTER_IMAGES_REQUEST':
      return {
        ...state,
        images: { ...state.images, loading: true, error: null }
      };
    case 'GET_NEWSLETTER_IMAGES_SUCCESS':
      return {
        ...state,
        images: {
          data: action.payload.data,
          loading: false,
          error: null
        }
      };
    case 'GET_NEWSLETTER_IMAGES_FAIL':
      return {
        ...state,
        images: { ...state.images, loading: false, error: action.payload }
      };
    case 'UPLOAD_NEWSLETTER_IMAGE_SUCCESS':
      return {
        ...state,
        images: {
          ...state.images,
          data: [action.payload, ...state.images.data]
        }
      };
    case 'DELETE_NEWSLETTER_IMAGE_SUCCESS':
      return {
        ...state,
        images: {
          ...state.images,
          data: state.images.data.filter(img => img.publicId !== action.payload)
        }
      };

    default:
      return state;
  }
};

export default newsletterReducer;
