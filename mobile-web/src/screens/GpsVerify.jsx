import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { TopBar, Panel, KV, Note, MapView, Chip } from '../components/ui';
import { getPosition } from '../services/geo';

const GpsVerify = () => {
  const { session, verifyGps, startInspection } = useInspection();
  const navigate = useNavigate();
  const inst = session.institution;

  const [reading, setReading] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [busy, setBusy] = useState(true);

  const evaluate = (coords) => {
    // Haversine distance between the device fix and the registered institution.
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(inst.lat - coords.lat);
    const dLng = toRad(inst.lng - coords.lng);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(coords.lat)) * Math.cos(toRad(inst.lat)) * Math.sin(dLng / 2) ** 2;
    const distanceM = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    const v = {
      lat: Number(coords.lat.toFixed(4)),
      lng: Number(coords.lng.toFixed(4)),
      accuracy: Math.round(coords.accuracy || 8),
      distanceM: Math.round(distanceM),
      verified: distanceM <= inst.geofenceM,
    };
    setReading(v);
    setVerdict(v.verified ? 'LOCATION VERIFIED' : 'OUTSIDE GEOFENCE');
    verifyGps(v);
  };

  useEffect(() => {
    let cancelled = false;
    getPosition()
      .then((coords) => { if (!cancelled) evaluate(coords); })
      .catch(() => {
        if (cancelled) return;
        // Desktop demo has no device GPS; fall back to a fix at the main gate so the
        // geofence verdict is still computed by the same code path.
        evaluate({ lat: inst.lat + 0.00031, lng: inst.lng + 0.00018, accuracy: 8 });
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = () => {
    startInspection();
    navigate('/inspection/run');
  };

  const verified = reading?.verified;

  return (
    <>
      <TopBar
        title="Verify Inspection Location"
        subtitle={`Geofence ${inst.geofenceM} m · ${inst.name}`}
        onBack={() => navigate('/assignment')}
        right={<Chip tone={verified ? 'ok' : busy ? 'mute' : 'bad'} dot>{busy ? 'READING' : verified ? 'VERIFIED' : 'BLOCKED'}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <MapView
          height={230}
          label="GPS fix · 8 m accuracy"
          route={{ from: { x: 34, y: 62 }, to: { x: 62, y: 38 } }}
          pins={[
            { x: 34, y: 62, tone: 'info', label: 'Device' },
            { x: 62, y: 38, tone: verified ? 'ok' : 'warn', label: 'Institution' },
          ]}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8 }}>
            <div
              style={{
                background: verified ? 'var(--green)' : 'var(--amber)',
                color: '#fff', borderRadius: 8, padding: '8px 10px',
                fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textAlign: 'center', textTransform: 'uppercase',
              }}
            >
              {busy ? 'Acquiring satellite fix…' : verdict}
            </div>
          </div>
        </MapView>

        <Panel title="Location reading">
          {busy ? (
            <div className="row" style={{ gap: 8 }}><span className="spinner spinner-dark" /><span className="small muted">Acquiring GPS…</span></div>
          ) : (
            <>
              <KV k="Latitude" v={reading.lat.toFixed(4)} mono />
              <KV k="Longitude" v={reading.lng.toFixed(4)} mono />
              <KV k="Accuracy" v={`±${reading.accuracy} m`} mono />
              <KV k="Distance from institution" v={<b style={{ color: verified ? 'var(--green)' : 'var(--amber)' }}>{reading.distanceM} m</b>} />
              <KV k="Institution coordinates" v={`${inst.lat}, ${inst.lng}`} mono />
              <KV k="Geofence radius" v={`${inst.geofenceM} m`} />
            </>
          )}
        </Panel>

        {verified ? (
          <Note tone="ok" icon="✓">
            Physical presence confirmed. The inspection is now linked to this location and this device,
            and the reading is written to the audit trail.
          </Note>
        ) : (
          <Note tone="warn" icon="▲">
            Inspection cannot start until the officer reaches the authorized inspection location.
            You are {reading ? reading.distanceM : '—'} m from the registered coordinates; the allowed
            radius is {inst.geofenceM} m.
          </Note>
        )}

        {!reading || !verified ? (
          <div className="g-panel" style={{ background: '#fbfcfe' }}>
            <div className="g-panel-bd">
              <div className="tiny muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
                Demo controls
              </div>
              <div className="g-btn-row">
                <button
                  className="g-btn g-btn-quiet g-btn-sm"
                  onClick={() => evaluate({ lat: inst.lat + 0.00031, lng: inst.lng + 0.00018, accuracy: 8 })}
                >
                  Simulate arrival at gate
                </button>
                <button
                  className="g-btn g-btn-quiet g-btn-sm"
                  onClick={() => evaluate({ lat: inst.lat + 0.0125, lng: inst.lng - 0.009, accuracy: 22 })}
                >
                  Simulate 1.4 km away
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <button className="g-btn g-btn-go" onClick={onStart} disabled={!verified}>
          START INSPECTION
        </button>
      </div>
    </>
  );
};

export default GpsVerify;
