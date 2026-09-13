# Incident reports

One written report per ticket from the support queue in [`../tickets`](../tickets).

Each report states what was found, how it is known, and what to do next —
diagnosis first, with the evidence that supports it, and a patch only where one
is warranted.

| Ticket                                                                            | Report                                                                           | Status     | Root cause in |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------------- |
| [TICKET-4821](../tickets/TICKET-4821-dashboard-csv-revenue-mismatch/ticket.md)       | [Dashboard revenue does not match CSV export](TICKET-4821-dashboard-csv-revenue-mismatch.md) | **Fixed**  | Code + monitoring |
| [TICKET-4830](../tickets/TICKET-4830-generation-drop-school-bristol.md)              | —                                                                                 | Open       | —             |
| [TICKET-4835](../tickets/TICKET-4835-zero-revenue-factory-manchester.md)             | —                                                                                 | Open       | —             |
| [TICKET-4847](../tickets/TICKET-4847-duplicate-offline-alerts.md)                    | —                                                                                 | Open       | —             |

## Follow-up work

Each ticket is worked in two passes: fix the customer-facing defect first, then
pick up the hardening items the report raises. Outstanding items:

| Item                                                                    | From        | Priority |
| ------------------------------------------------------------------------- | ----------- | -------- |
| Alert on `jobs.status = 'failed'` — nothing consumes it today             | TICKET-4821 | P1       |
| Report job failures to Sentry; `runJob` currently swallows them           | TICKET-4821 | P1       |
| CI check: every view refreshed `CONCURRENTLY` must have a unique index    | TICKET-4821 | P2       |
| Surface rollup freshness in the console                                   | TICKET-4821 | P3       |

## Code changes

| Change                                                                                                        | Ticket      | Applied |
| ---------------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| [`20260730090000_restore_mv_site_daily_kpis_unique_index.js`](../packages/db/migrations/20260730090000_restore_mv_site_daily_kpis_unique_index.js) | TICKET-4821 | Yes     |
