import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { API_URL } from '../../utils/axios';
import { submitRequest, submitSuccess, submitFailure } from '../features/quoteRequestSlice';

export const createQuoteRequest = (formData) => async (dispatch) => {
  dispatch(submitRequest());
  try {
    const response = await api.post('/quote-requests', formData);
    dispatch(submitSuccess(response.data));
    return response.data;
  } catch (error) {
    const message = error.response?.data?.error || error.message || 'Error al enviar solicitud';
    dispatch(submitFailure(message));
    throw error;
  }
};

export const uploadQuotePhotos = (quoteId, imageUris) => async () => {
  const formData = new FormData();

  for (let index = 0; index < imageUris.length; index++) {
    const uri = imageUris[index];
    const filename = uri.split('/').pop() || `photo_${index}.jpg`;
    const ext = filename.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    if (uri.startsWith('blob:') || uri.startsWith('data:')) {
      // Expo Web: la URI es un blob, hay que obtener el Blob real
      const blobRes = await fetch(uri);
      const blob = await blobRes.blob();
      formData.append('photos', blob, `photo_${index}.${ext}`);
    } else {
      // React Native nativo: usar el objeto { uri, name, type }
      formData.append('photos', { uri, name: `photo_${index}.${ext}`, type: mimeType });
    }
  }

  const token = await AsyncStorage.getItem('token');
  const response = await fetch(`${API_URL}/quote-requests/${quoteId}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Error al subir fotos');
  }

  return response.json();
};
