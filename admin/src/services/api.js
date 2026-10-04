import axios from 'axios';

const TOKEN_KEY = 'samaj_drishti_token';
const USER_KEY = 'samaj_drishti_user';

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

/**
 * Runtime backend URL resolution.
 * Precedence: window.__APP_CONFIG__.API_URL (written by docker-entrypoint.sh
 * from $API_URL at container startup) > Vite build-time VITE_API_URL > localhost.
 * This is what makes the nginx image portable without a rebuild.
 */
export const resolveApiUrl = () => {
  const runtime =
    typeof window !== 'undefined' ? window.__APP_CONFIG__?.API_URL : undefined;
  const buildtime = import.meta.env.VITE_API_URL;
  return runtime || buildtime || 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid token must not leave the dashboard stuck on
// "Failed to load dashboard data" - drop the session and return to the gate.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401 && isAuthenticated()) {
      clearSession();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/profile'),
};

const API_ORIGIN = resolveApiUrl().replace(/\/api\/?$/, '');

/**
 * <img> cannot send an Authorization header, so instead of a ?token= query
 * param we fetch the bytes with axios (which attaches the Bearer header) and
 * hand the browser an object URL. Callers must revoke the URL when done.
 */
const fetchAuthedBlobUrl = async (absoluteUrl) => {
  const res = await api.get(absoluteUrl, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
};

export const monitoringAPI = {
  overview: () => api.get('/monitoring/overview'),
  cameras: (params) => api.get('/monitoring/cameras', { params }),
  snapshotBlobUrl: (cameraId) =>
    fetchAuthedBlobUrl(`${resolveApiUrl()}/monitoring/cameras/${cameraId}/snapshot`),
  setStatus: (id, status) => api.patch(`/monitoring/cameras/${id}`, { status }),
};

export const evidenceAPI = {
  list: (params) => api.get('/evidence', { params }),
  verify: (id) => api.put(`/evidence/${id}/verify`),
  integrity: (id) => api.get(`/evidence/${id}/integrity`),
  /** Fetch the stored artefact with the Bearer header and open/download via
   *  a short-lived object URL - no token ever appears in a URL. */
  openFile: async (filePath) => {
    if (!filePath) return;
    const target = /^https?:\/\//i.test(filePath)
      ? filePath
      : `${API_ORIGIN}${filePath.startsWith('/') ? filePath : `/${filePath}`}`;
    const objectUrl = await fetchAuthedBlobUrl(target);
    window.open(objectUrl, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  },
};

/**
 * Real-Time Compliance GIS feed: every monitored center with its registered
 * coordinates, the center head and the ground-level CCTV cameras on site.
 * The Google Maps browser key is delivered by the backend, not bundled here.
 */
export const gisAPI = {
  centers: () => api.get('/gis/centers'),
};

export const attendanceAPI = {
  summary: () => api.get('/attendance/summary'),
  history: (params) => api.get('/attendance', { params }),
  anomalies: () => api.get('/attendance/anomalies'),
};

export const vcAPI = {
  sessions: () => api.get('/vc/sessions'),
  create: (payload) => api.post('/vc/sessions', payload),
  byId: (id) => api.get(`/vc/sessions/${id}`),
  end: (id) => api.post(`/vc/sessions/${id}/end`),
};

export const reportAPI = {
  list: (params) => api.get('/reports', { params }),
  byId: (id) => api.get(`/reports/${id}`),
  share: (id) => api.post(`/reports/${id}/share`),
};

export const auditAPI = {
  list: (params) => api.get('/audit', { params }),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAlerts: () => api.get('/admin/alerts'),
  getAIInsights: (forceRefresh = false) => {
    const params = forceRefresh ? { _t: Date.now() } : undefined;
    return api.get('/admin/ai/insights', { params });
  },
  getAIStatus: () => api.get('/admin/ai/status'),
  getNarrative: (tone) => api.get('/admin/ai/narrative', { params: { tone } }),
  runAIAssignment: (data) => api.post('/admin/ai/assign', data),
  flushAICache: (pattern) => api.post('/admin/ai/cache/flush', { pattern }),
  getProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  getInspections: () => api.get('/inspections/all'),
  getInspectionById: (id) => api.get(`/inspections/${id}`),
  getInspectionChecklist: (id) => api.get(`/inspections/${id}/checklist`),
  getEvidence: (inspectionId) =>
    api.get(inspectionId ? `/evidence?inspection_id=${inspectionId}` : '/evidence'),
  checkEvidenceIntegrity: (id) => api.get(`/evidence/${id}/integrity`),
  verifyEvidence: (id) => api.put(`/evidence/${id}/verify`),
  getNotifications: () => api.get('/notifications'),
};

export const atrAPI = {
  list: () => api.get('/atr'),
  byId: (id) => api.get(`/atr/${id}`),
  create: (data) => api.post('/atr', data),
  adjudicate: (id, data) => api.post(`/atr/${id}/adjudicate`, data),
};

/** Personnel directory for ATR assignment; admin-only on the backend. */
export const userAPI = {
  list: (params = {}) => api.get('/users', { params }),
};

export const beneficiaryAPI = {
  list: () => api.get('/beneficiaries/feedback'),
};

export { API_ORIGIN };
export default api;


