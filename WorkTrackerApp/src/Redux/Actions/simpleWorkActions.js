import { Platform } from 'react-native';
import api, { API_URL } from '../../utils/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import {
  fetchSimpleWorksRequest,
  fetchSimpleWorksSuccess,
  fetchSimpleWorksFailure,
} from '../features/simpleWorkSlice';

/**
 * Fetch SimpleWorks assigned to the authenticated staff member
 */
export const fetchAssignedSimpleWorks = () => async (dispatch) => {
  dispatch(fetchSimpleWorksRequest());
  try {
    // Cache-bust with timestamp so 304 never serves stale data after a status update
    const response = await api.get(`/simple-works/assigned?_=${Date.now()}`);
    const simpleWorks = response.data.simpleWorks || response.data || [];
    dispatch(fetchSimpleWorksSuccess(simpleWorks));
    return simpleWorks;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al obtener trabajos asignados';
    dispatch(fetchSimpleWorksFailure(errorMessage));
    if (__DEV__) {
      console.error('❌ fetchAssignedSimpleWorks error:', errorMessage);
    }
  }
};

/**
 * Update SimpleWork status (e.g., mark as in_progress or completed)
 */
export const updateSimpleWorkStatus = (id, data) => async (dispatch) => {
  try {
    await api.patch(`/simple-works/${id}`, data);
    await dispatch(fetchAssignedSimpleWorks());
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al actualizar trabajo';
    if (__DEV__) {
      console.error('❌ updateSimpleWorkStatus error:', errorMessage);
    }
    throw error;
  }
};

const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv', 'video/webm': 'webm',
};

/**
 * Upload a completion/work image for a SimpleWork.
 * Accepts full ImagePicker asset (preferred) or a plain URI string.
 * - Native: FileSystem.uploadAsync (native multipart, no boundary bugs)
 * - Web: fetch + Blob FormData (works in browser)
 */
export const uploadSimpleWorkImage = (simpleWorkId, imageAsset, type = 'completion') => async () => {
  const uri = typeof imageAsset === 'string' ? imageAsset : imageAsset.uri;

  // Prefer mimeType/fileName from the ImagePicker asset when available
  const assetMime = typeof imageAsset === 'object' ? imageAsset.mimeType : null;
  const assetName = typeof imageAsset === 'object' ? (imageAsset.fileName || imageAsset.name) : null;

  const rawFilename = assetName || uri.split('/').pop() || 'upload';
  const extFromFilename = (/\.(\w+)$/.exec(rawFilename) || [])[1]?.toLowerCase();

  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'];

  // Determine MIME type: asset > extension > default jpeg
  let mimeType = assetMime;
  if (!mimeType) {
    if (extFromFilename) {
      mimeType = videoExts.includes(extFromFilename)
        ? (extFromFilename === 'mov' ? 'video/quicktime' : `video/${extFromFilename}`)
        : (extFromFilename === 'jpg' ? 'image/jpeg' : `image/${extFromFilename}`);
    } else {
      mimeType = 'image/jpeg';
    }
  }

  // Ensure filename has a valid extension (blob URIs from web have UUID-like names)
  let filename = rawFilename;
  if (!extFromFilename) {
    const ext = MIME_TO_EXT[mimeType] || 'jpg';
    filename = `upload_${Date.now()}.${ext}`;
  }

  const token = await AsyncStorage.getItem('token');
  const url = `${API_URL}/simple-works/${simpleWorkId}/images?type=${type}`;

  if (Platform.OS === 'web') {
    const formData = new FormData();
    const fetchResponse = await fetch(uri);
    const blob = await fetchResponse.blob();
    // Pass explicit filename so multer's fileFilter can check the extension
    formData.append('image', blob, filename);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.message || `HTTP ${res.status}`;
      if (__DEV__) console.error('❌ uploadSimpleWorkImage error:', msg);
      throw new Error(msg);
    }
    return;
  }

  // Native: FileSystem.uploadAsync handles multipart boundary correctly
  const result = await FileSystem.uploadAsync(url, uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'image',
    mimeType,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status < 200 || result.status >= 300) {
    let msg = `HTTP ${result.status}`;
    try { msg = JSON.parse(result.body)?.message || msg; } catch {}
    if (__DEV__) console.error('❌ uploadSimpleWorkImage error:', msg);
    throw new Error(msg);
  }
};
