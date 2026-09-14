# Incident reports

One written report per ticket from the support queue in [`../tickets`](../tickets).

Each report states what was found, how it is known, and what to do next —
diagnosis first, with the evidence that supports it, and a patch only where one
is warranted.

| Ticket                                                                         | Report                                                                                                   | Status    | Root cause in           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | --------- | ----------------------- |
| [TICKET-4821](../tickets/TICKET-4821-dashboard-csv-revenue-mismatch/ticket.md) | [Dashboard revenue does not match CSV export](TICKET-4821-dashboard-csv-revenue-mismatch.md)             | **Fixed** | Code + monitoring       |
| [TICKET-4830](../tickets/TICKET-4830-generation-drop-school-bristol.md)        | [Generation dropped ~40% at School Bristol](TICKET-4830-generation-drop-school-bristol.md)               | Diagnosed | Hardware / connectivity |
| [TICKET-4835](../tickets/TICKET-4835-zero-revenue-factory-manchester.md)       | [Revenue showing £0.00 for Factory Manchester](TICKET-4835-zero-revenue-factory-manchester.md)           | Diagnosed | Data / process          |
| [TICKET-4847](../tickets/TICKET-4847-duplicate-offline-alerts.md)              | [Customer received duplicate offline alerts](TICKET-4847-duplicate-offline-alerts.md)                    | Diagnosed | Configuration           |
| [TICKET-4852](../tickets/TICKET-4852-csv-export-all-sites/ticket.md)           | [CSV export fails for "All sites" on staff accounts](TICKET-4852-csv-export-all-sites.md)                | **Fixed** | Code                    |
| [TICKET-4856](../tickets/TICKET-4856-api-logs-endpoint-identity/ticket.md)     | [API request log does not identify which endpoint was called](TICKET-4856-api-logs-endpoint-identity.md) | **Fixed** | Code                    |

**Status.** _Fixed_ means a change in this repository resolves the defect and
was verified against the reproduction environment; nothing has been deployed
to production, and each customer message is written for that state.
_Diagnosed_ means the cause is established with evidence and the remediation
lies outside this repository — a field intervention, a data change awaiting
commercial input, or an infrastructure and design decision — with the
platform-side hardening listed under follow-up work.

## Follow-up work

Each ticket is worked in two passes: fix the customer-facing defect first, then
pick up the hardening items the report raises. Outstanding items:

| Item                                                                                                     | From        | Priority |
| -------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| Alert on `jobs.status = 'failed'` — nothing consumes it today                                            | TICKET-4821 | P1       |
| Report job failures to Sentry; `runJob` currently swallows them                                          | TICKET-4821 | P1       |
| CI check: every view refreshed `CONCURRENTLY` must have a unique index                                   | TICKET-4821 | P2       |
| Mark days where an active asset produced no reading — chart, CSV and Dashboard render them as measured   | TICKET-4830 | P1       |
| Expose production per asset; today only the site total leaves the API                                    | TICKET-4830 | P1       |
| Make ingest report discarded payloads — unmatched `external_id` is dropped silently behind a `202`       | TICKET-4830 | P1       |
| Alert on a connector failing its status poll on consecutive runs, distinctly from `asset_offline`        | TICKET-4830 | P2       |
| Store irradiance from the weather stations — they are registered assets that produce no rows             | TICKET-4830 | P3       |
| Detect active sites generating with no covering PPA agreement                                            | TICKET-4835 | P1       |
| Stop coalescing a missing PPA rate to zero in both calculation paths                                     | TICKET-4835 | P1       |
| Prevent overlapping active PPA agreements per site (exclusion constraint)                                | TICKET-4835 | P1       |
| Warn on PPA agreements approaching expiry                                                                | TICKET-4835 | P2       |
| Reconcile `ppa_agreements.status` with its date window, or drop it                                       | TICKET-4835 | P2       |
| Give PPA agreements a write path — today renewals are hand-run SQL                                       | TICKET-4835 | P2       |
| Return the worker pool to one replica (infrastructure, no code)                                          | TICKET-4847 | P1       |
| Alert on duplicated job runs — nothing noticed this for six days                                         | TICKET-4847 | P1       |
| Choose a scheduling architecture; all options need the due time anchored to a shared grid first          | TICKET-4847 | P1       |
| Parallelise connector-status-poll; collapse alert-scan's per-connector query — the real Q3 capacity work | TICKET-4847 | P2       |
| Make worker replica count a reviewed change                                                              | TICKET-4847 | P2       |
| Surface the API's error message in the console — `downloadCsv` reports every failure as "Export failed"  | TICKET-4852 | P1       |
| Bound or stream the CSV export — an all-sites request multiplies rows against a 15s statement timeout    | TICKET-4852 | P1       |
| Record scope and outcome on rejected requests — 4xx rows carry no metadata                               | TICKET-4852 | P2       |
| Name the portfolio export after its customer — every all-sites file is `metris-export-portfolio-…`       | TICKET-4852 | P3       |
| Persist the customer switcher's default instead of only displaying it                                    | TICKET-4852 | P3       |
| Generate seeded operational history from the code path it represents — this fixture hid the defect       | TICKET-4856 | P1       |
| Smoke-check the shape of a log row: one request per route, path equal to the request path                | TICKET-4856 | P2       |
| Stop reading request state inside `finish` — `req.user`, `req.body` and `res.locals` are read there too  | TICKET-4856 | P3       |

## Code changes

| Change                                                                                                                                                                                                                                                                                    | Ticket                    | Applied |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------- |
| [`20260730090000_restore_mv_site_daily_kpis_unique_index.js`](../packages/db/migrations/20260730090000_restore_mv_site_daily_kpis_unique_index.js)                                                                                                                                        | TICKET-4821               | Yes     |
| [`20260730094000_unique_open_alert_per_asset.js`](../packages/db/migrations/20260730094000_unique_open_alert_per_asset.js) + [`alertScan.js`](../apps/api/src/workers/jobs/alertScan.js) — contains the duplicate alerts; does not stop the duplicated execution                          | TICKET-4847               | Yes     |
| [`export.js`](../apps/api/src/routes/export.js) + [`auth.js`](../apps/api/src/lib/auth.js) + [`api.ts`](../apps/web/src/lib/api.ts) — scopes the portfolio export to the selected customer                                                                                                | TICKET-4852               | Yes     |
| [`typeDefs.js`](../apps/api/src/graphql/typeDefs.js) + [`kpiService.js`](../apps/api/src/services/kpiService.js) + the dashboard and Site Overview pages — states how current the dashboard rollup is, and shows the rate a site's revenue is billed at beside the figure                 | TICKET-4821 + TICKET-4835 | Yes     |
| [`requestLogger.js`](../apps/api/src/lib/requestLogger.js) + [`operationNamePlugin.js`](../apps/api/src/graphql/operationNamePlugin.js) + [`CustomerSwitcher.tsx`](../apps/web/src/components/CustomerSwitcher.tsx) — records the endpoint that was called and the GraphQL operation name | TICKET-4856               | Yes     |
