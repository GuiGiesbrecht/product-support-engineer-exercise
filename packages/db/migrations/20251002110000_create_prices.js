exports.up = async (knex) => {
  await knex.schema.createTable('prices', (table) => {
    table.increments('id').primary();
    table.integer('site_id').notNullable().references('sites.id');
    table.string('tariff_type').notNullable().defaultTo('grid_import');
    table.decimal('price_per_kwh', 8, 4).notNullable();
    table.string('currency').notNullable().defaultTo('GBP');
    table.date('valid_from').notNullable();
    table.date('valid_to');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('prices');
};
