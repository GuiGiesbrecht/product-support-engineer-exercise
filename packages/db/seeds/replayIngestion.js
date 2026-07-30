const fs = require('fs');
const path = require('path');

const payloads = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../fixtures/readings/2026-07.json'), 'utf8')
);

/**
 * Replays archived gateway transmissions through the same write path the
 * ingest endpoint uses: one row per payload, keyed by the vendor payload id.
 */
module.exports = async function replayIngestion(
  knex,
  { from = '0000-01-01', until = '9999-12-31' } = {}
) {
  const connectors = await knex('connector_assets').select(
    'asset_id',
    'connector_vendor',
    'external_id'
  );
  const assetIdByExternal = {};
  for (const connector of connectors) {
    assetIdByExternal[`${connector.connector_vendor}:${connector.external_id}`] =
      connector.asset_id;
  }

  const productions = [];
  const consumptions = [];
  for (const payload of payloads) {
    if (payload.reading_date < from || payload.reading_date > until) continue;
    const assetId = assetIdByExternal[`${payload.vendor}:${payload.external_id}`];
    if (!assetId) {
      throw new Error(`No connector registered for ${payload.vendor}:${payload.external_id}`);
    }
    const row = {
      asset_id: assetId,
      reading_date: payload.reading_date,
      source: 'gateway_push',
      source_ref: payload.payload_id,
      ingested_at: new Date(new Date(payload.sent_at).getTime() + 1200).toISOString(),
    };
    if (payload.kind === 'production') {
      productions.push({ ...row, production_kwh: payload.kwh });
    } else {
      consumptions.push({ ...row, consumption_kwh: payload.kwh });
    }
  }

  if (productions.length) await knex.batchInsert('productions', productions, 100);
  if (consumptions.length) await knex.batchInsert('consumptions', consumptions, 100);
};
