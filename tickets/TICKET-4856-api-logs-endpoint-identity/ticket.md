# TICKET-4856 · API request log does not identify which endpoint was called (internal)

|           |                                         |
| --------- | --------------------------------------- |
| Priority  | Medium                                  |
| Status    | Open                                    |
| Raised by | Sofia Marchetti (support@metris.energy) |
| Opened    | 2026-07-29 17:05 UTC                    |
| Channel   | Internal                                |

---

Working through this week's tickets I kept going back to `api_logs` to answer
"how often did this happen", and I can't tell the requests apart.

Every GraphQL request is logged with path `/` — dashboard, revenue, site
overview, alerts, all in one bucket. Logins come through as `/login` and
exports as `/csv`. The `operation_name` column is empty on everything from this
week.

What's confusing is that older rows look fine: there are rows with `/graphql`
and `SiteOverview` in them, plus `/export/csv` and `/auth/login`. So either
something changed recently, or those rows came from somewhere else.

The practical problem is that I can't answer basic questions — how many times
an endpoint failed today, or whether the dashboard query is slower than the
revenue one. It came up on 4852 as well: we wanted to know how often staff had
hit the export error before anyone raised it, and there was nothing to count.

No customer impact that I can see. This is our own visibility.
