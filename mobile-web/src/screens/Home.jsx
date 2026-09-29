import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInspection } from '../context/InspectionContext';
import { Panel, SectionTitle, Kpis, StatusChip, Chip, Note, Bar, KV } from '../components/ui';

const LIVE = { cctvOnline: 18, cctvOffline: 3, anomalies: 5 };

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const Home = () => {
  const { user } = useAuth();
  const { session, online, checklistDone, criticalCount, pendingEvidence } = useInspection();
  const navigate = useNavigate();

  const assigned = 4;
  const completed = session.status === 'submitted' ? 3 : 2;
  const pending = assigned - completed;
  const inProgress = session.status === 'in_progress';
  const inst = session.institution;
  const officerName = user?.name || session.officer.name;

  return (
    <>
      <Panel
        title="Today"
        aside={<span className="g-sec-aside">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
      >
        <Kpis
          items={[
            { label: 'Assigned', value: assigned },
            { label: 'Completed', value: completed, tone: 'ok' },
            { label: 'Pending', value: pending, tone: 'warn' },
          ]}
        />
        <div className="divider" />
        <div className="g-kpis">
          <div className="g-kpi bad">
            <div className="g-kpi-n">1</div>
            <div className="g-kpi-l">High priority</div>
          </div>
          <div className="g-kpi warn">
            <div className="g-kpi-n">3</div>
            <div className="g-kpi-l">Medium</div>
          </div>
          <div className="g-kpi info">
            <div className="g-kpi-n">2</div>
            <div className="g-kpi-l">New since 07:00</div>
          </div>
        </div>
      </Panel>

      {online ? null : (
        <Note tone="warn" icon="⚠">
          <b>OFFLINE MODE</b> — work is being stored on this device and will sync automatically. {pendingEvidence} evidence item{pendingEvidence === 1 ? '' : 's'} waiting.
        </Note>
      )}

      <button className="g-btn g-btn-primary" onClick={() => navigate('/assignment')} style={{ minHeight: 54 }}>
        ▶ &nbsp;START INSPECTION
      </button>

      <SectionTitle aside={session.status !== 'assigned' ? <StatusChip status={session.status} /> : null}>
        Upcoming inspection
      </SectionTitle>

      <div className="g-inst">
        <div className="g-inst-top">
          <div className="g-inst-ic">🏛️</div>
          <div className="grow">
            <div className="g-inst-n">{inst.name}</div>
            <div className="g-inst-s">{inst.type}</div>
          </div>
        </div>
        <div className="divider" />
        <KV k="Location" v={`${inst.district} District, ${inst.state}`} />
        <KV k="Scheduled" v="Today · Surprise Inspection" />
        <KV k="Assignment" v={<span style={{ color: 'var(--info)' }}>AI Random Assignment</span>} />
        <KV k="Assignment ID" v={session.assignmentId} mono />
        <KV k="Status" v={<StatusChip status={session.status} />} />
        {inProgress ? (
          <div className="mt">
            <div className="row tiny muted" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
              <span>Inspection in progress</span>
              <span>{checklistDone}/24 checklist · {session.evidence.length} evidence</span>
            </div>
            <Bar pct={(checklistDone / 24) * 100} tone="info" />
          </div>
        ) : null}
        <button
          className="g-btn g-btn-primary mt"
          onClick={() => navigate(inProgress ? '/inspection/run' : '/assignment')}
        >
          {inProgress ? 'RESUME INSPECTION' : 'OPEN ASSIGNMENT'}
        </button>
      </div>

      {session.status === 'submitted' ? (
        <Note tone="ok" icon="✓">
          Report <b>{session.reportId}</b> submitted and synced with the Central Monitoring System.
          {criticalCount ? ` ${criticalCount} critical finding awaits review.` : ''}
        </Note>
      ) : null}

      <SectionTitle>Live monitoring</SectionTitle>
      <Panel>
        <Kpis
          items={[
            { label: 'CCTV online', value: LIVE.cctvOnline, tone: 'ok' },
            { label: 'CCTV offline', value: LIVE.cctvOffline, tone: 'bad' },
            { label: 'Anomalies', value: LIVE.anomalies, tone: 'warn' },
          ]}
        />
        <div className="divider" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="grow">
            <div className="g-h3">{officerName}</div>
            <div className="tiny muted">{session.officer.rank} · {session.officer.division}</div>
          </div>
          <div className="row" style={{ gap: 5 }}>
            <Chip tone={session.gps?.verified ? 'ok' : 'mute'} dot>{session.gps?.verified ? 'GPS ✓' : 'GPS —'}</Chip>
            <Chip tone={online ? 'ok' : 'bad'} dot>{online ? 'Network ✓' : 'Offline'}</Chip>
          </div>
        </div>
        <div className="divider" />
        <div className="row tiny muted" style={{ justifyContent: 'space-between' }}>
          <span>Last sync</span>
          <b style={{ color: 'var(--ink)' }}>
            {session.syncState === 'synced' ? 'Today, 09:12 · Central Monitoring System' : 'Not synced — queued locally'}
          </b>
        </div>
        <button className="g-btn g-btn-quiet g-btn-sm mt" onClick={() => navigate('/monitoring')}>
          Open CCTV wall
        </button>
      </Panel>
    </>
  );
};

export default Home;
