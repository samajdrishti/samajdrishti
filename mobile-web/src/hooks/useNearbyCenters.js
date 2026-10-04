import { useCallback, useEffect, useState } from 'react';
import { gisAPI, monitoringAPI } from '../services/api';

const CENTERS_KEY = 'sd_gis_centers_v1';
const CAMERAS_KEY = 'sd_cameras_v1';

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const writeCache = (key, rows) => {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch (err) {
    /* cache is best-effort */
  }
};

const toneForCenter = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'flagged') return 'bad';
  if (s === 'active') return 'ok';
  return 'mute';
};

/**
 * Maps a /gis/centers row onto a MapView pin. Returns null when the row has
 * no usable coordinates, so callers can simply .filter(Boolean).
 */
export const centerToPin = (c) => {
  if (!c) return null;
  const lat = Number(c.geo_coords?.lat);
  const lng = Number(c.geo_coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const head = c.head || {};
  return {
    centerId: c.id,
    lat,
    lng,
    tone: toneForCenter(c.status),
    label: c.name || 'Monitored center',
    popupContent: c.location || '',
    scheme: c.scheme || '',
    description: [
      c.status ? `Status: ${c.status}` : '',
      head.name ? `In-charge: ${head.name}` : '',
      c.camera_count != null ? `${c.camera_count} camera(s)` : '',
    ].filter(Boolean).join(' · '),
    phone: head.phone || '',
    hasCall: Boolean(head.phone),
  };
};

/**
 * District directory with stale-while-revalidate caching: the cached copy
 * renders instantly (and offline), then refreshes whenever we're online.
 */
export const useNearbyCenters = (online) => {
  const [centers, setCenters] = useState(() => readCache(CENTERS_KEY));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await gisAPI.centers();
      const rows = Array.isArray(data?.centers) ? data.centers : [];
      setCenters(rows);
      writeCache(CENTERS_KEY, rows);
    } catch (err) {
      /* offline or server down — the cached copy keeps the map populated */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (online) refresh();
  }, [online, refresh]);

  return { centers, loading, refresh };
};

/**
 * Maps a /monitoring/cameras row onto a MapView pin. Online cameras read
 * blue, offline/tampered ones red. Null when coordinates are unusable.
 */
export const cameraToPin = (c) => {
  if (!c) return null;
  const lat = Number(c.geo_coords?.lat);
  const lng = Number(c.geo_coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const online = c.online ?? c.status === 'online';
  return {
    cameraId: c.id,
    lat,
    lng,
    tone: online ? 'info' : 'bad',
    label: c.name || 'Camera',
    popupContent: c.project_name || c.location || '',
    scheme: online ? 'LIVE' : 'NO SIGNAL',
    description: [
      c.tamper_flag && c.tamper_flag !== 'normal' ? `Tamper: ${String(c.tamper_flag).replace(/_/g, ' ')}` : '',
      c.anomaly_note || '',
    ].filter(Boolean).join(' · '),
  };
};

export const useCameraPins = (online) => {
  const [cameras, setCameras] = useState(() => readCache(CAMERAS_KEY));

  const refresh = useCallback(async () => {
    try {
      const { data } = await monitoringAPI.cameras();
      const rows = Array.isArray(data) ? data : [];
      setCameras(rows);
      writeCache(CAMERAS_KEY, rows);
    } catch (err) {
      /* offline — cached cameras keep the layer populated */
    }
  }, []);

  useEffect(() => {
    if (online) refresh();
  }, [online, refresh]);

  return { cameras, refresh };
};
