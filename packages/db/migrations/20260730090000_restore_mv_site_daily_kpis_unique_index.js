/**
 * Restores the unique index on mv_site_daily_kpis.
 *
 * The 2026-07-27 release recreated the rollup to add savings_gbp with a
 * DROP + CREATE, which also dropped the unique index the original migration
 * had created alongside the view. REFRESH MATERIALIZED VIEW CONCURRENTLY
 * requires a unique index, so refresh-kpi-views has failed on every run since
 * that release and the dashboard has been serving a frozen snapshot while the
 * live query paths moved on. See TICKET-4821.
 *
 * The index only unblocks future refreshes; it does not update the rollup.
 * The refresh-kpi-views job recovers on its next run.
 */

exports.up = async (knex) => {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS mv_site_daily_kpis_site_day_uq
    ON mv_site_daily_kpis (site_id, day)
  `);
};

exports.down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS mv_site_daily_kpis_site_day_uq');
};
