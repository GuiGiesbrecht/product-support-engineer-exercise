const db = require('../db/knex');
const { log, hostname } = require('./lib/logger');
const { runJob } = require('./lib/jobRunner');
const refreshKpiViews = require('./jobs/refreshKpiViews');
const alertScan = require('./jobs/alertScan');
const connectorPoll = require('./jobs/connectorPoll');

const HOUR = 60 * 60 * 1000;
const FAILURE_RETRY_MS = 1 * HOUR;

const JOBS = [
  {
    name: 'refresh-kpi-views',
    intervalMs: 24 * HOUR,
    run: refreshKpiViews,
    failureMessage: 'REFRESH MATERIALIZED VIEW CONCURRENTLY failed for mv_site_daily_kpis',
  },
  {
    name: 'alert-scan',
    intervalMs: 6 * HOUR,
    run: alertScan,
    enabled: () => process.env.ALERTING_ENABLED === 'true',
    disabledReason: 'alerting is disabled in this environment (ALERTING_ENABLED)',
  },
  {
    name: 'connector-status-poll',
    intervalMs: 6 * HOUR,
    run: connectorPoll,
    enabled: () => Boolean(process.env.CONNECTOR_API_TOKEN),
    disabledReason: 'vendor credentials not configured (CONNECTOR_API_TOKEN)',
  },
];

/**
 * Minimal in-process scheduler. On boot each job catches up if its last
 * completed run is older than its interval — a worker that was down does not
 * wait a full cycle to recover. Failed runs retry hourly.
 *
 * Timing lives in this process and nothing coordinates instances, so a second
 * worker repeats every run instead of sharing it. Run exactly one.
 */
async function scheduleLoop(definition) {
  const lastCompleted = await db('jobs')
    .where({ name: definition.name, status: 'completed' })
    .orderBy('scheduled_for', 'desc')
    .first('scheduled_for');

  let nextDueAt = lastCompleted
    ? new Date(lastCompleted.scheduled_for).getTime() + definition.intervalMs
    : Date.now();

  const tick = async () => {
    const dueAt = nextDueAt;
    if (definition.enabled && !definition.enabled()) {
      log(null, 'info', `${definition.name} skipped — ${definition.disabledReason}`, {});
      nextDueAt = Date.now() + definition.intervalMs;
    } else {
      const { ok } = await runJob(definition, new Date(Math.min(dueAt, Date.now())).toISOString());
      nextDueAt = ok ? Date.now() + definition.intervalMs : Date.now() + FAILURE_RETRY_MS;
    }
    setTimeout(tick, Math.max(nextDueAt - Date.now(), 1000));
  };

  setTimeout(tick, Math.max(nextDueAt - Date.now(), 2000));
}

async function main() {
  console.log(`worker ${hostname} starting`);
  for (const definition of JOBS) {
    await scheduleLoop(definition);
  }
}

process.on('SIGTERM', () => {
  db.destroy().finally(() => process.exit(0));
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
