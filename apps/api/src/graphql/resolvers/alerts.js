const db = require('../../db/knex');
const { resolveCustomerContext } = require('./helpers');

module.exports = {
  Query: {
    alerts: async (_parent, { customerId, status }, ctx) => {
      const resolvedCustomerId = await resolveCustomerContext(ctx, customerId);
      const query = db('alerts')
        .join('sites', 'sites.id', 'alerts.site_id')
        .leftJoin('assets', 'assets.id', 'alerts.asset_id')
        .where('sites.customer_id', resolvedCustomerId)
        .orderBy('alerts.triggered_at', 'desc')
        .select(
          'alerts.*',
          'sites.name as site_name',
          'sites.slug as site_slug',
          'assets.name as asset_name'
        );
      if (status) query.where('alerts.status', status);
      return query;
    },
  },

  Alert: {
    triggeredAt: (alert) => new Date(alert.triggered_at).toISOString(),
    resolvedAt: (alert) => (alert.resolved_at ? new Date(alert.resolved_at).toISOString() : null),
    siteName: (alert) => alert.site_name,
    siteSlug: (alert) => alert.site_slug,
    assetName: (alert) => alert.asset_name,
  },
};
