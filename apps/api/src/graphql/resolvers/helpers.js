const { GraphQLError } = require('graphql');
const { isStaff, resolveCustomerId } = require('../../lib/auth');

function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.user;
}

function resolveCustomerContext(ctx, requestedCustomerId) {
  return resolveCustomerId(requireUser(ctx), requestedCustomerId);
}

function authorizeSite(ctx, site) {
  const user = requireUser(ctx);
  if (!isStaff(user) && site.customer_id !== user.customer_id) {
    throw new GraphQLError('Not found', { extensions: { code: 'NOT_FOUND' } });
  }
  return site;
}

module.exports = { requireUser, resolveCustomerContext, authorizeSite };
