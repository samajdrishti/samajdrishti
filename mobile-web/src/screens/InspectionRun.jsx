import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { TopBar, Panel, KV, Steps, Chip, StatusChip, SectionTitle, Bar } from '../components/ui';

const fmtClock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

const InspectionRun = () => {
  const { session, online, checklistDone, checklistTotal, durationMin, overallPct } = useInspection();
  const navigate = useNavigate();
  const s = session;
  const inst = s.institution;
  const vcDone = s.vc.status === 'ended';
  const hasEvidence = s.evidence.length > 0;
  const aiDone = s.ai.length > 0;
  const beneDone = s.beneficiary.status === 'completed';

  const steps = [
    { title: 'Location', state: 'done', detail: `GPS verified · ${s.gps ? `${s.gps.distanceM} m from gate` : ''}` },
    { title: 'Identity', state: 'done', detail: `${inst.incharge}` },
    { title: 'Live VC', state: vcDone ? 'done' : s.vc.status === 'active' ? 'active' : 'todo', detail: vcDone ? 'Completed and recorded' : s.vc.status === 'active' ? 'Call in progress' : 'Random video check pending' },
    { title: 'Beneficiaries', state: beneDone ? 'done' : s.beneficiary.status === 'active' ? 'active' : 'todo', detail: beneDone ? 'Sample verified & signed' : `${s.beneficiary.selected.length || 0} sampled` },
    { title: 'Evidence', state: hasEvidence ? 'done' : 'todo', detail: `${s.evidence.length} items captured` },
    { title: 'Checklist', state: checklistDone === checklistTotal ? 'done' : checklistDone ? 'active' : 'todo', detail: `${checklistDone} / ${checklistTotal} checks completed` },
    { title: 'AI analysis', state: aiDone ? 'done' : 'todo', detail: aiDone ? `${s.ai.length} indicators raised` : 'Runs after checklist' },
    { title: 'Submit', state: s.status === 'submitted' ? 'done' : 'todo', detail: s.status === 'submitted' ? s.reportId : 'Secure report submission' },
  ];

  const actions = [
    { to: '/vc', icon: '🎥', label: 'Random video check', sub: vcDone ? 'Completed' : s.vc.status === 'active' ? 'Live now' : 'Not started', tone: s.vc.status === 'active' ? 'ok' : 'mute' },
    { to: '/beneficiary', icon: '🧑', label: 'Beneficiary verification', sub: beneDone ? 'Verified & signed' : s.beneficiary.status === 'active' ? 'In progress' : 'Random sample', tone: beneDone ? 'ok' : 'mute' },
    { to: '/evidence/capture', icon: '📷', label: 'Capture evidence', sub: `${s.evidence.length} items`, tone: 'mute' },
    { to: '/checklist', icon: '☑️', label: 'Inspection checklist', sub: `${checklistDone}/${checklistTotal}`, tone: checklistDone ? 'ok' : 'mute' },
    { to: '/ai', icon: '🤖', label: 'Attendance & AI analysis', sub: aiDone ? `${s.ai.length} indicators` : 'Pending', tone: aiDone ? 'warn' : 'mute' },
    { to: '/inspection/summary', icon: '📋', label: 'Inspection summary', sub: `${durationMin} min`, tone: 'mute' },
  ];

  return (
    <>
      <TopBar
        title="Inspection in Progress"
        subtitle={`${s.inspectionId} · ${inst.name}`}
        onBack={() => navigate('/')}
        right={<StatusChip status="in_progress" />}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Panel title="Inspection overview">
          <KV k="Institution" v={inst.name} />
          <KV k="Type" v={s.inspectionType} />
          <KV k="Inspection ID" v={s.inspectionId} mono />
          <KV k="Start time" v={fmtClock(s.startedAt)} mono />
          <KV k="Duration" v={`${durationMin} min`} />
          <KV k="Officer" v={`${s.officer.name} · ${s.officer.id}`} />
          <div className="divider" />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Chip tone={s.gps?.verified ? 'ok' : 'mute'} dot>GPS {s.gps?.verified ? 'VERIFIED' : 'NOT VERIFIED'}</Chip>
            <Chip tone={online ? 'ok' : 'bad'} dot>{online ? 'NETWORK OK' : 'OFFLINE'}</Chip>
            <Chip tone={s.vc.status === 'active' ? 'info' : 'mute'} dot>
              VC {s.vc.status === 'active' ? 'ACTIVE' : s.vc.status === 'ended' ? 'COMPLETED' : 'NOT STARTED'}
            </Chip>
          </div>
        </Panel>

        <Panel title="Progress">
          <div className="row tiny muted" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span>Overall completion</span>
            <b style={{ color: 'var(--ink)' }}>
              {overallPct}%
            </b>
          </div>
          <Bar pct={overallPct} />
          <div className="divider" />
          <Steps steps={steps} />
        </Panel>

        <button className="g-btn g-btn-primary" onClick={() => navigate('/vc')}>
          🎥 &nbsp;START RANDOM VIDEO CHECK
        </button>

        <SectionTitle>Inspection modules</SectionTitle>
        <div className="g-panel">
          {actions.map((a) => (
            <button
              key={a.to}
              className="g-list-row"
              onClick={() => navigate(a.to)}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--line-soft)' }}
            >
              <div className="g-avatar" style={{ background: 'var(--info-bg)', color: 'var(--info-ink)' }}>{a.icon}</div>
              <div className="grow">
                <div className="g-h3">{a.label}</div>
                <div className="tiny muted">{a.sub}</div>
              </div>
              <span className="muted" style={{ fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default InspectionRun;
