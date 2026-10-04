import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, CHECKLIST_SECTIONS, CHECKLIST_ITEMS } from '../context/InspectionContext';
import { TopBar, Panel, KV, Chip, StatusChip, Bar, Note } from '../components/ui';

const MARK_TONE = { verified: 'ok', issue: 'warn', critical: 'bad' };

const fmtDT = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-IN');
  } catch (err) {
    return '—';
  }
};

/**
 * Full inspection report: printable (Print → Save as PDF) and shareable via
 * the Web Share sheet on mobile. Reads entirely from the local session, so it
 * works offline.
 */
const Report = () => {
  const { session, checklistDone, checklistTotal, criticalCount, durationMin } = useInspection();
  const navigate = useNavigate();
  const [shared, setShared] = useState(false);
  const s = session;

  const flagged = CHECKLIST_ITEMS.filter((i) => ['issue', 'critical'].includes(s.checklist[i.id]));
  const verified = CHECKLIST_ITEMS.filter((i) => s.checklist[i.id] === 'verified').length;

  const summaryText = [
    `Samaj Drishti inspection report ${s.reportId || s.inspectionId}`,
    `Institution: ${s.institution.name}, ${s.institution.district}`,
    `Officer: ${s.officer.name} (${s.officer.id})`,
    `Checklist: ${checklistDone}/${checklistTotal} · Evidence: ${s.evidence.length} · AI findings: ${s.ai.length}`,
    `Status: ${s.status}`,
  ].join('\n');

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Inspection report ${s.reportId || s.inspectionId}`, text: summaryText });
        setShared(true);
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(summaryText);
      setShared(true);
    } catch (err) {
      window.print();
    }
  };

  return (
    <>
      <TopBar
        title="Inspection Report"
        subtitle={s.reportId || s.inspectionId}
        onBack={() => navigate(-1)}
        right={<StatusChip status={s.status} />}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div className="g-btn-row no-print">
          <button type="button" className="g-btn g-btn-quiet" onClick={() => window.print()}>
            🖨️ PRINT / PDF
          </button>
          <button type="button" className="g-btn g-btn-primary" onClick={onShare}>
            📤 SHARE
          </button>
        </div>
        {shared ? <Note tone="ok" icon="✓">Report summary shared.</Note> : null}

        <div id="inspection-report">
          <Panel title="Report header">
            <KV k="Report ID" v={s.reportId || 'Not submitted yet'} mono />
            <KV k="Inspection ID" v={s.inspectionId} mono />
            <KV k="Assignment ID" v={s.assignmentId} mono />
            <KV k="Institution" v={s.institution.name} />
            <KV k="Location" v={`${s.institution.district}, ${s.institution.state}`} />
            <KV k="Scheme" v={s.institution.scheme} />
            <KV k="Officer" v={`${s.officer.name} · ${s.officer.id}`} />
            <KV k="Started" v={fmtDT(s.startedAt)} mono />
            <KV k="Submitted" v={s.submittedAt ? fmtDT(s.submittedAt) : '—'} mono />
            <KV k="Duration" v={`${durationMin} min`} />
          </Panel>

          <Panel title="GPS verification">
            <KV k="Result" v={<Chip tone={s.gps?.verified ? 'ok' : 'bad'} dot>{s.gps?.verified ? 'VERIFIED' : 'MISSING'}</Chip>} />
            {s.gps ? (
              <>
                <KV k="Coordinates" v={`${s.gps.lat}, ${s.gps.lng}`} mono />
                <KV k="Distance from site" v={`${s.gps.distanceM} m (allowed ${s.institution.geofenceM} m)`} />
                <KV k="Verified at" v={fmtDT(s.gps.verifiedAt)} mono />
              </>
            ) : null}
          </Panel>

          <Panel title={`Checklist — ${checklistDone}/${checklistTotal}`}>
            <div className="row tiny muted" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <span>{verified} verified · {flagged.length} flagged</span>
              <b style={{ color: 'var(--ink)' }}>{checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0}%</b>
            </div>
            <Bar pct={checklistTotal ? (checklistDone / checklistTotal) * 100 : 0} tone={flagged.length ? 'warn' : 'ok'} />
            <div className="divider" />
            {CHECKLIST_SECTIONS.map((section) => {
              const items = section.items.filter((i) => s.checklist[i.id]);
              if (!items.length) return null;
              return (
                <div key={section.id} style={{ marginBottom: 8 }}>
                  <div className="g-h3" style={{ marginBottom: 4 }}>{section.title}</div>
                  {items.map((i) => (
                    <div key={i.id} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                      <span className="small">{i.label}</span>
                      <Chip tone={MARK_TONE[s.checklist[i.id]]}>{s.checklist[i.id]}</Chip>
                    </div>
                  ))}
                </div>
              );
            })}
            {checklistDone === 0 ? <div className="small muted">No points marked.</div> : null}
          </Panel>

          <Panel title={`Evidence (${s.evidence.length})`}>
            {s.evidence.length === 0 ? (
              <div className="small muted">No evidence captured.</div>
            ) : (
              <div className="g-ev-grid">
                {s.evidence.map((e) => (
                  <div key={e.id} className="g-ev">
                    {e.dataUrl ? <img src={e.dataUrl} alt={e.label} /> : (
                      <div className="g-ev-doc"><span>{e.kind}</span></div>
                    )}
                    <span className="g-ev-tag">{e.id}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={`AI findings (${s.ai.length})${criticalCount ? ` · ${criticalCount} critical` : ''}`}>
            {s.ai.length === 0 ? (
              <div className="small muted">Analysis not run yet.</div>
            ) : (
              s.ai.map((a) => (
                <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <b className="small">{a.label}</b>
                    <Chip tone={a.severity === 'critical' ? 'bad' : a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : 'info'}>
                      {a.severity} · {a.confidence}%
                    </Chip>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 3 }}>{a.detail}</div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Beneficiary verification">
            <KV k="Status" v={s.beneficiary.status.replace(/_/g, ' ')} />
            <KV k="Sampled" v={s.beneficiary.selected.length} />
            <KV k="Verified" v={s.beneficiary.verified} />
            <KV k="Flagged" v={s.beneficiary.flagged} />
            <KV k="In-charge sign" v={s.beneficiary.inchargeSign ? `${s.beneficiary.inchargeSign.by} · ${fmtDT(s.beneficiary.inchargeSign.at)}` : '—'} />
          </Panel>

          {s.notes ? (
            <Panel title="Officer notes">
              <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{s.notes}</div>
            </Panel>
          ) : null}

          <Panel title="Sign-off">
            <KV k="Digitally signed by" v={`${s.officer.name} (${s.officer.id})`} />
            <KV k="Generated" v={fmtDT(new Date().toISOString())} mono />
            <div className="tiny muted" style={{ marginTop: 6 }}>
              Samaj Drishti · Ministry of Social Justice & Empowerment · SIH 2026 PS 26095
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
};

export default Report;
