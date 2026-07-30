exports.up = async (knex) => {
  await knex.schema.createTable('customers', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('billing_email').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').references('customers.id');
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.string('full_name').notNullable();
    table.string('role').notNullable();
    table.timestamp('last_login_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('customers');
};
