exports.up = async (knex) => {
  await knex.schema.createTable('sites', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').notNullable().references('customers.id');
    table.string('name').notNullable();
    table.string('slug').notNullable().unique();
    table.string('city').notNullable();
    table.string('country').notNullable().defaultTo('GB');
    table.string('timezone').notNullable().defaultTo('Europe/London');
    table.decimal('capacity_kwp', 8, 2).notNullable();
    table.date('commissioned_at').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('sites');
};
