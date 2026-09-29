# Samaj Drishti — API Contract v2

Single source of truth for the backend (`backend/`), the AI engine (`ai-engine/`) and
the web clients (`admin/`, `mobile-web/`).

* API base URL: `http://localhost:5000/api`
* AI engine base URL: `http://localhost:5001`
* Auth: `Authorization: Bearer <jwt>` from `POST /auth/login` -> `{ user, token }`
* Roles: `admin`, `supervisor`, `official` (admin+supervisor = "back office")
* Lists return a **JSON array**; single resources return an object; errors return `{ message }`
* All list endpoints accept `?limit=` (default 100, max 500)
* Timestamps: ISO-8601. Geo: `{ "lat": 18.5, "lng": 73.8 }`

## Realtime (socket.io, same host/port as the API)

| Direction | Event | Payload |
|---|---|---|
| client -> server | `join` | `userId` (number) — joins room `user_<id>` |
| server -> client | `notification` | `{ message, type }` |
| server -> client | `inspection:new` | `{ inspection }` |
| server -> client | `inspection:update` | `{ inspection, status, flags }` |
| server -> client | `vc:invite` | `{ session }` |
| server -> client | `alert` | `{ severity, message, meta }` |
| server -> client | `monitoring:tick` | `{ online, offline, alerts, timestamp }` (every 5 s) |

Client URL: `io(BACKEND_ORIGIN, { auth: { token } })`.

## Authentication

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | returns `{ user, token }` |
| POST | `/auth/register` | `{ name, email, password, role?, department?, phone? }` | returns `{ user, token }` |
| GET | `/auth/profile` | - | returns `{ user }` |

## Projects

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/projects` | list |
| GET | `/projects/:id` | returns `{ project, inspections, evidence, cameras, attendance }` |
| POST | `/projects` | `{ name, description, location, department, geo_coords, start_date, end_date, budget }` (admin/supervisor) |
| PUT | `/projects/:id` | `{ name, description, status, budget }` (admin) |

## Inspections

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/inspections/mine` | official: own assignments |
| GET | `/inspections/all` | back office |
| GET | `/inspections/:id` | returns `{ ...inspection, project_name, location, geo_coords, official_name }` |
| POST | `/inspections/assign` | `{ project_id, assigned_to, scheduled_date, ai_risk_score }` |
| PUT | `/inspections/:id/status` | `{ status, notes, completed_date, lat?, lng? }` -> returns `{ inspection, geo_verification, flags }`; recomputes geo-verification when `lat`/`lng` sent, emits `inspection:update` |
| POST | `/inspections/:id/geo-verify` | `{ lat, lng }` -> `{ distance_meters, within_radius, verdict, severity, explanation }` |

`verdict` is one of `verified` (within radius), `mismatch` (outside radius, moderate) or
`suspicious` (far outside radius — possible proxy/fake reporting).

## Evidence (tamper-evident)

| Method | Endpoint | Notes |
|---|---|---|
| POST | `/evidence` | `multipart/form-data`: `file`, `inspection_id`, `type`, `lat`, `lng`, `timestamp`. The uploaded file is hashed (SHA-256) and linked to the previous item of the same inspection. Responds `{ ...evidence, integrity: { status: "hashed", sha256, previous_hash, chain_length } }` |
| GET | `/evidence?inspection_id=` | list |
| GET | `/evidence/:id/integrity` | read-only verdict: re-hashes the stored file and walks the chain. Returns `{ ...evidence, integrity: { status, file_match, chain_ok, expected_hash, actual_hash, chain_length, explanation, checked_at } }` |
| PUT | `/evidence/:id/verify` | back office. **Re-hashes instead of flipping a flag**: `verified` is true only when the file still matches the upload hash *and* the chain links are intact. A mismatch is stored as `tampered`, written to the audit trail (`evidence.integrity_failed`) and broadcast as a Socket.IO `alert`. Returns `{ ...evidence, integrity }` |

`integrity.status` is one of:

| status | meaning |
|---|---|
| `verified` | file hash matches the upload hash and every chain link is intact |
| `tampered` | the stored file differs from the hash taken at upload (or a chain link is broken) |
| `missing_file` | the row has a hash but the file can no longer be read (moved/deleted) |
| `unverified` | legacy/seeded row with no hash recorded — it predates the chain |

Proof script: `node scripts/integrity-check.mjs` uploads evidence, verifies it,
alters the file on disk, shows the tamper detection and repairs it again.

## Attendance (NEW)

| Method | Endpoint | Body / notes |
|---|---|---|
| GET | `/attendance` | `?official_id=&from=&to=&project_id=` |
| POST | `/attendance/check-in` | `{ project_id?, lat, lng, device, mode: "gps"\|"manual" }` — official self check-in; rejects when the official is >250 m from the project |
| POST | `/attendance/check-out` | same body shape |
| GET | `/attendance/summary` | per-official aggregates: `{ officials: [{ official_id, name, days_present, absent_days, late_days, geo_mismatches, punctuality_pct }], totals }` |

## Monitoring / CCTV (NEW)

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/monitoring/cameras` | `?project_id=&status=` -> array of cameras incl. `online`, `last_seen` |
| POST | `/monitoring/cameras` | back office `{ name, project_id, location, stream_type, stream_url?, lat?, lng? }` |
| PATCH | `/monitoring/cameras/:id` | back office `{ status: "online"\|"offline", name?, location? }` |
| GET | `/monitoring/cameras/:id/snapshot` | `image/png` (200) — simulated frame or proxied JPEG; `404` when unknown |
| GET | `/monitoring/overview` | `{ cameras, online, offline, alerts, active_inspections, last_updated }` |

`stream_type` is `simulated` (server-generated PNG frames, no key/camera needed),
`mjpeg` (`stream_url` is an http(s) MJPEG/JPEG source) or `hls` (`stream_url` is an
`.m3u8` playlist played natively/with hls.js).

## Video conferencing (NEW)

| Method | Endpoint | Body / notes |
|---|---|---|
| POST | `/vc/sessions` | `{ project_id?, official_id?, mode: "random"\|"direct" }` -> picks a random project + official, returns `{ session }` with `join_url` |
| GET | `/vc/sessions` | `?status=` -> array |
| GET | `/vc/sessions/:id` | `{ session }` incl. `join_url` |
| POST | `/vc/sessions/:id/end` | sets `status="ended"`, `ended_at` |
| POST | `/vc/sessions/:id/join-log` | `{ user_id, action: "join"\|"leave" }` — presence log |

`join_url` targets Jitsi Meet (free, no API key) by default; override the host with
`VC_PROVIDER`/`VC_BASE_URL` env vars.


## Reports (NEW)

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/reports` | `?project_id=&status=&verified=&limit=` -> array of report summaries |
| GET | `/reports/:id` | full geo-tagged report: `{ report: { inspection, project, official, supervisor, evidence[], geo_verification, flags, attendance_context, ai_risk } }` |
| POST | `/reports/:id/share` | returns `{ text }` — a plain-text shareable summary |

## Audit trail (NEW)

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/audit` | `?entity=&entity_id=&limit=` -> newest first |
| GET | `/audit/:entity/:id` | filtered history |

## Admin / AI

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/admin/dashboard` | `stats`, `recentInspections`, `highRiskProjects`, `projects`, `officials` |
| GET | `/admin/ai/insights` | `{ anomalies }` |
| GET | `/admin/ai/status` | `{ aiEngine: { online, url, anomaly_backend, models, capabilities } }` |
| POST | `/admin/ai/assign` | `{ num_inspections, persist? }` -> risk-weighted random assignment |
| GET | `/admin/ai/narrative` | LLM executive summary: `{ narrative, provider, model, generated_at, data }` |
| GET | `/admin/alerts` | alert feed built from geo-verification + AI anomalies |

## AI Engine endpoints (http://localhost:5001)

| Method | Endpoint | Request | Response |
|---|---|---|---|
| GET | `/api/health` | - | `{ status, models, capabilities, anomaly_backend, llm_provider }` |
| POST | `/api/risk/score` | `{ project_id, budget, location, department, inspection_history }` | `{ project_id, risk_score, factors }` |
| POST | `/api/risk/score-batch` | `{ projects: [ ...same shape minus project_id ] }` | `{ scores: [{ project_id, risk_score, factors }], count }` |
| POST | `/api/anomaly/detect` | `{ inspections: [ ... ] }` | `{ anomalies: [{ inspection_id, type, method, confidence, details }] }` |
| POST | `/api/attendance/analyze` | `{ records: [{ official_id, date, check_in, check_out, project_id, lat, lng }] }` | `{ irregularities: [{ official_id, type, severity, details, confidence }], summary: { officials_analyzed, total_irregularities } }` |
| POST | `/api/patterns/suspicious` | `{ patterns: [{ inspector_id, scheduled_time }] }` | `{ suspicious_patterns: [...] }` |
| POST | `/api/geo/verify` | `{ project: { id, name, lat, lng, radius_meters? }, observation: { inspection_id, lat, lng, captured_at } }` | `{ distance_meters, within_radius, verdict, severity, explanation }` |
| POST | `/api/narrative` | `{ context: {...}, tone: "executive"\|"field"\|"technical" }` | `{ narrative, provider, model, generated_at }` |

Attendance irregularity `type` is one of `low_attendance`, `late_login`, `geo_mismatch`,
`missing_punch`, `proxy_sign_in`, `overlong_session`. `severity` is `low|medium|high`.
`provider` is e.g. `groq:openai/gpt-oss-20b` or `local-fallback` when no API key is set.

## Error handling

* `400` validation, `401` missing/invalid token, `403` wrong role, `404` not found, `502` upstream (AI engine) failure.
* Body shape is always `{ message }`.
* The AI engine must never take the API down: every call is wrapped and falls back to a
  deterministic local result, so the dashboard degrades instead of failing.
