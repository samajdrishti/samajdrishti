const { pool } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/evidence');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.mp4', '.mov', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

exports.uploadEvidence = [
  upload.single('file'),
  async (req, res) => {
    const { inspection_id, type, timestamp } = req.body;

    if (!inspection_id) {
      return res.status(400).json({ message: 'inspection_id is required' });
    }

    // Geo coordinates arrive either as a JSON object (application/json clients)
    // or as individual multipart fields (React Native FormData clients).
    let coords = req.body.geo_coords;
    if (typeof coords === 'string') {
      try {
        coords = JSON.parse(coords);
      } catch (err) {
        coords = null;
      }
    }
    const toNumber = (value) => (value === undefined || value === null || value === '' ? null : Number(value));
    const lat = coords?.lat !== undefined ? Number(coords.lat) : toNumber(req.body.lat);
    const lng = coords?.lng !== undefined ? Number(coords.lng) : toNumber(req.body.lng);

    try {
      const filePath = req.file ? `/uploads/evidence/${req.file.filename}` : (req.body.file_path || null);

      const result = await pool.query(
        'INSERT INTO evidence (inspection_id, type, file_path, geo_coords, timestamp) VALUES ($1, $2, $3, POINT($4, $5), $6) RETURNING *',
        [inspection_id, type || 'photo', filePath, lat, lng, timestamp || new Date()]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Evidence upload error:', err.message);
      res.status(500).json({ message: 'Server error' });
    }
  }
];

exports.getEvidence = async (req, res) => {
  try {
    const inspectionId = req.query.inspection_id;
    let query = 'SELECT * FROM evidence';
    let params = [];

    if (inspectionId) {
      query += ' WHERE inspection_id = $1';
      params = [inspectionId];
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyEvidence = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE evidence SET verified = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Evidence not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
