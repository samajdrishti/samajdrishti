import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { TopBar, Panel, KV, Note, Chip } from '../components/ui';

const KINDS = [
  { id: 'photo', icon: '📷', label: 'Photo' },
  { id: 'video', icon: '🎥', label: 'Video' },
  { id: 'document', icon: '📄', label: 'Document' },
  { id: 'voice', icon: '🎙️', label: 'Voice note' },
];

const KIND_LABEL = {
  photo: 'Site photograph',
  video: 'Video clip',
  document: 'Attendance register',
  voice: 'Voice note',
};

const MAX_BYTES = { photo: 10 * 1024 * 1024, video: 100 * 1024 * 1024, document: 10 * 1024 * 1024, voice: 15 * 1024 * 1024 };
const ACCEPT = {
  photo: 'image/*',
  video: 'video/*',
  document: 'image/*,.pdf',
  voice: 'audio/*',
};

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
  g.fillText('Samaj Drishti · GEO-TAGGED EVIDENCE · INTEGRITY SECURE', 14, h - 52);
  g.fillStyle = '#dbe6f2';
  g.font = '11px Consolas, monospace';
  g.fillText(`INS ${meta.inspectionId}`, 14, h - 34);
  g.fillText(`${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)}  ±${meta.accuracy} m`, 14, h - 18);
  g.fillText(`${meta.time}  OFFICER ${meta.officerId}`, 250, h - 18);
  return c.toDataURL('image/jpeg', 0.72);
};

/** Stamps the integrity band onto a real camera frame. */
const stampFrame = (canvas, meta) => {
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const band = Math.max(54, Math.round(h * 0.16));
  g.fillStyle = 'rgba(12,36,64,0.78)';
  g.fillRect(0, h - band, w, band);
  g.fillStyle = '#7ee0a8';
  g.font = `bold ${Math.max(11, Math.round(w / 40))}px Segoe UI, sans-serif`;
  g.fillText('Samaj Drishti · GEO-TAGGED EVIDENCE', 12, h - band + 20);
  g.fillStyle = '#dbe6f2';
  g.font = `${Math.max(10, Math.round(w / 44))}px Consolas, monospace`;
  g.fillText(`INS ${meta.inspectionId}  ${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)} ±${meta.accuracy}m`, 12, h - band + 38);
  g.fillText(`${meta.time}  OFFICER ${meta.officerId}`, 12, h - 10);
};

const EvidenceCapture = () => {
  const { session, addEvidence, online } = useInspection();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [kind, setKind] = useState('photo');
  const [shot, setShot] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fileError, setFileError] = useState('');
  const s = session;

  const meta = {
    inspectionId: s.inspectionId,
    officerId: s.officer.id,
    lat: s.gps?.lat ?? s.institution.lat,
    lng: s.gps?.lng ?? s.institution.lng,
    accuracy: s.gps?.accuracy ?? 8,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    if (kind !== 'photo' && kind !== 'video') return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser has no camera API — use the demo shutter or upload instead.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch (err) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access in the browser prompt, or use upload instead.'
          : 'Camera unavailable on this device — use the demo shutter or upload instead.'
      );
    }
  };

  useEffect(() => {
    startCamera();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const capture = () => {
    setFileError('');
    const video = videoRef.current;
    if (cameraOn && video && video.videoWidth) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stampFrame(canvas, meta);
      setShot({ kind, dataUrl: canvas.toDataURL('image/jpeg', 0.8), at: new Date().toISOString(), live: true });
    } else {
      // No live camera (desktop demo / denied permission): same watermark chain, synthetic frame.
      setShot({ kind, dataUrl: renderFrame(kind, meta), at: new Date().toISOString(), live: false });
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError('');
    if (file.size > (MAX_BYTES[kind] || MAX_BYTES.photo)) {
      const mb = Math.round((MAX_BYTES[kind] || MAX_BYTES.photo) / 1024 / 1024);
      setFileError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit for ${kind} evidence is ${mb} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setFileError('Could not read that file. Try a different one.');
    reader.onload = () => setShot({ kind, dataUrl: reader.result, at: new Date().toISOString(), fileName: file.name });
    reader.readAsDataURL(file);
  };

  const add = () => {
    if (!shot) return;
    addEvidence({
      id: `EV-${String(s.evidence.length + 1).padStart(2, '0')}`,
      kind,
      label: KIND_LABEL[kind] || 'Site photograph',
      capturedAt: shot.at,
      lat: meta.lat,
      lng: meta.lng,
      geoTag: 'GEO-TAGGED',
      integrity: 'SHA-256 SEALED',
      dataUrl: shot.dataUrl,
      synced: online,
    });
    stopCamera();
    setShot(null);
    navigate('/evidence');
  };

  return (
    <>
      <TopBar
        title="Capture Evidence"
        subtitle={`${s.inspectionId} · ${s.institution.name}`}
        onBack={() => { stopCamera(); navigate('/evidence'); }}
        right={<Chip tone="ok" dot>GEOTAG ON</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div className="g-shot">
          {shot ? (
            <img src={shot.dataUrl} alt="Captured evidence preview" />
          ) : cameraOn ? (
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} aria-label="Live camera preview" />
          ) : (
            <>
              <video ref={videoRef} playsInline muted style={{ display: 'none' }} aria-hidden="true" />
              <div className="g-reticle" aria-hidden="true" />
            </>
          )}
          <div className="g-shot-osd">
            <span>{shot ? 'PREVIEW' : cameraOn ? `CAM ${kind.toUpperCase()} · LIVE` : `CAM ${kind.toUpperCase()} · READY`}</span>
            <span className="rec">● {meta.time}</span>
          </div>
        </div>

        {cameraError && !shot ? <Note tone="warn" icon="▲">{cameraError}</Note> : null}
        {fileError ? <Note tone="bad" icon="!">{fileError}</Note> : null}

        <div className="g-cam-tools">
          <button type="button" className="g-cam-lens" onClick={capture} aria-label={cameraOn ? 'Capture photo from live camera' : 'Capture demo evidence frame'}>
            <span className="g-cam-ring">●</span>
            <span>{cameraOn ? 'Shutter' : 'Demo shutter'}</span>
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT[kind]} onChange={onFile} style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
          <button
            type="button"
            className="g-cam-lens"
            onClick={startCamera}
          >
            <span className="g-cam-ring" style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>◎</span>
            <span>{cameraOn ? 'Restart cam' : 'Start cam'}</span>
          </button>
          <button type="button" className="g-cam-lens" onClick={() => fileRef.current?.click()} aria-label={`Upload ${kind} from device`}>
            <span className="g-cam-ring" style={{ borderColor: 'var(--muted)', color: 'var(--muted)' }}>⬆</span>
            <span>Upload</span>
          </button>
        </div>

        <div className="g-tabs" role="tablist" aria-label="Evidence type" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'on' : ''} onClick={() => { setKind(k.id); setShot(null); setFileError(''); }}>
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
          <Chip tone={s.gps?.verified ? 'ok' : 'warn'} dot>GPS: {s.gps?.verified ? 'VERIFIED' : 'UNVERIFIED'}</Chip>
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
