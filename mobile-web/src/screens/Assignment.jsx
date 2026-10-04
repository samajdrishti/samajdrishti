import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { useLanguage } from '../context/LanguageContext';
import { TopBar, Panel, KV, Note, MapView, Chip, StatusChip } from '../components/ui';
import { useNearbyCenters, useCameraPins, centerToPin, cameraToPin } from '../hooks/useNearbyCenters';
import { haversineDistanceM } from '../services/geo';

const Assignment = () => {
  const { session, online, accept } = useInspection();
  const { t } = useLanguage();
  const { centers } = useNearbyCenters(online);
  const { cameras } = useCameraPins(online);
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(false);
  const [showCenters, setShowCenters] = React.useState(true);
  const [showCameras, setShowCameras] = React.useState(true);
  const s = session;
  const inst = s.institution;
  const accepted = s.status !== 'assigned';
  // Planning position: the live GPS fix when we have one, otherwise a point
  // ~1 km south-west of the institution so the route preview still draws.
  const you =
    Number.isFinite(Number(s.gps?.lat)) && Number.isFinite(Number(s.gps?.lng))
      ? { lat: Number(s.gps.lat), lng: Number(s.gps.lng) }
      : { lat: inst.lat - 0.006, lng: inst.lng - 0.007 };

  // Every other monitored NGO / departmental home, excluding this assignment
  // (same site within 150 m) and rows without coordinates.
  const otherPins = centers
    .map(centerToPin)
    .filter(Boolean)
    .filter((p) => haversineDistanceM(p, { lat: inst.lat, lng: inst.lng }) > 150);

  const cameraPins = cameras.map(cameraToPin).filter(Boolean);

  const onAccept = () => {
    if (busy || accepted) return;
    setBusy(true);
    try {
      accept();
    } finally {
      navigate('/gps');
    }
  };

  return (
    <>
      <TopBar
        title="New Inspection Assigned"
        subtitle={`${s.inspectionId} · ${s.assignmentId}`}
        onBack={() => navigate('/')}
        right={<Chip tone={s.priority === 'High' ? 'bad' : 'warn'}>{s.priority} priority</Chip>}
      />

      <div style={{ height: 2, background: 'var(--info)' }} />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div className="g-inst">
          <div className="g-inst-top">
            <div className="g-inst-ic">🏛️</div>
            <div className="grow">
              <div className="g-inst-n">{inst.name}</div>
              <div className="g-inst-s">{inst.type}</div>
            </div>
          </div>
          <div className="divider" />
          <KV k="District" v={`${inst.district}, ${inst.state}`} />
          <KV k="Scheme" v={inst.scheme} />
          <KV k="Distance from you" v={`${s.distanceKm} km`} />
          <KV k="Assignment type" v={<span style={{ color: 'var(--info)' }}>AI Random Assignment</span>} />
          <KV k="Inspection type" v={s.inspectionType} />
          <KV k="Priority" v={<StatusChip status={s.priority} />} />
          <KV k="Assignment ID" v={s.assignmentId} mono />
          <KV k="Assigned at" v={new Date(s.assignedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} />
          <KV k="Status" v={<StatusChip status={s.status} />} />
        </div>

        <Panel title="Route preview" pad={false}>
          <div style={{ padding: 12 }}>
            <div className="g-filter-row" style={{ marginBottom: 8 }} role="group" aria-label="Map layers">
              <button type="button" className={`g-filter ${showCenters ? 'on' : ''}`} onClick={() => setShowCenters((v) => !v)} aria-pressed={showCenters}>
                Centers ({otherPins.length})
              </button>
              <button type="button" className={`g-filter ${showCameras ? 'on' : ''}`} onClick={() => setShowCameras((v) => !v)} aria-pressed={showCameras}>
                Cameras ({cameraPins.length})
              </button>
            </div>
            <MapView
              height={220}
              label="OpenStreetMap"
              fitKey={`${otherPins.length}:${cameraPins.length}`}
              route={{ from: you, to: { lat: inst.lat, lng: inst.lng } }}
              pins={[
                { ...you, tone: 'info', label: 'You' },
                {
                  lat: inst.lat,
                  lng: inst.lng,
                  tone: 'warn',
                  label: inst.name || 'Target',
                  popupContent: `${inst.type} · ${inst.scheme}`,
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
            />
            <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
              Route is computed for planning only. The inspection cannot be started until your device is
              physically inside the {inst.geofenceM} m geofence of the institution.
              {otherPins.length || cameraPins.length ? (
                <> Tap any pin for details — {otherPins.length} monitored center(s), {cameraPins.length} camera(s) in view.</>
              ) : null}
            </div>
          </div>
        </Panel>

        <Note tone="info" icon="i">
          Inspection assigned automatically using randomized duty allocation to reduce predictable
          inspection patterns. You cannot choose or swap this assignment.
        </Note>

        <div className="g-btn-row">
          <button type="button" className="g-btn g-btn-quiet" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${inst.lat},${inst.lng}`, '_blank', 'noopener')}>
            🧭 {t('assign.navigate')}
          </button>
          <button className="g-btn g-btn-go" onClick={onAccept} disabled={accepted || busy}>
            {busy || accepted ? t('assign.accepted') : t('assign.accept')}
          </button>
        </div>
      </div>
    </>
  );
};

export default Assignment;
