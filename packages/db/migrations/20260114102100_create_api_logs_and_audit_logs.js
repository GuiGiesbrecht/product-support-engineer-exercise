exports.up = async (knex) => {
  await knex.schema.createTable('api_logs', (table) => {
    table.bigIncrements('id').primary();
    table.string('method').notNullable();
    table.string('path').notNullable();
    table.string('operation_name');
    table.integer('status_code').notNullable();
    table.integer('duration_ms').notNullable();
    table.integer('user_id').references('users.id');
    table.text('error');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('requested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_logs', (table) => {
    table.bigIncrements('id').primary();
    table.string('actor_type').notNullable();
    table.string('actor_id');
    table.string('action').notNullable();
    table.string('entity_type').notNullable();
    table.string('entity_id').notNullable();
    table.jsonb('before');
    table.jsonb('after');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('api_logs');
};
