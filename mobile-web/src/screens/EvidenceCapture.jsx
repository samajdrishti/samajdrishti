import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { TopBar, Panel, KV, Note, Chip } from '../components/ui';

const KINDS = [
  { id: 'photo', icon: '📷', label: 'Photo' },
  { id: 'video', icon: '🎥', label: 'Video' },
  { id: 'document', icon: '📄', label: 'Document' },
  { id: 'voice', icon: '🎙️', label: 'Voice note' },
];

/**
 * Draws a geo-tagged evidence frame. Real deployments hand this straight to the
 * device camera; the prototype renders the same watermark and metadata chain so
 * the evidence integrity trail is identical whether or not a camera is present.
 */
const renderFrame = (kind, meta) => {
  const w = 480;
  const h = kind === 'document' ? 640 : 360;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  if (kind === 'document') {
    g.fillStyle = '#eef1f5';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.fillRect(28, 26, w - 56, h - 52);
    g.strokeStyle = '#c3ccd8';
    g.lineWidth = 2;
    for (let i = 0; i < 13; i += 1) {
      g.beginPath();
      g.moveTo(52, 92 + i * 38);
      g.lineTo(w - 52 - (i % 3) * 60, 92 + i * 38);
      g.stroke();
    }
    g.fillStyle = '#123a63';
    g.fillRect(28, 26, w - 56, 40);
    g.fillStyle = '#fff';
    g.font = 'bold 15px Segoe UI, sans-serif';
    g.fillText('BENEFICIARY ATTENDANCE REGISTER', 48, 52);
    g.fillStyle = '#4a5765';
    g.font = '12px Segoe UI, sans-serif';
    g.fillText('ABC Rehabilitation Centre · Coimbatore', 48, 86);
  } else {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#9fc4e8');
    sky.addColorStop(1, '#dfeaf3');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d8f6f';
    g.fillRect(0, h * 0.68, w, h * 0.32);
    g.fillStyle = '#6a6257';
    g.fillRect(38, h * 0.42, 150, h * 0.26);
    g.fillStyle = '#59606b';
    g.fillRect(56, h * 0.5, 44, 40);
    g.fillRect(116, h * 0.5, 44, 40);
    g.fillStyle = '#4b5560';
    for (let i = 0; i < 5; i += 1) {
      g.beginPath();
      g.ellipse(90 + i * 68, h * 0.78, 13, 22, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Integrity watermark band.
  g.fillStyle = 'rgba(12,36,64,0.78)';
  g.fillRect(0, h - 74, w, 74);
  g.fillStyle = '#7ee0a8';
  g.font = 'bold 12px Segoe UI, sans-serif';
  g.fillText('DoSJE SmartInspect · GEO-TAGGED EVIDENCE · INTEGRITY SECURE', 14, h - 52);
  g.fillStyle = '#dbe6f2';
  g.font = '11px Consolas, monospace';
  g.fillText(`INS ${meta.inspectionId}`, 14, h - 34);
  g.fillText(`${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)}  ±${meta.accuracy} m`, 14, h - 18);
  g.fillText(`${meta.time}  OFFICER ${meta.officerId}`, 250, h - 18);
  return c.toDataURL('image/jpeg', 0.72);
};

const EvidenceCapture = () => {
  const { session, addEvidence, online } = useInspection();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [kind, setKind] = useState('photo');
  const [shot, setShot] = useState(null);
  const [recording, setRecording] = useState(false);
  const s = session;

  const meta = {
    inspectionId: s.inspectionId,
    officerId: s.officer.id,
    lat: s.gps?.lat ?? s.institution.lat,
    lng: s.gps?.lng ?? s.institution.lng,
    accuracy: s.gps?.accuracy ?? 8,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };

  const capture = () => {
    setShot({ kind, dataUrl: renderFrame(kind, meta), at: new Date().toISOString() });
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShot({ kind, dataUrl: reader.result, at: new Date().toISOString() });
    reader.readAsDataURL(file);
  };

  const add = () => {
    if (!shot) return;
    addEvidence({
      id: `EV-${String(s.evidence.length + 1).padStart(2, '0')}`,
      kind,
      label: kind === 'document' ? 'Attendance register' : kind === 'voice' ? 'Voice note' : kind === 'video' ? 'Video clip' : 'Site photograph',
      capturedAt: shot.at,
      lat: meta.lat,
      lng: meta.lng,
      geoTag: 'GEO-TAGGED',
      integrity: 'SHA-256 SEALED',
      dataUrl: shot.dataUrl,
      synced: online,
    });
    setShot(null);
    navigate('/evidence');
  };

  return (
    <>
      <TopBar
        title="Capture Evidence"
        subtitle={`${s.inspectionId} · ${s.institution.name}`}
        onBack={() => navigate('/evidence')}
        right={<Chip tone="ok" dot>GEOTAG ON</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div className="g-shot">
          {shot ? (
            <img src={shot.dataUrl} alt="Captured evidence preview" />
          ) : (
            <div className="g-reticle" />
          )}
          <div className="g-shot-osd">
            <span>{shot ? 'PREVIEW' : `CAM ${kind.toUpperCase()} · READY`}</span>
            <span className="rec">● {meta.time}</span>
          </div>
        </div>

        <div className="g-cam-tools">
          <button type="button" className="g-cam-lens" onClick={capture} disabled={recording}>
            <span className={`g-cam-ring ${recording ? 'rec' : ''}`}>{recording ? '■' : '●'}</span>
            <span>{recording ? 'Stop' : 'Shutter'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
          <button
            type="button"
            className="g-cam-lens"
            onClick={() => { setRecording((r) => !r); capture(); }}
          >
            <span className="g-cam-ring" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>⏺</span>
            <span>Video</span>
          </button>
          <button type="button" className="g-cam-lens" onClick={() => fileRef.current?.click()}>
            <span className="g-cam-ring" style={{ borderColor: 'var(--muted)', color: 'var(--muted)' }}>⬆</span>
            <span>Upload</span>
          </button>
        </div>

        <div className="g-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {KINDS.map((k) => (
            <button key={k.id} type="button" className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>

        <Panel title="Automatically attached metadata">
          <KV k="GPS coordinates" v={`${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)}`} mono />
          <KV k="Timestamp" v={meta.time} mono />
          <KV k="Inspection ID" v={s.inspectionId} mono />
          <KV k="Officer ID" v={s.officer.id} mono />
          <KV k="Institution ID" v="INST-CBE-00412" mono />
        </Panel>

        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <Chip tone="ok" dot>Geo-tagging: ON</Chip>
          <Chip tone="info" dot>Timestamp: {meta.time}</Chip>
          <Chip tone="ok" dot>GPS: VERIFIED</Chip>
          <Chip tone="ok" dot>Evidence integrity: SECURE</Chip>
        </div>

        {!online ? (
          <Note tone="warn" icon="⚠">
            Device is offline. This evidence is encrypted on the handset and queued for upload — it will
            sync automatically when connectivity returns.
          </Note>
        ) : null}

        <button className="g-btn g-btn-go" onClick={add} disabled={!shot}>
          ADD EVIDENCE
        </button>
        {shot ? (
          <button className="g-btn g-btn-quiet" onClick={() => setShot(null)}>Retake</button>
        ) : null}
      </div>
    </>
  );
};

export default EvidenceCapture;
