/**
 * Geo-verification service.
 *
 * Problem statement 26095 asks for "geo-tagged inspection reports" and for a
 * reduction in "fake reporting and proxy functioning". The enforcement is the
 * distance between where the registered project is and where the evidence /
 * check-in actually happened.
 *
 * This module is deliberately self-contained (no AI round-trip) so a report can
 * never be blocked by an upstream failure; the AI engine can enrich the wording
 * but the verdict itself is deterministic.
 */

const EARTH_RADIUS_M = 6371000;
const DEFAULT_RADIUS_M = 250;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance between two { lat, lng } points, in metres. */
const distanceMeters = (a, b) => {
  if (!a || !b) return null;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if ([lat1, lng1, lat2, lng2].some((v) => !Number.isFinite(v))) return null;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
};

const normaliseCoords = (coords) => {
  if (!coords) return null;
  if (typeof coords === 'string') {
    // PostgreSQL POINT comes back as "(lng,lat)"
    const match = coords.match(/^\(([-\d.]+),([-\d.]+)\)$/);
    if (!match) return null;
    return { lat: Number(match[2]), lng: Number(match[1]) };
  }
  const { lat, lng } = coords;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
};

/**
 * @returns {{distance_meters:number|null, within_radius:boolean, verdict:string,
 *            severity:string, explanation:string, radius_meters:number}}
 */
const verify = (projectCoords, observedCoords, { radiusMeters = DEFAULT_RADIUS_M, label = 'observation' } = {}) => {
  const project = normaliseCoords(projectCoords);
  const observed = normaliseCoords(observedCoords);
  const radius = Number(radiusMeters) || DEFAULT_RADIUS_M;

  if (!project) {
    return {
      distance_meters: null,
      within_radius: false,
      verdict: 'unknown',
      severity: 'low',
      explanation: 'No registered coordinates for this project, so the location could not be verified.',
      radius_meters: radius,
    };
  }

  if (!observed) {
    return {
      distance_meters: null,
      within_radius: false,
      verdict: 'unknown',
      severity: 'low',
      explanation: 'No GPS coordinates were submitted with this submission, so location verification was skipped.',
      radius_meters: radius,
    };
  }

  const distance = distanceMeters(project, observed);

  if (distance <= radius) {
    return {
      distance_meters: distance,
      within_radius: true,
      verdict: 'verified',
      severity: 'low',
      explanation: `Reported within ${Math.round(distance)} m of the registered site (allowed radius ${radius} m).`,
      radius_meters: radius,
    };
  }

  if (distance <= radius * 3) {
    return {
      distance_meters: distance,
      within_radius: false,
      verdict: 'mismatch',
      severity: 'medium',
      explanation: `Reported ${(distance / 1000).toFixed(2)} km from the registered site - just outside the ${radius} m radius. Needs a supervisor check.`,
      radius_meters: radius,
    };
  }

  return {
    distance_meters: distance,
    within_radius: false,
    verdict: 'suspicious',
    severity: 'high',
    explanation: `Reported ${(distance / 1000).toFixed(2)} km away from the registered site - possible proxy or fake reporting.`,
    radius_meters: radius,
  };
};

module.exports = { distanceMeters, normaliseCoords, verify, DEFAULT_RADIUS_M };
