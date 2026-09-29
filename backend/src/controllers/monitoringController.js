const { pool } = require('../config/db');
const cctv = require('../services/cctvService');
const audit = require('../services/auditService');
const geo = require('../services/geoService');

const decorate = (camera, projectsById) => {
  const project = projectsById[camera.project_id] || null;
  return {
    ...camera,
    project_name: project ? project.name : null,
    project_location: project ? project.location : null,
    online: camera.status === 'online',
    geo_coords: geo.normaliseCoords(camera.geo_coords),
    snapshot_url: `/api/monitoring/cameras/${camera.id}/snapshot`,
  };
};

const loadProjects = async () => {
  const result = await pool.query('SELECT id, name, location, geo_coords FROM projects');
  return result.rows.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});
};

exports.getCameras = async (req, res) => {
  try {
    const [camerasResult, projectsById] = await Promise.all([
      pool.query('SELECT * FROM cameras ORDER BY id ASC'),
      loadProjects(),
    ]);

    let cameras = camerasResult.rows.map((c) => decorate(c, projectsById));
    if (req.query.project_id) {
      cameras = cameras.filter((c) => String(c.project_id) === String(req.query.project_id));
    }
    if (req.query.status) {
      cameras = cameras.filter((c) => c.status === req.query.status);
    }
    res.json(cameras);
  } catch (err) {
    console.error('List cameras error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createCamera = async (req, res) => {
  const { name, project_id, location, stream_type, stream_url, lat, lng } = req.body;

  if (!name) return res.status(400).json({ message: 'Camera name is required' });
  const type = ['simulated', 'mjpeg', 'hls'].includes(stream_type) ? stream_type : 'simulated';
  if (type !== 'simulated' && !stream_url) {
    return res.status(400).json({ message: `stream_url is required for ${type} cameras` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO cameras (name, project_id, location, stream_type, stream_url, geo_coords)
       VALUES ($1, $2, $3, $4, $5, POINT($6, $7)) RETURNING *`,
      [name, project_id || null, location || null, type, stream_url || null, lat ?? null, lng ?? null]
    );
    await audit.record({
      actor: req.user,
      action: 'camera.created',
      entity: 'camera',
      entityId: result.rows[0].id,
      meta: { name, stream_type: type },
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create camera error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.updateCamera = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE cameras SET status = $1, last_seen = $2 WHERE id = $3 RETURNING *',
      [req.body.status === 'offline' ? 'offline' : 'online', new Date(), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Camera not found' });

    await audit.record({
      actor: req.user,
      action: 'camera.status_changed',
      entity: 'camera',
      entityId: result.rows[0].id,
      meta: { status: result.rows[0].status },
    });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update camera error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Live frame. Simulated cameras are rendered here as a moving PNG; real cameras
 * are proxied so the browser never talks to a third-party origin directly.
 */
exports.getSnapshot = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cameras WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Camera not found' });

    const camera = result.rows[0];
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    if (camera.stream_type === 'simulated' || !camera.stream_url) {
      res.set('Content-Type', 'image/png');
      res.set('X-Stream-Source', 'simulated');
      return res.send(cctv.renderFrame(camera, Date.now()));
    }

    const proxied = await cctv.proxySnapshot(camera.stream_url);
    if (!proxied) {
      res.set('Content-Type', 'image/png');
      res.set('X-Stream-Source', 'fallback-simulated');
      return res.send(cctv.renderFrame(camera, Date.now()));
    }

    res.set('Content-Type', proxied.contentType);
    res.set('X-Stream-Source', 'proxied');
    return res.send(proxied.buffer);
  } catch (err) {
    console.error('Snapshot error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOverview = async (req, res) => {
  try {
    const [camerasResult, inspectionsResult, projectsById, auditRows] = await Promise.all([
      pool.query('SELECT * FROM cameras ORDER BY id ASC'),
      pool.query('SELECT id, project_id, status, ai_risk_score FROM inspections'),
      loadProjects(),
      audit.list({ limit: 40 }),
    ]);

    const cameras = camerasResult.rows.map((c) => decorate(c, projectsById));
    const offline = cameras.filter((c) => !c.online);
    const flagged = inspectionsResult.rows.filter((i) => i.status === 'flagged');
    const geoFailures = auditRows.filter(
      (a) => a.action === 'geo_verification.failed' || a.action === 'geo_verification.suspicious'
    );

    const alerts = [
      ...offline.map((c) => ({
        severity: 'medium',
        type: 'camera_offline',
        message: `${c.name} (${c.project_name || 'unassigned project'}) stopped reporting`,
        meta: { camera_id: c.id, last_seen: c.last_seen },
      })),
      ...flagged.map((i) => ({
        severity: 'high',
        type: 'inspection_flagged',
        message: `Inspection #${i.id} is flagged for review (risk ${i.ai_risk_score ?? 'n/a'})`,
        meta: { inspection_id: i.id, project_id: i.project_id },
      })),
      ...geoFailures.map((a) => ({
        severity: a.action === 'geo_verification.suspicious' ? 'high' : 'medium',
        type: a.action.replace('.', '_'),
        message: a.meta || `Geo verification issue on ${a.entity} #${a.entity_id}`,
        meta: { audit_id: a.id, entity_id: a.entity_id },
      })),
    ];

    res.json({
      cameras,
      total_cameras: cameras.length,
      online: cameras.length - offline.length,
      offline: offline.length,
      active_inspections: inspectionsResult.rows.filter((i) => i.status === 'in_progress').length,
      pending_inspections: inspectionsResult.rows.filter((i) => i.status === 'pending').length,
      alerts: alerts.slice(0, 25),
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Monitoring overview error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

