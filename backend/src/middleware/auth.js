const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'samajdrishti_secret');
    const result = await pool.query('SELECT id, name, email, role, department FROM users WHERE id = $1', [decoded.id]);

    if (!result.rows.length) return res.status(401).json({ message: 'Token invalid - user not found' });

    req.user = result.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * For endpoints loaded by a plain <img src="..."> (CCTV snapshots) the browser
 * cannot send an Authorization header, so a `?token=` query parameter is also
 * accepted. Invalid or missing tokens fall through as anonymous rather than
 * failing the request.
 */
const softAuth = async (req, res, next) => {
  const header = req.header('Authorization')?.replace('Bearer ', '');
  const token = header || req.query.token;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'samajdrishti_secret');
    const result = await pool.query('SELECT id, name, email, role, department FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length) req.user = result.rows[0];
  } catch (err) {
    // anonymous access is still allowed for this endpoint
  }
  return next();
};

const roleCheck = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { auth, softAuth, roleCheck };
