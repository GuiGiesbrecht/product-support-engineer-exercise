/**
 * At most one open alert per asset and type. Pre-existing duplicates are
 * resolved first, keeping the earliest of each group, because the index
 * cannot be created while they exist.
 */

exports.up = async (knex) => {
  await knex.raw(`
    WITH resolved AS (
      UPDATE alerts a
      SET status = 'resolved', resolved_at = NOW()
      WHERE a.status = 'open'
        AND EXISTS (
          SELECT 1 FROM alerts kept
          WHERE kept.asset_id = a.asset_id
            AND kept.type = a.type
            AND kept.status = 'open'
            AND (kept.triggered_at, kept.id) < (a.triggered_at, a.id)
        )
      RETURNING a.id
    )
    INSERT INTO audit_logs
      (actor_type, actor_id, action, entity_type, entity_id, before, after, note)
    SELECT 'system', 'alerts-dedup', 'alert.resolved', 'alert', id::text,
           '{"status":"open"}'::jsonb, '{"status":"resolved"}'::jsonb,
           'Duplicate of an earlier open alert for the same asset and type.'
    FROM resolved
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX alerts_open_asset_type_uq
    ON alerts (asset_id, type)
    WHERE status = 'open'
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS alerts_open_asset_type_uq');
};
