import axios from 'axios';

/**
 * Runtime backend URL resolution.
 * Precedence: window.__APP_CONFIG__.API_URL (written by docker-entrypoint.sh
 * from $API_URL at container startup) > Vite build-time VITE_API_URL > LAN default.
 * The LAN default keeps phone-on-same-WiFi testing working with zero config.
 *
 * NOTE: this must be an absolute URL (including the http:// scheme). A bare
 * "host:port" string is resolved by axios as a *relative* path against the page
 * URL, which silently breaks every request.
 */
export const resolveApiUrl = () => {
  try {
    const fromConfig =
      (typeof window !== 'undefined' && window.__APP_CONFIG__?.API_URL) || undefined;
    const fromEnv =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || undefined;
    const host =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : 'localhost';
    return (fromConfig || fromEnv || `http://${host}:5000`).replace(/\/api\/?$/, '');
  } catch (err) {
    return 'http://localhost:5000';
  }
};

/** Lazy accessor — picks up docker-entrypoint's /config.js even if it loads after this module. */
export const getBackendOrigin = () => resolveApiUrl();

export const BACKEND_ORIGIN = resolveApiUrl();
export const API_BASE = `${BACKEND_ORIGIN}/api`;

const CLIENT_KEY = 'sd_client_id';
/** Stable per-device id used for idempotent evidence uploads + offline replay. */
export const getClientId = () => {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch (err) {
    return `mem-${Math.random().toString(36).slice(2, 10)}`;
  }
};

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
    return `Cannot reach the server at ${API_BASE}. Start the Spring Boot backend (backend-java/) and the AI engine (ai-engine/), then retry.`;
  if (err.response.status >= 500) return 'The server hit an internal error. Check the backend console.';
  return fallback;
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  try {
    config.headers['X-Client-Id'] = getClientId();
  } catch (err) {
    /* header is best-effort */
  }
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

export const anomalyAPI = {
  /**
   * Per-inspection anomaly analysis. Runs the server's deterministic detectors
   * (attendance, evidence, geo, CCTV) plus the AI engine, and stores the
   * findings. The field app is allowed to read its own findings back; only the
   * back office can close them out, so this is the officer's "run analysis" step.
   */
  forInspection: (id) => api.get(`/anomalies/inspections/${id}`),
  analyze: (id) => api.post(`/anomalies/inspections/${id}/analyze`),
  list: (params = {}) => api.get('/anomalies', { params }),
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
  /**
   * Resolve a stored `file_path` (/uploads/evidence/...) to a fetchable URL.
   * The API no longer serves /uploads anonymously, and an <img src> cannot
   * send an Authorization header, so the token rides as a query parameter -
   * the same pattern the CCTV snapshot URLs use.
   */
  fileUrl: (filePath) => {
    if (!filePath) return '';
    if (/^https?:\/\//i.test(filePath)) return filePath;
    const base = `${BACKEND_ORIGIN}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
    return `${base}?token=${encodeURIComponent(getToken() || '')}`;
  },
  upload: async (payload) => {
    const form = new FormData();
    form.append('inspection_id', String(payload.inspection_id));
    form.append('type', payload.type || 'photo');
    // Idempotency: the server + offline queue dedupe on this key.
    form.append('client_id', String(payload.client_id || payload._id || getClientId()));
    if (payload.timestamp) form.append('timestamp', payload.timestamp);
    if (payload.geo_coords && payload.geo_coords.lat != null) form.append('lat', String(payload.geo_coords.lat));
    if (payload.geo_coords && payload.geo_coords.lng != null) form.append('lng', String(payload.geo_coords.lng));
    if (payload.file) {
      // React Native objects ({uri, fileName, type}) are not valid FormData
      // values in a browser - convert the uri (data: URL) into a real Blob.
      const f = payload.file;
      if (f instanceof Blob) {
        form.append('file', f, f.name || `evidence-${Date.now()}.jpg`);
      } else if (f.uri && /^data:/i.test(f.uri)) {
        const name = f.fileName || f.name || `evidence-${Date.now()}.jpg`;
        const mime = /^data:([^;,]+)/.exec(f.uri)?.[1] || f.type || 'image/jpeg';
        const bin = atob(f.uri.slice(f.uri.indexOf(',') + 1));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        form.append('file', new Blob([bytes], { type: mime }), name);
      } else if (f.uri) {
        const blob = await fetch(f.uri).then((r) => r.blob());
        form.append('file', blob, f.fileName || f.name || `evidence-${Date.now()}.jpg`);
      }
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

/**
 * District institution directory — every monitored NGO / departmental home
 * with coordinates, scheme, status and the in-charge's phone. The field app
 * plots these as the "other centers" layer on its maps.
 */
export const gisAPI = {
  centers: () => api.get('/gis/centers'),
};

export default api;
