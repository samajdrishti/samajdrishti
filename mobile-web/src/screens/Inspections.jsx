import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { SectionTitle, Panel, StatusChip, Chip, Bar, FilterRow, Empty } from '../components/ui';

const HISTORY = [
  { id: 'INS-2026-00431', name: 'Special Training Centre · Tiruppur', date: 'Yesterday', status: 'submitted', score: 92, findings: 0, type: 'Routine' },
  { id: 'INS-2026-00418', name: 'Women Hostel · Salem', date: '28 Sep 2026', status: 'submitted', score: 74, findings: 2, type: 'Surprise' },
  { id: 'INS-2026-00399', name: 'Special Model School · Erode', date: '26 Sep 2026', status: 'submitted', score: 88, findings: 1, type: 'Routine' },
];

const GROUPS = ['Live', 'Pending', 'Completed'];

const Inspections = () => {
  const { session, checklistDone } = useInspection();
  const navigate = useNavigate();
  const [group, setGroup] = React.useState('Live');

  const s = session;
  const live = s.status !== 'submitted' && s.status !== 'assigned';

  return (
    <>
      <SectionTitle aside={`${HISTORY.length + 1} total`}>Inspections</SectionTitle>

      <FilterRow options={GROUPS} value={group} onChange={setGroup} />

      {group === 'Live' ? (
        live ? (
          <div className="g-inst">
            <div className="g-inst-top">
              <div className="g-inst-ic" style={{ background: 'var(--green-bg)', color: 'var(--green-ink)' }}>🔴</div>
              <div className="grow">
                <div className="g-inst-n">{s.institution.name}</div>
                <div className="g-inst-s">{s.inspectionType} · {s.institution.district}</div>
              </div>
              <StatusChip status="in_progress" />
            </div>
            <div className="divider" />
            <div className="row tiny muted" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
              <span>Progress</span>
              <b style={{ color: 'var(--ink)' }}>{checklistDone}/24 · {s.evidence.length} evidence</b>
            </div>
            <Bar pct={(checklistDone / 24) * 100} tone="info" />
            <div className="row" style={{ gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
              <Chip tone={s.gps?.verified ? 'ok' : 'mute'} dot>GPS {s.gps?.verified ? 'VERIFIED' : 'PENDING'}</Chip>
              <Chip tone={s.vc.status === 'ended' ? 'ok' : 'mute'} dot>VC {s.vc.status === 'ended' ? 'DONE' : 'PENDING'}</Chip>
              <Chip tone={s.ai.length ? 'warn' : 'mute'} dot>AI {s.ai.length || '—'}</Chip>
            </div>
            <button className="g-btn g-btn-primary mt" onClick={() => navigate('/inspection/run')}>
              RESUME INSPECTION
            </button>
          </div>
        ) : (
          <Panel>
            <Empty icon="📋" title="No inspection running" desc="Accept your randomised assignment to start the next surprise inspection." />
            <button className="g-btn g-btn-primary" onClick={() => navigate('/assignment')}>OPEN ASSIGNMENT</button>
          </Panel>
        )
      ) : null}

      {group === 'Pending' ? (
        <div className="g-inst">
          <div className="g-inst-top">
            <div className="g-inst-ic">🎲</div>
            <div className="grow">
              <div className="g-inst-n">{s.institution.name}</div>
              <div className="g-inst-s">{s.institution.type}</div>
            </div>
            <StatusChip status="assigned" />
          </div>
          <div className="divider" />
          <div className="small muted" style={{ marginBottom: 10 }}>
            {s.institution.district} District · {s.distanceKm} km · {s.inspectionType}
          </div>
          <button className="g-btn g-btn-go" onClick={() => navigate('/assignment')}>OPEN ASSIGNMENT</button>
        </div>
      ) : null}

      {group === 'Completed' ? (
        <Panel pad={false}>
          <div className="g-panel-bd">
            {HISTORY.map((h) => (
              <button
                key={h.id}
                type="button"
                className="g-list-row"
                onClick={() => navigate('/inspection/summary')}
                style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)' }}
              >
                <div className="g-avatar" style={{ background: 'var(--green-bg)', color: 'var(--green-ink)' }}>✓</div>
                <div className="grow">
                  <div className="g-h3">{h.name}</div>
                  <div className="tiny muted">{h.id} · {h.date} · {h.type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="g-h3" style={{ color: h.score < 80 ? 'var(--amber)' : 'var(--green)' }}>{h.score}%</div>
                  <div className="tiny muted">{h.findings} finding(s)</div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}
    </>
  );
};

export default Inspections;
