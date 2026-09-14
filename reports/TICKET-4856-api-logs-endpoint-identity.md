# TICKET-4856 · API request log does not identify which endpoint was called

|                 |                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Ticket          | [TICKET-4856](../tickets/TICKET-4856-api-logs-endpoint-identity/ticket.md)                                      |
| Raised by       | Sofia Marchetti (`support@metris.energy`) — internal                                                            |
| Reported        | 2026-07-29 17:05 UTC                                                                                            |
| Severity        | Medium — no customer impact; the platform cannot measure or audit itself                                        |
| Status          | **Fixed** · both columns now record what they claim to — verified in the reproduction environment, not deployed |
| Root cause in   | **Code** — two independent defects, each of which alone empties one column                                      |
| Affects         | Every request ever logged; every route, not only GraphQL                                                        |
| Impact window   | Since the request logger was written                                                                            |
| Investigated by | Guilherme Duarte Giesbrecht                                                                                     |
| Report date     | 2026-09-14                                                                                                      |

---

## Summary

**`api_logs` cannot tell you which endpoint a request hit.** Two defects
combine, and each is enough on its own:

- `path` records the route **relative to its mount point**, so every GraphQL
  request — dashboard, revenue, site overview, alerts — is logged as `/`.
  Logins are `/login`, exports are `/csv`.
- `operation_name`, the one column that exists to disambiguate `/graphql`, is
  **never populated**.

Neither is visible in this environment until real traffic is generated, because
the seeded history carries correct values. The fixture describes a logger that
does not exist.

This is not a data problem. Both columns are written on every request; both are
written wrong.

---

## What was reported

Sofia went to `api_logs` to count how often something had happened and found
every GraphQL request in one bucket, `operation_name` empty, and older rows
that looked correct — which reads like a regression and is not one.

Her observation reproduces exactly. Traffic generated against the running API
before the fix:

```
 method |  path  | operation_name | count
 POST   | /      |                |   417
 POST   | /login |                |     8
 GET    | /csv   |                |     9
```

The "older rows that look fine" are the seeded history, loaded straight from
`fixtures/history/api_logs.ndjson` rather than produced by the logger:

```
 POST   | /internal/ingest/readings |               |    34
 POST   | /graphql                  | SiteOverview  |    13
 POST   | /graphql                  | RevenueByDay  |     8
 GET    | /export/csv               |               |     6
 POST   | /auth/login               |               |     4
```

Same table. The second list is what the code appears to produce when you only
look at the seed.

---

## What actually happened

### Defect 1 — `path` is read after Express has rewritten it

`requestLogger` reads `req.path` **inside the `res.on('finish')` callback**
(`apps/api/src/lib/requestLogger.js`). Express strips a router's mount prefix
from `req.url` while that router handles the request and restores it when the
router's chain returns. The response is finished **inside** the handler, so
`finish` fires while the prefix is still stripped — and `req.path` derives from
`req.url`.

Every mounted router is affected, in exactly the way the rule predicts:

| Requested          | Mounted at | Logged   |
| ------------------ | ---------- | -------- |
| `POST /graphql`    | `/graphql` | `/`      |
| `POST /auth/login` | `/auth`    | `/login` |
| `GET /export/csv`  | `/export`  | `/csv`   |

The middleware itself is registered at app level, before the routers
(`apps/api/src/index.js:28`), so at the moment it runs the path is still
complete. Only the deferred read sees the rewritten value.

### Defect 2 — nothing ever sends `operationName`

The logger reads `req.body.operationName`. The console's `gql` helper posts
`{ query, variables }` and nothing else (`apps/web/src/lib/api.ts:61`). The
operation name is inside the query string, never in that field, so the
expression evaluates to `null` on every request. GraphQL clients are not
required to send it, and curl — the tool every investigation this week used —
does not.

### Why the two defects compound

Either one alone is survivable. `path` without `operation_name` would still
separate GraphQL from exports. `operation_name` without `path` would still name
the query. Together they erase the identity of the request completely: one
value, `/`, covering every read the console performs.

---

## Evidence

### The rule holds for a nested route too

`/internal/ingest/readings` is two segments below its mount. After the fix it is
recorded whole, which is the same rule read in the other direction — the
prefix was never lost, only unread:

```
 POST | /internal/ingest/readings | 503
```

### Nothing in the codebase reads the table

`api_logs` is written by `requestLogger` and loaded by the seed. No query, job
or resolver reads it. The consumers are people running SQL during an
investigation — which is why the defect survived: it degrades a human process,
not an automated one, and no test or alert covers it.

### It is why 4852 could not be sized

TICKET-4852's report states that how often staff had hit the export error
before the ticket "cannot be reconstructed". That is this defect. The rejected
requests were logged; they were logged as `/csv` with no metadata, so there was
nothing to count them by.

---

## Impact

Internal only. No customer-facing surface reads `api_logs`, no figure is derived
from it, and no data is lost — every request is recorded, with the right status
code, duration and user.

What is lost is the ability to ask anything of it:

- **Per-endpoint error rates.** "How many times did this fail today" has no
  answer, because every GraphQL failure shares one path with every success.
- **Per-operation latency.** `duration_ms` is recorded faithfully and cannot be
  grouped by anything meaningful — the dashboard query and the alerts query are
  the same row shape.
- **Audit of who called what.** `user_id` is correct; what they called is not.

The failure mode is worse than a missing column, because the table looks
healthy. Four incident investigations this week read this table, and the seeded
rows in it are the only ones that have ever been correct.

---

## What ships with this change

**1 — Read the path before Express rewrites it.**
`apps/api/src/lib/requestLogger.js` captures `req.originalUrl` at middleware
entry, dropping the query string. `originalUrl` is never rewritten, which is the
property the deferred read needed and `req.path` does not have.

**2 — Take the operation name from the parsed document.**
`apps/api/src/graphql/operationNamePlugin.js` is an Apollo Server plugin whose
`didResolveOperation` hook writes the resolved name onto `res.locals`; the
logger prefers it and falls back to the request body. Reading the parsed
document rather than the body means the name is recorded for **every** client —
the console, curl, the Apollo landing page — without any of them changing.

Choosing the plugin over "make the console send `operationName`" is deliberate:
the console is one of several clients, and the one that mattered most during
this week's work was curl.

**3 — Name the console's one anonymous operation.**
`apps/web/src/components/CustomerSwitcher.tsx` posted the query shorthand,
`{ customers { id name } }` — a valid operation that simply has no name,
so there was nothing for the plugin to record. The switcher renders in the console
layout, which made it one unattributable `/graphql` row per page load. Naming it
`CustomerList` changes the request in no other way. The anonymous rows that remain
now come from curl and the Apollo landing page rather than from the product itself.

### Verification (completed)

Every route exercised against the running API, log rows read back:

```
 method |           path            | operation_name | status_code | user_id
 POST   | /auth/login               |                |         200 |
 GET    | /internal/health          |                |         200 |
 POST   | /graphql                  | DashboardKpis  |         200 |       1
 POST   | /graphql                  | SiteOverview   |         200 |       1
 POST   | /graphql                  |                |         200 |       1    ← anonymous query
 GET    | /export/csv               |                |         200 |       1
 POST   | /graphql                  | Unauthorized   |         200 |             ← rejected, still named
 POST   | /internal/ingest/readings |                |         503 |
```

Each path is now the endpoint that was called. Named operations are recorded;
the anonymous `{ me { email } }` correctly records nothing, since it has no name
to record. A GraphQL request rejected for authentication is still attributed to
its operation. Export metadata is unchanged —
`{"to": "2026-07-02", "from": "2026-07-01", "site": "all", "customerId": 1}` —
and the query string does not leak into `path`.

The renamed switcher query was checked on its own, against the string the
component sends: `CustomerList` is recorded for both a staff and a customer
account, and each still receives its own scope — three customers and one.
The shorthand form still records no name, confirming the name is the only
difference between them.

`npm run lint`, `npm test` (15 tests) and `prettier --check` pass.

---

## What this change does not do

**No backfill.** Existing rows keep their truncated paths. The prefix cannot be
recovered from a row that never recorded it, and rewriting log history to look
like something that was never observed is worse than the gap. Rows before this
deploy should be read as "endpoint unknown".

**No repair of the fixture.** `fixtures/history/api_logs.ndjson` describes
correct behaviour and now matches what the code produces, so it stops being
misleading by virtue of the fix rather than by being edited.

**Rejected requests still carry no context.** `res.locals.logMetadata` and
`errorMessage` are set only on success paths, so a 4xx records status and
nothing else. That is TICKET-4852's open P2 and is unchanged here — but it is
worth noting that it only becomes useful once a row says which endpoint it
belongs to.

**No structured logging or APM.** This table remains the only request trail. It
is now trustworthy; it is not an observability stack.

---

## Preventing recurrence

| Priority | Action                                                                                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | Generate seeded operational history from the code path it represents, or review it against one. This fixture asserted behaviour the logger never had, and that is what kept the defect invisible through four investigations. |
| **P2**   | Add a smoke check asserting the shape of a log row — one request per route, path equal to the request path. The defect is trivial to catch once anything at all looks at the output.                                          |
| **P2**   | Record scope and outcome on rejected requests (carried from TICKET-4852). Now that a row names its endpoint, metadata on failures becomes worth reading.                                                                      |
| **P3**   | Reconsider reading request state inside `finish` at all. `path` was the only field affected today, but `req.user`, `req.body` and `res.locals` are all read there, and the same class of rewrite would be equally silent.     |

---

## What to tell the team

> `api_logs` was recording the wrong path on every request — everything under
> `/graphql` was logged as `/`, logins as `/login`, exports as `/csv` — and
> `operation_name` was never filled in at all. Both are fixed.
>
> Two things worth knowing. First, **rows from before this deploy are not
> reliable for identifying an endpoint**; treat the path on them as unknown
> rather than as evidence. There is no backfill, because the information was
> never captured.
>
> Second, the reason nobody noticed is that the seeded history in local and
> staging environments contains correct values. If you looked at this table in a
> seeded environment you saw a healthy one. Worth remembering the next time a
> fixture is the only thing confirming a behaviour.

---

## Appendix — reproduction

```bash
TOKEN=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"support@metris.energy","password":"SolarDemo!2026"}' | jq -r .token)

curl -s -o /dev/null localhost:4000/internal/health
curl -s -o /dev/null localhost:4000/graphql -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"query DashboardKpis { dashboard { revenueGbp } }"}'
curl -s -o /dev/null "localhost:4000/export/csv?from=2026-07-01&to=2026-07-29" \
  -H "Authorization: Bearer $TOKEN"
```

```sql
SELECT method, path, operation_name, status_code
FROM api_logs ORDER BY id DESC LIMIT 3;

-- before: / , /login , /csv , operation_name always null
-- after:  /graphql + DashboardKpis , /auth/login , /export/csv
```
