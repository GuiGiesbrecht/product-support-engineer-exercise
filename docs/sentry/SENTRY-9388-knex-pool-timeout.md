# METRIS-API-9388 · TimeoutError: Knex: Timeout acquiring a connection

|                |                         |
| -------------- | ----------------------- |
| Project        | metris-api (production) |
| Level          | error                   |
| Events         | 7                       |
| Users affected | 2                       |
| First seen     | 2026-07-22 09:41 UTC    |
| Last seen      | 2026-07-29 08:52 UTC    |
| Release        | api@1.4.2               |
| Status         | Unresolved              |

```
TimeoutError: Knex: Timeout acquiring a connection. The pool is probably full. Are you missing a .transacting(trx) call?
  at Client_PG.acquireConnection (node_modules/knex/lib/client.js:312:26)
  at Runner.ensureConnection (node_modules/knex/lib/execution/runner.js:287:28)
  at siteDailyKpis (apps/api/src/services/reportingService.js:9:31)
  at buildCsv (apps/api/src/services/exportService.js:37:22)
  at /export/csv (apps/api/src/routes/export.js:45:23)
```

**Request**

```
GET /export/csv?site=brighton-retail-park&from=2026-04-01&to=2026-07-29
user: support@metris.energy
```

**Tags:** transaction `GET /export/csv`, environment `production`

**Note (Marcus, 2026-07-29):** clusters when several long exports overlap —
every pool slot ends up occupied by export queries that each run for 10s+, and
new requests queue past the acquire timeout. Related to the export slowness
Sofia has been chasing (TICKET-4842).
