import { describe, it, expect } from 'vitest';
import { centerToPin, cameraToPin } from './useNearbyCenters';

describe('centerToPin', () => {
  const base = {
    id: 1,
    name: 'Anugraha Senior Citizens Home',
    location: 'Kuniyamuthur, Coimbatore',
    scheme: 'AVYAY',
    status: 'active',
    geo_coords: { lat: 11.0056, lng: 76.9283 },
    head: { name: 'Warden', phone: '+911234567890' },
    camera_count: 2,
  };

  it('maps a center row onto a pin', () => {
    const pin = centerToPin(base);
    expect(pin.lat).toBe(11.0056);
    expect(pin.lng).toBe(76.9283);
    expect(pin.tone).toBe('ok');
    expect(pin.label).toBe(base.name);
    expect(pin.hasCall).toBe(true);
  });

  it('marks flagged centers bad', () => {
    expect(centerToPin({ ...base, status: 'flagged' }).tone).toBe('bad');
  });

  it('returns null without usable coordinates', () => {
    expect(centerToPin({ ...base, geo_coords: null })).toBeNull();
    expect(centerToPin({ ...base, geo_coords: { lat: 'x', lng: 1 } })).toBeNull();
    expect(centerToPin(null)).toBeNull();
  });
});

describe('cameraToPin', () => {
  const base = {
    id: 6,
    name: 'Kavignar Entrance Gate CCTV',
    project_name: 'Kavignar Nasha Mukti Kendra (NAPDDR)',
    status: 'offline',
    online: false,
    geo_coords: { lat: 10.9821, lng: 76.9337 },
    tamper_flag: 'offline',
    anomaly_note: 'Camera Offline: Power cable disconnected',
  };

  it('marks offline cameras bad with the tamper note', () => {
    const pin = cameraToPin(base);
    expect(pin.tone).toBe('bad');
    expect(pin.description).toContain('Power cable');
  });

  it('marks online cameras info', () => {
    expect(cameraToPin({ ...base, online: true, status: 'online', tamper_flag: 'normal', anomaly_note: '' }).tone).toBe('info');
  });

  it('returns null without usable coordinates', () => {
    expect(cameraToPin({ ...base, geo_coords: {} })).toBeNull();
  });
});
