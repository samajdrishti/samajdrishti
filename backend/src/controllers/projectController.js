const { pool } = require('../config/db');
const geo = require('../services/geoService');

exports.getProjects = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Project detail with everything a supervisor needs in one call: the project,
 * its inspections, geo-tagged evidence, installed cameras and attendance.
 */
exports.getProject = async (req, res) => {
  try {
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!projectResult.rows.length) return res.status(404).json({ message: 'Project not found' });

    const [inspections, evidence, cameras, attendance] = await Promise.all([
      pool.query('SELECT * FROM inspections'),
      pool.query('SELECT * FROM evidence'),
      pool.query('SELECT * FROM cameras'),
      pool.query('SELECT * FROM attendance'),
    ]);

    const projectId = Number(req.params.id);
    const projectInspections = inspections.rows.filter((i) => Number(i.project_id) === projectId);
    const inspectionIds = new Set(projectInspections.map((i) => Number(i.id)));

    res.json({
      project: geo.normaliseCoords(projectResult.rows[0].geo_coords)
        ? { ...projectResult.rows[0], geo_coords: geo.normaliseCoords(projectResult.rows[0].geo_coords) }
        : projectResult.rows[0],
      inspections: projectInspections,
      evidence: evidence.rows.filter((e) => inspectionIds.has(Number(e.inspection_id))),
      cameras: cameras.rows.filter((c) => Number(c.project_id) === projectId),
      attendance: attendance.rows.filter((a) => Number(a.project_id) === projectId),
    });
  } catch (err) {
    console.error('Get project error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createProject = async (req, res) => {
  const { name, description, location, department, geo_coords, start_date, end_date, budget } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO projects (name, description, location, department, geo_coords, start_date, end_date, budget)
       VALUES ($1, $2, $3, $4, POINT($5, $6), $7, $8, $9) RETURNING *`,
      [
        name, description, location, department || null,
        geo_coords?.lat, geo_coords?.lng,
        start_date || null, end_date || null, budget || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create project error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProject = async (req, res) => {
  const { name, description, status, budget } = req.body;
  try {
    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2, status = $3, budget = $4 WHERE id = $5 RETURNING *',
      [name, description, status, budget, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
