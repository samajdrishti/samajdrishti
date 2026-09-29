const { pool } = require('../config/db');

/**
 * Append-only audit trail. Every state change that matters for accountability
 * (assignments, status changes, geo failures, evidence verification, VC joins)
 * lands here. Recording must never break the request that triggered it, so all
 * errors are swallowed and logged.
 */
const record = async ({ actor, action, entity, entityId, meta }) => {
  try {
    const result = await pool.query(
      'INSERT INTO audit (actor_id, actor_name, action, entity, entity_id, meta) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        actor && actor.id != null ? actor.id : null,
        (actor && actor.name) || 'system',
        action,
        entity,
        entityId != null ? entityId : null,
        meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : null,
      ]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[audit] could not record event:', action, '-', err.message);
    return null;
  }
};

const list = async ({ entity, entityId, limit = 100 } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  if (entity && entityId != null) {
    const result = await pool.query(
      'SELECT * FROM audit WHERE entity = $1 AND entity_id = $2 ORDER BY id DESC',
      [entity, entityId]
    );
    return result.rows.slice(0, safeLimit);
  }

  const result = await pool.query('SELECT * FROM audit ORDER BY id DESC');
  const rows = result.rows;
  const filtered = entity ? rows.filter((r) => r.entity === entity) : rows;
  return filtered.slice(0, safeLimit);
};

module.exports = { record, list };
