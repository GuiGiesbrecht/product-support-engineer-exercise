const { getDashboard, getDataAnchor } = require('../../services/kpiService');
const { monthToDateRange } = require('@metris/shared');
const { resolveCustomerContext } = require('./helpers');

module.exports = {
  Query: {
    dashboard: async (_parent, { customerId }, ctx) => {
      const resolvedCustomerId = await resolveCustomerContext(ctx, customerId);
      const dashboard = await getDashboard(resolvedCustomerId);
      ctx.res.locals.logMetadata = {
        ...(ctx.res.locals.logMetadata || {}),
        cache: dashboard.cacheState,
      };
      return dashboard;
    },
    dataWindow: async () => {
      const anchor = await getDataAnchor();
      return { anchor, monthStart: monthToDateRange(anchor).from };
    },
  },
};
