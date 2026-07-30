const knex = require('knex');
const { types } = require('pg');
const config = require('@metris/db');

// reading_date and other DATE columns are civil dates; hand them to the
// application as ISO strings rather than timezone-shifted Date objects.
types.setTypeParser(types.builtins.DATE, (value) => value);

module.exports = knex(config);
