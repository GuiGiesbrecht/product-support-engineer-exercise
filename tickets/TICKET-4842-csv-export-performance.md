# TICKET-4842 · CSV export slow / timing out on larger ranges (internal)

|           |                                         |
| --------- | --------------------------------------- |
| Priority  | Medium                                  |
| Status    | Open                                    |
| Raised by | Sofia Marchetti (support@metris.energy) |
| Opened    | 2026-07-29 09:05 UTC                    |
| Channel   | Internal                                |

---

The CSV export has become painful for anything beyond a few weeks of data. In
production yesterday, Brighton Retail Park for April–July took **13.8s**, and
twice this week I've had a straight 500 back (`canceling statement due to
statement timeout`). Two customers doing their Q2 true-up have hit the same
thing. Small ranges are fine.

APM captured this for one of the slow ones (production, 2026-07-29 08:47 UTC):

```
duration: 12266.401 ms
Query Text: SELECT a.site_id, p.reading_date AS day, SUM(p.production_kwh) AS production_kwh
            FROM productions p JOIN assets a ON a.id = p.asset_id
            WHERE a.site_id = ANY($1) AND p.reading_date BETWEEN $2 AND $3
            GROUP BY a.site_id, p.reading_date
HashAggregate  (cost=214788.10..214795.31 rows=721 width=44) (actual time=12228.940..12241.083 rows=121 loops=1)
  Group Key: a.site_id, p.reading_date
  ->  Hash Join  (cost=124.85..196742.55 rows=118455 width=18) (actual time=1.213..10904.406 rows=118221 loops=1)
        Hash Cond: (p.asset_id = a.id)
        ->  Seq Scan on productions p  (cost=0.00..165563.24 rows=2412847 width=18) (actual time=0.011..9426.771 rows=2404918 loops=1)
              Filter: ((reading_date >= '2026-04-01'::date) AND (reading_date <= '2026-07-29'::date))
              Rows Removed by Filter: 7929
        ->  Hash  (cost=84.60..84.60 rows=3220 width=8) (actual time=1.132..1.133 rows=3220 loops=1)
              ->  Seq Scan on assets a  (cost=0.00..84.60 rows=3220 width=8) (actual time=0.008..0.590 rows=3220 loops=1)
Planning Time: 0.412 ms
Execution Time: 12241.702 ms
```

`productions` is ~2.4M rows in production and growing. Can platform take a
look before month-end reporting kicks off properly?
