/**
 * Evidence-integrity proof (Problem Statement 26095, "tamper-evidence vault").
 *
 *   node scripts/integrity-check.mjs
 *
 * Runs against the live API and proves the whole chain end to end:
 *   1. an official uploads a geo-tagged photo        -> SHA-256 recorded
 *   2. a second upload links to the first hash       -> chain of 2
 *   3. back-office verification re-hashes the file   -> status "verified"
 *   4. the stored file is altered on disk           -> status "tampered"
 *   5. verification refuses to sign it off           -> alert + audit entry
 *   6. the file is restored                          -> status "verified" again
 *
 * Exits non-zero if any step misbehaves, so it can gate a demo.
 */
import fs from 'node:fs';
import path from 'node:path';

const API = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const UPLOADS = path.resolve('backend/uploads');

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

async function call(method, url, { token, body, form } = {}) {
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
    const data = type.includes('application/json') ? await res.json().catch(() => null) : await res.text();
    return { status: res.status, data, type };
  } catch (err) {
    return { status: 0, data: null, type: '', error: err.message };
  }
}

const show = (res) => `status=${res.status} body=${JSON.stringify(res.data)?.slice(0, 240)}`;

const login = async (email, password) => {
  const res = await call('POST', `${API}/auth/login`, { body: { email, password } });
  return res.data?.token ? { token: res.data.token, user: res.data.user } : null;
};

// 1x1 transparent PNG - a real, valid image so the chain is not mocked.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

const upload = async (token, inspectionId, name) => {
  const form = new FormData();
  form.append('file', new Blob([PNG], { type: 'image/png' }), name);
  form.append('inspection_id', String(inspectionId));
  form.append('type', 'photo');
  form.append('lat', '28.8955');
  form.append('lng', '76.6066');
  form.append('timestamp', new Date().toISOString());
  return call('POST', `${API}/evidence`, { token, form });
};

// `/uploads/...` is API-relative, NOT absolute: on Windows a leading slash is
// "rooted" on the current drive, so `path.isAbsolute` would resolve it to
// C:\uploads\... Detect a real absolute path by drive letter / UNC instead.
const absolutePathOf = (filePath) =>
  /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')
    ? filePath
    : path.join(UPLOADS, filePath.replace(/^[\\/]+/, '').replace(/^uploads[\\/]/, ''));

async function main() {
  console.log(`Samaj Drishti evidence-integrity proof\n  API ${API}`);

  const official = await login('official1@samajdrishti.gov.in', 'Official@123');
  const admin = await login('admin@samajdrishti.gov.in', 'Admin@123');
  if (!official || !admin) {
    console.error('  FATAL  could not sign in as official1 / admin');
    process.exit(1);
  }

  const mine = await call('GET', `${API}/inspections/mine`, { token: official.token });
  const inspectionId = mine.data?.[0]?.id;
  ok('an assigned inspection is available to drive', !!inspectionId, show(mine));

  // Existing chain for this inspection (it may already hold items from earlier
  // runs - a chain is cumulative, so the assertions below are delta-based).
  const priorRes = await call('GET', `${API}/evidence?inspection_id=${inspectionId}`, { token: admin.token });
  const prior = (priorRes.data || []).slice().sort((a, b) => Number(a.id) - Number(b.id));
  const priorLastHash = prior.length ? prior[prior.length - 1].sha256_hash : null;

  // ---------------------------------------------------------------- hashing
  section('Upload + hashing');
  const first = await upload(official.token, inspectionId, 'integrity-a.png');
  ok('evidence upload accepted', first.status === 201, show(first));
  const firstHash = first.data?.sha256_hash;
  ok('a SHA-256 hash was recorded on upload', /^[a-f0-9]{64}$/.test(firstHash || ''), String(firstHash));
  ok(
    'the item links to the previous hash of this inspection',
    (first.data?.previous_hash || null) === (priorLastHash || null),
    `previous_hash=${first.data?.previous_hash} expected=${priorLastHash}`
  );
  ok('file size + mime type captured', !!first.data?.file_size && !!first.data?.mime_type, show(first));

  const second = await upload(official.token, inspectionId, 'integrity-b.png');
  const secondHash = second.data?.sha256_hash;
  ok('a second upload links to the previous hash', second.data?.previous_hash === firstHash, String(second.data?.previous_hash));
  ok('a distinct upload still produces a hash', !!secondHash, String(secondHash));

  // ------------------------------------------------------------ verification
  section('Verification (untouched files)');
  const check1 = await call('GET', `${API}/evidence/${first.data.id}/integrity`, { token: admin.token });
  ok('integrity endpoint answers', check1.status === 200, show(check1));
  ok('an untouched file verifies', check1.data?.integrity?.status === 'verified', show(check1));
  ok(
    'the chain grew by exactly the two new items and is intact',
    check1.data?.integrity?.chain_length === prior.length + 2 && check1.data?.integrity?.chain_ok === true,
    `chain_length=${check1.data?.integrity?.chain_length} expected=${prior.length + 2}`
  );

  const verify1 = await call('PUT', `${API}/evidence/${first.data.id}/verify`, { token: admin.token });
  ok('verification signs off a clean file', verify1.data?.verified === true && verify1.data?.integrity_status === 'verified', show(verify1));
  ok('verification timestamp stored', !!verify1.data?.verified_at, show(verify1));

  // ------------------------------------------------------------- tampering
  section('Tamper detection');
  const file = absolutePathOf(first.data.file_path);
  const original = fs.readFileSync(file);
  fs.writeFileSync(file, Buffer.concat([original, Buffer.from('TAMPERED-BY-A-THIRD-PARTY')]));
  ok('the stored file was altered on disk', fs.readFileSync(file).length !== original.length, file);

  const check2 = await call('GET', `${API}/evidence/${first.data.id}/integrity`, { token: admin.token });
  ok('a modified file is detected as tampered', check2.data?.integrity?.status === 'tampered', show(check2));
  ok('expected vs actual hash are reported', check2.data?.integrity?.expected_hash !== check2.data?.integrity?.actual_hash, show(check2));

  const verify2 = await call('PUT', `${API}/evidence/${first.data.id}/verify`, { token: admin.token });
  ok('verification REFUSES to sign off a tampered file', verify2.data?.verified === false, show(verify2));
  ok('the row is marked tampered', verify2.data?.integrity_status === 'tampered', show(verify2));

  const audit = await call('GET', `${API}/audit?entity=evidence&entity_id=${first.data.id}`, { token: admin.token });
  const actions = (audit.data || []).map((a) => a.action);
  ok('the failure is written to the audit trail', actions.includes('evidence.integrity_failed'), JSON.stringify(actions));

  // ----------------------------------------------------------------- repair
  section('Repair');
  fs.writeFileSync(file, original);
  const check3 = await call('GET', `${API}/evidence/${first.data.id}/integrity`, { token: admin.token });
  ok('restoring the file restores the verdict', check3.data?.integrity?.status === 'verified', show(check3));
  const verify3 = await call('PUT', `${API}/evidence/${first.data.id}/verify`, { token: admin.token });
  ok('and it can be signed off again', verify3.data?.verified === true, show(verify3));

  // ------------------------------------------------------------------ legacy
  const legacy = await call('GET', `${API}/evidence`, { token: admin.token });
  const unhashed = (legacy.data || []).filter((e) => !e.sha256_hash).length;
  console.log(`\n  note  ${unhashed} seeded demo item(s) predate the chain and report "unverified"`);

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('integrity-check crashed:', err);
  process.exit(1);
});

