exports.up = async (knex) => {
  await knex.schema.createTable('alerts', (table) => {
    table.increments('id').primary();
    table.integer('site_id').notNullable().references('sites.id');
    table.integer('asset_id').references('assets.id');
    table.string('type').notNullable();
    table.string('severity').notNullable().defaultTo('warning');
    table.string('status').notNullable().defaultTo('open');
    table.text('message').notNullable();
    table.timestamp('triggered_at', { useTz: true }).notNullable();
    table.timestamp('resolved_at', { useTz: true });
    table.string('created_by').notNullable().defaultTo('alert-scan');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('alerts');
};
