# Metris — Solar Generation Monitoring Platform

Metris monitors commercial solar installations across the UK. Customers own
**sites**; each site has **assets** (inverters, smart meters, batteries,
weather stations) that report daily energy summaries through vendor
connectors. The platform aggregates readings into revenue and savings figures
and exposes them through a web console, a GraphQL API and CSV exports.

## Support rotation exercise

You have been given access to a reproduction environment that mirrors
production as of the evening of **2026-07-29**, together with the current
support queue.

- Start with **[`tickets/TICKET-4821-dashboard-csv-revenue-mismatch/ticket.md`](tickets/TICKET-4821-dashboard-csv-revenue-mismatch/ticket.md)**, then work the rest of [`tickets/`](tickets).
- For each ticket, produce a written incident report.
- Not every ticket is a bug, and not every bug is in code. Say what you found,
  how you know, and what you would do next.
- A code or SQL fix is welcome where one is warranted, but a correct diagnosis
  with evidence matters far more than a patch.

Recent Sentry issues are exported under [`docs/sentry/`](docs/sentry). System
architecture notes live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Getting started

Requirements: Docker with Compose.

```bash
docker compose up
```

This starts PostgreSQL, provisions the database (migrations + data), and runs
the API, the background worker and the web console.

| Service     | URL                                                               |
| ----------- | ----------------------------------------------------------------- |
| Web console | http://localhost:3000                                             |
| GraphQL API | http://localhost:4000/graphql (open in a browser for the sandbox) |
| REST export | http://localhost:4000/export/csv                                  |
| PostgreSQL  | localhost:5432 (`metris` / `metris_dev`, database `metris`)       |

### Credentials

All demo accounts share the password `SolarDemo!2026`.

| Email                              | Role                             |
| ---------------------------------- | -------------------------------- |
| support@metris.energy              | Internal support (all customers) |
| ops@metris.energy                  | Internal ops (all customers)     |
| finance@albionlogistics.co.uk      | Albion Logistics Ltd             |
| estates@northgate-education.org.uk | Northgate Education Trust        |
| energy@penninegroup.co.uk          | Pennine Group plc                |

### Connecting to the database

```bash
docker compose exec db psql -U metris -d metris
```

Operational history is queryable alongside domain data: `api_logs`,
`worker_logs`, `jobs`, `audit_logs`. Live worker output is also visible with
`docker compose logs -f worker`.

### Querying GraphQL from the terminal

```bash
TOKEN=$(curl -s -X POST localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"support@metris.energy","password":"SolarDemo!2026"}' | jq -r .token)

curl -s localhost:4000/graphql \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"{ dashboard(customerId: 1) { revenueGbp periodStart periodEnd } }"}'
```

## Development

```bash
npm install
npm test          # unit tests (vitest)
npm run lint      # eslint
npm run format    # prettier
```

The API and worker can run outside Docker against the compose database:

```bash
DATABASE_URL=postgres://metris:metris_dev@localhost:5432/metris npm run dev --workspace=@metris/api
DATABASE_URL=postgres://metris:metris_dev@localhost:5432/metris npm run worker --workspace=@metris/api
```

## Repository layout

```
apps/
  api/          Express + Apollo GraphQL API, REST export, background workers
  web/          Next.js console (dashboard, site overview, revenue, CSV export)
packages/
  db/           Knex migrations, fixtures and provisioning script
  shared/       Domain helpers shared by API and web
docker/         Container builds
docs/           Architecture notes, Sentry exports, screenshots
tickets/        Support queue
```
