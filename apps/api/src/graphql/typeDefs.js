module.exports = /* GraphQL */ `
  type Query {
    me: User!
    customers: [Customer!]!
    dataWindow: DataWindow!
    dashboard(customerId: ID): DashboardKpis!
    sites(customerId: ID): [Site!]!
    site(slug: String!): Site
    revenueByDay(customerId: ID, from: String, to: String): [SiteDailyKpi!]!
    alerts(customerId: ID, status: String): [Alert!]!
  }

  type User {
    id: ID!
    email: String!
    fullName: String!
    role: String!
    customer: Customer
  }

  type Customer {
    id: ID!
    name: String!
  }

  "The reporting window available in this environment, anchored to the latest reading."
  type DataWindow {
    anchor: String!
    monthStart: String!
  }

  type DashboardKpis {
    periodStart: String!
    periodEnd: String!
    productionKwh: Float!
    selfConsumedKwh: Float!
    revenueGbp: Float!
    savingsGbp: Float!
    openAlerts: Int!
    freshness: RollupFreshness!
    daily: [DashboardDay!]!
    sites: [SiteSummary!]!
  }

  """
  How current the pre-aggregated rollup behind the dashboard is. The dashboard
  reads mv_site_daily_kpis, which a nightly job rebuilds; every other reporting
  surface computes from the readings at request time. When the rollup falls
  behind, the dashboard disagrees with those surfaces until it catches up.
  """
  type RollupFreshness {
    "Latest day held in the rollup for this customer, or null when it holds none."
    throughDay: String
    "Days between throughDay and the latest day with readings. Zero when current."
    daysBehind: Int
  }

  type DashboardDay {
    day: String!
    productionKwh: Float!
    revenueGbp: Float!
    savingsGbp: Float!
  }

  type SiteSummary {
    id: ID!
    slug: String!
    name: String!
    city: String!
    capacityKwp: Float!
    productionKwh: Float!
    revenueGbp: Float!
    savingsGbp: Float!
    "PPA rate revenue is billed at, or null when no agreement covers the period."
    ppaRatePerKwh: Float
  }

  type Site {
    id: ID!
    slug: String!
    name: String!
    city: String!
    capacityKwp: Float!
    commissionedAt: String!
    status: String!
    customer: Customer!
    assets: [Asset!]!
    activePpa: PpaAgreement
    openAlerts: [Alert!]!
    dailyKpis(from: String, to: String): [SiteDailyKpi!]!
  }

  type Asset {
    id: ID!
    type: String!
    name: String!
    serialNumber: String!
    manufacturer: String!
    model: String!
    ratedPowerKw: Float
    status: String!
    connector: ConnectorAsset
  }

  type ConnectorAsset {
    vendor: String!
    externalId: String!
    firmwareVersion: String
    lastSeenAt: String
    lastSyncAt: String
    syncState: String!
  }

  type PpaAgreement {
    counterparty: String!
    ratePerKwh: Float!
    startDate: String!
    endDate: String!
    status: String!
  }

  type SiteDailyKpi {
    siteId: ID!
    slug: String!
    siteName: String!
    day: String!
    productionKwh: Float!
    consumptionKwh: Float!
    selfConsumedKwh: Float!
    revenueGbp: Float!
    savingsGbp: Float!
  }

  type Alert {
    id: ID!
    type: String!
    severity: String!
    status: String!
    message: String!
    triggeredAt: String!
    resolvedAt: String
    siteName: String!
    siteSlug: String!
    assetName: String
  }
`;
