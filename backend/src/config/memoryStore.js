/**
 * Samaj Drishti - In-memory data driver (prototype "demo mode")
 *
 * The production deployment uses PostgreSQL (see ./db.js). When no PostgreSQL
 * server is reachable the API transparently falls back to this driver so the
 * whole prototype (admin dashboard + mobile API + AI engine) can be demoed on a
 * machine without a database. Every controller keeps using the exact same
 * `pool.query(sql, params) -> { rows }` contract.
 */
const bcrypt = require('bcryptjs');

const state = {
  users: [],
  projects: [],
  inspections: [],
  evidence: [],
  notifications: [],
  cameras: [],
  attendance: [],
  vc_sessions: [],
  vc_join_logs: [],
  audit: [],
  atrs: [],
  beneficiary_feedback: [],
  checklists: [],
  sequences: {
    users: 0, projects: 0, inspections: 0, evidence: 0, notifications: 0,
    cameras: 0, attendance: 0, vc_sessions: 0, vc_join_logs: 0, audit: 0,
    atrs: 0, beneficiary_feedback: 0, checklists: 0,
  },
};

const nextId = (table) => (state.sequences[table] += 1);
const nowIso = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const daysAhead = (n) => daysAgo(-n);

/* ------------------------------------------------------------------ helpers */

const projectById = (id) => state.projects.find((p) => Number(p.id) === Number(id));
const userById = (id) => state.users.find((u) => Number(u.id) === Number(id));
const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  department: u.department, phone: u.phone, created_at: u.created_at,
});

/** Emulates: SELECT i.*, p.name AS project_name, p.location, p.geo_coords ... */
const project = (i) => {
  const p = projectById(i.project_id) || {};
  return {
    ...i,
    project_name: p.name || null,
    location: p.location || null,
    geo_coords: p.geo_coords || null,
    budget: p.budget ?? null,
    project_status: p.status || null,
  };
};

/** Emulates the JOIN onto users for the official's name */
const withOfficial = (i) => {
  const u = userById(i.assigned_to) || {};
  const s = userById(i.supervisor_id) || {};
  return { ...project(i), official_name: u.name || null, supervisor_name: s.name || null };
};

const orderByCreatedAtDesc = (rows) =>
  [...rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

/* ------------------------------------------------------- query route table
 * The prototype only ever issues a small, fixed set of statements. Rather than
 * shipping a fragile SQL parser, each known statement is mapped to an explicit
 * handler below (most specific predicates first).
 */
const ROUTES = [
  {
    name: 'schema:create-tables',
    test: (sql) => /^CREATE TABLE IF NOT EXISTS/i.test(sql),
    run: () => ({ rows: [] }),
  },
  {
    name: 'users:insert',
    test: (sql) => sql.startsWith('INSERT INTO users'),
    run: (p) => {
      const user = {
        id: nextId('users'),
        name: p[0], email: p[1], password: p[2],
        role: p[3] || 'official', department: p[4] || null, phone: p[5] || null,
        created_at: nowIso(),
      };
      state.users.push(user);
      return { rows: [publicUser(user)] };
    },
  },
  {
    name: 'users:find-id-by-email',
    test: (sql) => sql.startsWith('SELECT id FROM users WHERE email'),
    run: (p) => {
      const u = state.users.find((x) => x.email.toLowerCase() === String(p[0]).toLowerCase());
      return { rows: u ? [{ id: u.id }] : [] };
    },
  },
  {
    name: 'users:find-by-email',
    test: (sql) => sql.startsWith('SELECT * FROM users WHERE email'),
    run: (p) => {
      const u = state.users.find((x) => x.email.toLowerCase() === String(p[0]).toLowerCase());
      return { rows: u ? [{ ...u }] : [] };
    },
  },
  {
    name: 'users:find-by-id',
    test: (sql) => sql.includes('FROM users WHERE id = $1'),
    run: (p) => {
      const u = userById(p[0]);
      return { rows: u ? [publicUser(u)] : [] };
    },
  },
  {
    name: 'users:list-by-role',
    test: (sql) => sql.includes('FROM users WHERE role'),
    run: (p) => {
      const role = p[0] || 'official';
      return { rows: state.users.filter((u) => u.role === role).map((u) => ({ id: u.id, name: u.name, role: u.role })) };
    },
  },
  {
    name: 'projects:insert',
    test: (sql) => sql.startsWith('INSERT INTO projects'),
    run: (p) => {
      const row = {
        id: nextId('projects'),
        name: p[0], description: p[1] || null, location: p[2] || null,
        department: p[3] || null,
        geo_coords: p[4] != null && p[5] != null ? { lat: Number(p[4]), lng: Number(p[5]) } : null,
        start_date: p[6] || null, end_date: p[7] || null,
        budget: p[8] != null ? Number(p[8]) : null,
        status: 'pending',
        created_at: nowIso(),
      };
      state.projects.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'projects:update',
    test: (sql) => sql.startsWith('UPDATE projects SET'),
    run: (p) => {
      const row = projectById(p[4]);
      if (!row) return { rows: [] };
      Object.assign(row, {
        name: p[0], description: p[1] || null,
        status: p[2] || row.status,
        budget: p[3] != null ? Number(p[3]) : row.budget,
      });
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'projects:find-by-id',
    test: (sql) => sql.startsWith('SELECT * FROM projects WHERE id'),
    run: (p) => {
      const row = projectById(p[0]);
      return { rows: row ? [{ ...row }] : [] };
    },
  },
  {
    name: 'projects:list',
    test: (sql) => sql.startsWith('SELECT * FROM projects'),
    run: () => ({ rows: orderByCreatedAtDesc(state.projects).map((r) => ({ ...r })) }),
  },
  {
    name: 'inspections:insert',
    test: (sql) => sql.startsWith('INSERT INTO inspections'),
    run: (p) => {
      const row = {
        id: nextId('inspections'),
        project_id: p[0] != null ? Number(p[0]) : null,
        assigned_to: p[1] != null ? Number(p[1]) : null,
        supervisor_id: null,
        status: 'pending',
        scheduled_date: p[2] || null,
        completed_date: null,
        ai_risk_score: p[3] != null ? Number(p[3]) : null,
        notes: null,
        created_at: nowIso(),
      };
      state.inspections.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'inspections:update-status',
    test: (sql) => sql.startsWith('UPDATE inspections SET'),
    run: (p) => {
      const row = state.inspections.find(
        (i) => Number(i.id) === Number(p[3]) && Number(i.assigned_to) === Number(p[4])
      );
      if (!row) return { rows: [] };
      Object.assign(row, {
        status: p[0],
        notes: p[1] != null ? p[1] : row.notes,
        completed_date: p[2] || row.completed_date,
      });
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'inspections:mine',
    test: (sql) => sql.includes('FROM inspections i') && sql.includes('i.assigned_to = $1'),
    run: (p) => ({
      rows: orderByCreatedAtDesc(
        state.inspections.filter((i) => Number(i.assigned_to) === Number(p[0]))
      ).map(project),
    }),
  },
  {
    name: 'inspections:find-by-id',
    test: (sql) => sql.includes('FROM inspections i') && sql.includes('i.id = $1'),
    run: (p) => {
      const row = state.inspections.find((i) => Number(i.id) === Number(p[0]));
      return { rows: row ? [withOfficial(row)] : [] };
    },
  },
  {
    name: 'inspections:list',
    test: (sql) => sql.includes('FROM inspections i'),
    run: () => ({ rows: orderByCreatedAtDesc(state.inspections).map(withOfficial) }),
  },
  {
    name: 'inspections:list-raw',
    test: (sql) => sql.startsWith('SELECT * FROM inspections'),
    run: () => ({ rows: orderByCreatedAtDesc(state.inspections).map((r) => ({ ...r })) }),
  },
  {
    name: 'inspections:assignment-history',
    test: (sql) => sql.startsWith('SELECT assigned_to FROM inspections'),
    run: () => ({
      rows: state.inspections
        .filter((i) => i.assigned_to != null)
        .map((i) => ({ assigned_to: i.assigned_to })),
    }),
  },
  {
    name: 'evidence:insert',
    test: (sql) => sql.startsWith('INSERT INTO evidence'),
    run: (p) => {
      const row = {
        id: nextId('evidence'),
        inspection_id: p[0] != null ? Number(p[0]) : null,
        type: p[1] || 'photo',
        file_path: p[2] || null,
        geo_coords: p[3] != null && p[4] != null ? { lat: Number(p[3]), lng: Number(p[4]) } : null,
        timestamp: p[5] || nowIso(),
        sha256_hash: p[6] || null,
        previous_hash: p[7] || null,
        file_size: p[8] != null ? Number(p[8]) : null,
        mime_type: p[9] || null,
        verified: false,
        hash_verified: false,
        verified_at: null,
        integrity_status: 'unverified',
        created_at: nowIso(),
      };
      state.evidence.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    // Chain read: every item of one inspection, oldest first, so the links
    // (previous_hash -> sha256_hash) can be walked in order.
    name: 'evidence:chain',
    test: (sql) => sql.startsWith('SELECT * FROM evidence') && sql.includes('ORDER BY id ASC'),
    run: (p) => ({
      rows: state.evidence
        .filter((e) => Number(e.inspection_id) === Number(p[0]))
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((e) => ({ ...e })),
    }),
  },
  {
    name: 'evidence:find-by-id',
    test: (sql) => sql.startsWith('SELECT * FROM evidence WHERE id'),
    run: (p) => {
      const row = state.evidence.find((e) => Number(e.id) === Number(p[0]));
      return { rows: row ? [{ ...row }] : [] };
    },
  },
  {
    name: 'evidence:verify',
    test: (sql) => sql.startsWith('UPDATE evidence SET verified'),
    run: (p) => {
      const row = state.evidence.find((e) => Number(e.id) === Number(p[0]));
      if (!row) return { rows: [] };
      row.verified = p[1] === true;
      row.hash_verified = p[2] === true;
      row.integrity_status = p[3] || row.integrity_status || 'unverified';
      row.verified_at = p[4] || row.verified_at || null;
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'evidence:by-inspection',
    test: (sql) => sql.includes('FROM evidence') && sql.includes('inspection_id = $1'),
    run: (p) => ({
      rows: orderByCreatedAtDesc(
        state.evidence.filter((e) => Number(e.inspection_id) === Number(p[0]))
      ).map((r) => ({ ...r })),
    }),
  },
  {
    name: 'evidence:list',
    test: (sql) => sql.startsWith('SELECT * FROM evidence'),
    run: () => ({ rows: orderByCreatedAtDesc(state.evidence).map((r) => ({ ...r })) }),
  },
  {
    name: 'notifications:insert',
    test: (sql) => sql.startsWith('INSERT INTO notifications'),
    run: (p) => {
      const row = {
        id: nextId('notifications'),
        user_id: Number(p[0]),
        message: p[1],
        type: p[2] || 'info',
        read: false,
        created_at: nowIso(),
      };
      state.notifications.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'notifications:mark-read',
    test: (sql) => sql.startsWith('UPDATE notifications SET read'),
    run: (p) => {
      const row = state.notifications.find(
        (n) => Number(n.id) === Number(p[0]) && Number(n.user_id) === Number(p[1])
      );
      if (!row) return { rows: [] };
      row.read = true;
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'notifications:list',
    test: (sql) => sql.startsWith('SELECT * FROM notifications'),
    run: (p) => ({
      rows: orderByCreatedAtDesc(
        state.notifications.filter((n) => Number(n.user_id) === Number(p[0]))
      ).slice(0, 50).map((r) => ({ ...r })),
    }),
  },
  {
    name: 'cameras:insert',
    test: (sql) => sql.startsWith('INSERT INTO cameras'),
    run: (p) => {
      const row = {
        id: nextId('cameras'),
        name: p[0],
        project_id: p[1] != null ? Number(p[1]) : null,
        location: p[2] || null,
        stream_type: p[3] || 'simulated',
        stream_url: p[4] || null,
        geo_coords: p[5] != null && p[6] != null ? { lat: Number(p[5]), lng: Number(p[6]) } : null,
        status: 'online',
        last_seen: nowIso(),
        created_at: nowIso(),
      };
      state.cameras.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'cameras:update',
    test: (sql) => sql.startsWith('UPDATE cameras SET'),
    run: (p) => {
      const row = state.cameras.find((c) => Number(c.id) === Number(p[2]));
      if (!row) return { rows: [] };
      row.status = p[0];
      row.last_seen = p[1] || row.last_seen;
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'cameras:find-by-id',
    test: (sql) => sql.startsWith('SELECT * FROM cameras WHERE id'),
    run: (p) => {
      const row = state.cameras.find((c) => Number(c.id) === Number(p[0]));
      return { rows: row ? [{ ...row }] : [] };
    },
  },
  {
    name: 'cameras:list',
    test: (sql) => sql.startsWith('SELECT * FROM cameras'),
    run: () => ({ rows: state.cameras.map((c) => ({ ...c })) }),
  },
  {
    name: 'attendance:insert',
    test: (sql) => sql.startsWith('INSERT INTO attendance'),
    run: (p, sql) => {
      // The check-in statement hard-codes `check_out` as a literal NULL in its
      // VALUES list and therefore passes 8 parameters, while the 9-parameter
      // form binds a real value there. (Previously the latitude shifted into
      // check_out, which broke duplicate detection and check-out.)
      const hardCodedNullCheckOut = /VALUES\s*\(\s*\$\d+\s*,\s*\$\d+\s*,\s*\$\d+\s*,\s*NULL\b/i.test(sql);
      const at = hardCodedNullCheckOut
        ? { checkOut: null, lat: 3, lng: 4, device: 5, mode: 6, date: 7 }
        : { checkOut: 3, lat: 4, lng: 5, device: 6, mode: 7, date: 8 };
      const row = {
        id: nextId('attendance'),
        official_id: Number(p[0]),
        project_id: p[1] != null ? Number(p[1]) : null,
        check_in: p[2] || null,
        check_out: at.checkOut != null ? p[at.checkOut] || null : null,
        geo_coords: p[at.lat] != null && p[at.lng] != null
          ? { lat: Number(p[at.lat]), lng: Number(p[at.lng]) }
          : null,
        device: p[at.device] || null,
        mode: p[at.mode] || 'gps',
        date: p[at.date] || new Date().toISOString().slice(0, 10),
        created_at: nowIso(),
      };
      state.attendance.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'attendance:update',
    test: (sql) => sql.startsWith('UPDATE attendance SET'),
    run: (p) => {
      const row = state.attendance.find((a) => Number(a.id) === Number(p[3]));
      if (!row) return { rows: [] };
      row.check_out = p[0];
      if (p[1] != null && p[2] != null) row.geo_coords = { lat: Number(p[1]), lng: Number(p[2]) };
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'attendance:list',
    test: (sql) => sql.startsWith('SELECT * FROM attendance'),
    run: () => ({ rows: [...state.attendance].reverse().map((a) => ({ ...a })) }),
  },
  {
    name: 'vc_sessions:insert',
    test: (sql) => sql.startsWith('INSERT INTO vc_sessions'),
    run: (p) => {
      const row = {
        id: nextId('vc_sessions'),
        room_id: p[0],
        project_id: p[1] != null ? Number(p[1]) : null,
        official_id: p[2] != null ? Number(p[2]) : null,
        mode: p[3] || 'random',
        status: p[4] || 'scheduled',
        scheduled_at: p[5] || nowIso(),
        started_at: null,
        ended_at: null,
        join_url: p[6] || null,
        created_at: nowIso(),
      };
      state.vc_sessions.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'vc_sessions:end',
    test: (sql) => sql.startsWith('UPDATE vc_sessions SET'),
    run: (p) => {
      const row = state.vc_sessions.find((s) => Number(s.id) === Number(p[2]));
      if (!row) return { rows: [] };
      row.status = p[0];
      row.ended_at = p[1];
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'vc_sessions:find-by-id',
    test: (sql) => sql.startsWith('SELECT * FROM vc_sessions WHERE id'),
    run: (p) => {
      const row = state.vc_sessions.find((s) => Number(s.id) === Number(p[0]));
      return { rows: row ? [{ ...row }] : [] };
    },
  },
  {
    name: 'vc_sessions:list',
    test: (sql) => sql.startsWith('SELECT * FROM vc_sessions'),
    run: () => ({ rows: [...state.vc_sessions].reverse().map((s) => ({ ...s })) }),
  },
  {
    name: 'vc_join_logs:insert',
    test: (sql) => sql.startsWith('INSERT INTO vc_join_logs'),
    run: (p) => {
      const row = {
        id: nextId('vc_join_logs'),
        session_id: Number(p[0]),
        user_id: p[1] != null ? Number(p[1]) : null,
        action: p[2] || 'join',
        created_at: nowIso(),
      };
      state.vc_join_logs.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'vc_join_logs:list',
    test: (sql) => sql.startsWith('SELECT * FROM vc_join_logs'),
    run: (p) => ({
      rows: [...state.vc_join_logs].reverse()
        .filter((l) => (p[0] ? Number(l.session_id) === Number(p[0]) : true))
        .map((l) => ({ ...l })),
    }),
  },
  {
    name: 'audit:insert',
    test: (sql) => sql.startsWith('INSERT INTO audit'),
    run: (p) => {
      const row = {
        id: nextId('audit'),
        actor_id: p[0] != null ? Number(p[0]) : null,
        actor_name: p[1] || 'system',
        action: p[2],
        entity: p[3],
        entity_id: p[4] != null ? Number(p[4]) : null,
        meta: p[5] || null,
        created_at: nowIso(),
      };
      state.audit.push(row);
      return { rows: [{ ...row }] };
    },
  },
  {
    name: 'audit:list-by-entity',
    test: (sql) => sql.startsWith('SELECT * FROM audit WHERE entity'),
    run: (p) => ({
      rows: [...state.audit].reverse()
        .filter((a) => a.entity === p[0] && Number(a.entity_id) === Number(p[1]))
        .map((a) => ({ ...a })),
    }),
  },
  {
    name: 'audit:list',
    test: (sql) => sql.startsWith('SELECT * FROM audit'),
    run: () => ({ rows: [...state.audit].reverse().map((a) => ({ ...a })) }),
  },
  /**
   * Generic SELECT fallback (last resort - every specific route above wins).
   * Handles the narrow shape the controllers actually emit:
   *   SELECT <cols|*> FROM <table> [WHERE col = $n [AND ...]] [ORDER BY col [DESC]] [LIMIT n]
   * Anything with joins, aggregates or non-equality predicates returns null so
   * the caller gets a clear "unsupported statement" error instead of wrong data.
   */
  {
    name: 'generic:select',
    test: (sql) => /^SELECT\s/i.test(sql),
    run: (params, sql) => {
      const result = genericSelect(sql, params);
      if (!result) {
        const err = new Error(`[demo-mode] Unsupported SQL statement: ${sql.slice(0, 140)}`);
        err.code = 'DEMO_DB_UNSUPPORTED';
        throw err;
      }
      return result;
    },
  },
];

/* ---------------------------------------------------------------- seed data
 * Deterministic demo dataset so the dashboard, the mobile app and the AI
 * engine all have meaningful content on first boot.
 */
const makeRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const DEMO_USERS = [
  ['Dr. Anjali Verma', 'admin@samajdrishti.gov.in', 'admin', 'Central PMU, DoSJE', '+91 98100 11223'],
  ['Vikram Singh', 'supervisor@samajdrishti.gov.in', 'supervisor', 'Haryana Zonal Monitoring Cell', '+91 98100 44556'],
  ['Arun Kumar', 'official1@samajdrishti.gov.in', 'official', 'PMU Field Inspection Wing', '+91 98110 77881'],
  ['Priya Sharma', 'official2@samajdrishti.gov.in', 'official', 'Social Welfare Audit Unit', '+91 98110 77882'],
  ['Amit Patel', 'official3@samajdrishti.gov.in', 'official', 'Rehab Monitoring Cell', '+91 98110 77883'],
  ['Sunita Devi', 'official4@samajdrishti.gov.in', 'official', 'PwD Empowerment Division', '+91 98110 77884'],
  ['Chaubisee Vikas Sangh Admin', 'ngo@chaubisee.org', 'ngo', 'Chaubisee Senior Home, Rohtak', '+91 98110 33445'],
  ['Rameshwar Prasad', 'beneficiary@samajdrishti.gov.in', 'beneficiary', 'Resident Beneficiary (Rohtak)', '+91 98110 99887'],
];

const DEMO_PASSWORDS = {
  admin: 'Admin@123',
  supervisor: 'Super@123',
  official: 'Official@123',
  ngo: 'Ngo@123',
  beneficiary: 'Beneficiary@123',
};

const DEMO_PROJECTS = [
  [
    'Chaubisee Vikas Sangh - Senior Citizen Home (AVYAY)',
    '50-Bed Senior Citizen Home funded under AVYAY scheme. Critical audit focus due to historical proxy attendance and unverified headcount records. Case Study: Deficiencies flagged 2020 -> Grant cancelled -> Revived 2022 -> Fraudulent surprise inspection detected Nov 2023 -> Blacklisted.',
    'Meham, Rohtak, Haryana',
    'AVYAY',
    4200000,
    'flagged',
    { lat: 28.8955, lng: 76.6066 },
    {
      scheme: 'AVYAY',
      sanction_code: 'DoSJE/AVYAY/HAR/2020-095',
      sanctioned_capacity: 50,
      verified_headcount: 14,
      aebas_punch_count: 47,
      discrepancy_delta: 33,
      head: {
        name: 'Mrs. Kavita Rathi',
        designation: 'Warden & Center In-charge',
        phone: '+91 98110 33445',
        email: 'ngo@chaubisee.org',
        since: '2022-12-21',
      },
      case_timeline: [
        { date: '2020-08-13', event: 'PMU Inspection: Major infrastructure & attendance deficiencies flagged.' },
        { date: '2020-10-15', event: 'GIA Grant instalment cancelled by DoSJE order.' },
        { date: '2022-12-21', event: 'Conditional revival following NGO compliance affidavit.' },
        { date: '2023-11-17', event: 'Fraudulent surprise inspection attempt detected: geo-spoofing alert raised.' },
        { date: '2024-07-18', event: 'DoSJE Formal Order: Chaubisee Vikas Sangh permanently blacklisted.' },
      ]
    }
  ],
  [
    'Vrindavan Vridhashram & Geriatric Sanctuary (AVYAY)',
    '100-Capacity Geriatric Assisted Living Center providing nutrition, healthcare, physiotherapy and shelter under Atal Vayo Abhyuday Yojana.',
    'Chhatikara Road, Vrindavan, Mathura, UP',
    'AVYAY',
    6800000,
    'active',
    { lat: 27.5828, lng: 77.7006 },
    {
      scheme: 'AVYAY',
      sanction_code: 'DoSJE/AVYAY/UP/2023-112',
      sanctioned_capacity: 100,
      verified_headcount: 94,
      aebas_punch_count: 96,
      discrepancy_delta: 2,
      head: {
        name: 'Shri Ramanand Shastri',
        designation: 'Trustee & Center Head',
        phone: '+91 98370 21144',
        email: 'head.vrindavan@avyay-ngo.org',
        since: '2023-06-10',
      },
    }
  ],
  [
    'Navjyoti Drug De-Addiction & Rehab Center (NAPDDR)',
    '30-Bed Inpatient De-addiction & Psychosocial Rehabilitation Facility under the National Action Plan for Drug Demand Reduction.',
    'Sector 31, Gurugram, Haryana',
    'NAPDDR',
    5400000,
    'active',
    { lat: 28.4595, lng: 77.0266 },
    {
      scheme: 'NAPDDR',
      sanction_code: 'DoSJE/NAPDDR/HAR/2022-041',
      sanctioned_capacity: 30,
      verified_headcount: 27,
      aebas_punch_count: 28,
      discrepancy_delta: 1,
      head: {
        name: 'Dr. Sanjay Kapoor',
        designation: 'Medical Director & Center Head',
        phone: '+91 98188 77321',
        email: 'director@navjyoti-rehab.org',
        since: '2022-04-01',
      },
    }
  ],
  [
    'Sankalp Nasha Mukti Kendra (NAPDDR)',
    '45-Capacity Integrated Rehabilitation Center for Addicts (IRCA) providing medical detox, cognitive therapy and aftercare.',
    'Kolar Road, Bhopal, Madhya Pradesh',
    'NAPDDR',
    4600000,
    'active',
    { lat: 23.1765, lng: 77.4349 },
    {
      scheme: 'NAPDDR',
      sanction_code: 'DoSJE/NAPDDR/MP/2023-088',
      sanctioned_capacity: 45,
      verified_headcount: 41,
      aebas_punch_count: 42,
      discrepancy_delta: 1,
      head: {
        name: 'Mr. Devendra Malviya',
        designation: 'Center Administrator',
        phone: '+91 94250 66512',
        email: 'admin@sankalp-nmk.org',
        since: '2023-08-19',
      },
    }
  ],
  [
    'Samarth Divyangjan Skill & Empowerment Center (SIPDA)',
    'Vocational Training and Assistive Technology Center for Persons with Disabilities under SIPDA scheme, offering barrier-free labs and certified trades.',
    'Sitapura Industrial Area, Jaipur, Rajasthan',
    'SIPDA',
    7200000,
    'active',
    { lat: 26.7820, lng: 75.8242 },
    {
      scheme: 'SIPDA',
      sanction_code: 'DoSJE/SIPDA/RAJ/2021-019',
      sanctioned_capacity: 60,
      verified_headcount: 58,
      aebas_punch_count: 58,
      discrepancy_delta: 0,
      head: {
        name: 'Prof. Anjana Chaturvedi',
        designation: 'Principal & Center Head',
        phone: '+91 94140 89220',
        email: 'principal@samarth-divyangjan.org',
        since: '2021-05-03',
      },
    }
  ],
  [
    'Niramaya PwD Vocational & Assistive Training Hub (SIPDA)',
    'Skill development institution specializing in assistive digital tools, speech synthesis workstations and mobility training.',
    'Vibhuti Khand, Gomti Nagar, Lucknow, UP',
    'SIPDA',
    5900000,
    'active',
    { lat: 26.8467, lng: 80.9462 },
    {
      scheme: 'SIPDA',
      sanction_code: 'DoSJE/SIPDA/UP/2022-073',
      sanctioned_capacity: 50,
      verified_headcount: 46,
      aebas_punch_count: 48,
      discrepancy_delta: 2,
      head: {
        name: 'Dr. Meera Tripathi',
        designation: 'Director & Center Head',
        phone: '+91 98390 44517',
        email: 'head@niramaya-hub.org',
        since: '2022-07-11',
      },
    }
  ],
  [
    'Asha Kiran De-Addiction & Counseling Sanctuary (NAPDDR)',
    'Community-based substance use treatment facility offering outpatient opioid substitution therapy and relapse prevention counseling.',
    'Majitha Road, Amritsar, Punjab',
    'NAPDDR',
    5100000,
    'active',
    { lat: 31.6340, lng: 74.8723 },
    {
      scheme: 'NAPDDR',
      sanction_code: 'DoSJE/NAPDDR/PB/2023-015',
      sanctioned_capacity: 35,
      verified_headcount: 32,
      aebas_punch_count: 34,
      discrepancy_delta: 2,
      head: {
        name: 'Dr. Harpreet Singh Sandhu',
        designation: 'Clinical Head & In-charge',
        phone: '+91 98720 11654',
        email: 'clinical.head@ashakiran-sanctuary.org',
        since: '2023-02-27',
      },
    }
  ],
  [
    'Snehalaya Senior Care & Day Living Center (AVYAY)',
    'Community day living center and palliative elder care facility funded under the regional AVYAY elderly protection mandate.',
    'Kothrud, Pune, Maharashtra',
    'AVYAY',
    3900000,
    'completed',
    { lat: 18.5074, lng: 73.8077 },
    {
      scheme: 'AVYAY',
      sanction_code: 'DoSJE/AVYAY/MH/2022-064',
      sanctioned_capacity: 40,
      verified_headcount: 38,
      aebas_punch_count: 38,
      discrepancy_delta: 0,
      head: {
        name: 'Mrs. Sunanda Joshi',
        designation: 'Day-Care Coordinator & Head',
        phone: '+91 98220 55319',
        email: 'care@snehalaya-pune.org',
        since: '2022-11-05',
      },
    }
  ],
  [
    'Punarjeevan Nasha Mukti Kendra & Rehab (NAPDDR)',
    'Integrated Rehabilitation Centre for Addicts with medical detoxification, psychosocial counselling and vocational aftercare under the National Action Plan for Drug Demand Reduction.',
    'Nashik Road, Nashik, Maharashtra',
    'NAPDDR',
    4800000,
    'active',
    { lat: 19.9975, lng: 73.7898 },
    {
      scheme: 'NAPDDR',
      sanction_code: 'DoSJE/NAPDDR/MH/2023-052',
      sanctioned_capacity: 40,
      verified_headcount: 37,
      aebas_punch_count: 39,
      discrepancy_delta: 2,
      head: {
        name: 'Dr. Prakash Deshmukh',
        designation: 'Center Head & Chief Counsellor',
        phone: '+91 98230 44781',
        email: 'head@punarjeevan-rehab.org',
        since: '2023-01-16',
      },
    }
  ],
  [
    'Saksham Divyangjan Skill Academy (SIPDA)',
    'Vidarbha skilling hub for persons with disabilities offering certified trades, barrier-free assistive-technology labs and placement support under SIPDA.',
    'MIHAN, Nagpur, Maharashtra',
    'SIPDA',
    6400000,
    'active',
    { lat: 21.1458, lng: 79.0882 },
    {
      scheme: 'SIPDA',
      sanction_code: 'DoSJE/SIPDA/MH/2022-036',
      sanctioned_capacity: 70,
      verified_headcount: 64,
      aebas_punch_count: 66,
      discrepancy_delta: 2,
      head: {
        name: 'Mrs. Ashwini Kulkarni',
        designation: 'Principal & Center Head',
        phone: '+91 97650 22318',
        email: 'principal@saksham-academy.org',
        since: '2022-09-12',
      },
    }
  ],
];

const seedUsers = () => {
  const hashes = {};
  Object.entries(DEMO_PASSWORDS).forEach(([role, pw]) => {
    hashes[role] = bcrypt.hashSync(pw, 8);
  });

  DEMO_USERS.forEach(([name, email, role, department, phone], idx) => {
    state.users.push({
      id: nextId('users'),
      name,
      email,
      password: hashes[role] || hashes.official,
      role,
      department,
      phone,
      created_at: new Date(Date.now() - (30 - idx) * 86400000).toISOString(),
    });
  });

  DEMO_PROJECTS.forEach(([name, description, location, department, budget, status, geo_coords, metadata], idx) => {
    state.projects.push({
      id: nextId('projects'),
      name,
      description,
      location,
      department,
      geo_coords: geo_coords || { lat: 18.5 + idx * 0.07, lng: 73.85 + idx * 0.09 },
      start_date: daysAgo(200 - idx * 12),
      end_date: daysAhead(120 + idx * 10),
      budget,
      status,
      metadata: metadata || {},
      created_at: new Date(Date.now() - (40 - idx) * 86400000).toISOString(),
    });
  });
};

const seedOperations = () => {
  const officialIds = state.users.filter((u) => u.role === 'official').map((u) => u.id);
  const supervisorId = (state.users.find((u) => u.role === 'supervisor') || {}).id || null;
  const rand = makeRandom(20260601);
  const statuses = ['completed', 'completed', 'completed', 'in_progress', 'pending', 'flagged'];

  state.projects.forEach((proj, pIdx) => {
    const perProject = 2 + (pIdx % 3);
    for (let k = 0; k < perProject; k += 1) {
      let status = statuses[Math.floor(rand() * statuses.length)];
      if (proj.id === 1 && k === 0) status = 'flagged'; // Chaubisee Vikas Sangh is flagged

      const upcoming = status === 'pending' || status === 'in_progress';
      const scheduled = upcoming
        ? daysAhead(1 + Math.floor(rand() * 6))
        : daysAgo(2 + Math.floor(rand() * 28));
      const done = status === 'completed' || status === 'flagged';

      const riskScore = proj.id === 1 ? 88.5 : Number((18 + rand() * 65).toFixed(2));
      const note = proj.id === 1
        ? 'CRITICAL DEFICIENCY: Surprise inspection detected only 14 elderly residents physically present against 47 marked in AEBAS attendance. Doctor visit logbook missing since 3 weeks.'
        : status === 'flagged'
        ? 'Discrepancy observed between the reported beneficiary count and physical site headcount.'
        : null;

      state.inspections.push({
        id: nextId('inspections'),
        project_id: proj.id,
        assigned_to: officialIds[(pIdx + k) % officialIds.length],
        supervisor_id: supervisorId,
        status,
        scheduled_date: scheduled,
        completed_date: done ? scheduled : null,
        ai_risk_score: riskScore,
        notes: note,
        created_at: new Date(Date.now() - (25 - (pIdx * 2 + k)) * 86400000).toISOString(),
      });
    }
  });

  state.inspections
    .filter((i) => i.status === 'completed' || i.status === 'flagged')
    .slice(0, 10)
    .forEach((insp, idx) => {
      const project = state.projects.find((p) => Number(p.id) === Number(insp.project_id)) || {};
      const base = project.geo_coords || { lat: 28.8955, lng: 76.6066 };
      state.evidence.push({
        id: nextId('evidence'),
        inspection_id: insp.id,
        type: idx % 3 === 2 ? 'video' : 'photo',
        file_path: `/uploads/evidence/demo-${insp.id}.${idx % 3 === 2 ? 'mp4' : 'jpg'}`,
        geo_coords: { lat: base.lat + 0.0003, lng: base.lng + 0.0003 },
        timestamp: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
        verified: insp.status !== 'flagged',
        created_at: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
      });
    });

  // Seed Action Taken Reports (ATRs)
  state.atrs = [
    {
      id: 1,
      project_id: 1,
      project_name: 'Chaubisee Vikas Sangh - Senior Citizen Home (AVYAY)',
      inspection_id: 1,
      scheme: 'AVYAY',
      deficiency_title: 'Severe Ghost Beneficiaries & Proxy Biometric Attendance (47 punched vs 14 present)',
      deficiency_details: 'Surprise inspection on site revealed only 14 residents physically present against 47 marked in AEBAS biometric system. Doctor visit logbook missing for 21 days.',
      deadline: '2024-07-25',
      status: 'escalated',
      ngo_reply: 'Doctor was called for urgent family duty. Several senior residents had gone to native village for local fair.',
      corrective_evidence_url: '/uploads/evidence/atr-chaubisee-reply.pdf',
      pmu_adjudication: 'REJECTED - Forensic audit confirmed automated proxy punching cards used by warden. DoSJE issued formal Blacklist Notice Order #2024/DoSJE/119.',
      official_name: 'Dr. Anjali Verma',
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    {
      id: 2,
      project_id: 3,
      project_name: 'Navjyoti Drug De-Addiction & Rehab Center (NAPDDR)',
      inspection_id: 3,
      scheme: 'NAPDDR',
      deficiency_title: 'Controlled Sedative Medicine Stock Discrepancy & CCTV blindspot',
      deficiency_details: 'Psychotropic medication register showed 12 tablets of clonazepam unaccounted for; female counseling corner CCTV tilted toward wall.',
      deadline: '2026-10-10',
      status: 'under_review',
      ngo_reply: 'Dispensing log signed by Dr. Kapoor was pending entry into online register. CCTV bracket realigned and sealed with tamper-evident tape.',
      corrective_evidence_url: '/uploads/evidence/atr-navjyoti-proof.jpg',
      pmu_adjudication: 'PENDING_OFFICIAL_VERIFICATION - Inspector Arun Kumar scheduled for spot confirmation.',
      official_name: 'Vikram Singh',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
    {
      id: 3,
      project_id: 5,
      project_name: 'Samarth Divyangjan Skill & Empowerment Center (SIPDA)',
      inspection_id: 5,
      scheme: 'SIPDA',
      deficiency_title: 'Tactile Paving Discontinuity & Ramp Gradient Adjustment',
      deficiency_details: 'Wheelchair access ramp to 1st Floor lab slightly exceeded 1:12 slope ratio; tactile guide strips missing at library threshold.',
      deadline: '2026-10-15',
      status: 'approved_closed',
      ngo_reply: 'Replaced ramp with CPWD-compliant aluminium modular ramp (1:14 slope) and installed yellow tactile paving dots throughout.',
      corrective_evidence_url: '/uploads/evidence/atr-samarth-ramp.jpg',
      pmu_adjudication: 'APPROVED_AND_CLOSED - Geo-tagged photos verified compliant with RPwD Act 2016 guidelines.',
      official_name: 'Dr. Anjali Verma',
      created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  // Seed Beneficiary Feedback (Social Audit)
  state.beneficiary_feedback = [
    {
      id: 1,
      project_id: 2,
      project_name: 'Vrindavan Vridhashram & Geriatric Sanctuary (AVYAY)',
      beneficiary_name: 'Kailash Nath Sharma (Age 74)',
      scheme: 'AVYAY',
      category: 'Nutrition & Meals',
      rating: 5,
      comment: 'Warm khichdi, seasonal fruits, and clean drinking water provided twice daily. Doctor visits every Tuesday morning without fail.',
      sentiment: 'positive',
      verified_resident: true,
      voice_memo_recorded: true,
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: 2,
      project_id: 1,
      project_name: 'Chaubisee Vikas Sangh - Senior Citizen Home (AVYAY)',
      beneficiary_name: 'Rameshwar Prasad (Age 69)',
      scheme: 'AVYAY',
      category: 'Resident Amenities & Living Conditions',
      rating: 1,
      comment: 'Most of the listed 50 residents are never here. The warden only brings people when government officers arrive. No doctor has visited for a month.',
      sentiment: 'critical',
      verified_resident: true,
      voice_memo_recorded: true,
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    },
    {
      id: 3,
      project_id: 5,
      project_name: 'Samarth Divyangjan Skill Center (SIPDA)',
      beneficiary_name: 'Meena Kumari (PwD Trainee, Orthopedic)',
      scheme: 'SIPDA',
      category: 'Accessibility & Skill Equipment',
      rating: 5,
      comment: 'Screen reader software and specialized mouse equipment allowed me to complete the data entry certification. Ramp is now very smooth.',
      sentiment: 'positive',
      verified_resident: true,
      voice_memo_recorded: false,
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 4,
      project_id: 3,
      project_name: 'Navjyoti Rehab Center (NAPDDR)',
      beneficiary_name: 'Harpreet Singh (Inpatient)',
      scheme: 'NAPDDR',
      category: 'Medical Care & Counseling',
      rating: 4,
      comment: 'Counseling sessions are held daily at 10 AM. Medicine schedule is strictly maintained by nursing staff.',
      sentiment: 'positive',
      verified_resident: true,
      voice_memo_recorded: true,
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ];

  const adminId = state.users[0].id;
  [
    [adminId, 'Chaubisee Vikas Sangh (Rohtak) flagged: 84.5% CCTV obstruction & attendance discrepancy.', 'alert'],
    [adminId, 'AI Transparent Random Assigner generated balanced schedule with Zero-Conflict scoring.', 'info'],
    [adminId, 'Action Taken Report (ATR) received from Navjyoti Rehab Center awaiting adjudication.', 'warning'],
    [officialIds[0], 'Assigned surprise inspection: Vrindavan Vridhashram under AVYAY scheme.', 'info'],
    [officialIds[1], 'Reminder: Verify NavIC dual-constellation lock when reporting at site.', 'warning'],
  ].forEach(([userId, message, type], idx) => {
    state.notifications.push({
      id: nextId('notifications'),
      user_id: userId,
      message,
      type,
      read: idx > 3,
      created_at: new Date(Date.now() - idx * 3600000).toISOString(),
    });
  });
};

const VC_BASE_URL = process.env.VC_BASE_URL || 'https://meet.jit.si';

const seedMonitoring = () => {
  const officialIds = state.users.filter((u) => u.role === 'official').map((u) => u.id);
  const rand = makeRandom(776611);

  // --- CCTV / monitoring with AI Anomaly flags -----------------------------
  const cameraSpecs = [
    ['Chaubisee Main Hall CCTV', 1, 'Main Resident Hall, Rohtak', 'simulated', null, {
      tamper_flag: 'obstruction_detected',
      occlusion_pct: 84.5,
      detected_headcount: 14,
      aebas_punch_count: 47,
      anomaly_note: 'AI Alert: 84.5% lens obstruction detected (cardboard/cloth placed over lens to conceal low occupancy)',
    }],
    ['Chaubisee Dormitory CCTV', 1, 'Senior Dormitory A, Rohtak', 'simulated', null, {
      tamper_flag: 'headcount_discrepancy',
      occlusion_pct: 0,
      detected_headcount: 4,
      aebas_punch_count: 25,
      anomaly_note: 'AI Alert: Severe occupancy mismatch (4 physical vs 25 biometric punches logged)',
    }],
    ['Vrindavan Medical Room CCTV', 2, 'Doctor Examination Clinic', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 6,
      aebas_punch_count: 6,
      anomaly_note: 'Normal: Doctor on-duty verified by facial geometry',
    }],
    ['Navjyoti Detox Ward CCTV', 3, 'Inpatient Detox Room', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 26,
      aebas_punch_count: 28,
      anomaly_note: 'Normal: 26 active patients under supervision',
    }],
    ['Samarth Divyangjan Lab CCTV', 5, 'Assistive Tech Lab 1', 'hls', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 32,
      aebas_punch_count: 32,
      anomaly_note: 'Normal: Trainer and trainees present with wheelchair accessibility',
    }],
    ['Sankalp Entrance Gate CCTV', 4, 'Front Gate & Biometric Kiosk', 'simulated', null, {
      tamper_flag: 'offline',
      occlusion_pct: 100,
      detected_headcount: 0,
      aebas_punch_count: 0,
      anomaly_note: 'Camera Offline: Power cable disconnected / Tamper suspected',
    }],
    ['Niramaya Ground Floor Skill Hall CCTV', 6, 'Ground Floor Training Hall, Lucknow', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 24,
      aebas_punch_count: 24,
      anomaly_note: 'Normal: trainer and 24 trainees present in the ground-floor hall',
    }],
    ['Asha Kiran Courtyard & OPD CCTV', 7, 'OPD Courtyard, Amritsar', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 12,
      aebas_punch_count: 12,
      anomaly_note: 'Normal: ground-level counselling session in progress',
    }],
    ['Snehalaya Day-Care Ground Hall CCTV', 8, 'Day-Care Hall, Ground Floor, Pune', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 36,
      aebas_punch_count: 38,
      anomaly_note: 'Normal: day-care activities running; minor headcount variance (36 physical vs 38 punches)',
    }],
    ['Punarjeevan Detox Ward CCTV', 9, 'Ground Floor Detox Ward, Nashik', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 37,
      aebas_punch_count: 39,
      anomaly_note: 'Normal: morning ward round in progress; minor punch variance (37 physical vs 39 punches)',
    }],
    ['Saksham Barrier-Free Skill Hall CCTV', 10, 'Ground Floor Training Hall, MIHAN Nagpur', 'simulated', null, {
      tamper_flag: 'normal',
      occlusion_pct: 0,
      detected_headcount: 30,
      aebas_punch_count: 30,
      anomaly_note: 'Normal: trainer and 30 trainees present with assistive equipment',
    }],
  ];

  cameraSpecs.forEach(([name, projectId, location, streamType, streamUrl, aiMeta], idx) => {
    const project = state.projects.find((p) => Number(p.id) === projectId) || {};
    const coords = project.geo_coords || { lat: 28.8955, lng: 76.6066 };
    state.cameras.push({
      id: nextId('cameras'),
      name,
      project_id: projectId,
      location,
      stream_type: streamType,
      stream_url: streamUrl,
      geo_coords: { lat: coords.lat + 0.0004, lng: coords.lng + 0.0004 },
      status: aiMeta.tamper_flag === 'offline' ? 'offline' : 'online',
      tamper_flag: aiMeta.tamper_flag,
      occlusion_pct: aiMeta.occlusion_pct,
      detected_headcount: aiMeta.detected_headcount,
      aebas_punch_count: aiMeta.aebas_punch_count,
      anomaly_note: aiMeta.anomaly_note,
      last_seen: new Date(Date.now() - (aiMeta.tamper_flag === 'offline' ? 3 * 3600000 : idx * 60000)).toISOString(),
      created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    });
  });

  // --- Attendance over the last 14 days -------------------------------------
  const today = new Date();
  officialIds.forEach((officialId, oIdx) => {
    for (let d = 13; d >= 0; d -= 1) {
      const day = new Date(today.getTime() - d * 86400000);
      const dateStr = day.toISOString().slice(0, 10);
      if (day.getDay() === 0 && oIdx !== 2) continue; // most officials take Sunday off

      const project = state.projects[(oIdx + d) % state.projects.length];
      const coords = project.geo_coords || { lat: 18.5, lng: 73.85 };

      // official #3 is habitually late; official #2 occasionally checks in far away
      const lateMinutes = oIdx === 3 ? 35 + Math.floor(rand() * 40) : Math.floor(rand() * 22);
      const checkIn = new Date(day);
      checkIn.setHours(9, lateMinutes, 0, 0);
      const checkOut = new Date(day);
      checkOut.setHours(17, Math.floor(rand() * 50), 0, 0);

      const missingPunch = (oIdx === 1 && d === 5) || (oIdx === 0 && d === 3);
      const geoOffset = oIdx === 2 && d % 6 === 0 ? 0.09 : 0.0006; // ~9 km away twice

      state.attendance.push({
        id: nextId('attendance'),
        official_id: officialId,
        project_id: project.id,
        check_in: missingPunch ? null : checkIn.toISOString(),
        check_out: missingPunch ? null : checkOut.toISOString(),
        geo_coords: { lat: coords.lat + geoOffset, lng: coords.lng + geoOffset },
        device: `Android/${oIdx + 10}`,
        mode: 'gps',
        date: dateStr,
        created_at: checkIn.toISOString(),
      });
    }
  });

  // --- Video conferencing sessions -----------------------------------------
  const rooms = [
    ['Review Board Samaj Drishti', 1, officialIds[0], 'ended', 2],
    ['Beneficiary Grievance Review', 4, officialIds[3], 'ended', 1],
    ['Live Site Verification Ward 12', 5, officialIds[2], 'scheduled', 0],
  ];

  rooms.forEach(([roomName, projectId, officialId, status, daysAgo], idx) => {
    const sessionId = nextId('vc_sessions');
    const roomId = `${roomName.replace(/[^a-zA-Z0-9]/g, '')}-${1001 + idx}`;
    const scheduledAt = new Date(Date.now() - daysAgo * 86400000);
    state.vc_sessions.push({
      id: sessionId,
      room_id: roomId,
      project_id: projectId,
      official_id: officialId,
      mode: 'random',
      status,
      scheduled_at: scheduledAt.toISOString(),
      started_at: status === 'ended' ? new Date(scheduledAt.getTime() + 300000).toISOString() : null,
      ended_at: status === 'ended' ? new Date(scheduledAt.getTime() + 2700000).toISOString() : null,
      join_url: `${VC_BASE_URL}/${roomId}`,
      created_at: new Date(scheduledAt.getTime() - 600000).toISOString(),
    });
    state.vc_join_logs.push({
      id: nextId('vc_join_logs'),
      session_id: sessionId,
      user_id: officialId,
      action: 'join',
      created_at: new Date(scheduledAt.getTime() + 320000).toISOString(),
    });
  });

  // Deliberately mismatched geo-tags: these are what surface "possible proxy
  // reporting" in the reports screen and the alert feed.
  const geoCheckTargets = state.inspections.filter((i) => i.status === 'completed').slice(8, 12);
  const offsets = [0.6, 0.01, 0.0005, 0.35];
  geoCheckTargets.forEach((insp, idx) => {
    const project = state.projects.find((p) => Number(p.id) === Number(insp.project_id)) || {};
    const base = project.geo_coords || { lat: 18.5, lng: 73.85 };
    const offset = offsets[idx % offsets.length];
    state.evidence.push({
      id: nextId('evidence'),
      inspection_id: insp.id,
      type: 'photo',
      file_path: `/uploads/evidence/geo-check-${insp.id}.jpg`,
      geo_coords: { lat: base.lat + offset, lng: base.lng + offset },
      timestamp: new Date(Date.now() - (idx + 1) * 5400000).toISOString(),
      verified: offset < 0.001,
      created_at: new Date(Date.now() - (idx + 1) * 5400000).toISOString(),
    });
  });

  // --- Audit trail sample ---------------------------------------------------
  const admin = state.users[0];
  [
    [admin.id, admin.name, 'inspection.assigned', 'inspection', 1, { note: 'Initial random allocation' }],
    [admin.id, admin.name, 'project.created', 'project', 1, { note: 'Rural Road Construction - Zone 4' }],
    [officialIds[0], 'Rajesh Kumar', 'inspection.status_changed', 'inspection', 1, { from: 'pending', to: 'completed' }],
    [officialIds[0], 'Rajesh Kumar', 'evidence.uploaded', 'evidence', 1, { type: 'photo', verified: true }],
    [admin.id, admin.name, 'vc.session_ended', 'vc_session', 1, { room: 'ReviewBoardSamajDrishti-1001' }],
  ].forEach(([actorId, actorName, action, entity, entityId, meta], idx) => {
    state.audit.push({
      id: nextId('audit'),
      actor_id: actorId,
      actor_name: actorName,
      action,
      entity,
      entity_id: entityId,
      meta: JSON.stringify(meta),
      created_at: new Date(Date.now() - (idx + 1) * 3600000).toISOString(),
    });
  });
};

const seed = () => {
  if (state.users.length) return;
  seedUsers();
  seedOperations();
  seedMonitoring();
};

const normalize = (sql) => String(sql).replace(/\s+/g, ' ').trim();

/* ------------------------------------------------- generic SELECT fallback */

const TABLE_READERS = {
  users: () => state.users,
  projects: () => state.projects,
  inspections: () => state.inspections,
  evidence: () => state.evidence,
  notifications: () => state.notifications,
  cameras: () => state.cameras,
  attendance: () => state.attendance,
  vc_sessions: () => state.vc_sessions,
  vc_join_logs: () => state.vc_join_logs,
  audit: () => state.audit,
  atrs: () => state.atrs,
  beneficiary_feedback: () => state.beneficiary_feedback,
  checklists: () => state.checklists,
};

const SELECT_PATTERN =
  /^SELECT\s+(.+?)\s+FROM\s+([a-z_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i;

/** @returns {{rows: object[]}|null} null when the statement is out of scope. */
const genericSelect = (sql, params = []) => {
  const match = sql.match(SELECT_PATTERN);
  if (!match) return null;

  const [, columnPart, tableName, wherePart, orderPart, limitPart] = match;
  const read = TABLE_READERS[tableName];
  if (!read) return null;

  // Column list must be plain names / `*` / `name AS alias`
  const columns = columnPart.split(',').map((c) => c.trim());
  const parsedColumns = columns.map((col) => {
    const alias = col.match(/^([a-zA-Z_.]+)(?:\s+AS\s+([a-zA-Z_]+))?$/i);
    if (!alias) return null;
    const source = alias[1].includes('.') ? alias[1].split('.').pop() : alias[1];
    return { source, target: alias[2] || source, star: source === '*' };
  });
  if (parsedColumns.some((c) => c === null)) return null;

  // WHERE: equality predicates only
  let predicates = [];
  if (wherePart) {
    predicates = wherePart.split(/\s+AND\s+/i).map((cond) => {
      const eq = cond.match(/^([a-zA-Z_.]+)\s*=\s*(\$\d+|NULL|'[^']*')$/i);
      if (!eq) return null;
      const column = eq[1].includes('.') ? eq[1].split('.').pop() : eq[1];
      const raw = eq[2];
      let value;
      if (raw.startsWith('$')) value = params[Number(raw.slice(1)) - 1];
      else if (raw.toUpperCase() === 'NULL') value = null;
      else value = raw.slice(1, -1);
      return { column, value };
    });
    if (predicates.some((p) => p === null)) return null;
  }

  let rows = read().map((row) => ({ ...row }));

  rows = rows.filter((row) =>
    predicates.every(({ column, value }) => {
      const actual = row[column];
      if (value === null) return actual == null;
      if (actual == null) return false;
      return String(actual) === String(value);
    })
  );

  rows = rows.map((row) => {
    const projected = {};
    parsedColumns.forEach(({ source, target, star }) => {
      if (star) {
        Object.assign(projected, row);
        return;
      }
      projected[target] = row[source] === undefined ? null : row[source];
    });
    return projected;
  });

  if (orderPart) {
    const descending = /desc/i.test(orderPart);
    const column = orderPart.split(/\s+/)[0].replace(/^[a-zA-Z_]+\./, '');
    rows.sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return descending ? -cmp : cmp;
    });
  }

  if (limitPart) rows = rows.slice(0, Number(limitPart));

  return { rows };
};

const query = async (text, params = []) => {
  const sql = normalize(text);
  const route = ROUTES.find((r) => r.test(sql));
  if (!route) {
    const err = new Error(`[demo-mode] Unsupported SQL statement: ${sql.slice(0, 120)}`);
    err.code = 'DEMO_DB_UNSUPPORTED';
    throw err;
  }
  return route.run(params, sql);
};

module.exports = {
  query,
  seed,
  state,
  nextId,
  publicUser,
  project,
  withOfficial,
  orderByCreatedAtDesc,
  projectById,
  userById,
  daysAgo,
  daysAhead,
  nowIso,
};
