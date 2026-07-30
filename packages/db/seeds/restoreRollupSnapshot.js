/**
 * Materializes mv_site_daily_kpis at this point of the replay, matching the
 * rollup snapshot captured in production with the 2026-07-27 release.
 */
module.exports = async function restoreRollupSnapshot(knex) {
  await knex.raw('REFRESH MATERIALIZED VIEW mv_site_daily_kpis');
};
