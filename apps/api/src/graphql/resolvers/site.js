const db = require('../../db/knex');
const { siteDailyKpis } = require('../../services/reportingService');
const { getDataAnchor } = require('../../services/kpiService');
const { monthToDateRange, activeAgreementFor } = require('@metris/shared');
const { requireUser, resolveCustomerContext, authorizeSite } = require('./helpers');

module.exports = {
  Query: {
    sites: async (_parent, { customerId }, ctx) => {
      const resolvedCustomerId = await resolveCustomerContext(ctx, customerId);
      return db('sites').where({ customer_id: resolvedCustomerId }).orderBy('name');
    },
    site: async (_parent, { slug }, ctx) => {
      requireUser(ctx);
      const site = await db('sites').where({ slug }).first();
      if (!site) return null;
      return authorizeSite(ctx, site);
    },
  },

  Site: {
    capacityKwp: (site) => Number(site.capacity_kwp),
    commissionedAt: (site) => site.commissioned_at,
    customer: (site) => db('customers').where({ id: site.customer_id }).first(),
    assets: async (site) => {
      const rows = await db('assets')
        .leftJoin('connector_assets', 'connector_assets.asset_id', 'assets.id')
        .where('assets.site_id', site.id)
        .orderBy(['assets.type', 'assets.name'])
        .select(
          'assets.*',
          'connector_assets.connector_vendor',
          'connector_assets.external_id',
          'connector_assets.firmware_version',
          'connector_assets.last_seen_at',
          'connector_assets.last_sync_at',
          'connector_assets.sync_state'
        );
      return rows.map((row) => ({
        ...row,
        connector: row.connector_vendor
          ? {
              vendor: row.connector_vendor,
              externalId: row.external_id,
              firmwareVersion: row.firmware_version,
              lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
              lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
              syncState: row.sync_state,
            }
          : null,
      }));
    },
    activePpa: async (site) => {
      const agreements = await db('ppa_agreements')
        .where({ site_id: site.id })
        .orderBy('start_date')
        .select('*');
      const anchor = await getDataAnchor();
      const active = activeAgreementFor(agreements, anchor);
      if (!active) return null;
      return {
        counterparty: active.counterparty,
        ratePerKwh: Number(active.rate_per_kwh),
        startDate: active.start_date,
        endDate: active.end_date,
        status: active.status,
      };
    },
    openAlerts: (site) =>
      db('alerts')
        .leftJoin('assets', 'assets.id', 'alerts.asset_id')
        .join('sites', 'sites.id', 'alerts.site_id')
        .where({ 'alerts.site_id': site.id, 'alerts.status': 'open' })
        .orderBy('alerts.triggered_at', 'desc')
        .select(
          'alerts.*',
          'sites.name as site_name',
          'sites.slug as site_slug',
          'assets.name as asset_name'
        ),
    dailyKpis: async (site, { from, to }) => {
      let range = { from, to };
      if (!from || !to) {
        const anchor = await getDataAnchor();
        range = monthToDateRange(anchor);
      }
      return siteDailyKpis([site.id], range.from, range.to);
    },
  },

  Asset: {
    serialNumber: (asset) => asset.serial_number,
    ratedPowerKw: (asset) => (asset.rated_power_kw === null ? null : Number(asset.rated_power_kw)),
  },
};
