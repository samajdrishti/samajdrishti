require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const db = require('./config/db');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const inspectionRoutes = require('./routes/inspections');
const evidenceRoutes = require('./routes/evidence');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const attendanceRoutes = require('./routes/attendance');
const monitoringRoutes = require('./routes/monitoring');
const gisRoutes = require('./routes/gis');
const vcRoutes = require('./routes/vc');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const atrRoutes = require('./routes/atr');
const beneficiaryRoutes = require('./routes/beneficiaries');
const jwt = require('jsonwebtoken');

const app = express();

// crossOriginResourcePolicy is disabled so the admin dashboard (port 5173) can
// render geo-tagged evidence served from this API (port 5000).
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({
    message: 'Samaj Drishti API Server',
    status: 'running',
    dataMode: db.getMode(),
    version: '1.0.0',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dataMode: db.getMode(), timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/vc', vcRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/atr', atrRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Authenticate the socket from the JWT the client sends in the handshake so the
// user is auto-joined to their personal notification room.
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'samajdrishti_secret');
      socket.data.userId = decoded.id;
    } catch (err) {
      // unauthenticated sockets are still allowed (public monitoring views)
    }
  }
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  if (socket.data.userId) socket.join(`user_${socket.data.userId}`);

  socket.on('join', (userId) => {
    if (userId) socket.join(`user_${userId}`);
  });

  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

/** Live monitoring heartbeat so dashboards can show camera health in realtime. */
const startMonitoringHeartbeat = () => {
  const tick = async () => {
    try {
      const { rows } = await db.pool.query('SELECT status FROM cameras');
      const online = rows.filter((r) => r.status === 'online').length;
      io.emit('monitoring:tick', {
        online,
        offline: rows.length - online,
        total: rows.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // heartbeat is best-effort
    }
  };

  tick();
  const timer = setInterval(tick, 5000);
  timer.unref();
};

const PORT = process.env.PORT || 5000;

const start = async () => {
  const mode = await db.initDB();
  startMonitoringHeartbeat();
  server.listen(PORT, () => {
    console.log('----------------------------------------------------------');
    console.log(`Samaj Drishti API running on port ${PORT}`);
    console.log(`Data mode       : ${mode}${mode === 'memory' ? ' (in-memory demo data)' : ' (PostgreSQL)'}`);
    console.log(`AI engine URL   : ${process.env.AI_ENGINE_URL || 'http://localhost:5001'}`);
    console.log('Modules         : auth, projects, inspections, evidence, attendance,');
    console.log('                  monitoring (CCTV), vc, reports, audit, admin');
    console.log('----------------------------------------------------------');
  });
};

const shutdown = () => {
  server.close(() => {
    db.pool.end().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('Failed to start Samaj Drishti API:', err.message);
  process.exit(1);
});

module.exports = { app, io, server };

