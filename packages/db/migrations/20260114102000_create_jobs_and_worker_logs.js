exports.up = async (knex) => {
  await knex.schema.createTable('jobs', (table) => {
    table.bigIncrements('id').primary();
    table.string('name').notNullable();
    table.string('status').notNullable().defaultTo('running');
    table.timestamp('scheduled_for', { useTz: true }).notNullable();
    table.timestamp('started_at', { useTz: true });
    table.timestamp('finished_at', { useTz: true });
    table.string('hostname').notNullable();
    table.integer('attempt').notNullable().defaultTo(1);
    table.text('error');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('worker_logs', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('job_id').references('jobs.id');
    table.string('worker_hostname').notNullable();
    table.string('level').notNullable().defaultTo('info');
    table.text('message').notNullable();
    table.jsonb('context').notNullable().defaultTo('{}');
    table.timestamp('logged_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('worker_logs');
  await knex.schema.dropTableIfExists('jobs');
};
