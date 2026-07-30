const fs = require('fs');
const path = require('path');

const resync = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures/resync/solaredge_resync_2026-07-27.json'),
    'utf8'
  )
);

/**
 * Applies the corrective re-sync issued by the vendor on 2026-07-27:
 * retracts the transmissions listed in the re-sync manifest and records the
 * gateway firmware update, mirroring what the resync handler did in production.
 */
module.exports = async function applyConnectorResync(knex) {
  const issuedAt = new Date(resync.issued_at).getTime();

  let offset = 0;
  for (const retraction of resync.retracted_payloads) {
    const row = await knex('productions').where({ source_ref: retraction.payload_id }).first();
    if (!row) {
      throw new Error(`Re-sync manifest references unknown payload ${retraction.payload_id}`);
    }
    await knex('audit_logs').insert({
      actor_type: 'connector',
      actor_id: `${resync.vendor}-resync`,
      action: 'production.reading.deleted',
      entity_type: 'production',
      entity_id: String(row.id),
      before: {
        asset_id: row.asset_id,
        reading_date: retraction.reading_date,
        production_kwh: retraction.kwh,
        source_ref: retraction.payload_id,
      },
      after: null,
      note: `${resync.reason} (gateway ${resync.gateway})`,
      created_at: new Date(issuedAt + offset * 1000).toISOString(),
    });
    await knex('productions').where({ id: row.id }).del();
    offset += 1;
  }

  const firmware = resync.firmware_update;
  await knex('connector_assets')
    .whereIn('external_id', firmware.external_ids)
    .update({ firmware_version: firmware.to, last_sync_at: firmware.applied_at });
  await knex('audit_logs').insert({
    actor_type: 'connector',
    actor_id: `${resync.vendor}-resync`,
    action: 'connector.firmware.updated',
    entity_type: 'connector_gateway',
    entity_id: resync.gateway,
    before: { firmware_version: firmware.from },
    after: { firmware_version: firmware.to },
    note: `Gateway ${resync.gateway} updated by vendor as part of the corrective re-sync.`,
    created_at: firmware.applied_at,
  });
};
