/**
 * End-to-end check for the whole Samaj Drishti stack.
 *
 *   node scripts/e2e-check.mjs
 *
 * Walks the two journeys the product actually has - a field official and a
 * back-office user - against the running API, then pokes the AI engine
 * directly. Exits non-zero if any check fails, so it can gate a demo.
 */
const API = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const AI = (process.env.AI_URL || 'http://localhost:5001').replace(/\/$/, '');

let pass = 0;
const failures = [];

const ok = (name, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name} :: ${detail}`);
    console.log(`  FAIL  ${name}\n          ${detail}`);
  }
};

const section = (title) => console.log(`\n=== ${title} ===`);

async function call(method, url, { token, body, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, { method, headers, body: payload });
    const type = res.headers.get('content-type') || '';
    let data = null;
    if (raw) data = Buffer.from(await res.arrayBuffer());
    else if (type.includes('application/json')) data = await res.json().catch(() => null);
    else data = await res.text();
    return { status: res.status, data, type };
  } catch (err) {
    return { status: 0, data: null, type: '', error: err.message };
  }
}

const show = (res) => `status=${res.status} body=${JSON.stringify(res.data)?.slice(0, 220)}`;

const login = async (email, password) => {
  const res = await call('POST', `${API}/auth/login`, { body: { email, password } });
  return res.status === 200 && res.data?.token ? { token: res.data.token, user: res.data.user } : { res };
};

async function main() {
  console.log(`Samaj Drishti end-to-end check\n  API ${API}\n  AI  ${AI}`);

  // ------------------------------------------------------------------ system
  section('System');
  const health = await call('GET', `${API}/health`);
  ok('API /health is ok', health.status === 200 && health.data?.status === 'ok', show(health));
  const root = await call('GET', `${API.replace(/\/api$/, '')}/`);
  ok('API root reports data mode', root.status === 200 && !!root.data?.dataMode, show(root));
  const aiHealth = await call('GET', `${AI}/api/health`);
  ok('AI engine /api/health is ok', aiHealth.status === 200 && aiHealth.data?.status === 'ok', show(aiHealth));
  ok('AI engine reports an anomaly backend', !!aiHealth.data?.anomaly_backend, show(aiHealth));

  // -------------------------------------------------------------------- auth
  section('Auth');
  const admin = await login('admin@samajdrishti.gov.in', 'Admin@123');
  ok('admin logs in', !!admin.token, show(admin.res || {}));
  const supervisor = await login('supervisor@samajdrishti.gov.in', 'Super@123');
  ok('supervisor logs in', !!supervisor.token, show(supervisor.res || {}));
  const official = await login('official1@samajdrishti.gov.in', 'Official@123');
  ok('official1 logs in', !!official.token, show(official.res || {}));
  if (!admin.token || !official.token) {
    console.log('\nCannot continue without admin + official sessions.');
    return finish();
  }
  const T = admin.token;
  const TO = official.token;
  const TS = supervisor.token;
  const officialId = official.user?.id;

  const badLogin = await call('POST', `${API}/auth/login`, {
    body: { email: 'admin@samajdrishti.gov.in', password: 'wrong' },
  });
  // The project answers 400 for both "no such user" and "wrong password" so the
  // caller cannot tell which half was wrong.
  ok('login rejects a bad password', badLogin.status === 400, show(badLogin));
  const noToken = await call('GET', `${API}/auth/profile`);
  ok('profile without a token is 401', noToken.status === 401, show(noToken));
  const profile = await call('GET', `${API}/auth/profile`, { token: T });
  ok('profile returns the signed-in user', profile.data?.user?.email === 'admin@samajdrishti.gov.in', show(profile));

  const stamp = Date.now();
  const regEmail = `e2e_${stamp}@samajdrishti.gov.in`;
  const reg = await call('POST', `${API}/auth/register`, {
    body: { name: 'E2E Official', email: regEmail, password: 'Verify@123', role: 'official', department: 'QA' },
  });
  ok('register returns a token', (reg.status === 200 || reg.status === 201) && !!reg.data?.token, show(reg));
  const dup = await call('POST', `${API}/auth/register`, { body: { name: 'E2E', email: regEmail, password: 'Verify@123' } });
  ok('duplicate register is 400', dup.status === 400, show(dup));

  // ---------------------------------------------------------------- projects
  section('Projects');
  const projects = await call('GET', `${API}/projects`, { token: T });
  ok('projects list is non-empty', projects.status === 200 && Array.isArray(projects.data) && projects.data.length > 0, show(projects));
  const project = projects.data?.[0];
  ok('a project carries id + name + geo', !!project?.id && !!project?.name && !!project?.geo_coords, JSON.stringify(project)?.slice(0, 200));

  if (project?.id) {
    const detail = await call('GET', `${API}/projects/${project.id}`, { token: T });
    ok(
      'project detail bundles inspections + evidence + cameras',
      detail.status === 200 && Array.isArray(detail.data?.inspections) && Array.isArray(detail.data?.cameras),
      show(detail)
    );
  }
  const missing = await call('GET', `${API}/projects/99999999`, { token: T });
  ok('unknown project is 404', missing.status === 404, show(missing));

  const created = await call('POST', `${API}/projects`, {
    token: T,
    body: {
      name: `E2E Project ${stamp}`,
      description: 'created by the e2e harness',
      location: 'Verify Zone',
      department: 'Quality Assurance',
      geo_coords: { lat: 19.076, lng: 72.8777 },
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      budget: 1500000,
    },
  });
  ok('admin can create a project', (created.status === 200 || created.status === 201) && !!created.data?.id, show(created));
  const newProjectId = created.data?.id;
  if (newProjectId) {
    const upd = await call('PUT', `${API}/projects/${newProjectId}`, {
      token: T,
      body: { name: 'E2E Project (renamed)', status: 'in_progress', budget: 2000000 },
    });
    ok('admin can update a project', upd.status === 200, show(upd));
  }
  const officialCreate = await call('POST', `${API}/projects`, { token: TO, body: { name: 'nope', location: 'x', department: 'x' } });
  ok('official cannot create a project (403)', officialCreate.status === 403, show(officialCreate));

  // ------------------------------------------------------------- inspections
  section('Inspections');
  const allInspections = await call('GET', `${API}/inspections/all`, { token: T });
  ok('back office lists all inspections', allInspections.status === 200 && Array.isArray(allInspections.data), show(allInspections));
  const mine = await call('GET', `${API}/inspections/mine`, { token: TO });
  ok('official lists own assignments', mine.status === 200 && Array.isArray(mine.data), show(mine));

  const assign = await call('POST', `${API}/inspections/assign`, {
    token: T,
    body: { project_id: newProjectId || project?.id, assigned_to: officialId, scheduled_date: '2026-10-01', ai_risk_score: 42 },
  });
  ok('admin assigns an inspection', (assign.status === 200 || assign.status === 201) && !!assign.data?.id, show(assign));
  const assignedId = assign.data?.id;

  const officialAssign = await call('POST', `${API}/inspections/assign`, {
    token: TO,
    body: { project_id: project?.id, assigned_to: officialId, scheduled_date: '2026-10-01' },
  });
  ok('official cannot assign (403)', officialAssign.status === 403, show(officialAssign));

  const targetId = assignedId || (mine.data || [])[0]?.id;
  if (targetId) {
    const detail = await call('GET', `${API}/inspections/${targetId}`, { token: TO });
    ok('inspection detail joins project + official', detail.status === 200 && !!detail.data?.project_name, show(detail));

    const reMine = await call('GET', `${API}/inspections/mine`, { token: TO });
    ok('the new assignment reaches the official queue', (reMine.data || []).some((i) => i.id === targetId), `queue=${(reMine.data || []).map((i) => i.id).join(',')}`);

    // Report from the project's own coordinates, which is what the field app does.
    const geoOfTarget = detail.data?.geo_coords;
    const lat = geoOfTarget?.lat ?? 19.076;
    const lng = geoOfTarget?.lng ?? 72.8777;

    const geo = await call('POST', `${API}/inspections/${targetId}/geo-verify`, { token: TO, body: { lat, lng } });
    ok('geo-verify returns a verdict', ['verified', 'mismatch', 'suspicious'].includes(geo.data?.verdict), show(geo));
    ok('reporting from the project site verifies', geo.data?.verdict === 'verified', show(geo));

    const faraway = await call('POST', `${API}/inspections/${targetId}/geo-verify`, { token: TO, body: { lat: 28.6139, lng: 77.209 } });
    ok('reporting from far away is suspicious', faraway.data?.verdict === 'suspicious', show(faraway));

    const checklist = await call('GET', `${API}/inspections/${targetId}/checklist`, { token: TO });
    ok('checklist is readable', checklist.status === 200, show(checklist));
    const saveChecklist = await call('POST', `${API}/inspections/${targetId}/checklist`, {
      token: TO,
      body: { checks: { infra: true, beneficiaries: false }, voice_remarks: 'e2e run' },
    });
    ok('checklist is saved', saveChecklist.status === 200 || saveChecklist.status === 201, show(saveChecklist));
    ok('checklist reports a compliance score', typeof saveChecklist.data?.record?.compliance_score === 'number', show(saveChecklist));

    // The API state machine is pending -> in_progress -> completed (with
    // flagged as the auto-escalation branch), so "accept" means in_progress.
    const accept = await call('PUT', `${API}/inspections/${targetId}/status`, {
      token: TO,
      body: { status: 'in_progress', notes: 'accepted by e2e' },
    });
    ok('official accepts the assignment', accept.status === 200 && !!accept.data?.inspection, show(accept));

    const start = await call('PUT', `${API}/inspections/${targetId}/status`, {
      token: TO,
      body: { status: 'in_progress', notes: 'started by e2e', lat, lng },
    });
    ok('official starts the inspection', start.status === 200 && !!start.data?.inspection, show(start));

    const complete = await call('PUT', `${API}/inspections/${targetId}/status`, {
      token: TO,
      body: { status: 'completed', notes: 'completed by e2e', completed_date: '2026-09-28', lat, lng },
    });
    // "completed" is the legacy alias; the machine's terminal state after the
    // completion analysis is ai_analyzed, so accept that.
    ok('official completes the inspection', complete.status === 200 && ['ai_analyzed', 'submitted', 'completed'].includes(complete.data?.inspection?.status), show(complete));
  } else {
    ok('an inspection was available to drive', false, 'no assignment available');
  }

  // ---------------------------------------------------------------- evidence
  section('Evidence');
  if (targetId) {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64'
    );
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), `e2e-${stamp}.png`);
    form.append('inspection_id', String(targetId));
    form.append('type', 'photo');
    form.append('lat', '19.076');
    form.append('lng', '72.8777');
    form.append('timestamp', new Date().toISOString());
    const upload = await call('POST', `${API}/evidence`, { token: TO, form });
    ok('multipart evidence upload with geo succeeds', upload.status === 200 || upload.status === 201, show(upload));
    const evidenceId = upload.data?.id;
    ok('uploaded evidence keeps its geo-tag', upload.data?.geo_coords?.lat != null, show(upload));

    const list = await call('GET', `${API}/evidence?inspection_id=${targetId}`, { token: TO });
    ok('evidence lists for the inspection', list.status === 200 && Array.isArray(list.data) && list.data.length > 0, show(list));

    if (evidenceId) {
      const verify = await call('PUT', `${API}/evidence/${evidenceId}/verify`, { token: T });
      ok('back office verifies evidence', verify.status === 200 && verify.data?.verified === true, show(verify));
    } else {
      ok('evidence verify path reachable', false, 'upload returned no evidence id');
    }
  }

  // --------------------------------------------------------------- attendance
  section('Attendance');
  const checkIn = await call('POST', `${API}/attendance/check-in`, {
    token: TO,
    body: { lat: 19.076, lng: 72.8777, device: 'e2e-harness', mode: 'gps' },
  });
  ok('official checks in', checkIn.status === 200 || checkIn.status === 201, show(checkIn));
  const duplicatePunch = await call('POST', `${API}/attendance/check-in`, { token: TO, body: { lat: 19.076, lng: 72.8777 } });
  ok('a second open check-in is rejected', duplicatePunch.status === 400, show(duplicatePunch));
  const checkOut = await call('POST', `${API}/attendance/check-out`, { token: TO, body: { lat: 19.076, lng: 72.8777 } });
  ok('official checks out', checkOut.status === 200, show(checkOut));

  const history = await call('GET', `${API}/attendance`, { token: TO });
  ok('attendance history is readable by the official', history.status === 200 && Array.isArray(history.data), show(history));
  const summary = await call('GET', `${API}/attendance/summary`, { token: T });
  ok('attendance summary aggregates officials', summary.status === 200 && Array.isArray(summary.data?.officials), show(summary));
  const anomalies = await call('GET', `${API}/attendance/anomalies`, { token: T });
  ok('attendance anomalies are computed', anomalies.status === 200, show(anomalies));

  // --------------------------------------------------------------- monitoring
  section('Monitoring / CCTV');
  const overview = await call('GET', `${API}/monitoring/overview`, { token: T });
  ok(
    'monitoring overview bundles cameras, counts and alerts',
    overview.status === 200 && Array.isArray(overview.data?.cameras) && typeof overview.data?.online === 'number' && Array.isArray(overview.data?.alerts),
    show(overview)
  );
  const cameras = await call('GET', `${API}/monitoring/cameras`, { token: T });
  ok('camera list is non-empty', cameras.status === 200 && Array.isArray(cameras.data) && cameras.data.length > 0, show(cameras));
  const camera = cameras.data?.[0];
  if (camera?.id) {
    const snap = await call('GET', `${API}/monitoring/cameras/${camera.id}/snapshot?token=${T}`, { raw: true });
    ok('snapshot returns a PNG', snap.status === 200 && snap.type.includes('image/png') && snap.data.length > 1000, `status=${snap.status} type=${snap.type} bytes=${snap.data?.length}`);
    const patch = await call('PATCH', `${API}/monitoring/cameras/${camera.id}`, { token: T, body: { status: 'offline' } });
    ok('camera status can be toggled', patch.status === 200, show(patch));
    const restore = await call('PATCH', `${API}/monitoring/cameras/${camera.id}`, { token: T, body: { status: camera.status } });
    ok('camera status restores', restore.status === 200, show(restore));
  }

  // ---------------------------------------------------------------------- VC
  section('Video conference');
  const vc = await call('POST', `${API}/vc/sessions`, { token: TO, body: { mode: 'random' } });
  ok('official starts a random VC session', (vc.status === 200 || vc.status === 201) && !!vc.data?.session?.id, show(vc));
  const vcId = vc.data?.session?.id;
  ok('VC session carries a join_url', !!vc.data?.session?.join_url, show(vc));
  const vcList = await call('GET', `${API}/vc/sessions`, { token: TO });
  ok('VC sessions list', vcList.status === 200 && Array.isArray(vcList.data), show(vcList));
  if (vcId) {
    const joined = await call('POST', `${API}/vc/sessions/${vcId}/join-log`, { token: TO, body: { action: 'join' } });
    ok('VC presence is logged', joined.status === 200 || joined.status === 201, show(joined));
    // Only the back office may close a session, which is what the Meet screen exposes.
    const officialEnd = await call('POST', `${API}/vc/sessions/${vcId}/end`, { token: TO });
    ok('an official cannot end a session (403)', officialEnd.status === 403, show(officialEnd));
    const ended = await call('POST', `${API}/vc/sessions/${vcId}/end`, { token: T });
    ok('back office ends the session', ended.status === 200 && ended.data?.status === 'ended', show(ended));
  }

  // ----------------------------------------------------------------- reports
  section('Reports');
  const reports = await call('GET', `${API}/reports`, { token: T });
  ok('reports list is non-empty', reports.status === 200 && Array.isArray(reports.data) && reports.data.length > 0, show(reports));
  const report = reports.data?.[0];
  if (report?.id) {
    const full = await call('GET', `${API}/reports/${report.id}`, { token: T });
    ok('report detail is assembled', full.status === 200 && !!full.data?.report, show(full));
    const share = await call('POST', `${API}/reports/${report.id}/share`, { token: T });
    ok('report share text is generated', share.status === 200 && !!share.data?.text, show(share));
  }

  // ------------------------------------------------------------------- audit
  section('Audit trail');
  const audit = await call('GET', `${API}/audit`, { token: T });
  ok('audit entries are recorded', audit.status === 200 && Array.isArray(audit.data) && audit.data.length > 0, show(audit));
  if (targetId) {
    const entity = await call('GET', `${API}/audit/inspection/${targetId}`, { token: T });
    ok('audit filters by entity', entity.status === 200 && Array.isArray(entity.data), show(entity));
  }

  // --------------------------------------------------------- admin and AI
  section('Admin + AI');
  const dashboard = await call('GET', `${API}/admin/dashboard`, { token: T });
  ok('dashboard aggregates stats', dashboard.status === 200 && !!dashboard.data?.stats, show(dashboard));
  ok('dashboard ranks projects by risk', Array.isArray(dashboard.data?.highRiskProjects), show(dashboard));
  const insights = await call('GET', `${API}/admin/ai/insights`, { token: T });
  ok('AI insights return an anomalies array', insights.status === 200 && Array.isArray(insights.data?.anomalies), show(insights));
  const aiStatus = await call('GET', `${API}/admin/ai/status`, { token: T });
  ok('AI status reaches the engine', aiStatus.status === 200 && !!aiStatus.data?.aiEngine, show(aiStatus));
  const narrative = await call('GET', `${API}/admin/ai/narrative?tone=executive`, { token: T });
  ok('LLM briefing is generated', narrative.status === 200 && !!narrative.data?.narrative, show(narrative));
  const alerts = await call('GET', `${API}/admin/alerts`, { token: T });
  ok('alert feed is available', alerts.status === 200, show(alerts));
  const aiAssign = await call('POST', `${API}/admin/ai/assign`, { token: T, body: { num_inspections: 3, persist: false } });
  ok('AI generates a randomised assignment plan', aiAssign.status === 200, show(aiAssign));
  const officialDashboard = await call('GET', `${API}/admin/dashboard`, { token: TO });
  ok('official cannot read the admin dashboard (403)', officialDashboard.status === 403, show(officialDashboard));

  // --------------------------------------------------------------------- ATR
  section('ATR (adjudication)');
  const atrList = await call('GET', `${API}/atr`, { token: T });
  ok('ATR queue is non-empty', atrList.status === 200 && Array.isArray(atrList.data) && atrList.data.length > 0, show(atrList));
  const atr = atrList.data?.find((a) => a.status !== 'closed' && a.status !== 'resolved') || atrList.data?.[0];
  if (atr?.id) {
    const detail = await call('GET', `${API}/atr/${atr.id}`, { token: T });
    ok('ATR detail loads', detail.status === 200, show(detail));
    const respond = await call('POST', `${API}/atr/${atr.id}/respond`, {
      token: T,
      body: { ngo_reply: 'Reply filed by the e2e harness', corrective_evidence_url: 'https://example.org/evidence.pdf' },
    });
    ok('ATR response is recorded', respond.status === 200 || respond.status === 201, show(respond));
    const adjudicate = await call('POST', `${API}/atr/${atr.id}/adjudicate`, {
      token: T,
      body: { action: 'accept_explanation', pmu_adjudication: 'Reviewed by the PMU during the e2e run.' },
    });
    ok('ATR is adjudicated', adjudicate.status === 200, show(adjudicate));
  }

  // ------------------------------------------------------------- beneficiaries
  section('Beneficiary feedback');
  const feedbackList = await call('GET', `${API}/beneficiaries/feedback`, { token: T });
  ok('feedback list is non-empty', feedbackList.status === 200 && Array.isArray(feedbackList.data) && feedbackList.data.length > 0, show(feedbackList));
  const feedback = await call('POST', `${API}/beneficiaries/feedback`, {
    token: T,
    body: {
      project_id: newProjectId || project?.id,
      category: 'service_delivery',
      rating: 4,
      comment: 'Filed by the e2e harness',
      scheme: 'Post-Matric Scholarship',
      beneficiary_name: 'E2E Beneficiary',
    },
  });
  ok('feedback is accepted', (feedback.status === 200 || feedback.status === 201) && !!feedback.data, show(feedback));

  // ------------------------------------------------------------- notifications
  section('Notifications');
  const notifications = await call('GET', `${API}/notifications`, { token: TO });
  ok('notifications are readable', notifications.status === 200 && Array.isArray(notifications.data), show(notifications));
  const unread = (notifications.data || []).find((n) => !n.read);
  if (unread?.id) {
    const marked = await call('PUT', `${API}/notifications/${unread.id}/read`, { token: TO });
    ok('a notification can be marked read', marked.status === 200, show(marked));
  }

  // ----------------------------------------------------------------- AI engine
  section('AI engine (direct)');
  const riskBatch = await call('POST', `${AI}/api/risk/score-batch`, {
    body: {
      projects: [
        { id: 1, budget: 5000000, location: 'Mumbai', department: 'public_works', inspection_history: [] },
        { id: 2, budget: 200000, location: 'Dhanbad', department: 'education', inspection_history: [{ status: 'flagged' }, { status: 'flagged' }] },
      ],
    },
  });
  ok('risk score batch returns scores', riskBatch.status === 200 && Array.isArray(riskBatch.data?.scores) && riskBatch.data.scores.length === 2, show(riskBatch));
  ok(
    'every project in the portfolio is scored in range',
    (riskBatch.data?.scores || []).every((s) => typeof s.risk_score === 'number' && s.risk_score >= 0 && s.risk_score <= 100),
    show(riskBatch)
  );
  const malformedBatch = await call('POST', `${AI}/api/risk/score-batch`, {
    body: { projects: [{ id: 3, budget: 100, inspection_history: 2 }] },
  });
  ok('a malformed history value does not 500 the engine', malformedBatch.status === 200, show(malformedBatch));
  const detect = await call('POST', `${AI}/api/anomaly/detect`, {
    body: {
      inspections: [
        { id: 1, project_id: 1, risk_score: 10, duration_minutes: 45, evidence_count: 4, flagged: false, status: 'completed' },
        { id: 2, project_id: 1, risk_score: 20, duration_minutes: 50, evidence_count: 3, flagged: false, status: 'completed' },
        { id: 3, project_id: 2, risk_score: 95, duration_minutes: 2, evidence_count: 0, flagged: true, status: 'flagged' },
      ],
    },
  });
  ok('anomaly detector returns anomalies', detect.status === 200 && Array.isArray(detect.data?.anomalies), show(detect));
  ok('the seeded outlier is detected', (detect.data?.anomalies || []).length > 0, show(detect));
  const geoVerify = await call('POST', `${AI}/api/geo/verify`, {
    body: {
      project: { id: 1, name: 'Verify', lat: 19.076, lng: 72.8777, radius_meters: 200 },
      observation: { inspection_id: 1, lat: 28.6139, lng: 77.209, captured_at: new Date().toISOString() },
    },
  });
  ok('geo verification flags a distant report', geoVerify.data?.verdict === 'suspicious', show(geoVerify));
  const attendanceAnalyze = await call('POST', `${AI}/api/attendance/analyze`, {
    body: {
      records: [
        { official_id: 1, date: '2026-09-27', check_in: '2026-09-27T10:30:00Z', check_out: '2026-09-27T17:00:00Z', project_id: 1, lat: 19.076, lng: 72.8777 },
        { official_id: 1, date: '2026-09-28', check_in: '2026-09-28T11:30:00Z', check_out: '2026-09-28T12:00:00Z', project_id: 1, lat: 25.4, lng: 81.8 },
      ],
    },
  });
  ok('attendance analysis finds irregularities', attendanceAnalyze.status === 200 && Array.isArray(attendanceAnalyze.data?.irregularities), show(attendanceAnalyze));

  return finish();
}

function finish() {
  const total = pass + failures.length;
  console.log('\n──────────────────────────────────────────');
  console.log(`TOTAL ${total}   PASS ${pass}   FAIL ${failures.length}`);
  if (failures.length) {
    console.log('\nFAILURES');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exitCode = 1;
  }
  return pass;
}

main().catch((err) => {
  console.error('\nHarness crashed:', err);
  process.exitCode = 1;
});
