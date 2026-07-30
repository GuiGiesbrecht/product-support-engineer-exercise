const db = require('../../db/knex');

const VENDOR_ENDPOINTS = {
  solaredge: 'https://monitoringapi.solaredge.com/v2/status',
  fusionsolar: 'https://eu5.fusionsolar.huawei.com/thirdData/status',
  meteocontrol: 'https://api.meteocontrol.de/v2/systems/status',
  modbus_bridge: null, // polled over the site VPN, not a vendor API
  tesla: 'https://fleet-api.prd.eu.vn.cloud.tesla.com/api/1/status',
};

/**
 * Polls vendor monitoring APIs for connector health and updates heartbeat
 * state. Reading ingestion itself is push-based (see /internal/ingest); this
 * job only keeps last_seen_at and sync_state current between pushes.
 */
module.exports = async function connectorPoll({ log }) {
  const token = process.env.CONNECTOR_API_TOKEN;
  const connectors = await db('connector_assets').select('id', 'connector_vendor', 'external_id');

  let polled = 0;
  for (const connector of connectors) {
    const endpoint = VENDOR_ENDPOINTS[connector.connector_vendor];
    if (!endpoint) continue;
    const response = await fetch(`${endpoint}?externalId=${connector.external_id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      log(
        'warn',
        `Status poll failed for connector ${connector.external_id} (${connector.connector_vendor}): HTTP ${response.status}`,
        {
          external_id: connector.external_id,
        }
      );
      continue;
    }
    const status = await response.json();
    await db('connector_assets')
      .where({ id: connector.id })
      .update({
        last_seen_at: status.lastSeenAt || db.fn.now(),
        sync_state: status.state || 'ok',
      });
    polled += 1;
  }

  return { connectors: connectors.length, polled };
};
