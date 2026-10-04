import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useInspection } from '../context/InspectionContext';
import { Panel, SectionTitle, Kpis, StatusChip, Chip, Note, Bar, KV } from '../components/ui';

const LIVE = { cctvOnline: 18, cctvOffline: 3, anomalies: 5 };

const Home = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { session, online, checklistDone, checklistTotal, criticalCount, pendingEvidence, overallPct } = useInspection();
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
        title={t('home.today')}
        aside={<span className="g-sec-aside">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
      >
        <Kpis
          items={[
            { label: t('home.assigned'), value: assigned },
            { label: t('home.completed'), value: completed, tone: 'ok' },
            { label: t('home.pending'), value: pending, tone: 'warn' },
          ]}
        />
        <div className="divider" />
        <div className="g-kpis">
          <div className="g-kpi bad">
            <div className="g-kpi-n">1</div>
            <div className="g-kpi-l">{t('home.high')}</div>
          </div>
          <div className="g-kpi warn">
            <div className="g-kpi-n">3</div>
            <div className="g-kpi-l">{t('home.medium')}</div>
          </div>
          <div className="g-kpi info">
            <div className="g-kpi-n">2</div>
            <div className="g-kpi-l">{t('home.new')}</div>
          </div>
        </div>
      </Panel>

      {online ? null : (
        <Note tone="warn" icon="⚠">
          <b>OFFLINE MODE</b> — work is being stored on this device and will sync automatically. {pendingEvidence} evidence item{pendingEvidence === 1 ? '' : 's'} waiting.
        </Note>
      )}

      <button className="g-btn g-btn-primary" onClick={() => navigate('/assignment')} style={{ minHeight: 54 }}>
        ▶ &nbsp;{t('home.start')}
      </button>

      <SectionTitle aside={session.status !== 'assigned' ? <StatusChip status={session.status} /> : null}>
        {t('home.upcoming')}
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
              <span>{checklistDone}/{checklistTotal} checklist · {session.evidence.length} evidence · {overallPct}%</span>
            </div>
            <Bar pct={overallPct} tone="info" />
          </div>
        ) : null}
        <button
          className="g-btn g-btn-primary mt"
          onClick={() => navigate(inProgress ? '/inspection/run' : '/assignment')}
        >
          {inProgress ? t('home.resume') : t('home.open')}
        </button>
      </div>

      {session.status === 'submitted' ? (
        <Note tone="ok" icon="✓">
          Report <b>{session.reportId}</b> submitted and synced with the Central Monitoring System.
          {criticalCount ? ` ${criticalCount} critical finding awaits review.` : ''}
        </Note>
      ) : null}

      <SectionTitle>{t('home.live')}</SectionTitle>
      <Panel>
        <Kpis
          items={[
            { label: t('home.cctvOn'), value: LIVE.cctvOnline, tone: 'ok' },
            { label: t('home.cctvOff'), value: LIVE.cctvOffline, tone: 'bad' },
            { label: t('home.anomalies'), value: LIVE.anomalies, tone: 'warn' },
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
            <Chip tone={session.ai.length ? 'warn' : 'mute'} dot>AI {session.ai.length || '—'}</Chip>
          </div>
        </div>
        <div className="divider" />
        <div className="row tiny muted" style={{ justifyContent: 'space-between' }}>
          <span>{t('home.lastSync')}</span>
          <b style={{ color: 'var(--ink)' }}>
            {session.syncState === 'synced' ? 'Today, 09:12 · Central Monitoring System' : 'Not synced — queued locally'}
          </b>
        </div>
        <button className="g-btn g-btn-quiet g-btn-sm mt" onClick={() => navigate('/monitoring')}>
          {t('home.openCctv')}
        </button>
      </Panel>

      <SectionTitle>{t('home.tools')}</SectionTitle>
      <Panel pad={false}>
        <div className="g-panel-bd">
          <button type="button" className="g-list-row" onClick={() => navigate('/attendance')} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
            <div className="g-avatar sm" style={{ background: 'var(--info-bg)', color: 'var(--info-ink)' }} aria-hidden="true">🕒</div>
            <div className="grow">
              <div className="g-h3">{t('home.attendance')}</div>
              <div className="tiny muted">{t('home.attendanceSub')}</div>
            </div>
            <span className="muted" aria-hidden="true">→</span>
          </button>
          <button type="button" className="g-list-row" onClick={() => navigate('/meet')} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
            <div className="g-avatar sm" style={{ background: 'var(--green-bg)', color: 'var(--green-ink)' }} aria-hidden="true">📹</div>
            <div className="grow">
              <div className="g-h3">{t('home.vc')}</div>
              <div className="tiny muted">{t('home.vcSub')}</div>
            </div>
            <span className="muted" aria-hidden="true">→</span>
          </button>
          <button type="button" className="g-list-row" onClick={() => navigate('/directory')} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', borderBottom: 'none' }}>
            <div className="g-avatar sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }} aria-hidden="true">🏛️</div>
            <div className="grow">
              <div className="g-h3">{t('home.dir')}</div>
              <div className="tiny muted">{t('home.dirSub')}</div>
            </div>
            <span className="muted" aria-hidden="true">→</span>
          </button>
        </div>
      </Panel>
    </>
  );
};

export default Home;