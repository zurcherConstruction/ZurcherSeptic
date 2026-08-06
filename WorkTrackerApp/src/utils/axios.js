import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ⚡ NO importar store directamente para evitar ciclos
import { logout } from '../Redux/features/authSlice';

// 🔧 URL base centralizada - cambiar IP aquí cuando cambie la red
export const API_URL = __DEV__ 
  ? 'http://192.168.1.8:3001' // Desarrollo local192.168.1.8
  : 'https://zurcherapi.up.railway.app'; // Producción

// Crear instancia de Axios con la URL base
const api = axios.create({
  baseURL: API_URL + '/',
  timeout: 30000,
});

// Interceptor para requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token'); // Obtener el token desde AsyncStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // No establecer Content-Type si es FormData
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Si el token es inválido o ha expirado, cerrar sesión
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('staff');
      
      // ⚡ Lazy import del store para evitar ciclos
      const { store } = await import('../Redux/store');
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

export default api;