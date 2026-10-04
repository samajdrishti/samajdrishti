import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { useLanguage } from '../context/LanguageContext';
import { TopBar, Panel, KV, Note, MapView, Chip } from '../components/ui';
import { getPosition, watchPosition, evaluateGpsFix, geolocationErrorMessage, formatCoords, haversineDistanceM } from '../services/geo';
import { useNearbyCenters, useCameraPins, centerToPin, cameraToPin } from '../hooks/useNearbyCenters';

const DEMO_AT_GATE = (inst) => ({ lat: inst.lat + 0.00031, lng: inst.lng + 0.00018, accuracy: 8 });
const DEMO_FAR = (inst) => ({ lat: inst.lat + 0.0125, lng: inst.lng - 0.009, accuracy: 22 });
// If the device hasn't produced any fix (success or error) within this long,
// fall back to the gate demo fix so the officer is never stuck on "— m".
const FIRST_FIX_TIMEOUT_MS = 15000;

const GpsVerify = () => {
  const { session, online, verifyGps, startInspection } = useInspection();
  const { t } = useLanguage();
  const { centers } = useNearbyCenters(online);
  const { cameras } = useCameraPins(online);
  const navigate = useNavigate();
  const inst = session.institution;

  const [reading, setReading] = useState(() => session.gps ?? null);
  const [verdict, setVerdict] = useState(() => (session.gps?.verified ? 'LOCATION VERIFIED' : null));
  const [busy, setBusy] = useState(!session.gps);
  const [demoFallback, setDemoFallback] = useState(false);
  const [showCenters, setShowCenters] = useState(true);
  const [showCameras, setShowCameras] = useState(true);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const stopWatch = useRef(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; stopWatch.current?.(); }, []);

  const evaluate = useCallback((coords, source = 'gps') => {
    const v = evaluateGpsFix(coords, inst);
    if (!v) {
      if (mounted.current) {
        setError('That fix had no usable coordinates. Retry or use a demo fix.');
        setBusy(false);
      }
      return null;
    }
    if (mounted.current) {
      setReading(v);
      setVerdict(v.verified ? 'LOCATION VERIFIED' : 'OUTSIDE GEOFENCE');
      setError('');
      setBusy(false);
      setDemoFallback(source.startsWith('demo'));
    }
    verifyGps({ ...v, source });
    return v;
  }, [inst, verifyGps]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    const coords = await getPosition();
    if (!mounted.current) return;
    if (!coords) {
      setBusy(false);
      setError('No GPS fix yet. Check permission and sky view, then retry — or use a demo fix below.');
      return;
    }
    evaluate(coords);
  }, [evaluate]);

  useEffect(() => {
    if (session.gps) return; // restored session already has a reading
    let cancelled = false;
    let settled = false;
    const timer = setTimeout(() => {
      if (cancelled || settled || !mounted.current) return;
      settled = true;
      evaluate(DEMO_AT_GATE(inst), 'demo-timeout'); // hanging GPS (no success AND no error)
      if (mounted.current) setError('GPS took too long — showing a demo gate position. Tap RETRY GPS for a live fix.');
    }, FIRST_FIX_TIMEOUT_MS);
    getPosition().then((coords) => {
      if (cancelled || settled || !mounted.current) return;
      settled = true;
      clearTimeout(timer);
      if (coords) evaluate(coords, 'gps');
      else evaluate(DEMO_AT_GATE(inst), 'demo-fallback'); // desktop demo: same code path, gate fix
    }).finally(() => { if (!cancelled && mounted.current) setBusy(false); });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [evaluate, inst, session.gps]);

  const toggleTracking = () => {
    if (tracking) {
      stopWatch.current?.();
      stopWatch.current = null;
      setTracking(false);
      return;
    }
    setError('');
    stopWatch.current = watchPosition(
      (coords) => evaluate(coords, 'watch'),
      (err) => { if (mounted.current) setError(geolocationErrorMessage(err)); },
    );
    setTracking(true);
  };

  const onStart = () => {
    startInspection();
    navigate('/inspection/run');
  };

  const verified = reading?.verified;

  const otherPins = centers
    .map(centerToPin)
    .filter(Boolean)
    .filter((p) => haversineDistanceM(p, { lat: inst.lat, lng: inst.lng }) > 150);
  const cameraPins = cameras.map(cameraToPin).filter(Boolean);
  const devicePt = reading ? { lat: reading.lat, lng: reading.lng } : null;

  return (
    <>
      <TopBar
        title="Verify Inspection Location"
        subtitle={`Geofence ${inst.geofenceM} m · ${inst.name}`}
        onBack={() => navigate('/assignment')}
        right={<Chip tone={verified ? 'ok' : busy ? 'mute' : 'bad'} dot>{busy ? t('gps.reading') : verified ? t('gps.verified') : t('gps.blocked')}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div className="g-filter-row" role="group" aria-label="Map layers">
          <button type="button" className={`g-filter ${showCenters ? 'on' : ''}`} onClick={() => setShowCenters((v) => !v)} aria-pressed={showCenters}>
            Centers ({otherPins.length})
          </button>
          <button type="button" className={`g-filter ${showCameras ? 'on' : ''}`} onClick={() => setShowCameras((v) => !v)} aria-pressed={showCameras}>
            Cameras ({cameraPins.length})
          </button>
        </div>
        <MapView
          height={250}
          label={reading ? `GPS fix · ${reading.accuracy} m accuracy${demoFallback ? ' · demo' : ''}` : 'OpenStreetMap'}
          route={devicePt ? { from: devicePt, to: { lat: inst.lat, lng: inst.lng } } : null}
          fit={devicePt ? [devicePt, { lat: inst.lat, lng: inst.lng }] : [{ lat: inst.lat, lng: inst.lng }]}
          pins={[
            ...(devicePt ? [{ ...devicePt, tone: 'info', label: 'Device' }] : []),
            {
              lat: inst.lat,
              lng: inst.lng,
              tone: verified ? 'ok' : 'warn',
              label: inst.name || 'Institution',
              popupContent: `${inst.scheme} · ${inst.type}`,
              scheme: inst.scheme || 'SIPDA · NAPDDR · AVYAY',
              description: 'Senior Citizens (AVYAY) · De-Addiction (NAPDDR) · PwD Skills (SIPDA)',
              hasCall: true,
              hasVideo: true,
              phone: '+919843322140',
              videoUrl: 'https://meet.jit.si/samaj-drishti-vc'
            },
            ...(showCenters ? otherPins : []),
            ...(showCameras ? cameraPins : []),
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

        <Panel title="Location reading" aside={demoFallback ? <Chip tone="warn">DEMO POSITION</Chip> : reading ? <span className="g-mono tiny">{formatCoords(reading)}</span> : null}>
          {busy && !reading ? (
            <div className="row" style={{ gap: 8 }}><span className="spinner spinner-dark" aria-hidden="true" /><span className="small muted">Acquiring GPS…</span></div>
          ) : reading ? (
            <>
              <KV k="Latitude" v={reading.lat.toFixed(6)} mono />
              <KV k="Longitude" v={reading.lng.toFixed(6)} mono />
              <KV k="Accuracy" v={`±${reading.accuracy} m`} mono />
              <KV k="Distance from institution" v={<b style={{ color: verified ? 'var(--green)' : 'var(--amber)' }}>{reading.distanceM} m</b>} />
              <KV k="Bearing to site" v={reading.bearing != null ? `${reading.compass} · ${reading.bearing}°` : '—'} />
              <KV k="Institution coordinates" v={`${inst.lat}, ${inst.lng}`} mono />
              <KV k="Geofence radius" v={`${inst.geofenceM} m`} />
            </>
          ) : (
            <div className="small muted">No fix yet — retry below or use a demo fix.</div>
          )}
        </Panel>

        {error ? <Note tone="bad" icon="!">{error}</Note> : null}

        <div className="g-btn-row">
          <button type="button" className="g-btn g-btn-quiet" onClick={refresh} disabled={busy}>
            {busy ? t('gps.reading') : `↻ ${t('gps.retry')}`}
          </button>
          <button type="button" className="g-btn g-btn-quiet" onClick={toggleTracking} aria-pressed={tracking}>
            {tracking ? `■ ${t('gps.stopTracking')}` : `◎ ${t('gps.tracking')}`}
          </button>
        </div>

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
            {reading?.compass && (
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(217, 119, 6, 0.1)', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>
                🧭 Navigation: Head <b>{reading.compass}</b> ({reading.bearing}°) towards the institution.
              </div>
            )}
          </Note>
        )}

        {!verified ? (
          <div className="g-panel" style={{ background: 'var(--card-hd)' }}>
            <div className="g-panel-bd">
              <div className="tiny muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
                Demo controls · walkthrough only
              </div>
              <div className="g-btn-row">
                <button
                  type="button"
                  className="g-btn g-btn-quiet g-btn-sm"
                  onClick={() => evaluate(DEMO_AT_GATE(inst), 'demo')}
                >
                  Simulate arrival at gate
                </button>
                <button
                  type="button"
                  className="g-btn g-btn-quiet g-btn-sm"
                  onClick={() => evaluate(DEMO_FAR(inst), 'demo')}
                >
                  Simulate 1.4 km away
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <button className="g-btn g-btn-go" onClick={onStart} disabled={!verified}>
          {t('gps.start')}
        </button>
      </div>
    </>
  );
};

export default GpsVerify;
