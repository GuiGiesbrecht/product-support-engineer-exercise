const db = require('../../db/knex');

/**
 * Rebuilds the site daily KPI rollup. Runs CONCURRENTLY so the dashboard
 * stays readable while the rollup rebuilds.
 */
module.exports = async function refreshKpiViews({ log }) {
  log('info', 'Refreshing materialized view mv_site_daily_kpis', { concurrently: true });

  const connection = await db.client.acquireConnection();
  try {
    await connection.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_site_daily_kpis');
  } finally {
    await db.client.releaseConnection(connection);
  }

  log('info', 'Materialized view mv_site_daily_kpis refreshed', {});
  return { view: 'mv_site_daily_kpis' };
};
