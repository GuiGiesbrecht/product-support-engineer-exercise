exports.up = async (knex) => {
  await knex.schema.createTable('consumptions', (table) => {
    table.bigIncrements('id').primary();
    table.integer('asset_id').notNullable().references('assets.id');
    table.date('reading_date').notNullable();
    table.decimal('consumption_kwh', 10, 2).notNullable();
    table.string('source').notNullable().defaultTo('gateway_push');
    table.string('source_ref');
    table.timestamp('ingested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['asset_id', 'reading_date'], { indexName: 'consumptions_asset_date_uq' });
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('consumptions');
};
