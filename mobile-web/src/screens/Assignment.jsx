import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { TopBar, Panel, KV, Note, MapView, Chip, StatusChip } from '../components/ui';

const Assignment = () => {
  const { session, accept } = useInspection();
  const navigate = useNavigate();
  const s = session;
  const inst = s.institution;
  const accepted = s.status !== 'assigned';

  const onAccept = () => {
    accept();
    navigate('/gps');
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
            <MapView
              height={180}
              label="Coimbatore · offline base layer"
              route={{ from: { x: 22, y: 68 }, to: { x: 66, y: 34 } }}
              pins={[
                { x: 22, y: 68, tone: 'info', label: 'You' },
                { x: 66, y: 34, tone: 'warn', label: 'Target' },
              ]}
            />
            <div className="tiny muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
              Route is computed for planning only. The inspection cannot be started until your device is
              physically inside the {inst.geofenceM} m geofence of the institution.
            </div>
          </div>
        </Panel>

        <Note tone="info" icon="i">
          Inspection assigned automatically using randomized duty allocation to reduce predictable
          inspection patterns. You cannot choose or swap this assignment.
        </Note>

        <div className="g-btn-row">
          <button className="g-btn g-btn-quiet" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${inst.lat},${inst.lng}`, '_blank')}>
            🧭 NAVIGATE
          </button>
          <button className="g-btn g-btn-go" onClick={onAccept} disabled={accepted}>
            {accepted ? 'ACCEPTED ✓' : 'ACCEPT INSPECTION'}
          </button>
        </div>
      </div>
    </>
  );
};

export default Assignment;
