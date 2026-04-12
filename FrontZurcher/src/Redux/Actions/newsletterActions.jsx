import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ==================== SUBSCRIBERS ====================

export const getAllSubscribers = (params = {}) => async (dispatch) => {
  try {
    dispatch({ type: 'GET_SUBSCRIBERS_REQUEST' });
    
    const { data } = await axios.get(`${API_URL}/newsletter/subscribers`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    dispatch({ type: 'GET_SUBSCRIBERS_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'GET_SUBSCRIBERS_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const createSubscriber = (subscriberData) => async (dispatch) => {
  try {
    dispatch({ type: 'CREATE_SUBSCRIBER_REQUEST' });
    
    const { data } = await axios.post(
      `${API_URL}/newsletter/subscribers`,
      subscriberData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'CREATE_SUBSCRIBER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'CREATE_SUBSCRIBER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const updateSubscriber = (id, subscriberData) => async (dispatch) => {
  try {
    dispatch({ type: 'UPDATE_SUBSCRIBER_REQUEST' });
    
    const { data } = await axios.put(
      `${API_URL}/newsletter/subscribers/${id}`,
      subscriberData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'UPDATE_SUBSCRIBER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'UPDATE_SUBSCRIBER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const deleteSubscriber = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'DELETE_SUBSCRIBER_REQUEST' });
    
    const { data } = await axios.delete(
      `${API_URL}/newsletter/subscribers/${id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'DELETE_SUBSCRIBER_SUCCESS', payload: { id } });
    return data;
  } catch (error) {
    dispatch({ type: 'DELETE_SUBSCRIBER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const unsubscribeSubscriber = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'UPDATE_SUBSCRIBER_REQUEST' });
    
    const { data } = await axios.put(
      `${API_URL}/newsletter/subscribers/${id}/unsubscribe`,
      {},
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'UPDATE_SUBSCRIBER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'UPDATE_SUBSCRIBER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const unsubscribe = (id, reason) => async (dispatch) => {
  try {
    const { data } = await axios.post(
      `${API_URL}/newsletter/unsubscribe/${id}`,
      { reason }
    );
    return data;
  } catch (error) {
    throw error;
  }
};

// ==================== TEMPLATES ====================

export const getAllTemplates = (params = {}) => async (dispatch) => {
  try {
    dispatch({ type: 'GET_TEMPLATES_REQUEST' });
    
    const { data } = await axios.get(`${API_URL}/newsletter/templates`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    dispatch({ type: 'GET_TEMPLATES_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'GET_TEMPLATES_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const createTemplate = (templateData) => async (dispatch) => {
  try {
    dispatch({ type: 'CREATE_TEMPLATE_REQUEST' });
    
    const { data } = await axios.post(
      `${API_URL}/newsletter/templates`,
      templateData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'CREATE_TEMPLATE_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'CREATE_TEMPLATE_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const updateTemplate = (id, templateData) => async (dispatch) => {
  try {
    dispatch({ type: 'UPDATE_TEMPLATE_REQUEST' });
    
    const { data } = await axios.put(
      `${API_URL}/newsletter/templates/${id}`,
      templateData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'UPDATE_TEMPLATE_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'UPDATE_TEMPLATE_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const deleteTemplate = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'DELETE_TEMPLATE_REQUEST' });
    
    const { data } = await axios.delete(
      `${API_URL}/newsletter/templates/${id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'DELETE_TEMPLATE_SUCCESS', payload: { id } });
    return data;
  } catch (error) {
    dispatch({ type: 'DELETE_TEMPLATE_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

// ==================== NEWSLETTERS ====================

export const getAllNewsletters = (params = {}) => async (dispatch) => {
  try {
    dispatch({ type: 'GET_NEWSLETTERS_REQUEST' });
    
    const { data } = await axios.get(`${API_URL}/newsletter/newsletters`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    dispatch({ type: 'GET_NEWSLETTERS_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'GET_NEWSLETTERS_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const getNewsletterById = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'GET_NEWSLETTER_REQUEST' });
    
    const { data } = await axios.get(
      `${API_URL}/newsletter/newsletters/${id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'GET_NEWSLETTER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'GET_NEWSLETTER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const createNewsletter = (newsletterData) => async (dispatch) => {
  try {
    dispatch({ type: 'CREATE_NEWSLETTER_REQUEST' });
    
    const { data } = await axios.post(
      `${API_URL}/newsletter/newsletters`,
      newsletterData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'CREATE_NEWSLETTER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'CREATE_NEWSLETTER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const updateNewsletter = (id, newsletterData) => async (dispatch) => {
  try {
    dispatch({ type: 'UPDATE_NEWSLETTER_REQUEST' });
    
    const { data } = await axios.put(
      `${API_URL}/newsletter/newsletters/${id}`,
      newsletterData,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'UPDATE_NEWSLETTER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'UPDATE_NEWSLETTER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const sendNewsletter = (id, subscriberIds = null) => async (dispatch) => {
  try {
    dispatch({ type: 'SEND_NEWSLETTER_REQUEST' });
    
    const { data } = await axios.post(
      `${API_URL}/newsletter/newsletters/${id}/send`,
      { subscriberIds },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'SEND_NEWSLETTER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'SEND_NEWSLETTER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

// Reenviar newsletter (crea nuevos recipients y envía)
export const resendNewsletter = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'RESEND_NEWSLETTER_REQUEST' });
    
    const { data } = await axios.post(
      `${API_URL}/newsletter/newsletters/${id}/resend`,
      {},
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'RESEND_NEWSLETTER_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'RESEND_NEWSLETTER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const deleteNewsletter = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'DELETE_NEWSLETTER_REQUEST' });
    
    const { data } = await axios.delete(
      `${API_URL}/newsletter/newsletters/${id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'DELETE_NEWSLETTER_SUCCESS', payload: { id } });
    return data;
  } catch (error) {
    dispatch({ type: 'DELETE_NEWSLETTER_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

export const getNewsletterStats = (id) => async (dispatch) => {
  try {
    dispatch({ type: 'GET_NEWSLETTER_STATS_REQUEST' });
    
    const { data } = await axios.get(
      `${API_URL}/newsletter/newsletters/${id}/stats`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    dispatch({ type: 'GET_NEWSLETTER_STATS_SUCCESS', payload: data });
    return data;
  } catch (error) {
    dispatch({ type: 'GET_NEWSLETTER_STATS_FAILURE', payload: error.response?.data?.message || error.message });
    throw error;
  }
};

// ==================== PUBLIC ====================

export const publicSubscribe = (email, firstName, lastName) => async () => {
  try {
    const { data } = await axios.post(`${API_URL}/newsletter/subscribe`, {
      email,
      firstName,
      lastName
    });
    return data;
  } catch (error) {
    throw error;
  }
};

// ==================== IMAGES ====================

export const uploadNewsletterImage = (imageFile) => async (dispatch) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const { data } = await axios.post(`${API_URL}/newsletter/images/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    dispatch({
      type: 'UPLOAD_NEWSLETTER_IMAGE_SUCCESS',
      payload: data.data
    });

    return data.data;
  } catch (error) {
    dispatch({
      type: 'UPLOAD_NEWSLETTER_IMAGE_FAIL',
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

export const getNewsletterImages = () => async (dispatch) => {
  try {
    dispatch({ type: 'GET_NEWSLETTER_IMAGES_REQUEST' });

    const { data } = await axios.get(`${API_URL}/newsletter/images`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    dispatch({
      type: 'GET_NEWSLETTER_IMAGES_SUCCESS',
      payload: data
    });

    return data;
  } catch (error) {
    dispatch({
      type: 'GET_NEWSLETTER_IMAGES_FAIL',
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};

export const deleteNewsletterImage = (publicId) => async (dispatch) => {
  try {
    // Codificar publicId para la URL (contiene /)
    const encodedPublicId = encodeURIComponent(publicId);
    
    const { data } = await axios.delete(`${API_URL}/newsletter/images/${encodedPublicId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });

    dispatch({
      type: 'DELETE_NEWSLETTER_IMAGE_SUCCESS',
      payload: publicId
    });

    return data;
  } catch (error) {
    dispatch({
      type: 'DELETE_NEWSLETTER_IMAGE_FAIL',
      payload: error.response?.data?.message || error.message
    });
    throw error;
  }
};
