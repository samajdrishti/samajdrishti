const crypto = require('crypto');
const { pool } = require('../config/db');
const audit = require('../services/auditService');
const notifications = require('./notificationController');

const VC_BASE_URL = process.env.VC_BASE_URL || 'https://meet.jit.si';

const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

const decorate = (session, projectsById, usersById) => ({
  ...session,
  project_name: (projectsById[session.project_id] || {}).name || null,
  project_location: (projectsById[session.project_id] || {}).location || null,
  official_name: (usersById[session.official_id] || {}).name || null,
  live: session.status === 'live',
  join_url: session.join_url,
});

const loadLookups = async () => {
  const [projectsResult, usersResult] = await Promise.all([
    pool.query('SELECT id, name, location FROM projects'),
    pool.query("SELECT id, name, role FROM users WHERE role = 'official'"),
  ]);
  return {
    projectsById: projectsResult.rows.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}),
    usersById: usersResult.rows.reduce((acc, u) => { acc[u.id] = u; return acc; }, {}),
    projects: projectsResult.rows,
    officials: usersResult.rows,
  };
};

/**
 * Random VC connectivity: a project and an official are drawn at random so the
 * pairing cannot be arranged in advance, mirroring the random inspection policy.
 * The room is a Jitsi Meet URL - free, no API key, and embeddable in a browser.
 */
exports.createSession = async (req, res) => {
  try {
    const { project_id, official_id, mode } = req.body;
    const lookups = await loadLookups();
    if (!lookups.projects.length || !lookups.officials.length) {
      return res.status(400).json({ message: 'Projects and officials are required to open a session' });
    }

    const project = project_id
      ? lookups.projects.find((p) => Number(p.id) === Number(project_id))
      : randomOf(lookups.projects);
    const official = official_id
      ? lookups.officials.find((u) => Number(u.id) === Number(official_id))
      : randomOf(lookups.officials);

    if (!project || !official) {
      return res.status(400).json({ message: 'Unknown project or official' });
    }

    const roomId = `SamajDrishti-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const result = await pool.query(
      `INSERT INTO vc_sessions (room_id, project_id, official_id, mode, status, scheduled_at, join_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [roomId, project.id, official.id, mode === 'direct' ? 'direct' : 'random', 'live', new Date(), `${VC_BASE_URL}/${roomId}`]
    );

    const session = decorate(result.rows[0], lookups.projectsById, lookups.usersById);

    await audit.record({
      actor: req.user,
      action: 'vc.session_opened',
      entity: 'vc_session',
      entityId: session.id,
      meta: { room: roomId, project: project.name, official: official.name },
    });
    await notifications.createNotification(
      official.id,
      `You have been randomly connected to "${project.name}" for a live review. Join from the Meet tab.`,
      'alert'
    );

    // Realtime invite for clients that happen to be online.
    const { io } = require('../index');
    if (io) {
      io.to(`user_${official.id}`).emit('vc:invite', { session });
      io.emit('alert', {
        severity: 'info',
        message: `Random VC opened: ${project.name} <-> ${official.name}`,
        meta: { session_id: session.id },
      });
    }

    res.status(201).json({ session });
  } catch (err) {
    console.error('Create VC session error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listSessions = async (req, res) => {
  try {
    const [rowsResult, lookups] = await Promise.all([
      pool.query('SELECT * FROM vc_sessions ORDER BY id DESC'),
      loadLookups(),
    ]);
    let sessions = rowsResult.rows;
    if (req.query.status) sessions = sessions.filter((s) => s.status === req.query.status);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json(sessions.slice(0, limit).map((s) => decorate(s, lookups.projectsById, lookups.usersById)));
  } catch (err) {
    console.error('List VC sessions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.getSession = async (req, res) => {
  try {
    const [rowsResult, logsResult, lookups] = await Promise.all([
      pool.query('SELECT * FROM vc_sessions WHERE id = $1', [req.params.id]),
      pool.query('SELECT * FROM vc_join_logs WHERE session_id = $1 ORDER BY id DESC', [req.params.id]),
      loadLookups(),
    ]);
    if (!rowsResult.rows.length) return res.status(404).json({ message: 'Session not found' });

    const session = decorate(rowsResult.rows[0], lookups.projectsById, lookups.usersById);
    const presence = logsResult.rows.map((log) => ({
      ...log,
      user_name: (lookups.usersById[log.user_id] || {}).name || null,
    }));
    res.json({ session, presence });
  } catch (err) {
    console.error('Get VC session error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.endSession = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE vc_sessions SET status = $1, ended_at = $2 WHERE id = $3 RETURNING *',
      ['ended', new Date(), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Session not found' });

    await audit.record({
      actor: req.user,
      action: 'vc.session_ended',
      entity: 'vc_session',
      entityId: result.rows[0].id,
      meta: { room: result.rows[0].room_id },
    });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('End VC session error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logJoin = async (req, res) => {
  try {
    const { user_id, action } = req.body;
    const result = await pool.query(
      'INSERT INTO vc_join_logs (session_id, user_id, action) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, user_id || req.user.id, action === 'leave' ? 'leave' : 'join']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('VC join log error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

