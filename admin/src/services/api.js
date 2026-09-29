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

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
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

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

/** <img> cannot send an Authorization header, so the token travels as a query param. */
const snapshotUrl = (cameraId) =>
  `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/monitoring/cameras/${cameraId}/snapshot?t=${Date.now()}&token=${getToken() || ''}`;

export const monitoringAPI = {
  overview: () => api.get('/monitoring/overview'),
  cameras: (params) => api.get('/monitoring/cameras', { params }),
  snapshotUrl,
  setStatus: (id, status) => api.patch(`/monitoring/cameras/${id}`, { status }),
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
  getAIInsights: () => api.get('/admin/ai/insights'),
  getAIStatus: () => api.get('/admin/ai/status'),
  getNarrative: (tone) => api.get('/admin/ai/narrative', { params: { tone } }),
  runAIAssignment: (data) => api.post('/admin/ai/assign', data),
  getProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  getInspections: () => api.get('/inspections/all'),
  getInspectionById: (id) => api.get(`/inspections/${id}`),
  getInspectionChecklist: (id) => api.get(`/inspections/${id}/checklist`),
  getEvidence: (inspectionId) =>
    api.get(inspectionId ? `/evidence?inspection_id=${inspectionId}` : '/evidence'),
  /** Re-hash a stored artefact and return the integrity verdict (no state change). */
  checkEvidenceIntegrity: (id) => api.get(`/evidence/${id}/integrity`),
  verifyEvidence: (id) => api.put(`/evidence/${id}/verify`),
  getNotifications: () => api.get('/notifications'),
};

export const atrAPI = {
  list: () => api.get('/atr'),
  byId: (id) => api.get(`/atr/${id}`),
  adjudicate: (id, data) => api.post(`/atr/${id}/adjudicate`, data),
};

export const beneficiaryAPI = {
  list: () => api.get('/beneficiaries/feedback'),
};

export { API_ORIGIN };
export default api;


