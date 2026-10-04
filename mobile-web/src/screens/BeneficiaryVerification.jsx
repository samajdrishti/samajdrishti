import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, ATTENDANCE } from '../context/InspectionContext';
import { TopBar, Panel, Note, Chip, KV, Bar, StatusChip } from '../components/ui';

const VC_QUESTION = 'Show the beneficiary their individual certificate and today’s attendance mark.';

const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

const BeneficiaryVerification = () => {
  const { session, startBeneficiary, markBeneficiary, setBeneficiaryConsent, signBeneficiary } = useInspection();
  const navigate = useNavigate();
  const b = session.beneficiary;
  const a = ATTENDANCE;
  const incharge = session.institution.incharge;

  const [signing, setSigning] = useState(false);

  const started = b.status !== 'not_started';
  const allDecided = b.selected.length > 0 && b.selected.every((x) => x.verdict);
  const canSign = b.consent && allDecided && b.selected.length > 0;

  const begin = () => startBeneficiary();

  const sign = () => {
    setSigning(true);
    signBeneficiary(incharge);
    setTimeout(() => navigate('/ai'), 700);
  };

  return (
    <>
      <TopBar
        title="Beneficiary Verification"
        subtitle={`${session.institution.name}`}
        onBack={() => navigate('/inspection/run')}
        right={<StatusChip status={b.status} />}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Note tone="info" icon="i">
          A random sample of registered beneficiaries is drawn on the spot and verified against the
          physical register, a photo-ID scan and a live interview. This is what separates real
          attendance from a ghost-beneficiary pattern, and it feeds the AI anomaly engine.
        </Note>

        {!started ? (
          <>
            <Panel title="Verification basis" aside={<Chip tone="warn">{a.presentPct}%</Chip>}>
              <div className="g-kpis">
                <div className="g-kpi"><div className="g-kpi-n">{a.registered}</div><div className="g-kpi-l">Registered</div></div>
                <div className="g-kpi info"><div className="g-kpi-n">{a.reported}</div><div className="g-kpi-l">Reported</div></div>
                <div className="g-kpi warn"><div className="g-kpi-n">{a.observed}</div><div className="g-kpi-l">Observed</div></div>
              </div>
              <div className="divider" />
              <div className="row tiny muted" style={{ justifyContent: 'space-between', marginBottom: 5 }}>
                <span>Verified attendance</span>
                <b style={{ color: 'var(--ink)' }}>{a.presentPct}%</b>
              </div>
              <Bar pct={a.presentPct} tone="warn" />
            </Panel>
            <button className="g-btn g-btn-primary" onClick={begin}>
              🎲 DRAW RANDOM SAMPLE &amp; BEGIN
            </button>
          </>
        ) : (
          <>
            <Panel title="Consent" aside={<Chip tone={b.consent ? 'ok' : 'warn'} dot>{b.consent ? 'RECORDED' : 'REQUIRED'}</Chip>}>
              <div className="g-lede">
                Beneficiaries are verified with their consent; the interview is audio-logged and the
                photo scan is stored only as a geotagged hash, not as a raw image.
              </div>
              <div className="g-btn-row mt">
                <button className="g-btn g-btn-outline g-btn-sm" onClick={() => setBeneficiaryConsent(true)}>
                  Consent obtained on site
                </button>
              </div>
            </Panel>

            <Panel
              title={`Random sample (${b.selected.length} beneficiaries)`}
              aside={<span className="g-sec-aside">{b.verified} verified · {b.flagged} flagged</span>}
            >
              {b.selected.map((person) => {
                const tone = person.verdict === 'verified' ? 'ok' : person.verdict === 'flagged' ? 'bad' : 'mute';
                return (
                  <div key={person.tag} className="g-list-row" style={{ alignItems: 'flex-start' }}>
                    <div className="g-avatar" style={{ background: tone === 'ok' ? 'var(--green-bg)' : tone === 'bad' ? 'var(--red-bg)' : 'var(--info-bg)', color: tone === 'ok' ? 'var(--green-ink)' : tone === 'bad' ? 'var(--red)' : 'var(--info-ink)' }}>
                      {initials(person.name)}
                    </div>
                    <div className="grow">
                      <div className="g-h3">{person.name}</div>
                      <div className="tiny muted">{person.tag} · age {person.age} · QR + face + OTP</div>
                      {person.verdict ? <div className="tiny" style={{ marginTop: 3, color: person.verdict === 'verified' ? 'var(--green)' : 'var(--red)' }}>{person.verdict === 'verified' ? '✓ Identity matched register' : '▲ Could not match — flagged for review'}</div> : null}
                    </div>
                    <div className="g-btn-row" style={{ width: 150, flex: '0 0 auto' }}>
                      <button className={`g-btn g-btn-sm ${person.verdict === 'verified' ? 'g-btn-go' : 'g-btn-quiet'}`} onClick={() => markBeneficiary(person.tag, 'verified')}>✓</button>
                      <button className={`g-btn g-btn-sm ${person.verdict === 'flagged' ? 'g-btn-alert' : 'g-btn-quiet'}`} onClick={() => markBeneficiary(person.tag, 'flagged')}>✕</button>
                    </div>
                  </div>
                );
              })}
              <button
                className="g-btn g-btn-quiet g-btn-sm mt"
                onClick={begin}
              >
                ↻ Redraw sample
              </button>
            </Panel>

            <Panel title="Verification methods" pad={false}>
              <div className="g-panel-bd">
                {[
                  { icon: '🔳', label: 'QR / photo-ID scan', detail: 'Aadhaar-linked beneficiary card, matched to the register' },
                  { icon: '😀', label: 'On-device face match', detail: 'Lightweight local model; no face image leaves the device' },
                  { icon: '💬', label: 'Random interview', detail: `"${VC_QUESTION}" — answers cross-checked against the register` },
                  { icon: '📹', label: 'Live VC confirmation', detail: 'Incharge confirms the beneficiary is physically present' },
                ].map((m) => (
                  <div key={m.label} className="g-list-row">
                    <div className="g-avatar sm" style={{ background: 'var(--info-bg)', color: 'var(--info-ink)' }}>{m.icon}</div>
                    <div className="grow">
                      <div className="g-h3">{m.label}</div>
                      <div className="tiny muted">{m.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Incharge e-signature" aside={!b.inchargeSign ? <Chip tone="warn">PENDING</Chip> : <Chip tone="ok">SIGNED</Chip>}>
              {b.inchargeSign ? (
                <>
                  <div className="center" style={{ padding: '10px 0' }}>
                    <div style={{ fontFamily: 'cursive', fontSize: 28, color: 'var(--navy)' }}>{incharge}</div>
                    <div className="tiny muted">{new Date(b.inchargeSign.at).toLocaleString('en-IN')}</div>
                  </div>
                  <KV k="Signed by" v={b.inchargeSign.by} />
                </>
              ) : (
                <>
                  <div
                    style={{
                      height: 92, border: '1.5px dashed var(--line)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--muted)', fontSize: 12, background: '#fbfcfe',
                    }}
                  >
                    {signing ? <span className="spinner spinner-dark" /> : 'Signature area'}
                  </div>
                  <button
                    className="g-btn g-btn-quiet g-btn-sm mt"
                    disabled={!canSign || signing}
                    onClick={sign}
                  >
                    {signing ? 'Recording…' : 'Incharge signs here'}
                  </button>
                  {!canSign ? (
                    <div className="tiny muted mt">
                      Consent and a verdict for every sampled beneficiary are required before the
                      signature is accepted.
                    </div>
                  ) : null}
                </>
              )}
            </Panel>

            <button className="g-btn g-btn-go" onClick={sign} disabled={!b.inchargeSign}>
              {b.inchargeSign ? 'CONTINUE TO AI ANALYSIS' : 'COMPLETE SIGNATURE TO CONTINUE'}
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default BeneficiaryVerification;
