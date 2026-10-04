import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection, VC_QUESTIONS } from '../context/InspectionContext';
import { TopBar, Panel, Note, Chip, KV } from '../components/ui';

const Signal = ({ quality }) => {
  const bars = [4, 7, 10, 13];
  return (
    <span className={`g-sig ${quality === 'Fair' ? 'w' : quality === 'Poor' ? 'p' : ''}`}>
      {bars.map((h) => <i key={h} style={{ height: h }} />)}
    </span>
  );
};

const VideoCheck = () => {
  const { session, startVc, endVc, askQuestion, answerQuestion } = useInspection();
  const navigate = useNavigate();
  const s = session;
  const vc = s.vc;

  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [speakerIdx, setSpeakerIdx] = useState(0);

  const active = vc.status === 'active';

  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    const s2 = setInterval(() => setSpeakerIdx((i) => (i + 1) % 3), 2200);
    return () => { clearInterval(t); clearInterval(s2); };
  }, [active]);

  const connect = () => {
    setConnecting(true);
    setTimeout(() => { setConnecting(false); startVc(); }, 1200);
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const nextQuestion = VC_QUESTIONS[vc.askCount % VC_QUESTIONS.length];

  const participants = vc.participants.length
    ? vc.participants
    : [
      { name: 'S. Kumar', role: 'Field Officer (you)', self: true },
      { name: 'R. Meenakshi', role: 'Project Incharge' },
      { name: 'K. Anitha', role: 'Counsellor / Staff' },
    ];

  return (
    <>
      <TopBar
        title="Random Video Verification"
        subtitle={active ? `Live · ${mm}:${ss}` : 'Not connected'}
        onBack={() => navigate('/inspection/run')}
        right={<Chip tone={active ? 'ok' : 'mute'} dot>{active ? 'LIVE' : 'IDLE'}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div className="g-vc-main">
          <div className="g-vc-face">
            <div className="g-vc-face-avatar">{camOff ? '🙈' : 'SK'}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>S. Kumar · Inspection Officer</div>
            <div className="tiny" style={{ color: '#94a3b8' }}>
              {active ? (camOff ? 'Camera off — audio only' : 'Camera on · connected via secure relay') : 'Call not started'}
            </div>
            {active ? (
              <div className="row" style={{ gap: 8, marginTop: 2 }}>
                <Signal quality="Good" />
                <span className="tiny" style={{ color: '#94a3b8' }}>Good · 780 kbps</span>
              </div>
            ) : null}
          </div>
          <span className="g-vc-tag">Officer device</span>
          {active ? <span className="g-vc-rec">● REC {mm}:{ss}</span> : null}
        </div>

        <div className="g-vc-thumbs">
          {participants.map((p, i) => {
            const mono = p.self ? (camOff ? '🙈' : 'SK') : p.name.replace(/[^A-Z]/g, '').slice(0, 2).toUpperCase() || '•';
            return (
              <div key={p.name} className={`g-vc-thumb ${active && !p.self && speakerIdx === i - 1 ? 'speaking' : ''}`}>
                <div className="g-vc-thumb-av" style={p.self ? undefined : { background: '#31496b' }}>
                  {mono}
                </div>
                <div className="g-vc-thumb-n">{p.name}</div>
                <div className="tiny" style={{ color: '#7d8ea3', fontSize: 8.5 }}>
                  {active && !p.self && speakerIdx === i - 1 ? 'speaking' : p.role}
                </div>
              </div>
            );
          })}
        </div>

        <div className="g-vc-ctrl">
          <button className={`g-vc-btn ${muted ? 'on' : ''}`} onClick={() => setMuted((m) => !m)} title="Microphone">
            {muted ? '🔇' : '🎙️'}
          </button>
          <button className={`g-vc-btn ${camOff ? 'on' : ''}`} onClick={() => setCamOff((c) => !c)} title="Camera">
            {camOff ? '📷' : '🎥'}
          </button>
          <button className={`g-vc-btn ${speaker ? '' : 'on'}`} onClick={() => setSpeaker((v) => !v)} title="Speaker">
            🔊
          </button>
          <button className="g-vc-btn end" onClick={() => { endVc(); setElapsed(0); }} disabled={!active} title="End call">
            📵
          </button>
        </div>

        {!active ? (
          <button className="g-btn g-btn-primary" onClick={connect} disabled={connecting}>
            {connecting ? <><span className="spinner" /> Connecting to institution…</> : 'START RANDOM VIDEO CHECK'}
          </button>
        ) : null}

        <Panel title="AI-generated verification question" aside={<Chip tone="info">RANDOM</Chip>}>
          {active ? (
            <>
              <div className="g-h2" style={{ lineHeight: 1.45, margin: '2px 0 8px' }}>
                “{nextQuestion.text}”
              </div>
              <div className="g-lede">{nextQuestion.intent}</div>
              <div className="divider" />
              <div className="row tiny muted" style={{ justifyContent: 'space-between' }}>
                <span>Questions raised this call</span>
                <b style={{ color: 'var(--ink)' }}>{vc.askCount}</b>
              </div>
              <div className="g-btn-row mt">
                <button className="g-btn g-btn-outline" onClick={() => askQuestion(nextQuestion)}>
                  Request evidence
                </button>
                <button
                  className="g-btn g-btn-go"
                  onClick={() => { askQuestion(nextQuestion); answerQuestion(nextQuestion.id, 'verified'); }}
                >
                  Mark verified
                </button>
                <button
                  className="g-btn g-btn-alert"
                  onClick={() => { askQuestion(nextQuestion); answerQuestion(nextQuestion.id, 'flagged'); }}
                >
                  Flag issue
                </button>
              </div>
            </>
          ) : (
            <div className="g-lede">
              Start the call to let the AI engine draw a verification question. Questions are drawn at
              random so the institution cannot rehearse a response.
            </div>
          )}
        </Panel>

        {vc.questions.length ? (
          <Panel title={`Questions answered (${vc.questions.length})`}>
            {vc.questions.map((q) => (
              <div key={q.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <span className="g-h3 grow">{q.text}</span>
                  <Chip tone={q.verdict === 'verified' ? 'ok' : q.verdict === 'flagged' ? 'bad' : 'warn'}>
                    {q.verdict || 'pending'}
                  </Chip>
                </div>
              </div>
            ))}
          </Panel>
        ) : null}

        <Note tone="info" icon="i">
          Random VC helps verify actual on-site functioning and reduce proxy reporting. The call is
          initiated by the officer, is not announced in advance, and is recorded with the institution
          and beneficiary consent banner.
        </Note>

        {active ? (
          <Panel title="Call record">
            <KV k="Session" v={`VC-${s.inspectionId.slice(-6)}`} mono />
            <KV k="Started" v={vc.startedAt ? new Date(vc.startedAt).toLocaleTimeString('en-IN') : '—'} mono />
            <KV k="Verified answers" v={vc.verified} />
            <KV k="Flagged answers" v={vc.flagged} />
          </Panel>
        ) : null}
      </div>
    </>
  );
};

export default VideoCheck;
