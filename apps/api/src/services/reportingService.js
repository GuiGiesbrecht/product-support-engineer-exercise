const db = require('../db/knex');

/**
 * Per-site daily KPIs computed directly from readings. The site, revenue and
 * export views use this path so that figures reflect the readings tables at
 * query time.
 */
async function siteDailyKpis(siteIds, from, to) {
  const { rows } = await db.raw(
    `WITH days AS (
       SELECT generate_series(?::date, ?::date, interval '1 day')::date AS day
     ),
     daily_production AS (
       SELECT a.site_id, p.reading_date AS day, SUM(p.production_kwh) AS production_kwh
       FROM productions p
       JOIN assets a ON a.id = p.asset_id
       WHERE a.site_id = ANY(?) AND p.reading_date BETWEEN ? AND ?
       GROUP BY a.site_id, p.reading_date
     ),
     daily_consumption AS (
       SELECT a.site_id, c.reading_date AS day, SUM(c.consumption_kwh) AS consumption_kwh
       FROM consumptions c
       JOIN assets a ON a.id = c.asset_id
       WHERE a.site_id = ANY(?) AND c.reading_date BETWEEN ? AND ?
       GROUP BY a.site_id, c.reading_date
     )
     SELECT
       s.id AS site_id,
       s.slug,
       s.name AS site_name,
       d.day::text AS day,
       COALESCE(dp.production_kwh, 0) AS production_kwh,
       COALESCE(dc.consumption_kwh, 0) AS consumption_kwh,
       LEAST(COALESCE(dp.production_kwh, 0), COALESCE(dc.consumption_kwh, 0)) AS self_consumed_kwh,
       ROUND(COALESCE(dp.production_kwh, 0) * COALESCE(pa.rate_per_kwh, 0), 2) AS revenue_gbp,
       ROUND(
         LEAST(COALESCE(dp.production_kwh, 0), COALESCE(dc.consumption_kwh, 0)) *
         (COALESCE(pr.price_per_kwh, 0) - COALESCE(pa.rate_per_kwh, 0)),
         2
       ) AS savings_gbp
     FROM sites s
     CROSS JOIN days d
     LEFT JOIN daily_production dp ON dp.site_id = s.id AND dp.day = d.day
     LEFT JOIN daily_consumption dc ON dc.site_id = s.id AND dc.day = d.day
     LEFT JOIN ppa_agreements pa
       ON pa.site_id = s.id AND pa.status = 'active' AND d.day BETWEEN pa.start_date AND pa.end_date
     LEFT JOIN prices pr
       ON pr.site_id = s.id AND pr.tariff_type = 'grid_import'
       AND d.day >= pr.valid_from AND (pr.valid_to IS NULL OR d.day <= pr.valid_to)
     WHERE s.id = ANY(?)
     ORDER BY s.name, d.day`,
    [from, to, siteIds, from, to, siteIds, from, to, siteIds]
  );

  return rows.map((row) => ({
    siteId: row.site_id,
    slug: row.slug,
    siteName: row.site_name,
    day: row.day,
    productionKwh: Number(row.production_kwh),
    consumptionKwh: Number(row.consumption_kwh),
    selfConsumedKwh: Number(row.self_consumed_kwh),
    revenueGbp: Number(row.revenue_gbp),
    savingsGbp: Number(row.savings_gbp),
  }));
}

async function siteIdsForCustomer(customerId) {
  const rows = await db('sites').where({ customer_id: customerId }).select('id');
  return rows.map((row) => row.id);
}

module.exports = { siteDailyKpis, siteIdsForCustomer };
