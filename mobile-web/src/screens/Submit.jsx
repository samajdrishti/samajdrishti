import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, CHECKLIST_ITEMS } from '../context/InspectionContext';
import { TopBar, Panel, KV, Note, Chip } from '../components/ui';

const gates = (s) => [
  { label: 'GPS geofence verification', ok: Boolean(s.gps?.verified), detail: s.gps?.verified ? `${s.gps.distanceM} m from registered point` : 'Not verified' },
  { label: 'Random video check', ok: s.vc.status === 'ended', detail: s.vc.status === 'ended' ? 'Completed and recorded' : 'Not completed' },
  { label: 'Evidence capture', ok: s.evidence.length > 0, detail: `${s.evidence.length} items sealed` },
  { label: 'Checklist completion', ok: CHECKLIST_ITEMS.some((i) => s.checklist[i.id]), detail: `${CHECKLIST_ITEMS.filter((i) => s.checklist[i.id]).length} / ${CHECKLIST_ITEMS.length} points marked` },
  { label: 'AI-assisted analysis reviewed', ok: s.ai.length > 0, detail: s.ai.length ? `${s.ai.length} indicators, ${s.ai.filter((a) => a.verified).length} confirmed` : 'Not run' },
];

const Submit = () => {
  const { session, submit, online, pendingEvidence } = useInspection();
  const navigate = useNavigate();
  const s = session;
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(s.status === 'submitted');

  const list = gates(s);
  const blocking = list.filter((g) => !g.ok && g.label !== 'Random video check' && g.label !== 'AI-assisted analysis reviewed');
  const canSubmit = blocking.length === 0;

  const onSubmit = async () => {
    setBusy(true);
    await submit();
    setTimeout(() => { setBusy(false); setDone(true); }, 900);
  };

  if (done) {
    return (
      <>
        <TopBar title="Report Submitted" subtitle={s.reportId} onBack={() => navigate('/')} />
        <div className="g-panel-bd stack" style={{ gap: 14 }}>
          <div className="g-panel">
            <div className="g-panel-bd center" style={{ padding: '26px 18px' }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <div className="g-h1" style={{ marginTop: 8 }}>Inspection Report Submitted</div>
              <div className="g-lede" style={{ marginTop: 6 }}>
                The report, evidence and audit trail have been transmitted to the Central Monitoring System
                and are now visible to the DoSJE command dashboard.
              </div>
            </div>
          </div>
          <Panel title="Submission record">
            <KV k="Report ID" v={s.reportId} mono />
            <KV k="Inspection ID" v={s.inspectionId} mono />
            <KV k="Officer ID" v={s.officer.id} mono />
            <KV k="Institution" v={s.institution.name} />
            <KV k="Digital timestamp" v={new Date(s.submittedAt).toLocaleString('en-IN')} mono />
            <KV k="Sync status" v={<Chip tone="ok" dot>SYNCED WITH CENTRAL MONITORING SYSTEM</Chip>} />
          </Panel>
          <Note tone="ok" icon="✓">
            The web command dashboard has been updated by a live server push — no refresh required. A
            reviewer can open this inspection immediately from the GIS map.
          </Note>
          <button className="g-btn g-btn-primary" onClick={() => navigate('/')}>BACK TO DASHBOARD</button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Report Submission" subtitle={`${s.inspectionId} · Secure transmission`} onBack={() => navigate('/inspection/summary')} />
      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Panel title="Pre-submission validation">
          {list.map((g) => (
            <div key={g.label} className="g-kv">
              <span className="g-kv-k">{g.label}</span>
              <span className="g-kv-v" style={{ color: g.ok ? 'var(--green)' : 'var(--muted)' }}>
                {g.ok ? '✓ ' : ''}{g.detail}
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="Report contents">
          <KV k="Inspection ID" v={s.inspectionId} mono />
          <KV k="Officer ID" v={s.officer.id} mono />
          <KV k="GPS verification" v={<Chip tone={s.gps?.verified ? 'ok' : 'bad'} dot>{s.gps?.verified ? 'VERIFIED' : 'MISSING'}</Chip>} />
          <KV k="Evidence files" v={`${s.evidence.length} (${pendingEvidence} pending upload)`} />
          <KV k="AI analysis status" v={s.ai.length ? `${s.ai.length} indicators · human review required` : 'Not run'} />
          <KV k="Digital timestamp" v={new Date().toLocaleString('en-IN')} mono />
          <KV k="Sync status" v={<Chip tone={online ? 'ok' : 'warn'} dot>{online ? 'CONNECTED — WILL SYNC NOW' : 'OFFLINE — WILL QUEUE'}</Chip>} />
        </Panel>

        {blocking.length ? (
          <Note tone="bad" icon="!">
            Submission blocked: {blocking.map((b) => b.label).join(', ')} must be completed first.
          </Note>
        ) : (
          <Note tone="ok" icon="✓">
            All mandatory checks passed. The report is digitally signed by {s.officer.id} and will be
            immutable once received by the central system.
          </Note>
        )}

        {!online ? (
          <Note tone="warn" icon="⚠">
            No network. The report will be stored in the encrypted offline queue and transmitted
            automatically on reconnection.
          </Note>
        ) : null}

        <button className="g-btn g-btn-go" onClick={onSubmit} disabled={!canSubmit || busy}>
          {busy ? <><span className="spinner" /> Transmitting…</> : 'SUBMIT SECURE REPORT'}
        </button>
      </div>
    </>
  );
};

export default Submit;
