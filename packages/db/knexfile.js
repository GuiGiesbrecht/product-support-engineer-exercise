const connection = process.env.DATABASE_URL || 'postgres://metris:metris_dev@localhost:5432/metris';

module.exports = {
  client: 'pg',
  connection,
  pool: {
    min: 2,
    max: 10,
    afterCreate: (conn, done) => {
      // Mirrors the fleet-wide statement timeout applied by the platform team.
      conn.query("SET statement_timeout = '15s'", (err) => done(err, conn));
    },
  },
  migrations: {
    directory: `${__dirname}/migrations`,
    tableName: 'knex_migrations',
  },
};
