/**
 * Hot paths used by the support console and reporting endpoints.
 */

exports.up = async (knex) => {
  await knex.schema.alterTable('alerts', (table) => {
    table.index(['site_id', 'status'], 'alerts_site_status_idx');
  });
  await knex.schema.alterTable('jobs', (table) => {
    table.index(['name', 'scheduled_for'], 'jobs_name_scheduled_idx');
  });
  await knex.schema.alterTable('worker_logs', (table) => {
    table.index(['logged_at'], 'worker_logs_logged_at_idx');
  });
  await knex.schema.alterTable('api_logs', (table) => {
    table.index(['requested_at'], 'api_logs_requested_at_idx');
  });
  await knex.schema.alterTable('ppa_agreements', (table) => {
    table.index(['site_id', 'start_date', 'end_date'], 'ppa_agreements_site_window_idx');
  });
  await knex.schema.alterTable('prices', (table) => {
    table.index(['site_id', 'valid_from'], 'prices_site_valid_from_idx');
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('prices', (table) => {
    table.dropIndex([], 'prices_site_valid_from_idx');
  });
  await knex.schema.alterTable('ppa_agreements', (table) => {
    table.dropIndex([], 'ppa_agreements_site_window_idx');
  });
  await knex.schema.alterTable('api_logs', (table) => {
    table.dropIndex([], 'api_logs_requested_at_idx');
  });
  await knex.schema.alterTable('worker_logs', (table) => {
    table.dropIndex([], 'worker_logs_logged_at_idx');
  });
  await knex.schema.alterTable('jobs', (table) => {
    table.dropIndex([], 'jobs_name_scheduled_idx');
  });
  await knex.schema.alterTable('alerts', (table) => {
    table.dropIndex([], 'alerts_site_status_idx');
  });
};
