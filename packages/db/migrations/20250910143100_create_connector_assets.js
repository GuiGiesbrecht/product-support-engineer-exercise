exports.up = async (knex) => {
  await knex.schema.createTable('connector_assets', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').notNullable().references('assets.id').unique();
    table.string('connector_vendor').notNullable();
    table.string('external_id').notNullable();
    table.string('firmware_version');
    table.timestamp('last_seen_at', { useTz: true });
    table.timestamp('last_sync_at', { useTz: true });
    table.string('sync_state').notNullable().defaultTo('ok');
    table.jsonb('config').notNullable().defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['connector_vendor', 'external_id'], {
      indexName: 'connector_assets_vendor_external_uq',
    });
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('connector_assets');
};
