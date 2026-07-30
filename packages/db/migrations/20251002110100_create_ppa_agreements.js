exports.up = async (knex) => {
  await knex.schema.createTable('ppa_agreements', (table) => {
    table.increments('id').primary();
    table.integer('site_id').notNullable().references('sites.id');
    table.string('counterparty').notNullable();
    table.decimal('rate_per_kwh', 8, 4).notNullable();
    table.string('currency').notNullable().defaultTo('GBP');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('ppa_agreements');
};
