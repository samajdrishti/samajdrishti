// 100-user load probe for Samaj Drishti (no dependencies, Node 18+).
// Usage: API_URL=http://localhost:5000 VUS=100 DURATION_S=60 node scripts/load-100.mjs
// Exit 0 when error rate < 5% and p95 < 5s, else exit 1.
const BASE = process.env.API_URL || 'http://localhost:5000';
const VUS = parseInt(process.env.VUS || '100', 10);
const DURATION_S = parseInt(process.env.DURATION_S || '60', 10);

const LOGINS = [
  ['admin@samajdrishti.gov.in', 'Admin@123'],
  ['supervisor@samajdrishti.gov.in', 'Super@123'],
  ['official1@samajdrishti.gov.in', 'Official@123'],
  ['official2@samajdrishti.gov.in', 'Official@123'],
  ['official3@samajdrishti.gov.in', 'Official@123'],
  ['official4@samajdrishti.gov.in', 'Official@123'],
];

const lat = {};
const statusCount = {};
let total = 0;
let failed = 0;
const record = (name, ms, status) => {
  total += 1;
  if (status >= 500 || status === 0) failed += 1;
  statusCount[status] = (statusCount[status] || 0) + 1;
  (lat[name] = lat[name] || []).push(ms);
};

async function timed(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    record(name, Date.now() - t0, r.status);
    return r;
  } catch (e) {
    record(name, Date.now() - t0, 0);
    return { status: 0, body: null };
  }
}

async function login(i) {
  const [email, password] = LOGINS[i % LOGINS.length];
  const r = await timed('login', () =>
    fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => ({ status: res.status, body: res.ok ? await res.json() : null }))
  );
  return r.body && r.body.token;
}

async function vu(id, deadline, tokens, adminToken) {
  const token = tokens[id % tokens.length];
  const H = { Authorization: `Bearer ${token}` };
  const AH = { Authorization: `Bearer ${adminToken}` };
  let iter = 0;
  while (Date.now() < deadline) {
    iter += 1;
    await timed('projects', () => fetch(`${BASE}/api/projects`, { headers: H }).then((r) => ({ status: r.status })));
    await timed('inspections_mine', () =>
      fetch(`${BASE}/api/inspections/mine`, { headers: H }).then((r) => ({ status: r.status }))
    );
    await timed('cameras', () =>
      fetch(`${BASE}/api/monitoring/cameras?limit=10`, { headers: H }).then((r) => ({ status: r.status }))
    );
    await timed('overview', () =>
      fetch(`${BASE}/api/monitoring/overview`, { headers: H }).then((r) => ({ status: r.status }))
    );
    if (iter % 3 === 0) {
      await timed('snapshot', () =>
        fetch(`${BASE}/api/monitoring/cameras/1/snapshot`, { headers: H }).then(async (r) => {
          await r.arrayBuffer();
          return { status: r.status };
        })
      );
    }
    if (iter % 4 === 0) {
      await timed('evidence_list', () =>
        fetch(`${BASE}/api/evidence?inspection_id=1`, { headers: H }).then((r) => ({ status: r.status }))
      );
    }
    if (iter % 5 === 0) {
      await timed('admin_dashboard', () =>
        fetch(`${BASE}/api/admin/dashboard`, { headers: AH }).then((r) => ({ status: r.status }))
      );
    }
  }
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const stopAt = Date.now() + DURATION_S * 1000;
// Stagger logins to avoid a pure bcrypt thundering herd masking steady-state.
const tokens = [];
for (let i = 0; i < VUS; i += 1) {
  // eslint-disable-next-line no-await-in-loop
  const t = await login(i);
  if (t) tokens.push(t);
  if (i % 25 === 0) await new Promise((r) => setTimeout(r, 200));
}
console.log(`logins_ok=${tokens.length}/${VUS}`);
if (!tokens.length) {
  console.log('RESULT=FAIL no logins succeeded');
  process.exit(1);
}
await Promise.all(Array.from({ length: VUS }, (_, i) => vu(i, stopAt, tokens, tokens[0])));

console.log(`requests=${total} failed=${failed} err_rate=${((failed / total) * 100).toFixed(2)}%`);
console.log(`status=${JSON.stringify(statusCount)}`);
for (const [name, arr] of Object.entries(lat)) {
  console.log(`${name}: n=${arr.length} p50=${pct(arr, 50)}ms p95=${pct(arr, 95)}ms p99=${pct(arr, 99)}ms`);
}
const errRate = failed / total;
const p95worst = Math.max(...Object.values(lat).map((a) => pct(a, 95)));
if (errRate < 0.05 && p95worst < 5000) {
  console.log('RESULT=PASS');
  process.exit(0);
} else {
  console.log('RESULT=FAIL');
  process.exit(1);
}
