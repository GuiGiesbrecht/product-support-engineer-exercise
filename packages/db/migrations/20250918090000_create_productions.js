exports.up = async (knex) => {
  await knex.schema.createTable('productions', (table) => {
    table.bigIncrements('id').primary();
    table.integer('asset_id').notNullable().references('assets.id');
    table.date('reading_date').notNullable();
    table.decimal('production_kwh', 10, 2).notNullable();
    table.string('source').notNullable().defaultTo('gateway_push');
    table.string('source_ref');
    table.timestamp('ingested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('productions');
};
