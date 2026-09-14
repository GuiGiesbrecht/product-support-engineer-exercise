# TICKET-4847 · Customer received duplicate offline alerts

|                 |                                                                                         |
| --------------- | --------------------------------------------------------------------------------------- |
| Ticket          | [TICKET-4847](../tickets/TICKET-4847-duplicate-offline-alerts.md)                       |
| Raised by       | Daniel Okafor (`ops@metris.energy`) — internal                                          |
| Reported        | 2026-07-29 10:42 UTC                                                                    |
| Severity        | Medium — noise and lost trust in the alert channel, no data loss                        |
| Status          | **Diagnosed** · symptom contained, cause needs a design decision                        |
| Root cause in   | **Configuration** — replicas added to a scheduler that cannot divide or coordinate work |
| Affects         | Every scheduled job since 2026-07-22; only `alert-scan` causes visible harm             |
| Investigated by | Guilherme Duarte Giesbrecht                                                             |
| Report date     | 2026-09-13 · last updated 2026-09-14                                                    |

---

## Summary

The worker pool was scaled from one replica to two on **2026-07-22 15:40 UTC**.
The scheduler keeps its timing in memory and nothing coordinates instances, so
both replicas run every job. `alert-scan` deduplicates by reading `alerts` and
then inserting, with no transaction and nothing in the schema behind it, so two
concurrent scans both saw no open alert and both raised one.

The scale-out was intended to add capacity "ahead of Q3 onboarding batch". It
added none: measured below, each replica processes the entire workload rather
than half of it, so cycle time is unchanged and vendor API consumption doubled.

**This report ships containment, not a cure.** A unique index stops duplicate
alerts reaching customers. Removing the duplicated _execution_ requires a
change to how jobs are scheduled: the database can enforce single execution,
but only against an identity both schedulers derive identically, and the
scheduler does not currently produce one. What that identity would have to be,
and the designs that follow from it, are set out below.

**The alert itself is correct.** School Bristol's Inverter 2 stopped reporting
at 2026-07-28 06:12:44 UTC and is still silent. The defect is that there are
two of them, so the answer to Daniel's question is _resolve one, keep one_.

---

## What was reported

Northgate received two identical "inverter offline" emails on 28 July, and the
console lists the same alert twice, both open:

```
 id | site           | asset      | type          | status |      triggered_at
  6 | school-bristol | Inverter 2 | asset_offline | open   | 2026-07-28 12:15:09+00
  7 | school-bristol | Inverter 2 | asset_offline | open   | 2026-07-28 12:15:10+00
```

Both carry a byte-identical message:

> No data received from Inverter 2 (School Bristol) for more than 6 hours.
> Last seen 2026-07-28T06:12:44Z.

The report describes the emails as three seconds apart; the database shows one
second between the two `triggered_at` values. The difference is delivery jitter
and does not change the diagnosis — noted so the evidence does not look like it
contradicts the account.

Daniel's second observation, doubled entries in recent job history, is the same
cause seen one layer up.

---

## What actually happened

### Timeline

| When (UTC)            | Event                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| 2026-07-22 15:40:12   | `ops@metris.energy` scales the worker pool 1 → 2 replicas                |
| 2026-07-23 onwards    | Every scheduled job run appears twice, from two hostnames                |
| 2026-07-28 06:12:44   | School Bristol Inverter 2 stops reporting                                |
| 2026-07-28 12:15:06.8 | `worker-6b9f4d` starts `alert-scan`                                      |
| 2026-07-28 12:15:07.1 | `worker-7c2a1e` starts the same run — while the first is still executing |
| 2026-07-28 12:15:09.6 | `worker-6b9f4d` raises the alert (id 6)                                  |
| 2026-07-28 12:15:10.2 | `worker-7c2a1e` raises it again (id 7)                                   |
| 2026-07-29 10:42      | Ticket raised                                                            |

### The infrastructure change

```
2026-07-22 15:40:12 | user | ops@metris.energy | worker.replicas.updated
  infrastructure / worker-pool
  before: {"replicas": 1}  →  after: {"replicas": 2}
  "Scale out worker pool ahead of Q3 onboarding batch."
```

Nothing in the repository declared the worker's concurrency model — no comment,
no README note, no setting in `docker-compose.yml`. There was no way for whoever
scaled it to know the scheduler holds its state in memory.

### Why both replicas run everything

`apps/api/src/workers/index.js` derives each job's next run from the shared
`jobs` table at boot and then keeps the schedule in memory:

```js
let nextDueAt = new Date(lastCompleted.scheduled_for).getTime() + definition.intervalMs;
```

There is no lease, no claim and no lock — nothing that lets one replica take a
run and another stand down. A search of the worker for any coordination
primitive returns nothing.

### Why alert-scan turns that into a duplicate alert

`apps/api/src/workers/jobs/alertScan.js`:

```js
const existing = await db('alerts')
  .where({ asset_id, type: ALERT_TYPES.ASSET_OFFLINE, status: 'open' }).first();
if (existing) continue;
await db('alerts').insert({ ... });
```

The `SELECT` and the `INSERT` are two separate round trips. The runs overlapped
by roughly 2.8 seconds, so both read "no open alert" and both inserted.

Worth stating because it is a common assumption: wrapping those two statements
in a transaction would not have helped. Under `READ COMMITTED` both transactions
still see an empty result, because a `SELECT` cannot lock a row that does not
exist yet. Only a unique constraint, `SERIALIZABLE`, an explicit lock, or not
running twice will prevent it.

---

## Evidence

### Two runs, one schedule slot, both claiming to have raised one alert

```
 27 | worker-6b9f4d | 12:15:00 | 12:15:06.812 | 12:15:09.930 | completed | {"alerts_raised":1,"assets_evaluated":20}
 28 | worker-7c2a1e | 12:15:00 | 12:15:07.104 | 12:15:10.418 | completed | {"alerts_raised":1,"assets_evaluated":20}
```

Both logged the same action, and neither failed or retried:

```
 27 | worker-6b9f4d | 12:15:09.612 | Raised asset_offline alert for asset SUN40-77412 (School Bristol / Inverter 2)
 28 | worker-7c2a1e | 12:15:10.204 | Raised asset_offline alert for asset SUN40-77412 (School Bristol / Inverter 2)
```

### The second replica repeats the work rather than sharing it

```
 job                   | hostname      | duration |        metadata
 refresh-kpi-views     | worker-6b9f4d |    2.30s | {"view":"mv_site_daily_kpis"}
 refresh-kpi-views     | worker-7c2a1e |    1.90s | {"view":"mv_site_daily_kpis"}
 connector-status-poll | worker-6b9f4d |    9.60s | {"connectors": 20}
 connector-status-poll | worker-7c2a1e |   10.37s | {"connectors": 20}
 alert-scan            | worker-6b9f4d |    3.12s | {"alerts_raised":1,"assets_evaluated":20}
 alert-scan            | worker-7c2a1e |    3.31s | {"alerts_raised":1,"assets_evaluated":20}
```

Each replica evaluated all 20 assets and polled all 20 connectors. If work were
being divided, each would have handled roughly half.

|                              | 1 replica | 2 replicas       |
| ---------------------------- | --------- | ---------------- |
| Wall-clock time per cycle    | ~10s      | ~10s (no change) |
| Vendor status API calls      | 20        | **40**           |
| Rollup refreshes             | 1         | 2                |
| Alerts raised per real fault | 1         | **2**            |

### Deduplication worked before the scale-out

| Period                  | Alerts | Distinct events | Ratio   |
| ----------------------- | ------ | --------------- | ------- |
| Before 2026-07-22 15:40 | 4      | 4               | **1:1** |
| After                   | 2      | 1               | **2:1** |

The four earlier alerts (15 Jun, 22 Jun, 6 Jul, 11 Jul) were each raised once.
The first alert raised after the scale-out was duplicated. The deduplication
logic is not broken — it is correct for exactly one instance.

### The underlying fault is real and still open

```
 asset           | vendor       | last_seen_at           | sync_state
 Inverter 1      | fusionsolar  | 2026-07-29 20:14:31+00 | ok
 Inverter 2      | fusionsolar  | 2026-07-28 06:12:44+00 | error      ← silent 38+ hours
 Main Meter      | modbus       | 2026-07-29 20:14:31+00 | ok
 Weather Station | meteocontrol | 2026-07-29 20:14:31+00 | ok
```

Closing both alerts would hide a live fault.

### Related: TICKET-4830

School Bristol has two inverters and one has been silent since the morning of
**28 July** — the same day Northgate reported generation dropping by about 40%.
Per-inverter generation confirms it: Inverter 1 held steady at 328.00 then
327.75 kWh across the two days while Inverter 2 disappeared, and the site total
fell 40.03%. Worked separately under that ticket.

---

## Job runs have no identity the replicas share

Enforcing single execution in the database is a sound approach, and the shape
of it is a unique key over the identity of a scheduled run — the job and the
occasion it was due — with an `INSERT ... ON CONFLICT DO NOTHING` so the row
that records a run is also the lock that grants it. Whichever replica inserts
first executes; the others find the occasion taken and stand down.

That requires the two values to be **computed identically by every scheduler**.
`jobs (name, scheduled_for)` reads like that pair, and is not one.
`scheduled_for` is `Math.min(dueAt, Date.now())`, and after each run the
scheduler sets `nextDueAt = Date.now() + intervalMs`, re-anchoring to the clock
of whichever process just executed. The value is therefore a function of that
worker's own execution timing, not of the schedule. Two replicas agree on it
only while both derive it from the same `lastCompleted` row — at boot and
during catch-up — and diverge permanently after their first run.

Measured locally on 2026-09-13, against this repository's compose stack with
two workers and the interval shortened to one minute. The timestamps below come
from that run, not from the July production history:

```
 minute | executions | workers | distinct scheduled_for
 17:23  |     2      |    2    |          2
 17:24  |     2      |    2    |          2
 17:25  |     2      |    2    |          2
 17:26  |     2      |    2    |          2
 17:27  |     2      |    2    |          2
 17:28  |     2      |    2    |          2
```

Twelve executions for six cycles' worth of work, and twelve distinct
`scheduled_for` values. The two replicas shared an occasion exactly twice, both
during catch-up, where the value still came from the historical row rather than
from their own clocks:

```
 worker-0d5514 | 17:20:26 | skipped — run 2026-07-31T02:05:00.000Z claimed by another worker
 worker-e50adf | 17:22:54 | skipped — run 2026-07-31T02:06:00.000Z claimed by another worker
```

Once past catch-up, the values differ by milliseconds and never repeat:

```
 63 | worker-b2ccb0 | 2026-09-13 17:23:54.772
 64 | worker-e50adf | 2026-09-13 17:23:54.829     ← 57 ms apart, different occasion
 65 | worker-b2ccb0 | 2026-09-13 17:24:54.813
 66 | worker-e50adf | 2026-09-13 17:24:54.855     ← 42 ms apart
```

A unique key added on this pair today would be inert: correct as a constraint,
with nothing ever colliding against it, while the duplication continued
unchanged. The missing piece is upstream of the constraint — job runs need an
identity that depends on the schedule rather than on when a particular process
happened to execute, which means deriving the due time from a shared grid
(`floor(now / interval) * interval`) instead of from each worker's clock.

With that in place the unique key becomes viable, and so does every option in
the next section: they all need the same identity.

---

## Impact

- **Customer-visible:** Northgate received two identical emails and sees the
  alert twice. Noise, not data loss.
- **Trust:** duplicate alerts erode confidence in a channel that pages the
  on-call rota in production.
- **Operational:** since 2026-07-22 every job has run twice — double the calls
  to vendor status APIs, with the rate-limit exposure that implies, and double
  the rollup refresh work, for no reduction in cycle time.
- **Scaling:** the problem grows linearly with replicas. At three, alerts would
  arrive in triplicate.
- **Latent risk beyond this symptom:** any future job with a non-idempotent
  side effect will duplicate silently. `alert-scan` is only the first one to
  have been noticed.
- **Not affected:** generation, revenue, contract and reading data.

Only one of the three jobs causes harm when duplicated:

| Job                     | Side effect                                 | Duplication harmful?                                           |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `connector-status-poll` | `UPDATE connector_assets` with vendor state | No — idempotent. Costs twice the vendor API calls              |
| `refresh-kpi-views`     | `REFRESH ... CONCURRENTLY`                  | No — PostgreSQL serialises it on a lock. Costs duplicated work |
| `alert-scan`            | **`INSERT` into `alerts`**                  | **Yes** — the only job with a non-idempotent side effect       |

---

## What to do about the two open alerts

Daniel's direct question. **Resolve the later one, keep the earlier one open.**

- **Keep id 6** (`triggered_at 12:15:09`). It is the alert Northgate was
  notified about first, and its timestamp is the one that reflects the fault.
- **Resolve id 7** as a duplicate, with an audit entry explaining why it closed
  without anyone acting on it.
- **Do not resolve both.** Inverter 2 is still offline; the alert has to stay
  open until the asset is back or the fault is formally acknowledged.
- **Raise the underlying fault with field operations.** An inverter has been
  down for over a day and the alert did its job.

The deduplication runs automatically as part of the migration below, keeping
the earliest alert of each group, so no manual cleanup is required.

---

## What ships with this change

### 1 — Return the worker pool to a single replica

The immediate action, and it belongs to infrastructure rather than to this
repository: `docker-compose.yml` declares one worker and has no replica
setting, so the scale-out was applied outside version control. Reverting it
stops the duplication today, at the cost of returning the worker to a single
point of failure — which is what it was until 22 July, and which is a smaller
problem than paying twice for every job while alerting customers twice.

The scheduler and the compose service now say this in place, so the constraint
is visible where the next person will be standing when they consider scaling
it again.

### 2 — Enforce one open alert per asset and type

`packages/db/migrations/20260730094000_unique_open_alert_per_asset.js`

```sql
CREATE UNIQUE INDEX alerts_open_asset_type_uq
ON alerts (asset_id, type)
WHERE status = 'open';
```

**This contains the symptom. It is not a fix for the duplicated execution** —
both replicas still scan every asset and still make twice the vendor API calls.
What it does is stop the duplicate ever reaching a customer, and it does so
independently of how the schedulers behave: two runs milliseconds apart or
seconds apart, the second insert is rejected either way. That is exactly the
property the run claim lacked.

It also outlives whatever the scheduler becomes. Every architecture in the next
section delivers at-least-once, so the invariant has to live in the database in
any of them.

The migration resolves pre-existing duplicates before creating the index,
keeping the earliest of each group and recording each resolution in
`audit_logs`; the index cannot be created while duplicates exist, which makes
the cleanup a precondition rather than an independent data fix. `alertScan`
then tolerates the conflict instead of raising a unique violation that would
fail the job and abort the scan before the remaining assets were evaluated.

Site-level alerts are unaffected: `asset_id IS NULL` rows do not collide,
because NULLs are distinct in a unique index.

Verified against the reproduction database inside a rolled-back transaction:
deduplication resolved id 7 and left id 6 open; the index created; a duplicate
insert returned zero rows without raising; a different alert type on the same
asset was still accepted; two site-level alerts with no asset still coexisted.
`npm run lint` and `npm test` (15 tests) pass.

---

## What would actually fix it

Every option below rests on the same requirement as the unique key above:
**an identity for a scheduled run that every scheduler computes identically.**
The current scheduler derives its due time from each process's own clock, so
that has to change first — quantising onto a shared grid rather than
`Date.now() + interval` — whichever design is chosen.

| Option                                                                                                                                                        | What it solves                                                        | What it costs                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **One instance**                                                                                                                                              | Duplication. Nothing else                                             | No code. No failover                                                                          |
| **Leader election** — `pg_advisory_lock` per job name; the holder schedules, the others stand by and take over if it dies                                     | Duplication, with failover                                            | A few lines, no new infrastructure. Still one worker doing all the work                       |
| **PostgreSQL as a work queue** — a scheduler enqueues work items with a unique key on `(job, slot)`; executors claim with `SELECT ... FOR UPDATE SKIP LOCKED` | Duplication and distribution                                          | No new infrastructure, adequate at this volume. Two components to reason about instead of one |
| **SQS FIFO + executors**                                                                                                                                      | Duplication and distribution, with retry, DLQ and visibility built in | Another system to operate and pay for                                                         |

The detail behind the table is in a separate note,
[Scheduler design options for the worker pool](notes/TICKET-4847-scheduler-design-options.md):
the SQS shape in particular — group and deduplication keys, polling, visibility
timeout, at-least-once delivery — and why a queue only distributes load when it
carries units of work rather than jobs. Which option to pick is a design
decision rather than an incident action.

**More replicas will not relieve Q3.** The scale-out was justified as capacity
for the onboarding batch and, as measured above, provided none: adding replicas
increases cost in proportion to the replica count and capacity by zero, because
no job partitions its work. What adds capacity is concurrency inside the jobs
first — `connector-status-poll` issues its 20 HTTP calls one after another,
roughly 10 s a cycle that a bounded `Promise.all` brings to about 2 s — and
distribution across processes only once that is exhausted. The note sets out
both.

---

## Preventing recurrence

| Priority | Action                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P1**   | Return the worker pool to one replica                                                                                                                                          |
| **P1**   | Alert on duplicated job runs — two rows for one job in one window is always a defect and went unnoticed for six days. Pairs with the failed-job alerting raised in TICKET-4821 |
| **P1**   | Decide the scheduling architecture from the options above, starting with anchoring the due time to a shared grid, which all of them need                                       |
| **P2**   | Parallelise `connector-status-poll` and collapse `alert-scan`'s per-connector query — the real answer to Q3 capacity                                                           |
| **P2**   | Make worker replica count a reviewed change; the in-code notes added here are a start, not a substitute for a deployment checklist                                             |

---

## What to tell the team

> Daniel — the duplicate is real and the cause is the worker scale-out on 22
> July. The scheduler keeps its timing in memory and nothing coordinates the
> replicas, so both run every job. `alert-scan` checks for an existing open
> alert and then inserts, with nothing in the database enforcing it, so both
> runs saw no alert and both created one. That is also what you spotted in the
> job history — every run since the 22nd is doubled.
>
> On the two open alerts: **resolve id 7, keep id 6 open.** Inverter 2 at
> School Bristol has been silent since 06:12 on the 28th and still is, so the
> alert is correct — there is just one too many of it. The migration
> deduplicates automatically and keeps the earliest.
>
> Worth telling Northgate the second email was ours, not a second fault, and
> that the inverter itself needs attention. That inverter is also the answer to
> TICKET-4830 — the site has two, one stopped reporting on the morning of the
> 28th, and the total fell by exactly its share.
>
> What I have shipped stops duplicate alerts reaching customers. It does not
> stop the duplicated work, and I would rather say so than pretend otherwise.
> The natural place to stop it is a unique key on the job run, so only one
> replica can take each occasion — but `scheduled_for` is derived from each
> worker's own execution timing rather than from the schedule, so the two
> never produce the same value once they are past catch-up. I confirmed that
> with two workers running: twelve executions across six cycles, twelve
> distinct values. The constraint has to wait until job runs have an identity
> the replicas share.
>
> Please take the pool back to one replica now. It was a single point of
> failure until 22 July and that is the smaller problem. Then we should pick a
> scheduling design properly — I have written up leader election, a Postgres
> work queue and SQS FIFO with the trade-offs.
>
> One thing worth raising with whoever approved the scale-out: it did not add
> any capacity. Both replicas process all 20 assets and all 20 connectors every
> cycle, so cycle time is unchanged and we are making 40 vendor API calls
> instead of 20. For the Q3 batch the thing that actually helps is running the
> connector poll's HTTP calls concurrently instead of one after another, which
> takes it from about 10 seconds to about 2.

---

## Appendix — reproduction

```sql
-- the duplicate pair
SELECT id, asset_id, type, status, triggered_at FROM alerts WHERE status = 'open';

-- the two runs that produced it
SELECT id, hostname, started_at, finished_at, metadata
FROM jobs WHERE name = 'alert-scan' AND scheduled_for = '2026-07-28 12:15:00+00';

-- every job run in the retained production history is doubled
SELECT name, scheduled_for, COUNT(*), string_agg(DISTINCT hostname, ', ')
FROM jobs WHERE hostname IN ('worker-6b9f4d', 'worker-7c2a1e')
GROUP BY 1, 2 HAVING COUNT(*) > 1;
```

Reproducing the duplication live: shorten the job intervals, then
`docker compose up -d --build --scale worker=2` — the service declares no
`container_name` and no ports, so it scales without further changes. Use
`refresh-kpi-views`, which is idempotent and needs no credentials;
`alert-scan` would raise 19 alerts against this dataset, because the fixture
heartbeats are months old relative to the current clock.

> When reading `jobs` in a local environment, filter by the production
> hostnames — a worker running locally writes its own rows to the same table
> and inflates the counts.
