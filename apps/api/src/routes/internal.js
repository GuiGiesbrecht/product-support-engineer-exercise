const { Router } = require('express');
const db = require('../db/knex');

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (err) {
    res.locals.errorMessage = err.message;
    return res.status(503).json({ status: 'degraded', error: err.message });
  }
});

/**
 * Vendor gateways push daily energy summaries here. Each payload becomes one
 * reading row keyed by the vendor payload id.
 */
router.post('/ingest/readings', async (req, res) => {
  const secret = process.env.CONNECTOR_PUSH_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Connector ingest is not enabled in this environment' });
  }
  if (req.headers['x-connector-token'] !== secret) {
    return res.status(401).json({ error: 'Invalid connector token' });
  }

  const { vendor, gateway, payloads } = req.body || {};
  if (!vendor || !Array.isArray(payloads)) {
    return res.status(400).json({ error: 'vendor and payloads are required' });
  }

  const connectors = await db('connector_assets')
    .where({ connector_vendor: vendor })
    .select('asset_id', 'external_id');
  const assetIdByExternal = Object.fromEntries(connectors.map((c) => [c.external_id, c.asset_id]));

  let accepted = 0;
  for (const payload of payloads) {
    const assetId = assetIdByExternal[payload.external_id];
    if (!assetId) continue;
    const row = {
      asset_id: assetId,
      reading_date: payload.reading_date,
      source: 'gateway_push',
      source_ref: payload.payload_id,
    };
    if (payload.kind === 'production') {
      await db('productions').insert({ ...row, production_kwh: payload.kwh });
    } else if (payload.kind === 'consumption') {
      await db('consumptions')
        .insert({ ...row, consumption_kwh: payload.kwh })
        .onConflict(['asset_id', 'reading_date'])
        .merge(['consumption_kwh', 'source_ref', 'ingested_at']);
    } else {
      continue;
    }
    accepted += 1;
    await db('connector_assets')
      .where({ connector_vendor: vendor, external_id: payload.external_id })
      .update({ last_seen_at: db.fn.now(), sync_state: 'ok' });
  }

  res.locals.logMetadata = { gateway, vendor, payloads: payloads.length };
  return res.status(202).json({ accepted });
});

module.exports = router;
