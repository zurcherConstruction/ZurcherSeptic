import axios from 'axios';
import { store } from '../Redux/Store/Store';
import { logout } from '../Redux/Reducer/authReducer';

const api = axios.create({
  baseURL: 'http://localhost:3001/', 
  timeout: 180000, // ⬆️ Aumentado a 3 minutos (temporal hasta optimizaciones)
});

// 👤 Actividad real: el registro de horas solo cuenta peticiones hechas con interacción reciente
// (mouse, teclado, clic, scroll, toque) y la pestaña visible. Los refrescos automáticos de una
// pantalla abierta sin uso se marcan como inactivos.
const IDLE_AFTER_MS = 5 * 60 * 1000;
let lastInteraction = Date.now();
if (typeof window !== 'undefined') {
  const markActive = () => { lastInteraction = Date.now(); };
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach((evt) =>
    window.addEventListener(evt, markActive, { passive: true, capture: true })
  );
}
const isUserActive = () =>
  (typeof document === 'undefined' || document.visibilityState === 'visible') &&
  Date.now() - lastInteraction < IDLE_AFTER_MS;

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // ⚠️ NO usar setLoading global - causa re-renders infinitos
    // Cada componente debe manejar su propio loading state

    config.headers['X-User-Active'] = isUserActive() ? '1' : '0';

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

export default api;