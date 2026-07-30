const fs = require('fs');
const path = require('path');

const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/history', file), 'utf8'));
const readNdjson = (file) =>
  fs
    .readFileSync(path.join(__dirname, '../fixtures/history', file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

/**
 * Loads the retained window of operational history: alerts, job runs,
 * worker/API logs and the audit trail.
 */
module.exports = async function loadOperationalHistory(knex) {
  const sites = await knex('sites').select('id', 'slug');
  const siteIdBySlug = Object.fromEntries(sites.map((s) => [s.slug, s.id]));
  const assets = await knex('assets').select('id', 'serial_number');
  const assetIdBySerial = Object.fromEntries(assets.map((a) => [a.serial_number, a.id]));
  const users = await knex('users').select('id', 'email');
  const userIdByEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));

  for (const alert of readJson('alerts.json')) {
    await knex('alerts').insert({
      site_id: siteIdBySlug[alert.site],
      asset_id: alert.asset_serial ? assetIdBySerial[alert.asset_serial] : null,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      triggered_at: alert.triggered_at,
      resolved_at: alert.resolved_at,
      created_by: alert.created_by,
      created_at: alert.triggered_at,
    });
  }

  const jobIdByKey = {};
  for (const jobRun of readNdjson('jobs.ndjson')) {
    const [row] = await knex('jobs')
      .insert({
        name: jobRun.name,
        status: jobRun.status,
        scheduled_for: jobRun.scheduled_for,
        started_at: jobRun.started_at,
        finished_at: jobRun.finished_at,
        hostname: jobRun.hostname,
        attempt: jobRun.attempt,
        error: jobRun.error,
        metadata: jobRun.metadata,
        created_at: jobRun.started_at,
      })
      .returning('id');
    jobIdByKey[jobRun.key] = row.id;
  }

  const workerLogs = readNdjson('worker_logs.ndjson').map((log) => ({
    job_id: log.job_key ? jobIdByKey[log.job_key] : null,
    worker_hostname: log.worker_hostname,
    level: log.level,
    message: log.message,
    context: log.context,
    logged_at: log.logged_at,
  }));
  if (workerLogs.length) await knex.batchInsert('worker_logs', workerLogs, 100);

  const apiLogs = readNdjson('api_logs.ndjson').map((log) => ({
    method: log.method,
    path: log.path,
    operation_name: log.operation_name,
    status_code: log.status_code,
    duration_ms: log.duration_ms,
    user_id: log.user_email ? userIdByEmail[log.user_email] : null,
    error: log.error,
    metadata: log.metadata,
    requested_at: log.requested_at,
  }));
  if (apiLogs.length) await knex.batchInsert('api_logs', apiLogs, 100);

  for (const entry of readNdjson('audit_logs.ndjson')) {
    await knex('audit_logs').insert({
      actor_type: entry.actor_type,
      actor_id: entry.actor_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      before: entry.before,
      after: entry.after,
      note: entry.note,
      created_at: entry.created_at,
    });
  }
};
