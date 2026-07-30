/**
 * Adds savings_gbp to the site daily KPI rollup so the dashboard can show
 * savings without a second query. The view definition otherwise matches the
 * original rollup.
 */

exports.up = async (knex) => {
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_site_daily_kpis');

  await knex.raw(`
    CREATE MATERIALIZED VIEW mv_site_daily_kpis AS
    WITH daily_production AS (
      SELECT a.site_id, p.reading_date AS day, SUM(p.production_kwh) AS production_kwh
      FROM productions p
      JOIN assets a ON a.id = p.asset_id
      GROUP BY a.site_id, p.reading_date
    ),
    daily_consumption AS (
      SELECT a.site_id, c.reading_date AS day, SUM(c.consumption_kwh) AS consumption_kwh
      FROM consumptions c
      JOIN assets a ON a.id = c.asset_id
      GROUP BY a.site_id, c.reading_date
    )
    SELECT
      dp.site_id,
      dp.day,
      dp.production_kwh,
      COALESCE(dc.consumption_kwh, 0) AS consumption_kwh,
      LEAST(dp.production_kwh, COALESCE(dc.consumption_kwh, 0)) AS self_consumed_kwh,
      ROUND(dp.production_kwh * COALESCE(pa.rate_per_kwh, 0), 2) AS revenue_gbp,
      ROUND(
        LEAST(dp.production_kwh, COALESCE(dc.consumption_kwh, 0)) *
        (COALESCE(pr.price_per_kwh, 0) - COALESCE(pa.rate_per_kwh, 0)),
        2
      ) AS savings_gbp
    FROM daily_production dp
    LEFT JOIN daily_consumption dc ON dc.site_id = dp.site_id AND dc.day = dp.day
    LEFT JOIN ppa_agreements pa
      ON pa.site_id = dp.site_id
      AND pa.status = 'active'
      AND dp.day BETWEEN pa.start_date AND pa.end_date
    LEFT JOIN prices pr
      ON pr.site_id = dp.site_id
      AND pr.tariff_type = 'grid_import'
      AND dp.day >= pr.valid_from
      AND (pr.valid_to IS NULL OR dp.day <= pr.valid_to)
    WITH DATA
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS mv_site_daily_kpis');
};
