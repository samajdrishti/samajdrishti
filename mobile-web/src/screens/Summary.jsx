import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, CHECKLIST_ITEMS } from '../context/InspectionContext';
import { TopBar, Panel, KV, Timeline, Chip, Bar, Note } from '../components/ui';

const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

const Summary = () => {
  const { session, durationMin, checklistDone, criticalCount, events } = useInspection();
  const navigate = useNavigate();
  const s = session;
  const inst = s.institution;
  const issues = CHECKLIST_ITEMS.filter((i) => s.checklist[i.id] && s.checklist[i.id] !== 'verified').length;
  const flaggedCritical = CHECKLIST_ITEMS.filter((i) => s.checklist[i.id] === 'critical').length;
  const critical = Math.max(criticalCount, flaggedCritical);
  const needsReview = s.ai.some((a) => a.verified) || issues > 0 || critical > 0;
  const overall = critical > 0 ? 'REQUIRES REVIEW' : needsReview ? 'REVIEW ADVISED' : 'COMPLIANT';

  const timeline = [
    { title: 'Randomised assignment received', meta: `${clock(s.assignedAt)} · ${s.assignmentId}`, tone: 'info' },
    { title: 'Inspection accepted by officer', meta: `${clock(s.acceptedAt)} · ${s.officer.name}`, tone: 'info' },
    { title: 'GPS geofence verified', meta: `${clock(s.gps?.verifiedAt)} · ${s.gps?.distanceM} m from gate, ±${s.gps?.accuracy} m`, tone: 'ok' },
    { title: 'Inspection started', meta: clock(s.startedAt), tone: 'info' },
    s.vc.startedAt ? { title: 'Random video check completed', meta: `${clock(s.vc.startedAt)} – ${clock(s.vc.endedAt)} · ${s.vc.questions.length} verification questions`, tone: 'ok' } : null,
    { title: `Evidence captured (${s.evidence.length} items)`, meta: 'Geo-tagged, timestamped, integrity sealed', tone: s.evidence.length ? 'ok' : 'mute' },
    { title: `Checklist completed (${checklistDone}/${CHECKLIST_ITEMS.length})`, meta: `${issues} point(s) flagged`, tone: issues ? 'warn' : 'ok' },
    s.ai.length ? { title: 'AI-assisted anomaly analysis', meta: `${s.ai.length} indicators raised · officer review pending`, tone: 'warn' } : null,
    s.submittedAt ? { title: 'Report submitted', meta: `${clock(s.submittedAt)} · ${s.reportId}`, tone: 'ok' } : null,
  ].filter(Boolean);

  return (
    <>
      <TopBar
        title="Inspection Summary"
        subtitle={`${s.inspectionId} · ${inst.name}`}
        onBack={() => navigate('/ai')}
        right={<Chip tone={critical ? 'bad' : 'ok'}>{overall}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Panel title="Inspection overview">
          <KV k="Institution" v={inst.name} />
          <KV k="District" v={`${inst.district}, ${inst.state}`} />
          <KV k="Type" v={s.inspectionType} />
          <KV k="Officer" v={`${s.officer.name} · ${s.officer.id}`} />
          <KV k="Duration" v={`${durationMin} minutes`} />
          <KV k="GPS" v={<Chip tone={s.gps?.verified ? 'ok' : 'bad'} dot>{s.gps?.verified ? 'VERIFIED ✓' : 'NOT VERIFIED'}</Chip>} />
          <KV k="Video check" v={<Chip tone={s.vc.status === 'ended' ? 'ok' : 'mute'} dot>{s.vc.status === 'ended' ? 'COMPLETED ✓' : 'NOT COMPLETED'}</Chip>} />
          <KV k="Evidence" v={`${s.evidence.length} items`} />
          <KV k="Checklist" v={`${checklistDone} / ${CHECKLIST_ITEMS.length}`} />
          <KV k="Anomalies raised" v={s.ai.length} />
          <KV k="Critical findings" v={<b style={{ color: critical ? 'var(--red)' : 'var(--green)' }}>{critical}</b>} />
        </Panel>

        <Panel title="Overall status" aside={<Chip tone={critical ? 'bad' : 'ok'}>{overall}</Chip>}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="g-h2">Compliance score</span>
            <span className="g-h1">{Math.max(0, Math.round(((checklistDone - issues) / CHECKLIST_ITEMS.length) * 100))}%</span>
          </div>
          <div className="mt">
            <Bar pct={Math.max(0, Math.round(((checklistDone - issues) / CHECKLIST_ITEMS.length) * 100))} tone={critical ? 'bad' : issues ? 'warn' : 'ok'} />
          </div>
          <div className="divider" />
          <div className="g-lede">
            {critical
              ? 'One or more critical findings require review by the DoSJE desk officer before an Action Taken Report is raised.'
              : 'No critical finding was recorded. Flagged points will be included in the institution’s Action Taken Report.'}
          </div>
        </Panel>

        <Panel title="Inspection timeline">
          <Timeline items={timeline} />
        </Panel>

        {events.length ? (
          <Panel title="Device audit trail" aside={<span className="g-sec-aside">Last {Math.min(events.length, 6)} events</span>}>
            {events.slice(0, 6).map((e) => (
              <KV key={e.id} k={clock(e.at)} v={e.title} />
            ))}
          </Panel>
        ) : null}

        {!s.gps?.verified ? (
          <Note tone="bad" icon="!">
            GPS verification is missing. Submission will be rejected by the central system until the
            geofence check has been passed.
          </Note>
        ) : null}

        <div className="g-btn-row">
          <button className="g-btn g-btn-quiet" onClick={() => navigate('/evidence')}>
            VIEW EVIDENCE
          </button>
          <button className="g-btn g-btn-primary" onClick={() => navigate('/submit')} disabled={!s.gps?.verified}>
            SUBMIT REPORT
          </button>
        </div>
      </div>
    </>
  );
};

export default Summary;
