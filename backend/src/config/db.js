const { Pool } = require('pg');
const memoryStore = require('./memoryStore');

/**
 * DB_MODE:
 *   auto     (default) -> use PostgreSQL when reachable, else in-memory demo mode
 *   postgres           -> require PostgreSQL (startup fails if unavailable)
 *   memory             -> always use the in-memory demo driver
 */
const DB_MODE = (process.env.DB_MODE || 'auto').toLowerCase();

const postgresPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'samajdrishti',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  connectionTimeoutMillis: 3000,
});

postgresPool.on('connect', () => console.log('[db] PostgreSQL client connected'));

// A pool that has never successfully connected emits 'error' on the idle client
// failure path; log it instead of crashing the process.
postgresPool.on('error', (err) => console.error('[db] PostgreSQL pool error:', err.message));

let driver = null;
let activeMode = 'uninitialised';

/**
 * Stable facade - controllers destructure `pool` at require time and call
 * `pool.query()` per request, so the underlying driver can be swapped at boot.
 */
const pool = {
  query: (text, params) => {
    if (!driver) {
      return Promise.reject(new Error('Database not initialised. Call initDB() before serving requests.'));
    }
    return driver.query(text, params);
  },
  end: () => (driver && driver.end ? driver.end() : Promise.resolve()),
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'official', 'supervisor')) DEFAULT 'official',
    department VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    department VARCHAR(60),
    geo_coords POINT,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12,2),
    status VARCHAR(20) CHECK (status IN ('active', 'completed', 'pending')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    assigned_to INTEGER REFERENCES users(id),
    supervisor_id INTEGER REFERENCES users(id),
    status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'completed', 'flagged')) DEFAULT 'pending',
    scheduled_date DATE,
    completed_date DATE,
    ai_risk_score DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id SERIAL PRIMARY KEY,
    inspection_id INTEGER REFERENCES inspections(id),
    type VARCHAR(20) CHECK (type IN ('photo', 'video', 'audio', 'document')),
    file_path VARCHAR(500),
    geo_coords POINT,
    timestamp TIMESTAMP,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    type VARCHAR(50),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    location VARCHAR(200),
    stream_type VARCHAR(20) CHECK (stream_type IN ('simulated', 'mjpeg', 'hls')) DEFAULT 'simulated',
    stream_url VARCHAR(500),
    geo_coords POINT,
    status VARCHAR(20) CHECK (status IN ('online', 'offline')) DEFAULT 'online',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    official_id INTEGER REFERENCES users(id),
    project_id INTEGER REFERENCES projects(id),
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    geo_coords POINT,
    device VARCHAR(120),
    mode VARCHAR(20) DEFAULT 'gps',
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vc_sessions (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(120) NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    official_id INTEGER REFERENCES users(id),
    mode VARCHAR(20) DEFAULT 'random',
    status VARCHAR(20) CHECK (status IN ('scheduled', 'live', 'ended')) DEFAULT 'scheduled',
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    join_url VARCHAR(300),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vc_join_logs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES vc_sessions(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(20) DEFAULT 'join',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id),
    actor_name VARCHAR(120),
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(60) NOT NULL,
    entity_id INTEGER,
    meta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const connectPostgres = async () => {
  const client = await postgresPool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  driver = {
    kind: 'postgres',
    query: (text, params) => postgresPool.query(text, params),
    end: () => postgresPool.end(),
  };
};

const useMemory = () => {
  memoryStore.seed();
  driver = { kind: 'memory', query: (text, params) => memoryStore.query(text, params) };
};

const initDB = async () => {
  if (DB_MODE !== 'memory') {
    try {
      await connectPostgres();
      await driver.query(SCHEMA);
      activeMode = 'postgres';
      console.log('[db] Tables created/verified (PostgreSQL persistent mode)');
      return activeMode;
    } catch (err) {
      const reason = err.code || err.message;
      if (DB_MODE === 'postgres') {
        throw new Error(`PostgreSQL is required (DB_MODE=postgres) but is unreachable: ${reason}`);
      }
      console.warn(`[db] PostgreSQL unreachable (${reason}) - falling back to in-memory demo mode.`);
      postgresPool.end().catch(() => {});
    }
  }

  useMemory();
  activeMode = 'memory';
  const { state } = memoryStore;
  console.log(
    `[db] In-memory demo data loaded: ${state.projects.length} projects, ` +
    `${state.inspections.length} inspections, ${state.evidence.length} evidence records, ` +
    `${state.users.length} users.`
  );
  console.log('[db] Demo logins -> admin@samajdrishti.gov.in / Admin@123');
  return activeMode;
};

const getMode = () => activeMode;

module.exports = { pool, initDB, getMode, DB_MODE };

