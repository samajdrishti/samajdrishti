import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, ATTENDANCE } from '../context/InspectionContext';
import { TopBar, Panel, Note, Chip, Bar, KV } from '../components/ui';

const SEV_TONE = { critical: 'bad', high: 'bad', medium: 'warn', low: 'info' };
const SEV_COLOR = { critical: 'var(--red)', high: 'var(--red)', medium: 'var(--amber)', low: 'var(--info)' };

const Compare = () => {
  const a = ATTENDANCE;
  const rows = [
    { label: 'Registered', value: a.registered, color: 'var(--navy)' },
    { label: 'Reported attendance', value: a.reported, color: 'var(--info)' },
    { label: 'Observed (verified)', value: a.observed, color: 'var(--amber)' },
  ];
  return (
    <div className="g-cmp">
      {rows.map((r) => (
        <div key={r.label} className="g-cmp-row">
          <span className="g-cmp-l">{r.label}</span>
          <span className="g-cmp-track">
            <span
              className="g-cmp-fill"
              style={{ width: `${(r.value / a.registered) * 100}%`, background: r.color }}
            >
              {Math.round((r.value / a.registered) * 100)}%
            </span>
          </span>
          <span className="g-cmp-v">{r.value}</span>
        </div>
      ))}
    </div>
  );
};

const AiAnalytics = () => {
  const { session, runAi, verifyAnomaly, setNotes } = useInspection();
  const navigate = useNavigate();
  const a = ATTENDANCE;
  const hasRun = session.ai.length > 0;

  return (
    <>
      <TopBar
        title="Attendance & AI Analysis"
        subtitle={`${session.institution.name}`}
        onBack={() => navigate('/checklist')}
        right={<Chip tone="info" dot>AI-ASSISTED</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Panel title="Attendance verification" aside={<Chip tone="warn">{a.presentPct}%</Chip>}>
          <div className="g-kpis">
            <div className="g-kpi"><div className="g-kpi-n">{a.registered}</div><div className="g-kpi-l">Registered</div></div>
            <div className="g-kpi info"><div className="g-kpi-n">{a.reported}</div><div className="g-kpi-l">Reported</div></div>
            <div className="g-kpi warn"><div className="g-kpi-n">{a.present}</div><div className="g-kpi-l">Observed</div></div>
          </div>
          <div className="divider" />
          <div className="row tiny muted" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
            <span>Verified attendance</span>
            <b style={{ color: 'var(--ink)' }}>{a.presentPct}%</b>
          </div>
          <Bar pct={a.presentPct} tone="warn" />
          <div className="divider" />
          <Compare />
        </Panel>

        <Note tone="bad" icon="!">
          <b>Possible attendance discrepancy detected.</b> The register reports {a.reported} present
          but only {a.observed} beneficiaries were observed during the live video check — a gap of{' '}
          {a.reported - a.observed}. Staff on site: {a.staffOnDuty} of {a.staffRostered} rostered.
        </Note>

        <Note tone="info" icon="i">
          AI-assisted anomaly detection — requires officer verification. The engine flags patterns for a
          human officer to confirm or dismiss; it does not take any administrative decision.
        </Note>

        {!hasRun ? (
          <button className="g-btn g-btn-primary" onClick={runAi}>
            RUN AI ANOMALY ANALYSIS
          </button>
        ) : null}

        {hasRun ? (
          <>
            <div className="g-sec">
              <span className="g-sec-title">AI anomaly indicators ({session.ai.length})</span>
              <span className="g-sec-aside">Human verification required</span>
            </div>
            {session.ai.map((an) => (
              <div key={an.id} className="g-ai">
                <div className="g-ai-hd">
                  <span className="g-ai-t">{an.label}</span>
                  <Chip tone={SEV_TONE[an.severity]}>{an.severity}</Chip>
                </div>
                <div className="g-ai-bd">
                  <div className="g-lede" style={{ marginBottom: 9 }}>{an.detail}</div>
                  <div className="g-ai-conf">
                    <span className="tiny muted" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>CONFIDENCE</span>
                    <span className="g-ai-conf-track">
                      <i style={{ width: `${an.confidence}%`, background: SEV_COLOR[an.severity] }} />
                    </span>
                    <b style={{ fontSize: 12 }}>{an.confidence}%</b>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 8 }}>
                    🔗 Evidence reference: {an.evidenceRef}
                  </div>
                  {an.verified === null ? (
                    <div className="g-btn-row" style={{ marginTop: 10 }}>
                      <button className="g-btn g-btn-go g-btn-sm" onClick={() => verifyAnomaly(an.id, true)}>
                        ✓ Confirmed
                      </button>
                      <button className="g-btn g-btn-quiet g-btn-sm" onClick={() => verifyAnomaly(an.id, false)}>
                        ✕ Dismissed
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <Chip tone={an.verified ? 'ok' : 'mute'} dot>
                        {an.verified ? 'OFFICER CONFIRMED' : 'DISMISSED BY OFFICER'}
                      </Chip>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="g-panel" style={{ background: '#fbfcfe' }}>
              <div className="g-panel-bd">
                <div className="g-h3">Officer observation</div>
                <textarea
                  className="input mt"
                  rows={3}
                  value={session.notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record what you actually saw on site…"
                />
              </div>
            </div>
            <button className="g-btn g-btn-primary" onClick={() => navigate('/inspection/summary')}>
              CONTINUE TO SUMMARY
            </button>
          </>
        ) : null}

        <Panel title="Detection basis">
          <KV k="Attendance source" v="Manual register photo EV-04" />
          <KV k="Headcount source" v="Live video check, 12:35–12:50" />
          <KV k="Comparison window" v="Last 4 monthly records" />
          <KV k="Engine" v="AI Engine v1 · on-prem" />
        </Panel>
      </div>
    </>
  );
};

export default AiAnalytics;
