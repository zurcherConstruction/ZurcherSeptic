import api from '../../utils/axios';

export const fetchNotificationRoutings = () => async (dispatch) => {
  dispatch({ type: 'NOTIFICATION_ROUTING_LOADING' });
  try {
    const res = await api.get('/notification-routing');
    dispatch({ type: 'NOTIFICATION_ROUTING_SET', payload: res.data.routings });
  } catch (e) {
    dispatch({ type: 'NOTIFICATION_ROUTING_ERROR', payload: e.message });
  }
};

export const saveNotificationRoutings = (routings) => async (dispatch) => {
  await api.put('/notification-routing', { routings });
  dispatch(fetchNotificationRoutings());
};
