import api from '../../utils/axios';
import {
  fetchClaimsRequest,
  fetchClaimsSuccess,
  fetchClaimsFailure,
} from '../features/claimSlice';

/**
 * Fetch ALL Claims (for capataz role)
 */
export const fetchAllClaims = () => async (dispatch) => {
  dispatch(fetchClaimsRequest());
  try {
    const response = await api.get('/claims');
    const claims = response.data.claims || response.data || [];
    dispatch(fetchClaimsSuccess(claims));
    return claims;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al obtener reclamos';
    dispatch(fetchClaimsFailure(errorMessage));
    if (__DEV__) {
      console.error('❌ fetchAllClaims error:', errorMessage);
    }
  }
};

/**
 * Fetch Claims assigned to the authenticated staff member
 */
export const fetchAssignedClaims = () => async (dispatch) => {
  dispatch(fetchClaimsRequest());
  try {
    const response = await api.get('/claims/assigned');
    const claims = response.data.claims || response.data || [];
    dispatch(fetchClaimsSuccess(claims));
    return claims;
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al obtener reclamos asignados';
    dispatch(fetchClaimsFailure(errorMessage));
    if (__DEV__) {
      console.error('❌ fetchAssignedClaims error:', errorMessage);
    }
  }
};

/**
 * Update Claim status
 */
export const updateClaimStatus = (id, data) => async (dispatch) => {
  try {
    await api.patch(`/claims/${id}`, data);
    // Refetch to get updated data
    dispatch(fetchAssignedClaims());
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al actualizar reclamo';
    if (__DEV__) {
      console.error('❌ updateClaimStatus error:', errorMessage);
    }
    throw error;
  }
};

/**
 * Upload a repair image for a Claim
 */
export const uploadClaimRepairImage = (claimId, imageUri) => async () => {
  try {
    const formData = new FormData();
    const filename = imageUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('image', {
      uri: imageUri,
      name: filename,
      type,
    });

    await api.post(`/claims/${claimId}/images?type=repair`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || 'Error al subir imagen';
    if (__DEV__) {
      console.error('❌ uploadClaimRepairImage error:', errorMessage);
    }
    throw error;
  }
};
