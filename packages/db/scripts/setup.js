/**
 * Provisions a local environment that matches the state of production as of
 * 2026-07-29 evening:
 *
 *   1. runs migrations
 *   2. replays July's connector transmissions up to the 2026-07-27 release
 *   3. restores the KPI rollup to the snapshot materialized with that release
 *   4. applies the SolarEdge corrective re-sync issued on 2026-07-27
 *   5. replays the remaining transmissions
 *   6. loads recent operational history (alerts, jobs, logs, audit trail)
 *
 * The script is idempotent: an already-provisioned database is left untouched.
 */

const knex = require('knex')(require('../knexfile'));

const loadPortfolio = require('../seeds/loadPortfolio');
const replayIngestion = require('../seeds/replayIngestion');
const restoreRollupSnapshot = require('../seeds/restoreRollupSnapshot');
const applyConnectorResync = require('../seeds/applyConnectorResync');
const loadOperationalHistory = require('../seeds/loadOperationalHistory');

async function waitForDatabase(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await knex.raw('SELECT 1');
      return;
    } catch (err) {
      if (i === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  await waitForDatabase();
  await knex.migrate.latest();

  const { rows } = await knex.raw('SELECT COUNT(*)::int AS count FROM sites');
  if (rows[0].count > 0) {
    console.log('Database already provisioned; nothing to do.');
    return;
  }

  console.log('Loading portfolio (customers, sites, assets, tariffs, agreements)...');
  await loadPortfolio(knex);

  console.log('Replaying connector transmissions through 2026-07-26...');
  await replayIngestion(knex, { until: '2026-07-26' });

  console.log('Restoring KPI rollup snapshot (2026-07-27 release)...');
  await restoreRollupSnapshot(knex);

  console.log('Applying SolarEdge corrective re-sync (2026-07-27)...');
  await applyConnectorResync(knex);

  console.log('Replaying connector transmissions from 2026-07-27...');
  await replayIngestion(knex, { from: '2026-07-27' });

  console.log('Loading operational history...');
  await loadOperationalHistory(knex);

  console.log('Database provisioned.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
