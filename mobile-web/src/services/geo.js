/** Geolocation helper that never throws and always resolves. */
export const getPosition = (options = {}) =>
  new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
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
  });

export const formatCoords = (coords) =>
  coords ? `${Number(coords.lat).toFixed(5)}, ${Number(coords.lng).toFixed(5)}` : 'GPS unavailable';

export const formatDistance = (meters) => {
  if (meters == null) return 'n/a';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};
