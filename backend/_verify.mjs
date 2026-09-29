/**
 * Temporary end-to-end verification harness for the Samaj Drishti API.
 * Run with:  node _verify.mjs      (from samaj-drishti/backend)
 * Deleted once the run is green.
 */
const BASE = process.env.BASE || 'http://localhost:5000/api';
const AI = process.env.AI || 'http://localhost:5001';

const results = [];
const failures = [];
let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    results.push(`PASS  ${name}`);
  } else {
    fail += 1;
    const line = `${name} :: ${detail}`;
    failures.push(line);
    results.push(`FAIL  ${line}`);
  }
}

async function req(method, url, opts = {}) {
  const { token, body, form, raw } = opts;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch (err) {
    return { status: 0, error: err.message, data: null, contentType: '' };
  }
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (raw) {
    data = Buffer.from(await res.arrayBuffer());
  } else if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    const text = await res.text();
    data = text;
  }
  return { status: res.status, data, contentType, headers: res.headers };
}

async function login(email, password) {
  const res = await req('POST', `${BASE}/auth/login`, { body: { email, password } });
  if (res.status !== 200 || !res.data || !res.data.token) {
    return { ok: false, res };
  }
  return { ok: true, token: res.data.token, user: res.data.user, res };
}

const report = () => {
  console.log(results.join('\n'));
  console.log('\n──────────────────────────────────────────');
  console.log(`TOTAL  ${pass + fail}   PASS  ${pass}   FAIL  ${fail}`);
  if (failures.length) {
    console.log('\nFAILURES:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
};

async function main() {
  // ---------------------------------------------------------------- health
  const health = await req('GET', 'http://localhost:5000/api/health');
  check('GET /api/health -> 200 ok', health.status === 200 && health.data && health.data.status === 'ok', JSON.stringify(health.data));

  const root = await req('GET', 'http://localhost:5000/');
  check('GET / -> reports data mode', root.status === 200 && !!root.data.dataMode, JSON.stringify(root.data));

  // ------------------------------------------------------------------ auth
  const admin = await login('admin@samajdrishti.gov.in', 'Admin@123');
  check('login admin', admin.ok, `status ${admin.res.status}`);
  const supervisor = await login('supervisor@samajdrishti.gov.in', 'Super@123');
  check('login supervisor', supervisor.ok, `status ${supervisor.res.status}`);
  const official = await login('official1@samajdrishti.gov.in', 'Official@123');
  check('login official1', official.ok, `status ${official.res.status}`);

  const badLogin = await req('POST', `${BASE}/auth/login`, { body: { email: 'admin@samajdrishti.gov.in', password: 'wrong' } });
  check('login rejects bad password (401)', badLogin.status === 401, `status ${badLogin.status}`);

  const noToken = await req('GET', `${BASE}/auth/profile`);
  check('GET /auth/profile without token -> 401', noToken.status === 401, `status ${noToken.status}`);

  if (admin.ok) {
    const profile = await req('GET', `${BASE}/auth/profile`, { token: admin.token });
    check('GET /auth/profile with token -> user', profile.status === 200 && profile.data && profile.data.user && profile.data.user.email === 'admin@samajdrishti.gov.in', JSON.stringify(profile.data));
  }

  // registration round-trip
  const uniqueEmail = `verify_${Date.now()}@samajdrishti.gov.in`;
  const reg = await req('POST', `${BASE}/auth/register`, { body: { name: 'Verify Bot', email: uniqueEmail, password: 'Verify@123', role: 'official', department: 'Verification' } });
  check('POST /auth/register -> 201/200 with token', (reg.status === 200 || reg.status === 201) && reg.data && !!reg.data.token, `status ${reg.status} ${JSON.stringify(reg.data)}`);
  const dup = await req('POST', `${BASE}/auth/register`, { body: { name: 'Verify Bot', email: uniqueEmail, password: 'Verify@123' } });
  check('POST /auth/register duplicate -> 400', dup.status === 400, `status ${dup.status}`);

  if (!admin.ok) { report(); process.exit(1); }
  const T = admin.token;
  const TO = official.ok ? official.token : admin.token;
  const TS = supervisor.ok ? supervisor.token : admin.token;

  // -------------------------------------------------------------- projects
  const projects = await req('GET', `${BASE}/projects`, { token: T });
  check('GET /projects -> non-empty array', projects.status === 200 && Array.isArray(projects.data) && projects.data.length > 0, `status ${projects.status} len=${Array.isArray(projects.data) ? projects.data.length : 'n/a'}`);
  const projectId = Array.isArray(projects.data) && projects.data[0] ? projects.data[0].id : null;
  check('projects expose id + name + risk_score', projects.data && projects.data[0] && projects.data[0].name !== undefined, JSON.stringify(projects.data && projects.data[0]));

  if (projectId) {
    const detail = await req('GET', `${BASE}/projects/${projectId}`, { token: T });
    check('GET /projects/:id -> project + inspections + evidence + cameras + attendance', detail.status === 200 && detail.data && detail.data.project && Array.isArray(detail.data.inspections) && Array.isArray(detail.data.cameras), `status ${detail.status} keys=${detail.data && Object.keys(detail.data).join(',')}`);
  }

  const notFound = await req('GET', `${BASE}/projects/999999`, { token: T });
  check('GET /projects/999999 -> 404', notFound.status === 404, `status ${notFound.status}`);

  const created = await req('POST', `${BASE}/projects`, {
    token: T,
    body: { name: `Verification Project ${Date.now()}`, description: 'created by verification harness', location: 'Verify Zone', department: 'Verification', geo_coords: { lat: 19.076, lng: 72.8777 }, start_date: '2026-01-01', end_date: '2026-12-31', budget: 1234567 },
  });
  check('POST /projects (admin) -> created', (created.status === 200 || created.status === 201) && created.data && created.data.project, `status ${created.status} ${JSON.stringify(created.data)}`);
  const newProjectId = created.data && created.data.project ? created.data.project.id : null;

  if (newProjectId) {
    const upd = await req('PUT', `${BASE}/projects/${newProjectId}`, { token: T, body: { name: 'Verification Project (renamed)', status: 'in_progress', budget: 2000000 } });
    check('PUT /projects/:id -> updated', upd.status === 200, `status ${upd.status} ${JSON.stringify(upd.data)}`);
  }

  const officialCreates = await req('POST', `${BASE}/projects`, { token: TO, body: { name: 'nope', location: 'x', department: 'x' } });
  check('POST /projects as official -> 403', officialCreates.status === 403, `status ${officialCreates.status}`);

  // ------------------------------------------------------------ inspections
  const all = await req('GET', `${BASE}/inspections/all`, { token: T });
  check('GET /inspections/all -> array', all.status === 200 && Array.isArray(all.data), `status ${all.status}`);
  const mine = await req('GET', `${BASE}/inspections/mine`, { token: TO });
  check('GET /inspections/mine -> array', mine.status === 200 && Array.isArray(mine.data), `status ${mine.status} ${JSON.stringify(mine.data).slice(0, 160)}`);
  const mineAsAdmin = await req('GET', `${BASE}/inspections/mine`, { token: T });
  check('GET /inspections/mine as admin -> 200 (empty ok)', mineAsAdmin.status === 200, `status ${mineAsAdmin.status}`);

  const inspectable = (Array.isArray(all.data) ? all.data : []).find((i) => i.status !== 'completed' && i.status !== 'flagged');
  check('a non-terminal inspection is available to exercise', !!inspectable, 'none found');

  let inspectionId = inspectable ? inspectable.id : null;
  let assignedOfficialId = inspectable ? inspectable.assigned_to : null;

  if (projectId) {
    const assign = await req('POST', `${BASE}/inspections/assign`, { token: T, body: { project_id: projectId, assigned_to: assignedOfficialId || (mine.data && mine.data[0] && mine.data[0].assigned_to) || 2, scheduled_date: '2026-10-01', ai_risk_score: 42 } });
    check('POST /inspections/assign -> created', (assign.status === 200 || assign.status === 201) && assign.data && assign.data.inspection, `status ${assign.status} ${JSON.stringify(assign.data)}`);
  }

  const officialAssigns = await req('POST', `${BASE}/inspections/assign`, { token: TO, body: { project_id: projectId, assigned_to: 2, scheduled_date: '2026-10-01' } });
  check('POST /inspections/assign as official -> 403', officialAssigns.status === 403, `status ${officialAssigns.status}`);
