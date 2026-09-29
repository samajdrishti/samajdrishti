const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'samajdrishti_secret', { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  const { name, email, password, role, department, phone } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, department, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, department, phone',
      [name, email, hashedPassword, role || 'official', department, phone]
    );

    const token = generateToken(result.rows[0].id);
    res.status(201).json({ user: result.rows[0], token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(400).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, result.rows[0].password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(result.rows[0].id);
    const { password: _, ...user } = result.rows[0];
    res.json({ user, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProfile = async (req, res) => {
  res.json({ user: req.user });
};
