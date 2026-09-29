const { pool } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const audit = require('../services/auditService');

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

/* ---------------------------------------------------------- integrity chain
 * Every uploaded artefact is hashed (SHA-256) and linked to the hash of the
 * previous evidence item of the same inspection. Re-hashing the stored file
 * later proves the bytes on disk are still the ones the officer submitted, and
 * the links prove nothing was inserted into or dropped from the chain.
 */
const hashFile = (filePath) =>
  new Promise((resolve) => {
    if (!filePath) return resolve(null);
    // NOTE: on Windows `path.isAbsolute('/uploads/x.png')` is true (a leading
    // slash is "rooted" on the current drive), so detect real absolute paths by
    // drive letter / UNC instead, and resolve API-relative paths from the repo.
    const isRealAbsolute = /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');
    const absolute = isRealAbsolute
      ? filePath
      : path.join(__dirname, '../..', filePath.replace(/^[\\/]+/, ''));
    return fs.readFile(absolute, (err, buffer) => {
      // A missing file is a verdict, not a crash.
      if (err) return resolve(null);
      return resolve(crypto.createHash('sha256').update(buffer).digest('hex'));
    });
  });

/** Verdict for one evidence row plus the health of its inspection chain. */
const checkIntegrity = async (row) => {
  if (!row.sha256_hash) {
    return {
      status: 'unverified',
      file_match: false,
      chain_ok: true,
      explanation: 'No integrity hash was recorded for this item (it predates the chain).',
    };
  }

  const actual = await hashFile(row.file_path);
  if (actual === null) {
    return {
      status: 'missing_file',
      file_match: false,
      chain_ok: true,
      expected_hash: row.sha256_hash,
      actual_hash: null,
      explanation: 'The stored file could not be read - it was moved or deleted after upload.',
    };
  }

  const fileMatch = actual === row.sha256_hash;

  const chain = await pool.query(
    'SELECT * FROM evidence WHERE inspection_id = $1 ORDER BY id ASC',
    [row.inspection_id]
  );
  const links = chain.rows.map((r, index) => {
    const expectedPrevious = index === 0 ? null : chain.rows[index - 1].sha256_hash || null;
    return { id: r.id, linked: (r.previous_hash || null) === (expectedPrevious || null) };
  });
  const chainOk = links.length > 0 && links.every((l) => l.linked);

  return {
    status: fileMatch && chainOk ? 'verified' : 'tampered',
    file_match: fileMatch,
    chain_ok: chainOk,
    expected_hash: row.sha256_hash,
    actual_hash: actual,
    chain_length: chain.rows.length,
    explanation: !fileMatch
      ? 'The stored file no longer matches the hash taken at upload - the artefact was altered after submission.'
      : chainOk
        ? 'File hash matches the hash taken at upload and every chain link is intact.'
        : 'The file is unchanged but a chain link is broken - evidence may have been added or removed.',
  };
};

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

      // Integrity chain: hash the artefact and link it to the previous item of
      // this inspection so later tampering is detectable.
      const sha256Hash = await hashFile(filePath);
      const previous = await pool.query(
        'SELECT * FROM evidence WHERE inspection_id = $1 ORDER BY id ASC',
        [inspection_id]
      );
      const previousHash = previous.rows.length
        ? previous.rows[previous.rows.length - 1].sha256_hash || null
        : null;

      const result = await pool.query(
        `INSERT INTO evidence
           (inspection_id, type, file_path, geo_coords, timestamp,
            sha256_hash, previous_hash, file_size, mime_type)
         VALUES ($1, $2, $3, POINT($4, $5), $6, $7, $8, $9, $10) RETURNING *`,
        [
          inspection_id,
          type || 'photo',
          filePath,
          lat,
          lng,
          timestamp || new Date(),
          sha256Hash,
          previousHash,
          req.file ? req.file.size : null,
          req.file ? req.file.mimetype : null,
        ]
      );

      await audit.record({
        actor: req.user,
        action: 'evidence.uploaded',
        entity: 'evidence',
        entityId: result.rows[0].id,
        meta: { file: filePath, sha256: sha256Hash, previous_hash: previousHash },
      });

      res.status(201).json({
        ...result.rows[0],
        integrity: {
          status: sha256Hash ? 'hashed' : 'unverified',
          sha256: sha256Hash,
          previous_hash: previousHash,
          chain_length: previous.rows.length + 1,
        },
      });
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

/** Read-only integrity verdict (no state change) - drives the dashboard chip. */
exports.getIntegrity = async (req, res) => {
  try {
    const found = await pool.query('SELECT * FROM evidence WHERE id = $1', [req.params.id]);
    if (!found.rows.length) return res.status(404).json({ message: 'Evidence not found' });
    const integrity = await checkIntegrity(found.rows[0]);
    res.json({
      ...found.rows[0],
      integrity: { ...integrity, checked_at: new Date().toISOString() },
    });
  } catch (err) {
    console.error('Evidence integrity error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Back-office verification re-hashes the stored artefact instead of flipping a
 * flag: `verified` is only true when the file still matches the hash taken at
 * upload *and* the chain links are intact. A mismatch is persisted as
 * `tampered`, written to the audit trail and broadcast as an alert.
 */
exports.verifyEvidence = async (req, res) => {
  try {
    const found = await pool.query('SELECT * FROM evidence WHERE id = $1', [req.params.id]);
    if (!found.rows.length) return res.status(404).json({ message: 'Evidence not found' });

    const row = found.rows[0];
    const integrity = await checkIntegrity(row);
    const ok = integrity.status === 'verified';

    const result = await pool.query(
      `UPDATE evidence
          SET verified = $2, hash_verified = $3, integrity_status = $4, verified_at = $5
        WHERE id = $1 RETURNING *`,
      [req.params.id, ok, integrity.file_match, integrity.status, new Date()]
    );

    await audit.record({
      actor: req.user,
      action: ok ? 'evidence.verified' : 'evidence.integrity_failed',
      entity: 'evidence',
      entityId: row.id,
      meta: {
        status: integrity.status,
        expected_hash: integrity.expected_hash || null,
        actual_hash: integrity.actual_hash || null,
      },
    });

    if (!ok) {
      const { io } = require('../index');
      if (io) {
        io.emit('alert', {
          severity: 'high',
          message: `Evidence #${row.id} failed integrity check (${integrity.status.replace('_', ' ')})`,
          meta: { evidence_id: row.id, status: integrity.status },
        });
      }
    }

    res.json({
      ...result.rows[0],
      integrity: { ...integrity, checked_at: new Date().toISOString() },
    });
  } catch (err) {
    console.error('Verify evidence error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
