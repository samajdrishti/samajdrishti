import { describe, it, expect } from 'vitest';
import {
  haversineDistanceM,
  bearingDeg,
  compass16,
  evaluateGpsFix,
  formatCoords,
  formatDistance,
  toRad,
} from './geo';

const CBE = { lat: 11.0168, lng: 76.9558 };
const INST = { ...CBE, geofenceM: 120 };

describe('toRad', () => {
  it('converts degrees to radians', () => {
    expect(toRad(180)).toBeCloseTo(Math.PI, 10);
    expect(toRad(0)).toBe(0);
  });
});

describe('haversineDistanceM', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineDistanceM(CBE, CBE)).toBeCloseTo(0, 6);
  });

  it(' gate offset (~39 m) matches the demo expectation', () => {
    const d = haversineDistanceM({ lat: CBE.lat + 0.00031, lng: CBE.lng + 0.00018 }, CBE);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(60);
  });

  it('1.4 km demo offset reads in kilometres', () => {
    const d = haversineDistanceM({ lat: CBE.lat + 0.0125, lng: CBE.lng - 0.009 }, CBE);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(2200);
  });

  it('returns NaN on bad input instead of throwing', () => {
    expect(haversineDistanceM(null, CBE)).toBeNaN();
    expect(haversineDistanceM({ lat: 'x', lng: 1 }, CBE)).toBeNaN();
  });
});

describe('bearingDeg / compass16', () => {
  it('returns a 0-360 bearing', () => {
    const b = bearingDeg({ lat: 11.02, lng: 76.94 }, CBE);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('maps bearings to 16-wind compass points', () => {
    expect(compass16(0)).toBe('N');
    expect(compass16(90)).toBe('E');
    expect(compass16(180)).toBe('S');
    expect(compass16(270)).toBe('W');
    expect(compass16(null)).toBe('—');
  });
});

describe('evaluateGpsFix', () => {
  it('verifies a fix at the gate', () => {
    const v = evaluateGpsFix({ lat: CBE.lat + 0.00031, lng: CBE.lng + 0.00018, accuracy: 8 }, INST);
    expect(v.verified).toBe(true);
    expect(v.distanceM).toBeLessThanOrEqual(120);
  });

  it('blocks a fix 1.4 km away', () => {
    const v = evaluateGpsFix({ lat: CBE.lat + 0.0125, lng: CBE.lng - 0.009, accuracy: 22 }, INST);
    expect(v.verified).toBe(false);
    expect(v.distanceM).toBeGreaterThan(120);
  });

  it('returns null on bad input instead of throwing', () => {
    expect(evaluateGpsFix(null, INST)).toBeNull();
    expect(evaluateGpsFix({ lat: NaN, lng: 1 }, INST)).toBeNull();
    expect(evaluateGpsFix({ lat: 1, lng: 1 }, null)).toBeNull();
  });
});

describe('formatters', () => {
  it('formatCoords prints fixed decimals', () => {
    expect(formatCoords(CBE)).toBe('11.01680, 76.95580');
    expect(formatCoords(null)).toBe('GPS unavailable');
  });

  it('formatDistance switches units at 1 km', () => {
    expect(formatDistance(39)).toBe('39 m');
    expect(formatDistance(1400)).toBe('1.40 km');
    expect(formatDistance(null)).toBe('n/a');
  });
});
