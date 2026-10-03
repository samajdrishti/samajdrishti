# Samaj Drishti

**AI-Powered Real-Time Monitoring & Random Inspection System for Transparent Governance**

Smart India Hackathon 2026 | Problem Statement ID: 26095 | Theme: Smart Automation

---

## 📁 Project Structure

```
samaj-drishti/
├── backend-java/     # Spring Boot API server (port 5000) — the shared backend
├── admin/            # Department dashboard (React + MUI, port 5173)
├── mobile-web/       # Field app - installable PWA for officials (port 5174)
├── ai-engine/        # Python ML + LLM engine (port 5001)
├── scripts/          # e2e-check.mjs (82 checks) + integrity-check.mjs (20 checks)
├── logs/             # dev-server / build / test output (git-ignored, safe to delete)
└── docker-compose.yml, orchestrate.cmd, start-all.cmd, stop-all.cmd, pm2.config.js
```

> The prototype plan (`prototype-plan.md`) and the classic architecture drawing
> (`architecture-diagram.html`) live one level up, in the workspace root.

## 🚀 Quick Start

Two frontends, one shared backend. `admin/` (web dashboard, port 5173) and
`mobile-web/` (mobile field PWA, port 5174) both call the same Spring Boot API
(`backend-java/`, port 5000), which in turn calls the shared Python AI engine
(`ai-engine/`, port 5001). The dashboards stay usable (with reduced AI output)
if the Python engine is offline.

| # | Service | Port | Command |
|---|---------|------|---------|
| 1 | Shared API (Spring Boot) | 5000 | `cd backend-java && mvn spring-boot:run` (or `java -jar target\samaj-drishti-api.jar`) |
| 2 | AI engine (shared) | 5001 | `cd ai-engine && .venv\Scripts\python.exe -m uvicorn main:app --port 5001` |
| 3 | Frontend 1 — Web dashboard | 5173 | `cd admin && npm install && npm run dev` |
| 4 | Frontend 2 — Mobile field app (PWA) | 5174 | `cd mobile-web && npm install && npm run dev` |

Both frontends resolve the backend URL at runtime from `/config.js`
(`window.__APP_CONFIG__.API_URL`), falling back to the build-time `VITE_API_URL`
(see `admin/.env.example` and `mobile-web/.env.example`, default
`http://localhost:5000/api`). For phone testing on the same Wi-Fi, set the
mobile app's `VITE_API_URL` to `http://<your-lan-ip>:5000/api`. In Docker, override
without rebuilding: `API_URL=https://api.example.gov.in/api docker compose up --build`.
Or run everything with `docker compose up --build`, or double-click `start-all.cmd`.

Open <http://localhost:5174> on a phone (or the laptop) for the inspector app and
<http://localhost:5173> for the department dashboard.

### Why a PWA instead of the React Native app

No Android SDK is available on this machine, so the field app is shipped as
an **installable PWA**: "Add to Home Screen" gives a full-screen, offline-capable
app on Android and iOS, and it runs unchanged in a desktop browser. `mobile-web/`
uses the same API, geo-fencing and offline queue. (A JDK 17 +
Maven are installed as of this writing, which is why `backend-java/` can now be
compiled and tested here — only the Android SDK is still missing.)

### Data storage

`.env` is loaded automatically. On boot the API tries PostgreSQL and, if the
server is unreachable, falls back to an **in-memory demo dataset** seeded with
10 projects, 29 inspections, cameras, 14 days of attendance and audit history:

```
[db] PostgreSQL unreachable (ECONNREFUSED) - falling back to in-memory demo mode.
[db] In-memory demo data loaded: 10 projects, 29 inspections, 14 evidence records, 8 users.
```

Set `DB_MODE=postgres` in production — the API then refuses to start without a
database.

### AI engine

```bash
cd ai-engine
python -m venv .venv && .venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 5001
```

* **Anomaly detection** prefers Isolation Forest (scikit-learn). Where an
  Application Control policy blocks the scikit-learn binaries it transparently
  falls back to a pure-NumPy robust modified z-score detector combined with
  domain rules (flagged inspections, extreme risk). The live backend is reported
  at `/api/health` and shown in the dashboard.
* **Executive briefings** are written by a real LLM (Groq free tier,
  `openai/gpt-oss-20b`) when `GROQ_API_KEY` is set; otherwise a deterministic
  local summary is produced so the feature never breaks.
* `GET /api/health` reports `llm_provider`, `anomaly_backend` and capabilities.

```bash
# optional: add an LLM provider
setx GROQ_API_KEY "gsk_..."        # Windows
export GROQ_API_KEY="gsk_..."      # macOS/Linux
set GROQ_MODEL=openai/gpt-oss-20b   # optional
```

> Groq's edge WAF rejects the default `Python-urllib` User-Agent with HTTP 403,
> which is why `llm.py` sends an explicit `User-Agent`. Reasoning models also need
> `max_tokens >= ~800`, otherwise the response content comes back empty.

### Demo Credentials

| Role | Email | Password | Used by |
|------|-------|----------|---------|
| Admin | `admin@samajdrishti.gov.in` | `Admin@123` | Department dashboard |
| Supervisor | `supervisor@samajdrishti.gov.in` | `Super@123` | Department dashboard |
| Officials 1-4 | `official1@…` … `official4@samajdrishti.gov.in` | `Official@123` | Field app |

One-tap sign-in buttons are on both login screens.



## 🔧 Environment Variables

### Backend (.env)
```bash
PORT=5000
# auto = PostgreSQL when reachable, else in-memory demo data | postgres | memory
DB_MODE=auto
DB_USER=postgres
DB_HOST=localhost
DB_NAME=samajdrishti
DB_PASSWORD=postgres
DB_PORT=5432
JWT_SECRET=your_jwt_secret
AI_ENGINE_URL=http://localhost:5001
# Seed the well-known demo logins (admin@…/Admin@123). OFF by default in
# docker-compose — never leave it on in a deployment others can reach.
SEED_DEMO_DATA=false
```

`DB_MODE=postgres` turns the demo fallback into a hard requirement — the API
refuses to start if the database is down, which is what you want in deployment.

> **Security note:** when seeding is enabled the demo users get well-known
> passwords (`Admin@123`, `Super@123`, `Official@123`). Keep
> `SEED_DEMO_DATA=false` (the compose default) anywhere the stack is
> reachable beyond your machine, and rotate `JWT_SECRET` before any real use.


## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get token |
| GET | `/api/auth/profile` | Get user profile |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project details |
| POST | `/api/projects` | Create project (admin only) |

### Inspections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inspections/mine` | Get assigned inspections |
| GET | `/api/inspections/all` | Get all inspections (admin) |
| POST | `/api/inspections/assign` | Assign inspection (admin) |
| PUT | `/api/inspections/:id/status` | Update inspection status |
| GET | `/api/inspections/:id` | Get inspection details |

### Evidence
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/evidence` | Upload evidence (`multipart/form-data`: `file`, `inspection_id`, `type`, `lat`, `lng`, `timestamp`) |
| GET | `/api/evidence?inspection_id=ID` | List evidence for inspection |
| PUT | `/api/evidence/:id/verify` | Verify evidence (admin) |

### Admin (role: admin or supervisor)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Aggregated stats + AI risk-scored projects + recent inspections |
| GET | `/api/admin/ai/insights` | Anomalies for the latest inspection batch |
| GET | `/api/admin/ai/status` | AI engine liveness + active anomaly backend |
| POST | `/api/admin/ai/assign` | Generate randomised, risk-weighted assignments (persisted by default) |

### Compliance GIS (real map + center drill-down)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gis/centers` | Centers on a real map: registered coordinates, the center head (warden/director), sanctioned capacity vs verified headcount and every ground-level camera with its live snapshot URL. The Google Maps browser key is served from the backend (`GOOGLE_MAP_API`), never bundled in the frontend. |

### AI Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Liveness + active models / anomaly backend |
| POST | `/api/anomaly/detect` | Detect inspection pattern anomalies |
| POST | `/api/risk/score` | Calculate project risk score |
| POST | `/api/risk/score-batch` | Risk score a whole project portfolio in one round-trip |
| POST | `/api/inspections/random-assign` | Generate random inspection assignments |
| POST | `/api/attendance/analyze` | Detect attendance irregularities |
| POST | `/api/patterns/suspicious` | Detect suspicious inspection patterns |

## 👤 User Roles

- **Admin**: Full access - create projects, assign inspections, view all data
- **Official**: View assigned inspections, capture evidence, submit reports
- **Supervisor**: Review inspections, manage officials

## 📱 Field App Screens (mobile-web, PWA)

| Tab / Screen | Description |
|--------------|-------------|
| **Login / Register** | JWT auth, one-tap demo sign-in, session restore |
| **Inspections (Home)** | Assigned inspections grouped by status, AI risk bars, live/offline badge, offline queue counter |
| **Inspection Detail** | Geo-check button, status transitions (start/complete/flag) — every change is geo-tagged and auto-flagged if filed from far away |
| **Evidence Capture** | Camera or gallery capture, preview, multipart upload with GPS, offline queue on failure |
| **CCTV** | Live camera grid refreshing every 3 s, site filter, online/offline chips, alert list |
| **Meet** | Random VC pairing, embedded Jitsi room, session history, presence logging |
| **Attendance** | Geo-fenced check-in/out, 14-day punch history, offline sync |
| **Profile** | User card, notifications, API/connection diagnostics, install hint, sign out |

## 🎯 Problem Statement 26095 coverage

| Required feature | Where it lives |
|------------------|----------------|
| Live CCTV feed integration from projects/institutes | `GET /api/monitoring/cameras`, `/snapshot` (server-rendered live frames or proxied HLS/MJPEG), CCTV tab + Live Monitoring page + GIS Compliance Map drill-down (center head + ground-level cameras per center) |
| Random video conferencing with incharge/staff/beneficiaries | `POST /api/vc/sessions` (random pairing, Jitsi Meet room), Meet tab + Live Monitoring page |
| Real-time monitoring dashboard for department officials | `/api/admin/dashboard`, `/api/monitoring/overview`, socket.io `monitoring:tick` / `alert` events |
| Mobile inspection module for PMU/inspection teams | Field app (PWA) Inspections + Inspection Detail screens |
| Random assignment of inspection duties through AI | `POST /api/admin/ai/assign` — risk-weighted, official/date/time randomised, persisted + notified |
| Geo-tagged inspection reports and live evidence capture | Haversine geo-verification on every status change, `multipart` evidence upload with GPS, `/api/reports` |
| AI-based anomaly and attendance analytics | `/api/admin/ai/insights` (Isolation Forest / robust z-score), `/api/attendance/anomalies` (late logins, missing punches, geo mismatches, proxy sign-ins) |
| *Extra:* reduction in fake reporting / proxy functioning | Suspicious geo-verdict auto-escalates an inspection to `flagged` and raises an alert |
| *Extra:* LLM executive briefing | `GET /api/admin/ai/narrative` (Groq `gpt-oss-20b`, local fallback) |
| *Extra:* full audit trail | `audit` table, `GET /api/audit`, recorded on every state change |


## 🗄️ Database Schema

### Tables
- `users` - User accounts with role-based access
- `projects` - Development/implementation projects
- `inspections` - Inspection records with AI risk scores
- `evidence` - Photos/videos/gps data from inspections
- `notifications` - System notifications

## 🤖 AI Features

1. **Anomaly Detection**: Uses Isolation Forest to detect unusual inspection patterns
2. **Risk Scoring**: Calculates AI risk score (0-100) based on budget, history, location
3. **Random Assignment**: AI-powered random inspection assignment to reduce bias
4. **Attendance Analysis**: Detects attendance irregularities
5. **Pattern Detection**: Identifies suspicious inspection patterns

## 🔌 Key Features

- ✅ Offline-first design (works without internet; queued uploads replay
  idempotently via a client-generated `client_id`, so a retried sync never
  duplicates evidence)
- ✅ Geo-tagged evidence capture
- ✅ Tamper-evident evidence vault (SHA-256 chain, re-hashed on sign-off — `node scripts/integrity-check.mjs`)
- ✅ Role-based authentication
- ✅ AI-powered risk scoring
- ✅ Random inspection assignment
- ✅ Full audit trail
- ✅ Real-time notifications
- ✅ CCTV integration support

## 📊 Data Flow

```
Mobile App ↔ Backend API (port 5000)
                ↕
              AI Engine (port 5001)
                ↕
            PostgreSQL Database
```

## 🔧 Development

```bash
# Backend (Spring Boot API)
cd backend-java && mvn spring-boot:run

# AI Engine
cd ai-engine && .venv\Scripts\python.exe -m uvicorn main:app --port 5001

# Dashboards
cd admin && npm run dev        # department dashboard :5173
cd mobile-web && npm run dev   # field PWA :5174
```

## 🧪 Prototype Build Notes

Verified end-to-end (Node 24 / Python 3.13): 19/19 API smoke checks passing,
admin dashboard served on port 5173, mobile upload contract exercised with
`curl` against the live API.

### Fixed to make the prototype run

> Historical log from the original Node.js/Express backend era — the backend
> has since been rewritten as Spring Boot (`backend-java/`) with the same API
> contract, so rows mentioning `express-validator`/`multer` describe the
> legacy stack.

| Area | Problem | Fix |
|------|---------|-----|
| `backend` | `express-validator` + `dotenv` imported but never installed | Added to `package.json`; `.env` now loads on boot |
| `backend` | `initDB()` was never called, so tables were never created | `index.js` awaits `initDB()` before listening |
| `backend` | No database on a clean machine | `config/db.js` auto-detects PostgreSQL, else falls back to `config/memoryStore.js` (same `pool.query` contract) seeded with demo data |
| `backend` | `notificationController` destructured `io` from `index.js` at require time (circular, always `undefined`) | Lazy `require` inside `createNotification`; sockets join `user_<id>` rooms |
| `backend` | `POST /admin/ai/assign` produced a preview that was never stored | Assignments persist as pending inspections; each official is notified |
| `backend` | Risk weighting was flat 50 — `projects.risk_score` never existed | New `POST /api/risk/score-batch`; dashboard + assignment use real AI scores |
| `backend` | Evidence upload dropped geo-tags sent as multipart fields | Controller accepts `lat`/`lng` fields or a JSON `geo_coords` object |
| `ai-engine` | Hard `sklearn` import crashed on machines with blocked binaries | Guarded import; Isolation Forest with a NumPy robust z-score fallback |
| `ai-engine` | Anomalies unreliable for small batches / empty feature sets | Rule-based screening below 8 rows, guards for 0 columns, seeded confidence |
| `admin` | `@vitejs/plugin-react` and Emotion peers missing (build failed) | Added to `package.json`; `npm run build` now succeeds (12.3k modules) |
| `admin` | No login screen and no token, so every call returned 401 | Login gate with demo buttons, 401 interceptor, sign-out, user card |
| `admin` | Dashboard read `data.evidence` (never sent) and charted `Math.random()` | Uses `stats.totalEvidence` + real `highRiskProjects`; error/empty states added |
| `admin` | Evidence page was mock data; "Add Project" never called the API | Both wired to the API with validation, verification and empty states |
| `admin` | AI confidence rendered as `0.83%` | Rendered as a percentage with the detector method shown |
| `mobile` | `AppRegistry` imported from `react`; `" axios"` typo in `package.json` | Both fixed |
| `mobile` | `offlineStorage` used undefined APIs and dropped the whole queue on partial success | Imports added; only successfully synced items are removed |
| `mobile` | Evidence posted as JSON to a multer endpoint | Uploads multipart FormData with file + geo-tag |
| `mobile` | Both navigators mounted at once, so login never went away | `AuthWrapper` mounts exactly one stack from the restored session |
| `mobile` | Camera permission compared an object to a string (always denied) | Checks the `CAMERA` grant; storage permission is optional |

### Verified on this machine

15/15 end-to-end checks covering every Problem Statement 26095 feature, plus:

* `admin` production build (12.3k modules) and `mobile-web` production build (132 modules)
* all four dev servers return HTTP 200 (`5000`, `5001`, `5173`, `5174`)
* CCTV snapshot returns a real ~72 KB PNG that differs between calls (live frames)
* geo-verification auto-escalates a report filed 700 km away to `flagged` with
  `possible_proxy_reporting, auto_flagged`
* the LLM briefing is generated live by `groq:openai/gpt-oss-20b` in ~1-2 s
* attendance analytics find the seeded `late_login`, `geo_mismatch` and
  `proxy_sign_in` patterns
* reports show a realistic verdict mix (verified / suspicious / unknown)

### Not verified on this machine

* **React Native app** — no separate RN source tree ships in this checkout
  (it predates the PWA); no Android SDK is installed either way.
  Use `mobile-web/` for demos.
* **PostgreSQL path** — no server available, so the API ran on the in-memory
  driver. Set `DB_MODE=postgres` once a database is available; the same
  controllers and queries are used either way.
* **scikit-learn path** — the Application Control policy on this machine blocks
  one of its binaries, so anomaly detection ran on the NumPy fallback.
* **Real cameras** — the seeded CCTV feeds are server-rendered frames. Register a
  camera with `stream_type: "mjpeg"` or `"hls"` and a real `stream_url` to proxy a
  live site feed.


## 📄 References

### Design documents
- [Prototype plan](../prototype-plan.md) - phase plan and success criteria
- [Architecture diagram](../architecture-diagram.html) - the classic component drawing (open in a browser, then *Print / Save as PDF* for slides)

> The as-built HLD/LLD, API contract v2 and rendered diagram set referenced in
> earlier drafts of this README are not in the repository; the endpoint table
> above and the Problem Statement 26095 coverage matrix are the living contract.

### External
- [DoSJE Official Site](https://www.dosje.gov.in/)
- [GitHub Repository](https://github.com/samajdrishti/samajdrishti)

---

Built for Smart India Hackathon 2026