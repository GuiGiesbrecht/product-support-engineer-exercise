# TICKET-4852 · CSV export fails for "All sites" on staff accounts

|                 |                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Ticket          | [TICKET-4852](../tickets/TICKET-4852-csv-export-all-sites/ticket.md)                                              |
| Raised by       | Daniel Okafor (`ops@metris.energy`) — internal                                                                    |
| Reported        | 2026-07-29 09:20 UTC                                                                                              |
| Severity        | Medium — staff cannot export a portfolio; no customer impact                                                      |
| Status          | **Fixed** · the export now follows the customer switcher — verified in the reproduction environment, not deployed |
| Root cause in   | **Code** — the export took its scope from the account instead of from the selection                               |
| Affects         | All three staff accounts, on every customer; customer accounts unaffected                                         |
| Impact window   | Since the endpoint was written                                                                                    |
| Investigated by | Guilherme Duarte Giesbrecht                                                                                       |
| Report date     | 2026-09-13 · last updated 2026-09-14                                                                              |

---

## Summary

**The export endpoint had no notion of a customer.** Asked for every site, it
read the scope off `req.user.customer_id` — and a staff account is precisely
the account where that column is `null` (`isStaff`,
`apps/api/src/lib/auth.js:38`). There was no customer to scope to, so a guard
returned `400 Staff exports must specify a site` rather than run a query that
could not have matched anything.

The customer Daniel picks in the switcher never reached the request. Every
GraphQL query carries that selection; `downloadCsv` built its query string
from `site`, `from` and `to` only. The export page reads the selection to fill
its own site dropdown and then drops it on the way out.

The 400 was therefore not the defect but a guard standing in front of one, and
the console rendered it as `Export failed` — which is why it read as a broken
export rather than a missing parameter.

Customer accounts were never affected. Their scope comes from their own
record, which has a customer in it.

---

## What was reported

Reproduced exactly as described, both surfaces on the same window
(`2026-07-01` → `2026-07-29`):

| Signed in as                | Site dropdown | Result                                       |
| --------------------------- | ------------- | -------------------------------------------- |
| `ops@metris.energy`         | **All sites** | **400** `Staff exports must specify a site`  |
| `ops@metris.energy`         | Leeds Depot   | 200 · `metris-export-leeds-depot-….csv`      |
| `energy@penninegroup.co.uk` | **All sites** | 200 · four sites, `metris-export-portfolio-` |

Daniel's reading of it was right on every point: it fails for any customer he
switches to, a single site always works, and Rachel at Pennine pulling her own
all-sites export was never affected.

---

## What actually happened

### The defect

`apps/api/src/routes/export.js` had two branches. With a `site` slug it
resolved that site and exported it. Without one it did this:

```js
const rows = await db('sites').where({ customer_id: req.user.customer_id }).select('id');
```

`req.user.customer_id` is the column that defines staff: `isStaff(user)`
returns `user.customer_id === null` (`apps/api/src/lib/auth.js:38`), and all
three staff rows in the fixtures have `customer_key: null`. The branch
described as "every site the caller can see" only works for an account that
belongs to one customer.

### Why the guard was right to be there

`sites.customer_id` is `notNullable`
(`packages/db/migrations/20250903101600_create_sites.js:4`), so the query
above would have matched no rows for a staff account. `buildCsv` does not
treat that as an error: it emits the header, no rows, and a `TOTAL` line of
zeroes. Staff would have received a syntactically valid, entirely empty export
of a portfolio that is not empty.

Returning 400 was the correct call against that outcome. It closed off the
symptom without addressing why the scope was missing.

### The selection never left the browser

The console has a customer switcher that writes to `metris.customerId` in
`localStorage` (`apps/web/src/components/CustomerSwitcher.tsx:35`), and every
GraphQL query accepts that value: `dashboard`, `sites`, `revenueByDay` and
`alerts` all take a `customerId` argument
(`apps/api/src/graphql/typeDefs.js:6-10`). The sidebar passes it
(`apps/web/src/app/(console)/layout.tsx:33-36`). The export page passes it too
— to list the sites in its own dropdown
(`apps/web/src/app/(console)/exports/page.tsx:25-27`).

`downloadCsv` was the one caller that did not:

```ts
const search = new URLSearchParams();
if (params.site) search.set('site', params.site);
if (params.from) search.set('from', params.from);
if (params.to) search.set('to', params.to);
```

The endpoint had no parameter to receive it with, so nothing about the request
was wrong — the two halves had simply never been connected.

---

## Evidence

### The endpoint says why; the console does not

```
$ curl -s -i "localhost:4000/export/csv?from=2026-07-01&to=2026-07-29" \
    -H "Authorization: Bearer $STAFF_TOKEN"

HTTP/1.1 400 Bad Request
{"error":"Staff exports must specify a site"}
```

The API names the problem. The console discards it:

```ts
if (!res.ok) throw new Error('Export failed');
```

`apps/web/src/lib/api.ts:85`. The body is never read, so every failure of this
endpoint — 400, 404, 500 — reaches the user as the same four words.

### Two scoping rules, and only one was wired to the console

Both existed in the repository before this change.

`resolveCustomerContext` (`apps/api/src/graphql/resolvers/helpers.js`) is the
one GraphQL uses: staff get the customer they asked for, and with no request
it falls back to the first customer by name — which is what the switcher
displays when the user has chosen nothing.

`resolveCustomerId` (`apps/api/src/lib/auth.js:46`) is the REST-shaped version
of the same idea, returning `null` for staff with no selection. It was
exported and never called:

```
$ git grep -n "resolveCustomerId" main -- apps packages
main:apps/api/src/lib/auth.js:46:function resolveCustomerId(user, requestedCustomerId) {
main:apps/api/src/lib/auth.js:51:module.exports = { ..., resolveCustomerId };
```

Two definitions, one caller. The export route reached for neither and derived
the scope itself, which is how it ended up with a rule that cannot describe a
staff account.

### The rejection left no trace worth reading

`requestLogger` writes one `api_logs` row per request, carrying
`res.locals.errorMessage` and `res.locals.logMetadata`
(`apps/api/src/lib/requestLogger.js:22-23`). The route sets both only on the
success path, after `buildCsv` returns (`routes/export.js:45`). A rejected
export therefore logged as a bare `400` with `error` null and `metadata` `{}`
— no site, no customer, no reason. Whatever this cost staff before the ticket
was raised is not recoverable from the logs.

---

## Impact

- **Staff only.** All three staff accounts, on every customer. The path is the
  one staff use to answer "send me the whole portfolio for July".
- **No customer impact.** Customer accounts scope from their own record and
  were never affected — confirmed above against `energy@penninegroup.co.uk`.
- **Workaround was manual.** One export per site, pasted together. For Pennine
  that is four files per request, with the arithmetic on the `TOTAL` rows left
  to whoever assembles them.
- **Silent in the logs.** Nothing alerted, and the rejected requests carry no
  metadata, so the frequency before the ticket cannot be reconstructed.

---

## What ships with this change

`resolveCustomerId` now holds the rule that was only in the GraphQL helper,
next to `isStaff` where the staff definition already lives, and both
transports call it. Staff get the customer they asked for and fall back to the
first customer by name; customer accounts keep deriving scope from their own
record, and a `customerId` in the query string cannot widen it. A non-numeric
value falls back to the default rather than reaching the database.

The export route uses it for the all-sites branch and the 400 is gone. The
console sends the switcher's selection with the request, as it already does
for every GraphQL query. The resolved customer is recorded in the request
log's metadata alongside the site and the date range.

### Verification (completed)

Run against the API with the change applied, on `2026-07-01` → `2026-07-29`:

| Case                                                | Result                                        |
| --------------------------------------------------- | --------------------------------------------- |
| Staff · all sites · Pennine                         | 200 · the four Pennine sites                  |
| Staff · all sites · Albion                          | 200 · London Warehouse                        |
| Staff · all sites · nothing selected                | 200 · first customer by name                  |
| Staff · single site                                 | 200 · unchanged                               |
| Customer · all sites                                | 200 · unchanged, four sites                   |
| Customer · forcing `customerId` of another customer | 200 · **still their own sites**               |
| Staff · `customerId=abc`                            | 200 · default, no error reaching the database |

GraphQL was re-checked after the helper was rewired: staff with an id, staff
with `null`, a customer account overriding the argument, and an unauthenticated
request still rejected with `Authentication required`. `eslint`, `prettier`
and the 15 unit tests pass.

---

## What this change does not do

**The error message is unchanged.** `downloadCsv` still reports `Export
failed` for anything that is not a 200. This flow no longer has a 400 to
explain, but the next endpoint that fails will be exactly as opaque as this
one was. That is the single highest-value follow-up here, and it is deliberate
that it did not ship with the fix.

**It does not make the export cheaper.** The all-sites branch now does the
work for every site of a customer in one request — four sites for Pennine,
where a single-site export of the same range returns 123 lines and the
portfolio returns 483. The seeded production logs show a four-month
single-site export already running for 12.3s, and another of the same shape
cancelled at 15,003 ms against the fleet-wide `statement_timeout = '15s'`
(`packages/db/knexfile.js:11`). The path just enabled multiplies that by the
site count, so the first long-range portfolio export is a plausible 500.
Bounding or streaming the export is listed below.

---

## Preventing recurrence

| Priority | Action                                                                                                                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | **Surface the API's message in the console.** Read `body.error` in `downloadCsv` instead of replacing every failure with "Export failed". A 400 that names the missing parameter was shown as a broken feature. |
| **P1**   | Bound or stream the CSV export. An all-sites request multiplies rows by the site count against a 15s statement timeout that single-site exports already reach.                                                  |
| **P2**   | Record scope and outcome on rejected requests too — set `logMetadata` before the work, not after it, so 4xx rows say what was asked for.                                                                        |
| **P2**   | Treat "which customer is in scope" as one rule. It now lives in `lib/auth`; a new surface should call it rather than read `customer_id` off the account, which is the mistake this endpoint made.               |
| **P3**   | Name the portfolio export after its customer. Every all-sites file is `metris-export-portfolio-…`, so two customers' exports for the same range are indistinguishable in a downloads folder.                    |
| **P3**   | Persist the switcher's default. It displays the first customer while `localStorage` is empty; both transports now resolve the same fallback, so they agree, but the agreement is implicit rather than stored.   |

Deliberately **not** changed: staff being able to export any customer. That is
the existing authorisation model — `resolveCustomerId` and `authorizeSite`
both grant staff access across customers — and this endpoint now follows it
instead of diverging from it.

---

## What to tell the team

> Daniel — fixed, and your reading of it was right at every step. It was not
> the export that was broken; the request never said which customer to export.
>
> The endpoint worked out "all sites" from the customer on your account, and a
> staff account is exactly the one with no customer on it, so there was
> nothing to scope to and it answered 400. The console showed that as "Export
> failed", which is why it looked like a defect in the export rather than a
> missing parameter. Picking a site worked because the site itself carries the
> customer.
>
> The customer you select in the switcher is now sent with the download, the
> same way every other screen already sends it, so "All sites" gives you that
> customer's portfolio. Nothing changed for customers — Rachel's export scoped
> from her own account throughout, and a customer cannot request another
> customer's sites.
>
> Two things I did not fix and would rather flag. The console still reports
> every export failure as "Export failed", so the next one will be just as
> hard to read from the outside. And a portfolio export over a long range now
> does several sites' work in one request, where a single site over four
> months has already been cancelled at the 15-second statement timeout — if a
> long-range export 500s, that is what it is, and it is on the follow-up list.
>
> No action needed on your side, and no stitching files together by hand.

---

## Appendix — reproduction

```bash
STAFF=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ops@metris.energy","password":"SolarDemo!2026"}' | jq -r .token)

# Before: staff asking for every site
curl -s -i "localhost:4000/export/csv?from=2026-07-01&to=2026-07-29" \
  -H "Authorization: Bearer $STAFF" | head -1
# HTTP/1.1 400 Bad Request

# After: the same request carrying the switcher's selection (3 = Pennine)
curl -s "localhost:4000/export/csv?customerId=3&from=2026-07-01&to=2026-07-29" \
  -H "Authorization: Bearer $STAFF" | cut -d, -f2 | sort -u

# Unchanged throughout: a customer account exports its own portfolio
CUST=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"energy@penninegroup.co.uk","password":"SolarDemo!2026"}' | jq -r .token)

curl -s "localhost:4000/export/csv?customerId=1&from=2026-07-01&to=2026-07-29" \
  -H "Authorization: Bearer $CUST" | cut -d, -f2 | sort -u
# still the four Pennine sites, never Albion's
```
