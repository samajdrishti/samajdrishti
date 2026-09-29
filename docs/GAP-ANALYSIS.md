# Gap Analysis — HLD/LLD vs `backend-java`

Target: the HLD/LLD in the task brief (system name *DoSJE SmartInspect*, package
`com.smartinspect`, MySQL, feature-based packages).

Assessed: `backend-java/` — Spring Boot 3.2.5, Java 17, package `in.gov.samajdrishti`,
72/72 tests green (`ApiContractTest` 47, `GeoAndAiClientTest` 13, `JsonContractTest` 8,
`SupportCodeTest` 4). Layer-oriented layout: `config / security / domain / repository /
service / web / realtime / seed`.

> Naming note: the LLD names the system *DoSJE SmartInspect*, the code and the running
> prototype are *Samaj Drishti*. Same PS (26095). Treated as one product.

---

## 0. Status legend

| | Meaning |
|---|---|
| **OK** | Present and behaviourally equivalent |
| **PARTIAL** | Present but a different shape, or missing fields the LLD requires |
| **MISSING** | No entity, table, endpoint or logic anywhere |
| **N/A** | LLD item with no counterpart worth building (noted for the record) |

---

## 1. Package structure

| LLD package | Current location | Verdict |
|---|---|---|
| `config/` | `in.gov.samajdrishti.config` (7 classes) | OK, same name |
| `auth/` | split: `security/{JwtService,JwtAuthFilter,AuthPrincipal}` + `web/AuthController` | **PARTIAL** — no `AuthService`, no `LoginRequest` record |
| `user/` | `domain/User` + `repository/UserRepository` only | **PARTIAL** — no `UserService`, no `UserController` |
| `institution/` | *nothing* | **MISSING** |
| `inspection/` | `domain/Inspection`, `web/InspectionController`, logic in controller | **PARTIAL** — no `InspectionService`, no `InspectionStatus` enum |
| `assignment/` | *nothing* (assignment is two columns on `Inspection`) | **MISSING** |
| `location/` | `service/GeoService` | OK in substance, wrong package, no `LocationService` |
| `evidence/` | `domain/Evidence` + `web/EvidenceController` | PARTIAL — no `EvidenceService`, no `StorageService` |
| `checklist/` | `domain/InspectionChecklist` | **PARTIAL** — no `ChecklistItem` entity, no `ChecklistService` |
| `attendance/` | `domain/Attendance` + `web/AttendanceController` | PARTIAL — no `AttendanceService`, no `AttendanceRecord` |
| `anomaly/` | `service/AiEngineClient` (call only) | **MISSING** — no `Anomaly` entity, no `AnomalyService` |
| `cctv/` | `domain/Camera` + `web/MonitoringController` | PARTIAL — no `CCTVService` |
| `report/` | `service/ReportService` + `web/ReportController` | PARTIAL — computed, never persisted |
| `atr/` | `domain/Atr` + `web/AtrController` | PARTIAL — no `ATRService`, no create/update/close endpoints |
| `notification/` | `domain/Notification` + `service/NotificationService` + controller | OK |
| `audit/` | `domain/AuditEntry` + `service/AuditService` + controller | OK, table named `audit` not `audit_logs` |
| `websocket/` | `config/WebSocketConfig` + `realtime/{RealtimeHub,SocketIoEngineHandler}` | PARTIAL — no `WebSocketController`, no `WebSocketEventService` |

**Net:** every LLD package has *something* equivalent except `institution/` and
`assignment/`, which do not exist at all. The dominant cost is not missing
functionality, it is that the module boundaries the LLD asks for are not there.

---

## 2. Database schema

13 of 15 LLD tables exist. Two are genuinely absent; the rest are present under a
different name and/or column set.

| LLD table | Current | Verdict | Delta |
|---|---|---|---|
| `users` | `users` | PARTIAL | LLD adds `district`, `state`, `is_active`; has `updated_at`. Roles are 3 (`admin`/`supervisor`/`official`) vs the LLD's 7. |
| `institutions` | — | **MISSING** | LLD: `name, type, scheme, address, district, state, latitude, longitude, geofence_radius, status`. The LLD's institution is today's `projects` table. |
| `inspection_assignments` | — | **MISSING** | LLD: `inspection_id, officer_id, assignment_type, assigned_at, accepted_at, priority, status`. Today: `inspections.assigned_to` + `supervisor_id` + `status` + `scheduled_date`. No history, no accept/decline, no priority. |
| `inspections` | `inspections` | PARTIAL | LLD wants `inspection_code, institution_id, assignment_id, inspection_type, gps_verified, vc_status, submitted_at`. Today: `project_id, assigned_to, supervisor_id (never written), status, scheduled_date, completed_date, ai_risk_score, notes`. |
| `inspection_checklists` | `inspection_checklists` | PARTIAL | LLD is **per item** (`section, item, status, remarks, verified_at`). Today is **one row per inspection** with a `checks_json` blob `{itemId: boolean}` + `compliance_score` + `voice_remarks`. Item definitions are hard-coded in `InspectionController.SCHEME_CHECKLISTS`. No remarks per item, no `verified_at`. |
| `evidence` | `evidence` | PARTIAL | LLD wants `uploaded_by, latitude, longitude, accuracy, file_hash, sync_status`. Today: `evidence_type, file_path, geo_lat, geo_lng, captured_at, verified`. **No `uploaded_by`, no hash, no `sync_status`, no `accuracy`.** Duplicate-upload detection is therefore impossible. |
| `attendance_records` | `attendance` | PARTIAL | Different model. Today = a **punch pair** (`check_in`/`check_out` on one row) for official site visits. LLD = **beneficiary headcount verification** (`registered/reported/observed/attendance_percentage/verified`) scoped to an `inspection_id`. These are two different concepts sharing a name. |
| `anomalies` | — | **MISSING** | LLD: `inspection_id, type, description, confidence, severity, evidence_id, status, human_verified`. AI results are returned to the caller and discarded — not queryable, not acknowledgeable, no human-in-the-loop record. |
| `cctv_cameras` | `cameras` | PARTIAL | LLD: `institution_id, camera_name, stream_url, status, last_heartbeat`. Today: `project_id, name, stream_type, stream_url, status, tamper_flag, occlusion_pct, detected_headcount, aebas_punch_count, last_seen`. Substantially richer; the LLD's 5 columns are a subset. |
| `inspection_reports` | — | **MISSING** | `ReportService` assembles a report at read time from Inspection+Evidence+Attendance+Audit. Nothing is stored, so there is no `report_status`, no `submitted_by/submitted_at`, no history. |
| `action_taken_reports` | `atrs` | PARTIAL | LLD: `anomaly_id, assigned_to, action_description, deadline, status, remarks, verification_status, closed_at`. Today: `project_id, project_name, inspection_id, scheme, deficiency_title, deficiency_details, deadline, status, ngo_reply, corrective_evidence_url, pmu_adjudication, official_name`. Overlapping but no `anomaly_id`, no `assigned_to`, no `closed_at`, no `verification_status`. |
| `notifications` | `notifications` | PARTIAL | LLD: `title, message, type, reference_id, is_read`. Today: `message, type, is_read`. **No `title`, no `reference_id`** (so a notification cannot link to the inspection/ATR it refers to). |
| `audit_logs` | `audit` | PARTIAL | LLD: `user_id, action, entity_type, entity_id, old_value, new_value, ip_address`. Today: `actor_id, actor_name, action_type, entity, entity_id, meta` (JSON blob), no `ip_address`, and `old_value`/`new_value` exist only inside the free-form `meta` JSON. |

**Bonus tables the LLD does not mention** but the code has and the dashboards use:
`projects`, `vc_sessions`, `vc_join_logs`, `beneficiary_feedback`. The LLD covers VC as a
"simulated screen" and has no beneficiary-feedback table.

---

## 3. API surface

35 REST endpoints exist. Mapping to the LLD's documented endpoints:

| LLD endpoint | Status | Note |
|---|---|---|
| `POST /api/auth/login` | OK | body is `{email, password}`, LLD says `{username, password}`. Response `{token, user}` matches. |
| `GET /api/inspections/assigned` | PARTIAL | exists as `/api/inspections/mine` (different path, same meaning) |
| `POST /api/inspections/{id}/accept` | **MISSING** | no accept step; officer goes straight to `PUT /status` |
| `POST /api/inspections/{id}/start` | **MISSING** | status is set via the generic `PUT /{id}/status` |
| `POST /api/inspections/{id}/complete` | **MISSING** | same |
| `GET /api/inspections/{id}` | OK | — |
| `POST /api/inspections/{id}/location` | PARTIAL | exists as `POST /{id}/geo-verify`, returns the same `{verified, distanceMeters, accuracy}`-shaped verdict (keys are snake_case: `distance_meters`, `within_radius`, `verdict`). **Does not persist the result** onto the inspection — `gps_verified` is never written. |
| `POST /api/inspections/{id}/evidence` | PARTIAL | upload is `POST /api/evidence` (flat, not nested) |
| `GET /api/inspections/{id}/checklist` | OK | — |
| `PUT /api/inspections/{id}/checklist/{itemId}` | **MISSING** | whole checklist is `POST`ted as one JSON blob; no per-item update, no per-item remarks |
| `POST /api/inspections/{id}/attendance` | **MISSING** | no beneficiary-headcount endpoint at all |
| `POST /internal/ai/analyze` | **MISSING** | no per-inspection AI call. The engine gets a *batch* of inspections and a project gets a risk score, but nothing analyses one inspection end-to-end (checklist + evidence + attendance + geo). |
| `POST /api/atr` | **MISSING** | **an ATR cannot be created through the API.** Only `GET`, `/respond`, `/adjudicate` exist. ATRs come from the seeder. |
| `PUT /api/atr/{id}` | **MISSING** | — |
| `POST /api/atr/{id}/close` | **MISSING** | closest is `/adjudicate` with `approve` → `approved_closed` |
| `GET /api/users` etc. | **MISSING** | no user-management endpoints at all |
| Login response `role: "INSPECTION_OFFICER"` | PARTIAL | code returns `official` / `supervisor` / `admin` |

**Endpoints the code has that the LLD does not list** (all used by the shipped
dashboards, all must survive the refactor): `/api/projects*`, `/api/monitoring/cameras*`
+ `/snapshot`, `/api/vc/sessions*`, `/api/beneficiaries/feedback`,
`/api/attendance/check-in|check-out|summary|anomalies`, `/api/reports*`,
`/api/admin/{dashboard,ai/*,alerts}`, `/api/audit*`, `/api/notifications*`.

---

## 4. Algorithms and rules

| LLD section | Status | Note |
|---|---|---|
| §16 Random assignment (filter active/district/available → random → avoid repeat → notify) | PARTIAL | `POST /api/admin/ai/assign` delegates the whole decision to the Python engine's `/api/inspections/random-assign`, weighted by AI risk. **No eligibility filtering in Java** — no `district` column on `users`, no `is_active`, no availability or workload check, no "don't reassign the same officer" rule. The LLD's §16 is a *fallback* the engine has no equivalent for. |
| §17 Geofence (haversine vs radius) | OK | `GeoService` implements haversine exactly, plus a 3-zone verdict ladder (`verified` / `mismatch` / `suspicious`) that is strictly better than the LLD's binary. **But the radius is a hardcoded `DEFAULT_RADIUS_M = 250`** — there is no per-institution `geofence_radius` column, so §17's "institution coordinates + radius" cannot be configured per site. |
| §18 Offline sync (clientId/UUID → idempotent server) | **MISSING** | no `client_id` on any table, no idempotency key on any write endpoint. The PWA has an offline queue; a retried upload after a flaky ack will duplicate. Evidence is the only upload and it stores no hash. |
| §19 State machine (15 states) | PARTIAL | code has 4: `pending`, `in_progress`, `completed`, `flagged`. `VALID_STATUSES` is a `List<String>` in the controller. 11 of 15 states unreachable; no transition validation beyond membership. |
| §20 Audit logging (14 named actions) | PARTIAL | audit is written on ~18 actions, good coverage. But names differ (`geo_verification.verified` vs LLD `GPS_VERIFIED`) and there is no `ip_address`, so "who did this, from where" is unanswerable. |
| §9 AI as assistance + human review | PARTIAL | every AI call has a deterministic Java fallback and a null-on-failure contract — that part is solid. But `human_verified` is impossible: anomalies are not stored, so no reviewer can sign off. This is the single biggest functional gap. |
| §7 RBAC with 7 roles | PARTIAL | 3 roles enforced; 2 more (`ngo`, `beneficiary`) are seeded in the DB but **no endpoint authorises them** and a seeded `ngo` user cannot even self-register (`AuthController.ROLES` excludes them). `AuthPrincipal.isBackOffice()` is dead code. |

---

## 5. Realtime

LLD wants STOMP `/topic/inspections` and `/topic/inspections/{code}`.
Code has a **hand-written Engine.IO v4 / Socket.IO v5 implementation** over raw Spring
WebSocket (`realtime/SocketIoEngineHandler`, 195 lines) with rooms named `user_<id>`.

**This is a deliberate divergence, not a defect.** The shipped `admin/` and `mobile-web/`
both use `socket.io-client`, so switching to STOMP would break both frontends and the
working demo for no functional gain. Recommend: keep the wire protocol, add the
`WebSocketEventService`/`WebSocketController` abstraction the LLD names, and map
`/topic/inspections` onto a `inspections` room.

Gaps that matter more than the protocol:

* **No authentication requirement on connect.** `RealtimeHub.emit()` broadcasts to every
  open socket and ignores rooms entirely, so an unauthenticated client receives every
  event. `?token=` is only honoured to *join* a user room.
* Events emitted: `monitoring:tick`, `inspection:new`, `inspection:update`, `alert`,
  `vc:invite`, `notification`. **No event for**: attendance, ATR state change, evidence
  upload/verify, report submission, camera state change, anomaly raised. The LLD's §13
  web→mobile flow (official creates ATR → officer notified) works only because
  `NotificationService` emits `notification`; the ATR state change itself is invisible.
* Heartbeat payload hardcodes `alerts: 0`.

---

## 6. Infrastructure divergences (need a decision, not code)

| LLD | Code | Impact |
|---|---|---|
| **MySQL** | **PostgreSQL** (+ H2 in-memory demo fallback) | `pom.xml` ships the Postgres driver; H2 backs the demo and the whole test suite. Moving to MySQL is a driver swap plus dialect/column-type review (`BigDecimal(5,2)`, `Instant`, `IDENTITY`), and H2 would need `MODE=MySQL` for tests to stay meaningful. **Not recommended for a hackathon with a working demo.** |
| AWS S3 | local disk `uploads/evidence` | `app.uploads.evidence-dir`. `StorageService` is the natural seam to abstract. |
| Firebase push | in-app socket notification | fine for the prototype; a `NotificationService` interface is the seam. |
| React Native + Expo mobile | PWA at `mobile-web/` | already documented in the README (no Android SDK on this machine). `mobile/` is legacy. |
| Swagger / OpenAPI | none | no OpenAPI dependency, no springdoc. |
| Deployment to cloud | local `start-all.cmd` | — |

---

## 7. Correctness and security issues found

Not in the LLD, but they will be visible in a demo and are cheap to fix:

1. **Realtime has no auth** — anonymous sockets receive all broadcasts (§5). Highest
   severity: it defeats the "officer only sees own inspections" model.
2. **`GET /api/inspections/{id}` has no ownership check** — any authenticated user reads
   any inspection. Same for `POST /{id}/geo-verify` and `POST /{id}/checklist`, so any
   user can submit a checklist for anyone's inspection. (`PUT /{id}/status` *does* check
   via `findByIdAndAssignedTo` — 404, not 403.)
3. **Evidence coordinates are stored but never geofence-verified at upload** — the one
   place it matters most, since that is the actual proof of visit.
4. **Attendance check-in bypasses the fence entirely when no GPS is sent** — `lat`/`lng`
   are optional, so the anti-proxy control is opt-in per client.
5. **Evidence upload has no file validation** — no content-type check, no extension check,
   no size check beyond the 10 MB global cap, and `getOriginalFilename()` is used for the
   stored name. Combined with `add-mappings: true` and a `permitAll` `/uploads/**`
   static path, this is the classic unrestricted-upload hole.
6. **`supervisor_id` on `inspections` is never written** by any endpoint.
7. **AI results are never persisted** — the dashboard recomputes anomalies on every
   `/api/admin/ai/insights` call, so two officials viewing the same page can see
   different anomaly lists, and nothing is reviewable.
8. `VcController.logJoin` trusts a caller-supplied `user_id`.
9. `POST /api/beneficiaries/feedback` is `permitAll` and hardcodes
   `verifiedResident = true` with no check — a "verified resident" claim that is
   literally always true.
10. CORS is `allowedOriginPatterns("*")` with `allowCredentials(true)`, and
    `JWT_SECRET` has a hardcoded default.

---

## 8. Recommended order of work

Ordered by demo-visible value ÷ risk, so each step is independently shippable.

**Phase 1 — close the LLD's functional holes (highest demo value)**
1. `anomalies` table + `Anomaly`/`AnomalyService` + per-inspection `POST /internal/ai/analyze`;
   persist every AI finding with `human_verified`. *Unblocks §9's human-in-the-loop claim
   and the LLD's only missing core table.*
2. `POST /api/atr`, `PUT /api/atr/{id}`, `POST /api/atr/{id}/close` + `assigned_to`,
   `verification_status`, `closed_at`, and a socket event on ATR change. *The LLD's §13
   web→mobile flow is currently only half-implemented because an ATR cannot be created.*
3. `inspection_assignments` table + `AssignmentService`/`RandomAssignmentService` with
   the §16 eligibility filters in Java (active/district/available/no-repeat) as the
   fallback the engine path lacks.
4. `evidence.client_id` / `file_hash` / `sync_status` / `uploaded_by` / `accuracy` +
   idempotency on upload. *§18 offline sync is unimplemented and this is the fix.*
5. Per-item checklist (`section, item, status, remarks, verified_at`) replacing the
   `checks_json` blob, plus `GET`/`PUT /checklist/{itemId}`.

**Phase 2 — persist what is currently computed**
6. `inspection_reports` table + `report_status`/`submitted_by`/`submitted_at`.
7. Beneficiary `attendance_records` (registered/reported/observed/percentage) — note this
   is a *new* concept, keep the existing official punch `attendance` table as-is.
8. `gps_verified` written by the geofence service; `institutions.geofence_radius`
   honoured (replaces hardcoded 250 m). Renaming `projects`→`institutions` is the one
   high-churn rename — worth doing here or not at all.

**Phase 3 — make the LLD's structure real**
9. Repackage to `com.smartinspect` with the LLD's feature packages; add the missing
   `*Service` / `*Controller` classes so logic leaves the controllers. Behaviour-preserving.
10. Enum-ise the status strings (`InspectionStatus`, `AnomalyType`, `AnomalySeverity`,
    `Role`) and validate transitions against §19.
11. `notifications.title` + `reference_id`; `audit_logs` `ip_address` + `old_value`/
    `new_value`; extend `users` with `district`/`state`/`is_active` and map the 7 roles.

**Phase 4 — hardening** (pick the top 3, the rest are pre-existing debt)
12. Realtime auth; ownership checks on the three unguarded inspection endpoints; file
    validation on evidence upload; CORS/secret env-driven.

**Explicitly not recommended:** MySQL migration, React Native replacement of the PWA,
STOMP in place of the socket.io protocol. Each breaks a working piece for a cosmetic
match to the document.
