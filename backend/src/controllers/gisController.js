const { pool } = require('../config/db');
const geo = require('../services/geoService');

/**
 * One-stop feed for the Real-Time Compliance GIS map.
 *
 * Each center (project) is returned with its registered coordinates, the
 * center head (warden / director / principal) and the ground-level CCTV
 * cameras mounted on the site, so a single click on the map opens the
 * facility drill-down without extra round-trips.
 *
 * The Google Maps browser key is served from the backend (never bundled into
 * the frontend source) and the client falls back to OpenStreetMap tiles when
 * the key is unavailable on the current machine.
 */
const decorateCamera = (camera) => ({
  id: camera.id,
  name: camera.name,
  location: camera.location,
  stream_type: camera.stream_type,
  status: camera.status,
  online: camera.status === 'online',
  tamper_flag: camera.tamper_flag || 'normal',
  occlusion_pct: camera.occlusion_pct ?? null,
  detected_headcount: camera.detected_headcount ?? null,
  aebas_punch_count: camera.aebas_punch_count ?? null,
  anomaly_note: camera.anomaly_note || null,
  last_seen: camera.last_seen || null,
  geo_coords: geo.normaliseCoords(camera.geo_coords),
  snapshot_url: `/api/monitoring/cameras/${camera.id}/snapshot`,
});

exports.getCenters = async (req, res) => {
  try {
    const [projectsResult, camerasResult] = await Promise.all([
      pool.query('SELECT * FROM projects'),
      pool.query('SELECT * FROM cameras'),
    ]);

    const camerasByProject = camerasResult.rows.reduce((acc, camera) => {
      const key = String(camera.project_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(decorateCamera(camera));
      return acc;
    }, {});

    const centers = projectsResult.rows.map((project) => {
      const meta = project.metadata || {};
      const cameras = camerasByProject[String(project.id)] || [];
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        location: project.location,
        scheme: project.department || meta.scheme || null,
        status: project.status,
        budget: project.budget,
        sanction_code: meta.sanction_code || null,
        sanctioned_capacity: meta.sanctioned_capacity ?? null,
        verified_headcount: meta.verified_headcount ?? null,
        aebas_punch_count: meta.aebas_punch_count ?? null,
        discrepancy_delta: meta.discrepancy_delta ?? null,
        head: meta.head || null,
        geo_coords: geo.normaliseCoords(project.geo_coords),
        cameras,
        camera_count: cameras.length,
        cameras_online: cameras.filter((c) => c.online).length,
      };
    });

    res.json({
      map: {
        provider: 'google',
        api_key: process.env.GOOGLE_MAP_API || null,
        fallback_provider: 'openstreetmap',
      },
      centers,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GIS centers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
