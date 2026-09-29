const audit = require('../services/auditService');

const parseMeta = (row) => {
  if (row.meta == null) return null;
  if (typeof row.meta !== 'string') return row.meta;
  try {
    return JSON.parse(row.meta);
  } catch (err) {
    return row.meta;
  }
};

exports.list = async (req, res) => {
  try {
    const rows = await audit.list({
      entity: req.query.entity,
      entityId: req.query.entity_id,
      limit: req.query.limit,
    });
    res.json(rows.map((row) => ({ ...row, meta: parseMeta(row) })));
  } catch (err) {
    console.error('Audit list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.byEntity = async (req, res) => {
  try {
    const rows = await audit.list({ entity: req.params.entity, entityId: req.params.id, limit: req.query.limit });
    res.json(rows.map((row) => ({ ...row, meta: parseMeta(row) })));
  } catch (err) {
    console.error('Audit byEntity error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
