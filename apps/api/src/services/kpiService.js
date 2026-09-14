const db = require('../db/knex');
const cache = require('./cacheService');
const { monthToDateRange, eachDay } = require('@metris/shared');

const DASHBOARD_CACHE_TTL_MS = 60_000;

/**
 * The latest civil date for which any reading exists. All default reporting
 * windows anchor here so that the console shows the most recent complete data.
 */
async function getDataAnchor() {
  const { rows } = await db.raw('SELECT MAX(reading_date)::text AS anchor FROM productions');
  return rows[0].anchor;
}

/**
 * Portfolio dashboard KPIs. Reads the pre-aggregated mv_site_daily_kpis
 * rollup: the dashboard is the highest-traffic page and joining raw readings
 * across every site on each load does not scale.
 */
async function getDashboard(customerId) {
  const anchor = await getDataAnchor();
  const { from, to } = monthToDateRange(anchor);

  const { value, cache: cacheState } = await cache.remember(
    `dashboard:${customerId}:${from}:${to}`,
    DASHBOARD_CACHE_TTL_MS,
    async () => {
      const { rows: totals } = await db.raw(
        `SELECT
           COALESCE(SUM(mv.production_kwh), 0) AS production_kwh,
           COALESCE(SUM(mv.self_consumed_kwh), 0) AS self_consumed_kwh,
           COALESCE(SUM(mv.revenue_gbp), 0) AS revenue_gbp,
           COALESCE(SUM(mv.savings_gbp), 0) AS savings_gbp
         FROM mv_site_daily_kpis mv
         JOIN sites s ON s.id = mv.site_id
         WHERE s.customer_id = ? AND mv.day BETWEEN ? AND ?`,
        [customerId, from, to]
      );

      const { rows: daily } = await db.raw(
        `SELECT mv.day::text AS day,
                SUM(mv.production_kwh) AS production_kwh,
                SUM(mv.revenue_gbp) AS revenue_gbp,
                SUM(mv.savings_gbp) AS savings_gbp
         FROM mv_site_daily_kpis mv
         JOIN sites s ON s.id = mv.site_id
         WHERE s.customer_id = ? AND mv.day BETWEEN ? AND ?
         GROUP BY mv.day
         ORDER BY mv.day`,
        [customerId, from, to]
      );

      // The rate is read live rather than from the rollup, which does not carry
      // it. A scalar subquery keeps it out of the GROUP BY: joining
      // ppa_agreements would multiply rows, and nothing stops two active
      // agreements from overlapping, so a join could silently double the sums.
      const { rows: sites } = await db.raw(
        `SELECT s.id, s.slug, s.name, s.city, s.capacity_kwp,
                COALESCE(SUM(mv.production_kwh), 0) AS production_kwh,
                COALESCE(SUM(mv.revenue_gbp), 0) AS revenue_gbp,
                COALESCE(SUM(mv.savings_gbp), 0) AS savings_gbp,
                (SELECT pa.rate_per_kwh
                   FROM ppa_agreements pa
                  WHERE pa.site_id = s.id
                    AND pa.status = 'active'
                    AND ? BETWEEN pa.start_date AND pa.end_date
                  ORDER BY pa.start_date
                  LIMIT 1) AS ppa_rate_per_kwh
         FROM sites s
         LEFT JOIN mv_site_daily_kpis mv
           ON mv.site_id = s.id AND mv.day BETWEEN ? AND ?
         WHERE s.customer_id = ?
         GROUP BY s.id, s.slug, s.name, s.city, s.capacity_kwp
         ORDER BY s.name`,
        [to, from, to, customerId]
      );

      // Read inside the cached block so that the freshness reported always
      // describes the figures returned with it.
      const { rows: freshnessRows } = await db.raw(
        `SELECT MAX(mv.day)::text AS through_day
         FROM mv_site_daily_kpis mv
         JOIN sites s ON s.id = mv.site_id
         WHERE s.customer_id = ? AND mv.day BETWEEN ? AND ?`,
        [customerId, from, to]
      );

      return { totals: totals[0], daily, sites, throughDay: freshnessRows[0].through_day };
    }
  );

  const { rows: alertRows } = await db.raw(
    `SELECT COUNT(*)::int AS open_alerts
     FROM alerts al JOIN sites s ON s.id = al.site_id
     WHERE s.customer_id = ? AND al.status = 'open'`,
    [customerId]
  );

  return {
    periodStart: from,
    periodEnd: to,
    productionKwh: Number(value.totals.production_kwh),
    selfConsumedKwh: Number(value.totals.self_consumed_kwh),
    revenueGbp: Number(value.totals.revenue_gbp),
    savingsGbp: Number(value.totals.savings_gbp),
    openAlerts: alertRows[0].open_alerts,
    freshness: {
      throughDay: value.throughDay,
      daysBehind: value.throughDay ? eachDay(value.throughDay, to).length - 1 : null,
    },
    daily: value.daily.map((row) => ({
      day: row.day,
      productionKwh: Number(row.production_kwh),
      revenueGbp: Number(row.revenue_gbp),
      savingsGbp: Number(row.savings_gbp),
    })),
    sites: value.sites.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      capacityKwp: Number(row.capacity_kwp),
      productionKwh: Number(row.production_kwh),
      revenueGbp: Number(row.revenue_gbp),
      savingsGbp: Number(row.savings_gbp),
      ppaRatePerKwh: row.ppa_rate_per_kwh === null ? null : Number(row.ppa_rate_per_kwh),
    })),
    cacheState,
  };
}

module.exports = { getDashboard, getDataAnchor };
