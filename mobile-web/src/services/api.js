import axios from 'axios';

/**
 * The backend is reached over the LAN so the app works from a phone as well as a
 * laptop. Override with VITE_API_URL when needed.
 *
 * NOTE: this must be an absolute URL (including the http:// scheme). A bare
 * "host:port" string is resolved by axios as a *relative* path against the page
 * URL, which silently breaks every request.
 */
export const BACKEND_ORIGIN = (
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`
).replace(/\/api\/?$/, '');
export const API_BASE = `${BACKEND_ORIGIN}/api`;

const TOKEN_KEY = 'sd_token';
const USER_KEY = 'sd_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};
export const saveSession = ({ token, user }) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
export const isAuthenticated = () => Boolean(getToken());

const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

/** One-shot reachability probe for the API, used by the connection banner. */
export const checkHealth = (timeout = 6000) => api.get('/health', { timeout });

/**
 * Turns any request failure into one actionable line:
 *  - 4xx/5xx with a JSON body -> the server's own message
 *  - timeout                   -> says it timed out
 *  - no response at all        -> names the exact URL that was attempted
 */
export const apiErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')
    return 'The request timed out. Check your connection and try again.';
  if (!err.response)
    return `Cannot reach the server at ${API_BASE}. Start the backend (node src/index.js in backend/), then retry.`;
  if (err.response.status >= 500) return 'The server hit an internal error. Check the backend console.';
  return fallback;
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && isAuthenticated()) {
      clearSession();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  profile: () => api.get('/auth/profile'),
};

export const inspectionAPI = {
  mine: () => api.get('/inspections/mine'),
  all: () => api.get('/inspections/all'),
  byId: (id) => api.get(`/inspections/${id}`),
  geoVerify: (id, lat, lng) => api.post(`/inspections/${id}/geo-verify`, { lat, lng }),
  updateStatus: (id, data) => api.put(`/inspections/${id}/status`, data),
  getChecklist: (id) => api.get(`/inspections/${id}/checklist`),
  saveChecklist: (id, data) => api.post(`/inspections/${id}/checklist`, data),
};

export const atrAPI = {
  list: () => api.get('/atr'),
  byId: (id) => api.get(`/atr/${id}`),
  respond: (id, data) => api.post(`/atr/${id}/respond`, data),
  adjudicate: (id, data) => api.post(`/atr/${id}/adjudicate`, data),
};

export const beneficiaryAPI = {
  list: () => api.get('/beneficiaries/feedback'),
  submit: (data) => api.post('/beneficiaries/feedback', data),
};

export const evidenceAPI = {
  byInspection: (id) => api.get(`/evidence?inspection_id=${id}`),
  upload: (payload) => {
    const form = new FormData();
    form.append('inspection_id', String(payload.inspection_id));
    form.append('type', payload.type || 'photo');
    if (payload.timestamp) form.append('timestamp', payload.timestamp);
    if (payload.geo_coords && payload.geo_coords.lat != null) form.append('lat', String(payload.geo_coords.lat));
    if (payload.geo_coords && payload.geo_coords.lng != null) form.append('lng', String(payload.geo_coords.lng));
    if (payload.file) {
      form.append('file', {
        uri: payload.file.uri,
        name: payload.file.fileName || `evidence-${Date.now()}.jpg`,
        type: payload.file.type || 'image/jpeg',
      });
    }
    return api.post('/evidence', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
};

export const attendanceAPI = {
  history: (officialId) => api.get('/attendance' + (officialId ? `?official_id=${officialId}` : '')),
  checkIn: (payload) => api.post('/attendance/check-in', payload),
  checkOut: (payload) => api.post('/attendance/check-out', payload),
  summary: () => api.get('/attendance/summary'),
};

export const monitoringAPI = {
  overview: () => api.get('/monitoring/overview'),
  cameras: (params = {}) => api.get('/monitoring/cameras', { params }),
  /** <img> cannot send headers, so the token travels as a query parameter. */
  snapshotUrl: (cameraId) =>
    `${API_BASE}/monitoring/cameras/${cameraId}/snapshot?t=${Date.now()}&token=${getToken() || ''}`,
};

export const vcAPI = {
  sessions: () => api.get('/vc/sessions'),
  create: (payload) => api.post('/vc/sessions', payload),
  byId: (id) => api.get(`/vc/sessions/${id}`),
  logJoin: (id, action) => api.post(`/vc/sessions/${id}/join-log`, { action }),
  end: (id) => api.post(`/vc/sessions/${id}/end`),
};

export const reportAPI = {
  list: (params = {}) => api.get('/reports', { params }),
  byId: (id) => api.get(`/reports/${id}`),
};

export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};

export default api;
