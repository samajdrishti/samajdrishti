import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { inspectionAPI, evidenceAPI, reportAPI, anomalyAPI, getClientId } from '../services/api';
import { queueEvidence, queueInspectionUpdate, flushQueue } from '../services/offlineQueue';

/* ==========================================================================
   Inspection session state.

   The field flow is modelled as one persisted session so that a refresh, a
   dropped connection or a mid-inspection hand-off never loses work. Every
   transition also pushes to the API, but the local write happens first and the
   API call is best-effort: an officer in a low-connectivity district must be
   able to keep working.
   ========================================================================== */

const SESSION_KEY = 'si_session_v1';
const NET_KEY = 'si_simulated_offline';

export const CHECKLIST_SECTIONS = [
  {
    id: 'infra',
    title: 'Infrastructure',
    items: [
      { id: 'infra.building', label: 'Building condition', hint: 'Structural integrity, roof, walls' },
      { id: 'infra.fire', label: 'Fire safety & equipment', hint: 'Extinguishers, exits, fire drill record' },
      { id: 'infra.access', label: 'Accessibility', hint: 'Ramp, disabled-access toilet, signage' },
      { id: 'infra.clean', label: 'Cleanliness & hygiene', hint: 'Premises, kitchen, storage areas' },
    ],
  },
  {
    id: 'services',
    title: 'Beneficiary Services',
    items: [
      { id: 'svc.attendance', label: 'Beneficiary attendance', hint: 'Cross-check with the physical register' },
      { id: 'svc.food', label: 'Food & nutrition services', hint: 'Menu followed, meal quality, supplements' },
      { id: 'svc.staff', label: 'Staff availability', hint: 'Duty roster vs staff actually on site' },
      { id: 'svc.activity', label: 'Programme activity', hint: 'Sessions conducted as per the annual plan' },
    ],
  },
  {
    id: 'docs',
    title: 'Documentation',
    items: [
      { id: 'doc.registers', label: 'Beneficiary registers', hint: 'Original, up to date, entries traceable' },
      { id: 'doc.finance', label: 'Financial records', hint: 'Cash book, vouchers, utilisation certificate' },
      { id: 'doc.certificates', label: 'Individual certificates', hint: 'Aadhaar-linked, issued to beneficiary' },
      { id: 'doc.previous', label: 'Previous inspection reports', hint: 'Compliance with earlier directions' },
    ],
  },
  {
    id: 'safety',
    title: 'Safety & Sanitation',
    items: [
      { id: 'safe.water', label: 'Drinking water', hint: 'Potable source, tested, adequate quantity' },
      { id: 'safe.sanitation', label: 'Sanitation facilities', hint: 'Toilets, bathing area, waste disposal' },
      { id: 'safe.security', label: 'Boundary wall & security', hint: 'Perimeter, gate, CCTV coverage' },
      { id: 'safe.medical', label: 'Medical / emergency care', hint: 'First aid, referral tie-up, emergency contact' },
    ],
  },
  {
    id: 'staff',
    title: 'Staff & Governance',
    items: [
      { id: 'gov.staffregister', label: 'Staff register & attendance', hint: 'Staff attendance sheet for the month' },
      { id: 'gov.smc', label: 'Incharge / SMC constitution', hint: 'Committee list, chairperson, terms' },
      { id: 'gov.grievance', label: 'Grievance redressal', hint: 'Box, register, response time' },
      { id: 'gov.disclosure', label: 'Income & asset disclosure', hint: 'Declared by staff handling funds' },
    ],
  },
  {
    id: 'scheme',
    title: 'Scheme Compliance',
    items: [
      { id: 'sch.target', label: 'Scheme-specific target fulfilment', hint: 'Against the sanctioned annual target' },
      { id: 'sch.funds', label: 'Fund utilisation', hint: 'Grant received vs utilised' },
      { id: 'sch.convergence', label: 'Convergence with other schemes', hint: 'Linkage with PDS / SCST / NRLM' },
      { id: 'sch.selection', label: 'Beneficiary selection', hint: 'Verified against SECC 2011 / latest list' },
    ],
  },
];

export const CHECKLIST_ITEMS = CHECKLIST_SECTIONS.flatMap((s) =>
  s.items.map((i) => ({ ...i, section: s.title, sectionId: s.id }))
);

export const VC_QUESTIONS = [
  { id: 'q1', text: 'Show the current beneficiary attendance register for today.', intent: 'Cross-check the register against the officer-observed headcount.' },
  { id: 'q2', text: 'Show the stock register issued and returned for this week.', intent: 'Verify material is actually reaching beneficiaries.' },
  { id: 'q3', text: 'Show the CCTV recorder and its last 24 hours of footage.', intent: 'Confirm the feed is live and un-tampered.' },
  { id: 'q4', text: 'Show the kitchen register and today’s prepared meal.', intent: 'Confirm the meal is prepared and served on site.' },
  { id: 'q5', text: 'Show the grievance box and the last three entries.', intent: 'Check whether grievances are recorded and answered.' },
  { id: 'q6', text: 'Show the individual certificates issued this month.', intent: 'Verify beneficiary entitlements are documented.' },
];

export const ATTENDANCE = {
  registered: 120,
  reported: 112,
  observed: 103,
  present: 103,
  presentPct: 85.8,
  staffOnDuty: 4,
  staffRostered: 5,
};

/* The register pool a random sample is drawn from on every run, so the
   institution cannot pre-rehearse which beneficiaries will be checked. */
const BENE_POOL = [
  { tag: 'B-0412', name: 'Smt. Lakshmi', age: 41 },
  { tag: 'B-0298', name: 'Mr. Ravi', age: 52 },
  { tag: 'B-0561', name: 'Ms. Devi', age: 38 },
  { tag: 'B-0177', name: 'Mr. Suresh', age: 58 },
  { tag: 'B-0644', name: 'Smt. Kamala', age: 45 },
];

const STAFF_POOL = [
  { name: 'K. Anitha', role: 'Counsellor / Staff' },
  { name: 'M. Rajesh', role: 'Ward Helper' },
  { name: 'P. Selvi', role: 'Kitchen Supervisor' },
  { name: 'T. Vinod', role: 'Nurse' },
];

const pickRandom = (pool, count) => {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
};

const buildAnomalies = () => [
  {
    id: 'an.att',
    type: 'Attendance anomaly',
    label: 'Attendance mismatch',
    severity: 'high',
    confidence: 91,
    detail: `Register reports ${ATTENDANCE.reported} present for today, but only ${ATTENDANCE.observed} beneficiaries were observed on the live video check. Gap of ${ATTENDANCE.reported - ATTENDANCE.observed} beneficiaries.`,
    evidenceRef: 'EV-03 · VC recording 04:12, attendance register photo EV-04',
    verified: null,
  },
  {
    id: 'an.staff',
    type: 'Attendance anomaly',
    label: 'Missing staff member',
    severity: 'medium',
    confidence: 78,
    detail: 'Roster lists 5 staff on duty today. Video check at 12:35 showed 4 on site. Ward helper post is vacant.',
    evidenceRef: 'VC recording 12:35, EV-02 · duty roster photo',
    verified: null,
  },
  {
    id: 'an.cctv',
    type: 'CCTV anomaly',
    label: 'CCTV feed unavailable',
    severity: 'medium',
    confidence: 84,
    detail: 'Main entrance camera has had no heartbeat for 27 minutes. Secondary camera last frame is 31 minutes old.',
    evidenceRef: 'CAM-CBE-0412 · heartbeat log',
    verified: null,
  },
  {
    id: 'an.docs',
    type: 'Missing documentation',
    label: 'Previous inspection report not produced',
    severity: 'critical',
    confidence: 88,
    detail: 'Officer asked for the previous inspection report and the 2025 utilisation certificate. Incharge stated it is "under process at the district office".',
    evidenceRef: 'VC recording 08:40 · officer note',
    verified: null,
  },
  {
    id: 'an.pattern',
    type: 'Repeated reporting pattern',
    label: 'Identical monthly figures',
    severity: 'low',
    confidence: 66,
    detail: 'Attendance has been reported as exactly 112 for four consecutive months across three records, which is unlikely for a residential facility.',
    evidenceRef: 'Attendance register exports, Jan–Apr 2026',
    verified: null,
  },
];

/**
 * Maps the server's anomaly rows (snake_case, 0..1 confidence) onto the local
 * shape the field screen renders (0..100 confidence, a severity the chip set
 * knows). Falls back to the locally-built findings when the central engine has
 * nothing on record for this inspection yet.
 */
const mapAnomalies = (serverRows, localRows) => {
  if (Array.isArray(serverRows) && serverRows.length) {
    return serverRows.map((row) => ({
      id: `srv-${row.id}`,
      type: row.type,
      label: String(row.type || 'FINDING').replace(/_/g, ' '),
      severity: row.severity === 'high' ? 'critical' : row.severity || 'medium',
      confidence: Math.round(Number(row.confidence || 0.5) * 100),
      detail: row.description || 'Raised by the central anomaly engine.',
      evidenceRef: row.evidence_id ? `EVIDENCE #${row.evidence_id}` : row.detector || 'central engine',
      verified: row.human_verified ? true : row.status === 'confirmed' ? true : row.status === 'dismissed' ? false : null,
      source: row.source || 'ai',
    }));
  }
  return localRows;
};

const INSTITUTION = {
  name: 'ABC Rehabilitation Centre',
  type: 'Rehabilitation Centre (NGO grant-aided)',
  district: 'Coimbatore',
  state: 'Tamil Nadu',
  scheme: 'SIPDA',
  lat: 11.0168,
  lng: 76.9558,
  geofenceM: 120,
  incharge: 'R. Meenakshi, Project Incharge',
};

const nowIso = () => new Date().toISOString();

const freshSession = () => ({
  inspectionId: 'INS-2026-00482',
  assignmentId: 'RA-7F3A91C2',
  assignedAt: nowIso(),
  acceptedAt: null,
  status: 'assigned',
  institution: INSTITUTION,
  officer: {
    id: 'OFF-KR-2214',
    name: 'S. Kumar',
    rank: 'Inspection Officer (PMU)',
    district: 'Coimbatore',
    division: 'Coimbatore Division',
    phone: '+91 94433 22140',
  },
  priority: 'High',
  inspectionType: 'Surprise Inspection',
  distanceKm: 4.2,
  gps: null,
  vc: { status: 'not_started', startedAt: null, endedAt: null, askCount: 0, questions: [], verified: 0, flagged: 0, participants: [] },
  evidence: [],
  checklist: {},
  beneficiary: {
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    method: 'QR + Face + OTP',
    selected: [],
    verified: 0,
    flagged: 0,
    consent: false,
    inchargeSign: null,
  },
  notes: '',
  ai: [],
  aiSource: null,
  attendance: ATTENDANCE,
  startedAt: null,
  submittedAt: null,
  reportId: null,
  syncState: 'synced',
});

const load = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return freshSession();
    const parsed = JSON.parse(raw);
    const base = freshSession();
    return {
      ...base,
      ...parsed,
      institution: base.institution,
      officer: { ...base.officer, ...parsed.officer },
      vc: { ...base.vc, ...parsed.vc },
      beneficiary: { ...base.beneficiary, ...parsed.beneficiary },
    };
  } catch (err) {
    return freshSession();
  }
};

/**
 * localStorage is ~5 MB and a single photo data-URL is ~200–600 KB, so the raw
 * session (with embedded images) quickly exceeds quota and wipes persistence.
 * Persist a metadata-only copy: evidence keeps everything except the image
 * bytes, which live in memory for this tab session. Queue payloads already
 * carry their own copy via the offline queue when needed.
 */
const persistSession = (session) => {
  const slim = {
    ...session,
    evidence: (session.evidence || []).map((e) => {
      if (!e.dataUrl || e.dataUrl.length < 1024) return e;
      const meta = { ...e };
      delete meta.dataUrl;
      return { ...meta, hasImage: true };
    }),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(slim));
  } catch (err) {
    try {
      const emergency = { ...slim, evidence: slim.evidence.slice(0, 10) };
      localStorage.setItem(SESSION_KEY, JSON.stringify(emergency));
    } catch (err2) {
      /* persistence is best-effort; the in-memory session keeps working */
    }
  }
};

const InspectionContext = createContext(null);

export const InspectionProvider = ({ children }) => {
  const [session, setSession] = useState(load);
  const [simulatedOffline, setSimulatedOffline] = useState(() => localStorage.getItem(NET_KEY) === '1');
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [events, setEvents] = useState([]);

  const online = browserOnline && !simulatedOffline;
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    persistSession(session);
  }, [session]);

  useEffect(() => {
    localStorage.setItem(NET_KEY, simulatedOffline ? '1' : '0');
  }, [simulatedOffline]);

  useEffect(() => {
    const up = () => setBrowserOnline(true);
    const down = () => setBrowserOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const patch = useCallback((fn) => setSession((s) => {
    const next = fn(s);
    return { ...next, syncState: onlineRef.current ? 'synced' : 'pending' };
  }), []);

  const logEvent = useCallback((title, tone = 'ok', meta = '') => {
    setEvents((e) => [{ id: `${Date.now()}-${title}`, title, tone, meta, at: nowIso() }, ...e].slice(0, 60));
  }, []);

  /* ------------------------------------------------------------ transitions */

  const accept = () => {
    patch((s) => ({ ...s, status: 'accepted', acceptedAt: nowIso() }));
    logEvent('Inspection accepted by officer', 'info', 'ACCEPTED');
    inspectionAPI.updateStatus(sessionRef.current.inspectionId, { status: 'accepted' }).catch(() => {
      queueInspectionUpdate(sessionRef.current.inspectionId, { status: 'accepted' });
    });
  };

  const verifyGps = (reading) => {
    patch((s) => ({
      ...s,
      status: 'gps_verified',
      gps: { ...reading, verified: reading.distanceM <= s.institution.geofenceM, verifiedAt: nowIso() },
    }));
    logEvent('GPS geofence verified', 'ok', `DISTANCE ${Math.round(reading.distanceM)} M`);
    inspectionAPI.geoVerify(sessionRef.current.inspectionId, reading.lat, reading.lng).catch(() => {
      queueInspectionUpdate(sessionRef.current.inspectionId, { status: 'gps_verified', lat: reading.lat, lng: reading.lng });
    });
  };

  const startInspection = () => {
    patch((s) => ({ ...s, status: 'in_progress', startedAt: nowIso() }));
    logEvent('Inspection started', 'info', 'IN PROGRESS');
    inspectionAPI.updateStatus(sessionRef.current.inspectionId, { status: 'in_progress' }).catch(() => {
      queueInspectionUpdate(sessionRef.current.inspectionId, { status: 'in_progress' });
    });
  };

  const startVc = () => {
    patch((s) => {
      const incharge = { name: s.institution.incharge, role: 'Project Incharge' };
      const randomStaff = pickRandom(STAFF_POOL, 1);
      const participants = [
        { name: s.officer.name, role: 'Field Officer (you)', self: true },
        incharge,
        ...randomStaff.map((p) => ({ ...p })),
      ];
      return { ...s, vc: { ...s.vc, status: 'active', startedAt: nowIso(), participants } };
    });
    logEvent('Random video check started', 'info', 'VC LIVE');
  };

  const endVc = () => {
    patch((s) => ({ ...s, vc: { ...s.vc, status: 'ended', endedAt: nowIso() } }));
    logEvent('Random video check ended', 'ok', 'VC COMPLETED');
  };

  const askQuestion = (q) => {
    patch((s) => ({
      ...s,
      vc: {
        ...s.vc,
        askCount: s.vc.askCount + 1,
        questions: s.vc.questions.some((x) => x.id === q.id)
          ? s.vc.questions
          : [...s.vc.questions, { ...q, askedAt: nowIso(), verdict: 'pending' }],
      },
    }));
    logEvent(`Verification question raised: ${q.id.toUpperCase()}`, 'info');
  };

  const answerQuestion = (id, verdict) => {
    patch((s) => {
      const questions = s.vc.questions.map((q) => (q.id === id ? { ...q, verdict, answeredAt: nowIso() } : q));
      return {
        ...s,
        vc: {
          ...s.vc,
          questions,
          verified: questions.filter((q) => q.verdict === 'verified').length,
          flagged: questions.filter((q) => q.verdict === 'flagged').length,
        },
      };
    });
  };

  /* ------------------------------------------------- beneficiary verification */

  /**
   * Opens the beneficiary-verification step and draws a fresh random sample of
   * beneficiaries to check face-to-face / by QR. The sample is re-rolled on every
   * start so the institution cannot know in advance who will be verified.
   */
  const startBeneficiary = () => {
    patch((s) => {
      const sample = pickRandom(BENE_POOL, 3);
      return {
        ...s,
        beneficiary: {
          ...s.beneficiary,
          status: 'active',
          startedAt: nowIso(),
          selected: sample,
        },
      };
    });
    logEvent('Beneficiary verification started', 'info', `${3} RANDOM BENEFICIARIES DRAWN`);
  };

  const markBeneficiary = (tag, verdict) => {
    patch((s) => {
      const selected = s.beneficiary.selected.map((b) => (b.tag === tag ? { ...b, verdict } : b));
      return {
        ...s,
        beneficiary: {
          ...s.beneficiary,
          selected,
          verified: selected.filter((b) => b.verdict === 'verified').length,
          flagged: selected.filter((b) => b.verdict === 'flagged').length,
        },
      };
    });
  };

  const setBeneficiaryConsent = (granted) => {
    patch((s) => ({ ...s, beneficiary: { ...s.beneficiary, consent: granted } }));
  };

  const signBeneficiary = (signedBy) => {
    patch((s) => ({
      ...s,
      beneficiary: {
        ...s.beneficiary,
        inchargeSign: { by: signedBy, at: nowIso() },
        status: 'completed',
        completedAt: nowIso(),
      },
    }));
    logEvent('Incharge e-signature recorded', 'ok', signedBy);
  };

  const addEvidence = (item) => {
    const stamped = {
      ...item,
      id: item.id || `EV-${Date.now().toString(36).toUpperCase()}`,
      client_id: item.client_id || `${getClientId()}-${Date.now()}`,
      capturedAt: item.capturedAt || nowIso(),
      synced: onlineRef.current,
    };
    patch((s) => ({ ...s, evidence: [stamped, ...s.evidence] }));
    logEvent(`Evidence captured: ${stamped.label}`, 'ok', stamped.geoTag);
    if (onlineRef.current) {
      evidenceAPI.upload({
        inspection_id: sessionRef.current?.inspectionId,
        client_id: stamped.client_id,
        type: stamped.kind,
        geo_coords: { lat: stamped.lat, lng: stamped.lng },
        timestamp: stamped.capturedAt,
        file: stamped.dataUrl ? { uri: stamped.dataUrl, fileName: `${stamped.id}.jpg`, type: 'image/jpeg' } : undefined,
      }).catch(() => {
        queueEvidence({
          _id: stamped.client_id,
          client_id: stamped.client_id,
          inspection_id: sessionRef.current?.inspectionId,
          type: stamped.kind,
        });
        setSession((s) => ({
          ...s,
          evidence: s.evidence.map((e) => (e.client_id === stamped.client_id ? { ...e, synced: false } : e)),
        }));
      });
    } else {
      queueEvidence({
        _id: stamped.client_id,
        client_id: stamped.client_id,
        inspection_id: session.inspectionId,
        type: stamped.kind,
      });
    }
  };

  const setCheck = (itemId, value) => {
    patch((s) => ({ ...s, checklist: { ...s.checklist, [itemId]: value } }));
    inspectionAPI.saveChecklist(sessionRef.current.inspectionId, { itemId, value }).catch(() => {
      queueInspectionUpdate(sessionRef.current.inspectionId, { checklist: { [itemId]: value } });
    });
  };

  const removeEvidence = (id) => {
    patch((s) => ({ ...s, evidence: s.evidence.filter((e) => e.id !== id && e.client_id !== id) }));
    logEvent('Evidence removed', 'warn', String(id));
  };

  const setNotes = (text) => setSession((s) => ({ ...s, notes: text }));

  const runAi = async (force = false) => {
    if (sessionRef.current.ai.length && !force) return { cached: true };
    // Ask the central engine for findings it already raised on this inspection
    // (it runs the detectors when an inspection completes). Officers can read
    // their own findings; only the back office closes them out.
    let source = 'local';
    let serverAnomalies = null;
    if (onlineRef.current) {
      try {
        const { data } = await anomalyAPI.forInspection(sessionRef.current.inspectionId);
        if (Array.isArray(data.anomalies) && data.anomalies.length) {
          serverAnomalies = data.anomalies;
          source = 'server';
        }
      } catch (err) {
        // Server unreachable or nothing raised yet - the local fallback keeps
        // the demo moving, exactly as the LLD intends for a dead AI engine.
        serverAnomalies = null;
        source = 'local';
      }
    }
    patch((s) => ({
      ...s,
      ai: mapAnomalies(serverAnomalies, buildAnomalies()),
      aiSource: source,
    }));
    logEvent(
      'AI-assisted anomaly analysis complete',
      'warn',
      source === 'server' ? 'FROM CENTRAL ENGINE · HUMAN REVIEW REQUIRED' : 'LOCAL ENGINE · HUMAN REVIEW REQUIRED'
    );
    return { cached: false, source };
  };

  const verifyAnomaly = (id, ok) => {
    patch((s) => ({ ...s, ai: s.ai.map((a) => (a.id === id ? { ...a, verified: ok, verifiedAt: nowIso() } : a)) }));
  };

  const submit = async () => {
    const d = new Date();
    const stamp = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const reportId = `RPT-${d.getFullYear()}-${stamp}`;
    patch((s) => ({ ...s, status: 'submitted', submittedAt: nowIso(), reportId }));
    logEvent('Inspection report submitted', 'ok', reportId);
    try {
      await reportAPI.list({ inspection_id: sessionRef.current.inspectionId });
    } catch (err) {
      queueInspectionUpdate(sessionRef.current.inspectionId, { status: 'submitted', reportId });
    }
    return reportId;
  };

  const syncNow = async () => {
    if (syncing) return { skipped: true };
    setSyncing(true);
    try {
      const result = await flushQueue();
      const drained = (result.evidence?.synced || 0) + (result.inspections?.synced || 0);
      if (drained > 0) {
        setSession((s) => ({
          ...s,
          syncState: 'synced',
          evidence: s.evidence.map((e) => ({ ...e, synced: true })),
        }));
      } else {
        setSession((s) => ({ ...s, syncState: onlineRef.current ? 'synced' : 'pending' }));
      }
      logEvent(
        'Offline queue synchronised',
        'ok',
        `${result.evidence?.synced || 0} EVIDENCE · ${result.inspections?.synced || 0} UPDATES`
      );
      return result;
    } catch (err) {
      logEvent('Sync failed — will retry', 'warn', String(err?.message || err).slice(0, 80));
      return { error: err };
    } finally {
      setSyncing(false);
    }
  };

  const resetDemo = () => {
    const next = freshSession();
    setSession(next);
    setEvents([]);
  };

  /* ---------------------------------------------------------------- derived */

  const checklistDone = CHECKLIST_ITEMS.filter((i) => session.checklist[i.id]).length;
  const checklistTotal = CHECKLIST_ITEMS.length;
  const criticalCount = session.ai.filter((a) => a.severity === 'critical').length;
  const pendingEvidence = session.evidence.filter((e) => !e.synced).length;

  /** 8 inspection steps → single % used by Home / run / summary bars. */
  const overallPct = useMemo(() => {
    const steps = [
      Boolean(session.gps?.verified),
      session.vc.status === 'ended' || session.vc.status === 'active',
      session.beneficiary.status === 'completed' || session.beneficiary.status === 'active',
      session.evidence.length > 0,
      checklistDone > 0,
      checklistDone === checklistTotal,
      session.ai.length > 0,
      session.status === 'submitted',
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  }, [session.gps, session.vc.status, session.beneficiary.status, session.evidence.length, checklistDone, checklistTotal, session.ai.length, session.status]);

  const durationMin = useMemo(() => {
    if (!session.startedAt) return 0;
    const end = session.submittedAt ? Date.parse(session.submittedAt) : Date.now();
    return Math.max(1, Math.round((end - Date.parse(session.startedAt)) / 60000));
  }, [session.startedAt, session.submittedAt]);

  // The transition helpers close over refs + stable callbacks only, so the
  // value memo intentionally tracks data (session, online, …), not identity.
  /* eslint-disable react-hooks/exhaustive-deps */
  const value = useMemo(() => ({
    session, setSession, online, browserOnline, simulatedOffline, setSimulatedOffline,
    syncing, events, checklistDone, checklistTotal, criticalCount, pendingEvidence, durationMin,
    overallPct,
    accept, verifyGps, startInspection, startVc, endVc, askQuestion, answerQuestion,
    startBeneficiary, markBeneficiary, setBeneficiaryConsent, signBeneficiary,
    addEvidence, removeEvidence, setCheck, setNotes, runAi, verifyAnomaly, submit, syncNow, resetDemo, logEvent,
  }), [session, online, browserOnline, simulatedOffline, syncing, events, checklistDone, checklistTotal, criticalCount, pendingEvidence, durationMin, overallPct]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>;
};

export const useInspection = () => {
  const ctx = useContext(InspectionContext);
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider');
  return ctx;
};
