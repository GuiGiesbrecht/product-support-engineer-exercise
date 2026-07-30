exports.up = async (knex) => {
  await knex.schema.createTable('assets', (table) => {
    table.increments('id').primary();
    table.integer('site_id').notNullable().references('sites.id');
    table.string('type').notNullable();
    table.string('name').notNullable();
    table.string('serial_number').notNullable().unique();
    table.string('manufacturer').notNullable();
    table.string('model').notNullable();
    table.decimal('rated_power_kw', 8, 2);
    table.string('status').notNullable().defaultTo('active');
    table.date('installed_at').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['site_id', 'type'], 'assets_site_type_idx');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('assets');
};
