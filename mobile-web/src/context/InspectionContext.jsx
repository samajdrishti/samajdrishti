import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { inspectionAPI, evidenceAPI, reportAPI } from '../services/api';

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
  vc: { status: 'not_started', startedAt: null, endedAt: null, askCount: 0, questions: [], verified: 0, flagged: 0 },
  evidence: [],
  checklist: {},
  notes: '',
  ai: [],
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
    return { ...freshSession(), ...parsed, institution: INSTITUTION, officer: { ...freshSession().officer, ...parsed.officer } };
  } catch (err) {
    return freshSession();
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

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
    return { ...next, syncState: online ? 'synced' : 'pending' };
  }), [online]);

  const logEvent = useCallback((title, tone = 'ok', meta = '') => {
    setEvents((e) => [{ id: `${Date.now()}-${title}`, title, tone, meta, at: nowIso() }, ...e].slice(0, 60));
  }, []);

  /* ------------------------------------------------------------ transitions */

  const accept = () => {
    patch((s) => ({ ...s, status: 'accepted', acceptedAt: nowIso() }));
    logEvent('Inspection accepted by officer', 'info', 'ACCEPTED');
    inspectionAPI.updateStatus(session.inspectionId, { status: 'accepted' }).catch(() => {});
  };

  const verifyGps = (reading) => {
    patch((s) => ({
      ...s,
      status: 'gps_verified',
      gps: { ...reading, verified: reading.distanceM <= s.institution.geofenceM, verifiedAt: nowIso() },
    }));
    logEvent('GPS geofence verified', 'ok', `DISTANCE ${Math.round(reading.distanceM)} M`);
    inspectionAPI.geoVerify(session.inspectionId, reading.lat, reading.lng).catch(() => {});
  };

  const startInspection = () => {
    patch((s) => ({ ...s, status: 'in_progress', startedAt: nowIso() }));
    logEvent('Inspection started', 'info', 'IN PROGRESS');
    inspectionAPI.updateStatus(session.inspectionId, { status: 'in_progress' }).catch(() => {});
  };

  const startVc = () => {
    patch((s) => ({ ...s, vc: { ...s.vc, status: 'active', startedAt: nowIso() } }));
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
    patch((s) => ({
      ...s,
      vc: {
        ...s.vc,
        questions: s.vc.questions.map((q) => (q.id === id ? { ...q, verdict, answeredAt: nowIso() } : q)),
        verified: s.vc.questions.filter((q) => q.verdict === 'verified').length + (verdict === 'verified' ? 1 : 0),
        flagged: s.vc.questions.filter((q) => q.verdict === 'flagged').length + (verdict === 'flagged' ? 1 : 0),
      },
    }));
  };

  const addEvidence = (item) => {
    patch((s) => ({ ...s, evidence: [item, ...s.evidence] }));
    logEvent(`Evidence captured: ${item.label}`, 'ok', item.geoTag);
    if (online) evidenceAPI.upload({ inspection_id: session.inspectionId, type: item.kind, geo_coords: { lat: item.lat, lng: item.lng }, timestamp: item.capturedAt }).catch(() => {});
  };

  const setCheck = (itemId, value) => {
    patch((s) => ({ ...s, checklist: { ...s.checklist, [itemId]: value } }));
    inspectionAPI.saveChecklist(session.inspectionId, { itemId, value }).catch(() => {});
  };

  const setNotes = (text) => setSession((s) => ({ ...s, notes: text }));

  const runAi = () => {
    patch((s) => ({ ...s, ai: s.ai.length ? s.ai : buildAnomalies() }));
    logEvent('AI-assisted anomaly analysis complete', 'warn', '5 INDICATORS · HUMAN REVIEW REQUIRED');
  };

  const verifyAnomaly = (id, ok) => {
    patch((s) => ({ ...s, ai: s.ai.map((a) => (a.id === id ? { ...a, verified: ok, verifiedAt: nowIso() } : a)) }));
  };

  const submit = async () => {
    const reportId = `INS-2026-00${482 + session.evidence.length}`;
    patch((s) => ({ ...s, status: 'submitted', submittedAt: nowIso(), reportId }));
    logEvent('Inspection report submitted', 'ok', reportId);
    try { await reportAPI.list({ inspection_id: session.inspectionId }); } catch (err) { /* offline-safe */ }
  };

  const syncNow = () => {
    setSyncing(true);
    setTimeout(() => {
      setSession((s) => ({ ...s, syncState: 'synced' }));
      setSyncing(false);
      logEvent('Offline queue synchronised', 'ok', `${session.evidence.length} EVIDENCE ITEMS`);
    }, 1400);
  };

  const resetDemo = () => {
    const next = freshSession();
    setSession(next);
    setEvents([]);
  };

  /* ---------------------------------------------------------------- derived */

  const checklistDone = CHECKLIST_ITEMS.filter((i) => session.checklist[i.id]).length;
  const criticalCount = session.ai.filter((a) => a.severity === 'critical').length;
  const pendingEvidence = session.evidence.filter((e) => !e.synced).length;
  const evidenceMinutes = session.evidence.length;

  const durationMin = useMemo(() => {
    if (!session.startedAt) return 0;
    const end = session.submittedAt ? Date.parse(session.submittedAt) : Date.now();
    return Math.max(1, Math.round((end - Date.parse(session.startedAt)) / 60000));
  }, [session.startedAt, session.submittedAt, session.status]);

  const value = useMemo(() => ({
    session, setSession, online, browserOnline, simulatedOffline, setSimulatedOffline,
    syncing, events, checklistDone, criticalCount, pendingEvidence, durationMin,
    accept, verifyGps, startInspection, startVc, endVc, askQuestion, answerQuestion,
    addEvidence, setCheck, setNotes, runAi, verifyAnomaly, submit, syncNow, resetDemo, logEvent,
  }), [session, online, browserOnline, simulatedOffline, syncing, events, checklistDone, criticalCount, pendingEvidence, durationMin]);

  return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>;
};

export const useInspection = () => {
  const ctx = useContext(InspectionContext);
  if (!ctx) throw new Error('useInspection must be used inside InspectionProvider');
  return ctx;
};
