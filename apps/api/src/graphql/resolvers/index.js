const db = require('../../db/knex');
const { isStaff } = require('../../lib/auth');
const { requireUser } = require('./helpers');
const dashboard = require('./dashboard');
const site = require('./site');
const revenue = require('./revenue');
const alerts = require('./alerts');

const base = {
  Query: {
    me: (_parent, _args, ctx) => requireUser(ctx),
    customers: async (_parent, _args, ctx) => {
      const user = requireUser(ctx);
      if (isStaff(user)) return db('customers').orderBy('name');
      return db('customers').where({ id: user.customer_id });
    },
  },
  User: {
    fullName: (user) => user.full_name,
    customer: (user) =>
      user.customer_id ? db('customers').where({ id: user.customer_id }).first() : null,
  },
};

module.exports = {
  Query: {
    ...base.Query,
    ...dashboard.Query,
    ...site.Query,
    ...revenue.Query,
    ...alerts.Query,
  },
  User: base.User,
  Site: site.Site,
  Asset: site.Asset,
  Alert: alerts.Alert,
};
