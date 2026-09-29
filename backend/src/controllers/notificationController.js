const { pool } = require('../config/db');

exports.getNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createNotification = async (userId, message, type = 'info') => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3)',
      [userId, message, type]
    );

    // Required lazily: index.js requires the route -> controller chain at boot,
    // so a top-level import here would capture an undefined `io`.
    const { io } = require('../index');
    if (io) io.to(`user_${userId}`).emit('notification', { message, type });
  } catch (err) {
    console.error('Notification error:', err);
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
