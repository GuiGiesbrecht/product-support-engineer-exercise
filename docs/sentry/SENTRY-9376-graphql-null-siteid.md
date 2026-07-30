# METRIS-API-9376 · GraphQLError: Variable "$siteId" of non-null type "ID!" must not be null

|                |                         |
| -------------- | ----------------------- |
| Project        | metris-api (production) |
| Level          | warning                 |
| Events         | 96                      |
| Users affected | 0                       |
| First seen     | 2026-07-11 06:00 UTC    |
| Last seen      | 2026-07-29 15:00 UTC    |
| Release        | api@1.4.2               |
| Status         | Unresolved              |

```
GraphQLError: Variable "$siteId" of non-null type "ID!" must not be null.
  at coerceVariableValues (node_modules/graphql/execution/values.js:87:15)
  at buildExecutionContext (node_modules/graphql/execution/execute.js:203:37)
  at executeOperation (apps/api/src/index.js -> @apollo/server request pipeline)
```

**Request**

```
POST /graphql  operationName=SiteOverview
user-agent: metris-synthetics/1.8
```

**Tags:** environment `production`, transaction `POST /graphql`

**Note (Marcus, 2026-07-14):** synthetic uptime check misconfigured after the
site-overview probe was split per region — it fires the query without a
`siteId` on the hour. Harmless but noisy; synthetics config ticket open with
the SRE vendor.
