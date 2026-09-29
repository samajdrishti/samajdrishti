const { pool } = require('../config/db');
const geo = require('../services/geoService');
const audit = require('../services/auditService');
const aiService = require('../services/aiService');
const notifications = require('./notificationController');

/** Reject a punch that is far from the project the official claims to be at. */
const PUNCH_TOLERANCE_M = 250;

const enrich = (rows, usersById, projectsById) =>
  rows.map((row) => ({
    ...row,
    geo_coords: geo.normaliseCoords(row.geo_coords),
    official_name: (usersById[row.official_id] || {}).name || null,
    project_name: (projectsById[row.project_id] || {}).name || null,
    check_in: row.check_in ? new Date(row.check_in).toISOString() : null,
    check_out: row.check_out ? new Date(row.check_out).toISOString() : null,
  }));

const loadLookups = async () => {
  const [usersResult, projectsResult] = await Promise.all([
    pool.query('SELECT id, name, role, department FROM users'),
    pool.query('SELECT id, name, location, geo_coords FROM projects'),
  ]);
  return {
    usersById: usersResult.rows.reduce((acc, u) => { acc[u.id] = u; return acc; }, {}),
    projectsById: projectsResult.rows.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}),
  };
};

exports.list = async (req, res) => {
  try {
    const [rowsResult, lookups] = await Promise.all([
      pool.query('SELECT * FROM attendance ORDER BY id DESC'),
      loadLookups(),
    ]);

    let rows = rowsResult.rows;
    if (req.query.official_id) rows = rows.filter((r) => String(r.official_id) === String(req.query.official_id));
    if (req.query.project_id) rows = rows.filter((r) => String(r.project_id) === String(req.query.project_id));
    if (req.query.from) rows = rows.filter((r) => r.date >= req.query.from);
    if (req.query.to) rows = rows.filter((r) => r.date <= req.query.to);

    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(enrich(rows.slice(0, limit), lookups.usersById, lookups.projectsById));
  } catch (err) {
    console.error('Attendance list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const punch = (action) => async (req, res) => {
  const { project_id, lat, lng, device, mode } = req.body;
  const officialId = req.user.role === 'official' ? req.user.id : req.body.official_id;

  if (!officialId) return res.status(400).json({ message: 'official_id is required' });

  try {
    // An open punch must be closed before a new one is created.
    const existing = await pool.query('SELECT * FROM attendance ORDER BY id DESC');
    const openRow = existing.rows.find(
      (r) => Number(r.official_id) === Number(officialId) && r.check_in && !r.check_out
    );

    if (action === 'check_out') {
      if (!openRow) return res.status(400).json({ message: 'No open check-in found to close' });
      const updated = await pool.query(
        'UPDATE attendance SET check_out = $1, geo_coords = POINT($2, $3) WHERE id = $4 RETURNING *',
        [new Date(), lat ?? null, lng ?? null, openRow.id]
      );
      await audit.record({
        actor: req.user,
        action: 'attendance.checked_out',
        entity: 'attendance',
        entityId: openRow.id,
        meta: { project_id: openRow.project_id },
      });
      const lookups = await loadLookups();
      return res.json(enrich([updated.rows[0]], lookups.usersById, lookups.projectsById)[0]);
    }

    if (openRow) {
      return res.status(400).json({ message: 'You already have an open check-in. Check out first.' });
    }

    // Geo-fence: refuse a check-in far from the project being claimed.
    if (project_id) {
      const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [project_id]);
      const project = projectResult.rows[0];
      const verdict = geo.verify(project ? project.geo_coords : null, { lat, lng }, {
        radiusMeters: PUNCH_TOLERANCE_M,
      });
      if (verdict.verdict === 'suspicious') {
        await audit.record({
          actor: req.user,
          action: 'attendance.geo_rejected',
          entity: 'project',
          entityId: project_id,
          meta: verdict.explanation,
        });
        return res.status(400).json({
          message: `Check-in rejected: ${verdict.explanation}`,
          geo_verification: verdict,
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO attendance (official_id, project_id, check_in, check_out, geo_coords, device, mode, date)
       VALUES ($1, $2, $3, NULL, POINT($4, $5), $6, $7, $8) RETURNING *`,
      [
        officialId, project_id || null, new Date(), lat ?? null, lng ?? null,
        device || null, mode || 'gps', new Date().toISOString().slice(0, 10),
      ]
    );
    await audit.record({
      actor: req.user,
      action: 'attendance.checked_in',
      entity: 'attendance',
      entityId: result.rows[0].id,
      meta: { project_id: project_id || null, mode: mode || 'gps' },
    });

    const lookups = await loadLookups();
    res.status(201).json(enrich([result.rows[0]], lookups.usersById, lookups.projectsById)[0]);
  } catch (err) {
    console.error('Attendance punch error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.checkIn = punch('check_in');
exports.checkOut = punch('check_out');
exports.summary = async (req, res) => {
  try {
    const [rowsResult, lookups] = await Promise.all([
      pool.query('SELECT * FROM attendance ORDER BY id DESC'),
      loadLookups(),
    ]);

    const officials = Object.values(lookups.usersById).filter((u) => u.role === 'official');
    const today = new Date().toISOString().slice(0, 10);

    const aggregates = officials.map((official) => {
      const own = rowsResult.rows.filter((r) => Number(r.official_id) === Number(official.id));
      const byDate = new Map();
      own.forEach((row) => {
        const current = byDate.get(row.date) || { check_in: null, check_out: null, coords: null, project_id: null };
        if (row.check_in && !current.check_in) current.check_in = row.check_in;
        if (row.check_out) current.check_out = row.check_out;
        if (row.geo_coords) current.coords = row.geo_coords;
        if (row.project_id) current.project_id = row.project_id;
        byDate.set(row.date, current);
      });

      const days = [...byDate.entries()];
      const presentDays = days.filter(([, v]) => v.check_in).length;
      const lateDays = days.filter(([, v]) => {
        if (!v.check_in) return false;
        const time = new Date(v.check_in);
        return time.getHours() * 60 + time.getMinutes() > 9 * 60 + 30;
      }).length;
      const missingPunches = days.filter(([, v]) => Boolean(v.check_in) !== Boolean(v.check_out)).length;

      let geoMismatches = 0;
      days.forEach(([, v]) => {
        if (!v.coords || !v.project_id) return;
        const project = lookups.projectsById[v.project_id];
        if (!project) return;
        const verdict = geo.verify(project.geo_coords, v.coords, { radiusMeters: 500 });
        if (verdict.verdict === 'suspicious') geoMismatches += 1;
      });

      return {
        official_id: official.id,
        name: official.name,
        department: official.department,
        days_present: presentDays,
        absent_days: Math.max(0, 14 - presentDays),
        late_days: lateDays,
        missing_punches: missingPunches,
        geo_mismatches: geoMismatches,
        punctuality_pct: presentDays ? Math.round(((presentDays - lateDays) / presentDays) * 100) : 0,
        checked_in_today: Boolean(byDate.get(today) && byDate.get(today).check_in),
      };
    });

    res.json({
      officials: aggregates,
      totals: {
        officials: aggregates.length,
        present_today: aggregates.filter((a) => a.checked_in_today).length,
        late_days: aggregates.reduce((sum, a) => sum + a.late_days, 0),
        geo_mismatches: aggregates.reduce((sum, a) => sum + a.geo_mismatches, 0),
      },
    });
  } catch (err) {
    console.error('Attendance summary error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Attendance irregularities computed by the AI engine. */
exports.anomalies = async (req, res) => {
  try {
    const rowsResult = await pool.query('SELECT * FROM attendance ORDER BY id DESC');
    const lookups = await loadLookups();

    const records = rowsResult.rows.map((row) => {
      const coords = geo.normaliseCoords(row.geo_coords);
      const project = lookups.projectsById[row.project_id];
      const projectCoords = project ? geo.normaliseCoords(project.geo_coords) : null;
      return {
        official_id: row.official_id,
        date: row.date,
        check_in: row.check_in,
        check_out: row.check_out,
        project_id: row.project_id,
        project_lat: projectCoords ? projectCoords.lat : null,
        project_lng: projectCoords ? projectCoords.lng : null,
        lat: coords ? coords.lat : null,
        lng: coords ? coords.lng : null,
      };
    });

    const irregularities = await aiService.analyzeAttendance(records);
    res.json({ irregularities, records_analyzed: records.length });
  } catch (err) {
    console.error('Attendance anomalies error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

