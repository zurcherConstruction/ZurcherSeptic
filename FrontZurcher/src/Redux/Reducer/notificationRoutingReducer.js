const initialState = {
  routings: [],
  loading: false,
  error: null,
};

const notificationRoutingReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'NOTIFICATION_ROUTING_LOADING':
      return { ...state, loading: true, error: null };
    case 'NOTIFICATION_ROUTING_SET':
      return { ...state, loading: false, routings: action.payload };
    case 'NOTIFICATION_ROUTING_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

export default notificationRoutingReducer;
