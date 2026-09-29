import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The Android emulator reaches the host machine through 10.0.2.2, while the iOS
// simulator can use localhost. Point this at your LAN IP when testing on a real
// device (e.g. http://192.168.1.5:5000/api).
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const API_ORIGIN = `http://${DEV_HOST}:5000`;
const API_BASE_URL = `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/profile'),
};

export const projectAPI = {
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
};

export const inspectionAPI = {
  getAssigned: () => api.get('/inspections/mine'),
  getAll: () => api.get('/inspections/all'),
  assign: (data) => api.post('/inspections/assign', data),
  updateStatus: (id, data) => api.put(`/inspections/${id}/status`, data),
  getById: (id) => api.get(`/inspections/${id}`),
};

/**
 * Evidence is uploaded as multipart/form-data because the API stores the binary
 * through multer. Geo-tags are sent as flat lat/lng fields, which the API maps
 * back onto the point column.
 */
export const buildEvidenceFormData = (data) => {
  const form = new FormData();
  form.append('inspection_id', String(data.inspection_id));
  form.append('type', data.type || 'photo');
  if (data.timestamp) form.append('timestamp', data.timestamp);
  if (data.geo_coords && data.geo_coords.lat != null) {
    form.append('lat', String(data.geo_coords.lat));
  }
  if (data.geo_coords && data.geo_coords.lng != null) {
    form.append('lng', String(data.geo_coords.lng));
  }
  if (data.file && data.file.uri) {
    form.append('file', {
      uri: data.file.uri,
      name: data.file.fileName || `evidence-${Date.now()}.jpg`,
      type: data.file.type || 'image/jpeg',
    });
  }
  return form;
};

export const evidenceAPI = {
  upload: (data) =>
    api.post('/evidence', buildEvidenceFormData(data), {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000,
    }),
  getByInspection: (inspectionId) => api.get(`/evidence?inspection_id=${inspectionId}`),
  verify: (id) => api.put(`/evidence/${id}/verify`),
};

export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};

export default api;

