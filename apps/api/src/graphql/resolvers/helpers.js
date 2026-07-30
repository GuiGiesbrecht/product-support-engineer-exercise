const { GraphQLError } = require('graphql');
const db = require('../../db/knex');
const { isStaff } = require('../../lib/auth');

function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.user;
}

async function resolveCustomerContext(ctx, requestedCustomerId) {
  const user = requireUser(ctx);
  if (!isStaff(user)) return user.customer_id;
  if (requestedCustomerId) return Number(requestedCustomerId);
  const first = await db('customers').orderBy('name').first('id');
  return first.id;
}

function authorizeSite(ctx, site) {
  const user = requireUser(ctx);
  if (!isStaff(user) && site.customer_id !== user.customer_id) {
    throw new GraphQLError('Not found', { extensions: { code: 'NOT_FOUND' } });
  }
  return site;
}

module.exports = { requireUser, resolveCustomerContext, authorizeSite };
