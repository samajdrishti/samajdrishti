/** Geolocation helpers. Every function is pure (testable) except getPosition/watchPosition. */

export const EARTH_RADIUS_M = 6371000;

export const toRad = (deg) => (Number(deg) * Math.PI) / 180;
export const toDeg = (rad) => (Number(rad) * 180) / Math.PI;

const num = (v, fallback = NaN) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Haversine distance in metres between two {lat,lng} points. Returns NaN on bad input. */
export const haversineDistanceM = (a, b) => {
  const lat1 = num(a?.lat);
  const lng1 = num(a?.lng);
  const lat2 = num(b?.lat);
  const lng2 = num(b?.lng);
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) return NaN;
  // Shortest-arc longitude delta (handles the antimeridian).
  const diffLng = ((lng2 - lng1 + 540) % 360) - 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(diffLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Forward azimuth 0-360° from point a to point b. Returns null on bad input. */
export const bearingDeg = (a, b) => {
  const lat1 = num(a?.lat);
  const lng1 = num(a?.lng);
  const lat2 = num(b?.lat);
  const lng2 = num(b?.lng);
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) return null;
  const diffLng = ((lng2 - lng1 + 540) % 360) - 180;
  const dLng = toRad(diffLng);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
};

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export const compass16 = (bearing) => {
  if (bearing == null || !Number.isFinite(Number(bearing))) return '—';
  return COMPASS_16[Math.round(Number(bearing) / 22.5) % 16];
};

/**
 * Evaluates a device fix against an institution geofence.
 * Pure + unit-tested: GpsVerify renders whatever this returns.
 */
export const evaluateGpsFix = (coords, institution) => {
  if (!coords || !institution) return null;
  const lat = num(coords.lat);
  const lng = num(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const distanceM = haversineDistanceM({ lat, lng }, { lat: institution.lat, lng: institution.lng });
  if (!Number.isFinite(distanceM)) return null;
  const bearing = bearingDeg({ lat, lng }, { lat: institution.lat, lng: institution.lng });
  const rounded = Math.round(distanceM);
  const verified = rounded <= Number(institution.geofenceM ?? 120);
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accuracy: Math.max(1, Math.round(num(coords.accuracy, 8))),
    distanceM: rounded,
    bearing,
    compass: compass16(bearing),
    verified,
  };
};

/** One-shot fix. Never throws / never rejects — resolves null when unavailable. */
export const getPosition = (options = {}) =>
  new Promise((resolve) => {
    try {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000, ...options }
      );
    } catch (err) {
      resolve(null);
    }
  });

/** Continuous tracking for the GPS screen. Returns a stop() function. */
export const watchPosition = (onFix, onError, options = {}) => {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onError?.(new Error('Geolocation is not available on this device.'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (position) =>
      onFix?.({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
    (err) => onError?.(err),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000, ...options }
  );
  return () => navigator.geolocation.clearWatch(id);
};

export const formatCoords = (coords, digits = 5) =>
  coords && Number.isFinite(Number(coords.lat)) && Number.isFinite(Number(coords.lng))
    ? `${Number(coords.lat).toFixed(digits)}, ${Number(coords.lng).toFixed(digits)}`
    : 'GPS unavailable';

export const formatDistance = (meters) => {
  if (meters == null || !Number.isFinite(Number(meters))) return 'n/a';
  const m = Number(meters);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
};

export const geolocationErrorMessage = (err) => {
  const code = err?.code;
  if (code === 1) return 'Location permission denied. Enable location for this app in the browser / system settings, then retry.';
  if (code === 2) return 'Position unavailable. Move outdoors with a clear sky view and retry.';
  if (code === 3) return 'GPS timed out. Retry — the first fix after moving can take 10–20 seconds.';
  return err?.message || 'Could not read GPS. Retry or use a demo fix to continue the walkthrough.';
};
