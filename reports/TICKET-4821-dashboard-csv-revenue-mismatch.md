# TICKET-4821 · Dashboard revenue does not match CSV export

|                    |                                                                       |
| ------------------ | --------------------------------------------------------------------- |
| Customer           | Albion Logistics Ltd (reported by Priya Nair)                          |
| Reported           | 2026-07-29 14:36 UTC                                                   |
| Severity           | High — figures are used for invoicing                                  |
| Status             | **Fixed** · index restored, rollup refreshed, both surfaces verified   |
| Root cause in      | **Code** — a schema migration, compounded by a monitoring gap          |
| Affects            | **All customers**, not just the reporter                               |
| Impact window      | 2026-07-27 onwards, and widening daily                                 |

---

## Summary

**The CSV is right. £4,087.00 is Albion's July revenue.** The dashboard is
showing £4,321.00 because the pre-aggregated rollup behind it stopped updating
on 2026-07-27.

The 2026-07-27 release recreated the `mv_site_daily_kpis` materialized view to
add a savings column. The `DROP` also removed the view's unique index, and the
`CREATE` never restored it. `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a
unique index, so the nightly `refresh-kpi-views` job has failed on every run
since. The dashboard has been serving a frozen snapshot ever since, while the
Revenue page, Site Overview and the CSV export — which compute from the
readings tables at request time — kept moving.

This is not a calculation bug. Both query paths are equivalent; only one of
them stopped being fed.

---

## What the customer saw

Reproduced exactly, signed in as `finance@albionlogistics.co.uk`, both
surfaces reporting the same window (`2026-07-01` → `2026-07-29`):

| Surface                             | Revenue       | Production     | Savings    |
| ----------------------------------- | ------------- | -------------- | ---------- |
| Dashboard (GraphQL `dashboard`)     | **£4,321.00** | 54,012.50 kWh  | £4,844.96  |
| CSV export (`TOTAL` row)            | **£4,087.00** | 51,087.50 kWh  | £5,380.00  |
| Revenue page (GraphQL `revenueByDay`) | £4,087.00   | 51,087.50 kWh  | —          |

The gap is £234.00 in revenue and 2,925.00 kWh in production. At London
Warehouse's PPA rate of £0.08/kWh, `2,925.00 × 0.08 = £234.00` — the entire
revenue gap is explained by the production gap. Tariffs, rounding and the
reporting window are identical on both sides.

---

## What actually happened

### Timeline

| When (UTC)        | Event                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| 2026-07-27 02:00  | Last successful `refresh-kpi-views` run                                                        |
| 2026-07-27 ~05:31 | Release deploys `20260727053100_recreate_mv_site_daily_kpis.js` — view recreated **without its unique index** |
| 2026-07-27 13:47  | SolarEdge corrective re-sync retracts 10 production payloads (8,175.00 kWh, 20–24 July) from London Warehouse |
| 2026-07-27 13:52  | Gateway `SE-GW-2201` firmware updated 2.4.1 → 2.4.2                                            |
| 2026-07-28 02:00  | `refresh-kpi-views` fails for the first time                                                   |
| 2026-07-29 02:00  | Fails again                                                                                     |
| 2026-07-29 14:36  | Ticket raised                                                                                   |

### The defect

`20260302091500_create_mv_site_daily_kpis.js` created the view **and** the
index:

```sql
CREATE UNIQUE INDEX mv_site_daily_kpis_site_day_uq
ON mv_site_daily_kpis (site_id, day)
```

`20260727053100_recreate_mv_site_daily_kpis.js` added `savings_gbp` with
`DROP MATERIALIZED VIEW IF EXISTS` followed by `CREATE MATERIALIZED VIEW`. The
`DROP` took the index with it and the migration never recreated it.

`refreshKpiViews` refreshes with `CONCURRENTLY`
(`apps/api/src/workers/jobs/refreshKpiViews.js:12`), which PostgreSQL rejects
on a view with no unique index. The job broke on its first run after the
release and has failed identically since.

The rollup is therefore frozen at the state materialised by that deploy's
`CREATE ... WITH DATA` — which is **before** the vendor retraction later the
same day, and before the 27–29 July readings existed.

---

## Evidence

### The rollup stops at 2026-07-26

```sql
SELECT MIN(mv.day), MAX(mv.day), COUNT(*), SUM(mv.production_kwh), SUM(mv.revenue_gbp)
FROM mv_site_daily_kpis mv JOIN sites s ON s.id = mv.site_id
WHERE s.slug = 'london-warehouse' AND mv.day BETWEEN '2026-07-01' AND '2026-07-29';
```

```
 first      | last       | days | production | revenue
 2026-07-01 | 2026-07-26 |   26 |  54012.50  | 4321.00
```

26 days instead of 29 — and £4,321.00, the exact figure on the dashboard.

### The job has been failing since 2026-07-28

```sql
SELECT scheduled_for, status, error FROM jobs
WHERE name = 'refresh-kpi-views' ORDER BY scheduled_for;
```

```
 2026-07-27 02:00:00+00 | completed |
 2026-07-28 02:00:00+00 | failed    | cannot refresh materialized view "public.mv_site_daily_kpis" concurrently
 2026-07-29 02:00:00+00 | failed    | cannot refresh materialized view "public.mv_site_daily_kpis" concurrently
```

### The view has no index

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'mv_site_daily_kpis';
-- (0 rows)
```

### The arithmetic reconciles exactly

Two things happened after the last good refresh.

**Ten production readings were retracted** by the vendor re-sync, all from
London Warehouse, all dated 20–24 July. They were deleted from `productions`
but remain inside the frozen snapshot:

```sql
SELECT SUM((before->>'production_kwh')::numeric) FROM audit_logs
WHERE action = 'production.reading.deleted';
-- 8175.00
```

**Three days of readings arrived** that the snapshot never saw:

```
 2026-07-27 | 1842.50
 2026-07-28 | 1701.25
 2026-07-29 | 1706.25   → 5250.00 kWh
```

```
  54,012.50 kWh   frozen snapshot
 −  8,175.00 kWh  retracted by the vendor
 +  5,250.00 kWh  27–29 July
 ───────────────
   51,087.50 kWh  live query / CSV        ✓

  at £0.08/kWh:  −£654.00 + £420.00 = −£234.00
  £4,321.00 − £234.00 = £4,087.00                ✓
```

### Both query paths are equivalent

Running the view's own definition as an ordinary query — without touching the
view — returns `revenue 4087.00 / savings 5380.00` for London Warehouse,
identical to the CSV. There is no logic divergence between
`kpiService.getDashboard` and `reportingService.siteDailyKpis`. The only
difference is staleness.

### The fix was verified on a throwaway clone

A copy of the view was created in the same database, refreshed concurrently
without an index, indexed, and refreshed again, then dropped:

```
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fixcheck;
ERROR:  cannot refresh materialized view "public.mv_fixcheck" concurrently
HINT:   Create a unique index with no WHERE clause on one or more columns of
        the materialized view.

CREATE UNIQUE INDEX mv_fixcheck_site_day_uq ON mv_fixcheck (site_id, day);
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fixcheck;
-- REFRESH MATERIALIZED VIEW
```

The production rollup was not modified during this check.

### Why nobody noticed for two days

`runJob` catches the exception, writes it to `jobs.error` and returns
(`apps/api/src/workers/lib/jobRunner.js:28`). Because the error never
propagates, **Sentry never saw it** — none of the exported issues mention the
refresh. A job feeding invoiced figures stayed broken for two days, recorded
only in a table nobody was watching.

---

## Impact

Every customer's dashboard has been wrong since 2026-07-27 — Albion only
noticed because their error happens to point upward.

| Customer                  | Dashboard   | Correct     | Error       |
| ------------------------- | ----------- | ----------- | ----------- |
| Albion Logistics Ltd      | £4,321.00   | £4,087.00   | **+£234.00** |
| Northgate Education Trust | £1,629.09   | £1,773.78   | −£144.69    |
| Pennine Group plc         | £5,325.03   | £5,932.46   | −£607.43    |
| **Portfolio**             | £11,275.12  | £11,793.24  | **−£518.12** |

- Only the **Dashboard** is affected. Revenue, Site Overview and the CSV export
  have been correct throughout.
- The error **grows by one day of generation every day** the job stays broken.
- **Invoicing risk:** the reporter states they invoice against these figures.
  Anyone who billed from the dashboard since 2026-07-27 overbilled Albion and
  underbilled Northgate and Pennine.
- `factory-manchester` reads £0.00 on **both** paths. That is a separate
  defect, tracked under TICKET-4835, and is not caused by this issue.

---

## Immediate remediation

**1 — Restore the index.** Supplied as a migration:

`packages/db/migrations/20260730090000_restore_mv_site_daily_kpis_unique_index.js`

```js
exports.up = async (knex) => {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS mv_site_daily_kpis_site_day_uq
    ON mv_site_daily_kpis (site_id, day)
  `);
};
```

**2 — Refresh the rollup.** The index unblocks future refreshes but does not
update the data. `refresh-kpi-views` retries an hour after a failure, so it
recovers on its own; to correct the dashboard immediately:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_site_daily_kpis;
```

Kept out of the migration deliberately: a schema change and a data rebuild
should be able to fail, be reviewed and be rolled back independently.

**3 — Verify.** After the refresh, the dashboard and the CSV must both report
£4,087.00 for Albion in July, and `MAX(day)` in the rollup must equal
`MAX(reading_date)` in `productions`.

### Verification (completed)

The migration was applied and the rollup refreshed. `refresh-kpi-views`
completed on its next run, after failing on every run since 2026-07-28:

```
 2026-07-28 02:00:00+00 | failed    | cannot refresh materialized view ... concurrently
 2026-07-28 02:00:00+00 | completed |                        ← after the fix
```

Every site now reconciles, and the rollup reaches the latest reading date:

```
 slug                 | rollup up to | dashboard | live    | delta
 brighton-retail-park | 2026-07-29   |   3070.74 | 3070.74 |  0.00
 factory-manchester   | 2026-07-29   |      0.00 |    0.00 |  0.00
 glasgow-cold-storage | 2026-07-29   |   1415.40 | 1415.40 |  0.00
 leeds-depot          | 2026-07-29   |   1446.32 | 1446.32 |  0.00
 london-warehouse     | 2026-07-29   |   4087.00 | 4087.00 |  0.00
 school-bristol       | 2026-07-29   |   1773.78 | 1773.78 |  0.00
```

Confirmed through the API as well — the dashboard now returns
`revenueGbp: 4087`, `productionKwh: 51087.5`, `savingsGbp: 5380` for Albion,
identical to the CSV `TOTAL` row.

`factory-manchester` still reads £0.00 on both paths. That is TICKET-4835 and
is unrelated to this defect.

---

## Preventing recurrence

| Priority | Action                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | **Alert on failed jobs.** `jobs.status = 'failed'` is already recorded and nothing consumes it. A revenue-critical job failed silently twice. This gap, not the missing index, is why the customer found the bug before we did. |
| **P1**   | Have `refresh-kpi-views` report failures to Sentry as well as to `jobs` — `runJob` currently swallows them, so the error is invisible to alerting.                  |
| **P2**   | Add a startup or CI check asserting that every materialized view refreshed with `CONCURRENTLY` has a unique index. This class of defect is silent by construction.  |
| **P2**   | Treat "recreate a materialized view" as a reviewed pattern: any migration that drops a view must recreate its indexes in the same migration.                        |
| **P3**   | Surface rollup freshness in the console — a dashboard reading a snapshot should say how old that snapshot is. The customer had no way to tell.                      |

Deliberately **not** changed: the dual read path (rollup for the dashboard,
live queries elsewhere) is a sound design for the traffic profile, and falling
back to a non-concurrent refresh would have hidden the failure instead of
fixing it.

---

## What to tell the customer

> Hi Priya,
>
> The CSV is the correct figure — **£4,087.00 for July**. Please invoice
> against that.
>
> The dashboard was showing £4,321.00 because the pre-aggregated table behind
> it stopped updating on 27 July, following a release that day. It was still
> showing figures from before two changes: your gateway vendor retracted ten
> readings from 20–24 July as part of a corrective re-sync, and three more days
> of generation have been recorded since. The Revenue page and the CSV export
> calculate from the readings directly, so they were never affected.
>
> We have identified the cause and have a fix ready. Once it is deployed the
> dashboard will match the export. We will confirm when that is done.
>
> This affected all customer dashboards, not only yours, and we are adding
> monitoring so a failure like this is caught by us rather than by you. Sorry
> for the trouble it caused before month end.

---

## Appendix — reproduction

```bash
TOKEN=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"finance@albionlogistics.co.uk","password":"SolarDemo!2026"}' | jq -r .token)

# Dashboard — reads the rollup
curl -s localhost:4000/graphql -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ dashboard { periodStart periodEnd revenueGbp productionKwh } }"}'

# CSV — computes live
curl -s -H "Authorization: Bearer $TOKEN" \
  "localhost:4000/export/csv?from=2026-07-01&to=2026-07-29" | tail -1
```
