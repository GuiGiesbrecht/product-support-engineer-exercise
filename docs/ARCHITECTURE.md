# Architecture

## Overview

```
 vendor gateways                      Metris platform
┌──────────────┐   daily energy    ┌─────────────────────────────────────────┐
│ SolarEdge    │   summaries       │  api (Express)                          │
│ FusionSolar  │ ────────────────▶ │   POST /internal/ingest/readings        │
│ Modbus bridge│   (push, HTTPS)   │   GraphQL /graphql · REST /export/csv   │
└──────────────┘                   └────────────┬────────────────────────────┘
                                                │
                                         PostgreSQL
                            productions · consumptions · prices
                            ppa_agreements · alerts · jobs · logs
                                                │
                                   ┌────────────┴────────────┐
                                   │ worker (scheduler)      │
                                   │  refresh-kpi-views      │
                                   │  alert-scan             │
                                   │  connector-status-poll  │
                                   └─────────────────────────┘
```

## Ingestion

Vendor gateways **push** one energy summary per asset per civil day
(`reading_date`) to `POST /internal/ingest/readings`. Each payload carries a
vendor payload id, stored as `source_ref`. Production readings land in
`productions`, meter readings in `consumptions`. Assets are matched through
`connector_assets` (vendor + external id); the same table tracks connector
heartbeats (`last_seen_at`, `sync_state`) and gateway configuration.

The worker's `connector-status-poll` job only refreshes heartbeat state
between pushes — it does not ingest readings.

## Derived figures

For each site and day:

- **revenue** = production × the PPA rate whose agreement window covers the
  reading date (`ppa_agreements`)
- **self-consumed energy** = min(production, consumption)
- **savings** = self-consumed × (grid import tariff − PPA rate), tariffs from
  `prices`

Two query paths produce these figures:

1. **`mv_site_daily_kpis`** — a materialized view with one row per site/day,
   backing the **Dashboard** (the highest-traffic page; joining raw readings
   across a whole portfolio on every load does not scale). The
   `refresh-kpi-views` worker job rebuilds it nightly at 02:00 UTC using
   `REFRESH MATERIALIZED VIEW CONCURRENTLY`, and the scheduler catches up on
   boot when a run was missed.
2. **Live CTE queries** (`apps/api/src/services/reportingService.js`) — used
   by **Site Overview**, the **Revenue** page and the **CSV export**, which
   compute from `productions`/`consumptions` at query time.

## Caching

Dashboard KPI responses are cached in-process for 60 seconds per customer
(`apps/api/src/services/cacheService.js`). Cache hits and misses are recorded
in `api_logs.metadata`.

## Workers

A single scheduler process (`apps/api/src/workers/index.js`) runs all jobs.
Every run is recorded in `jobs` (status, hostname, timing, error) and job log
lines go to `worker_logs` as well as stdout. Jobs that fail retry hourly.
`alert-scan` evaluates connector heartbeats every 6 hours and raises alerts;
it pages the on-call rota in production and is therefore gated behind
`ALERTING_ENABLED` elsewhere.

## Reporting windows

The console anchors its default "month to date" window to the most recent
`reading_date` present, so every surface reports over the same civil-date
range. All reading dates are civil dates (`DATE`); timestamps appear only in
operational tables.

## Observability

- `api_logs` — one row per API request (duration, status, operation, cache
  metadata)
- `worker_logs` / `jobs` — background job activity and outcomes
- `audit_logs` — data-changing events (connector corrections, agreement
  changes, infrastructure changes)
- Sentry — unhandled errors from web, api and worker (see `docs/sentry/` for
  recent exports)
