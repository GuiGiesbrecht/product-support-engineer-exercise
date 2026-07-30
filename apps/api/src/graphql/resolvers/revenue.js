const { siteDailyKpis, siteIdsForCustomer } = require('../../services/reportingService');
const { getDataAnchor } = require('../../services/kpiService');
const { monthToDateRange } = require('@metris/shared');
const { resolveCustomerContext } = require('./helpers');

module.exports = {
  Query: {
    revenueByDay: async (_parent, { customerId, from, to }, ctx) => {
      const resolvedCustomerId = await resolveCustomerContext(ctx, customerId);
      const siteIds = await siteIdsForCustomer(resolvedCustomerId);
      if (siteIds.length === 0) return [];
      let range = { from, to };
      if (!from || !to) {
        const anchor = await getDataAnchor();
        range = monthToDateRange(anchor);
      }
      return siteDailyKpis(siteIds, range.from, range.to);
    },
  },
};
