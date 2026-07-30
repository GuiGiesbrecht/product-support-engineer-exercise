# METRIS-WORKER-9301 · FetchError: ECONNRESET (meteocontrol status poll)

|                |                            |
| -------------- | -------------------------- |
| Project        | metris-worker (production) |
| Level          | warning                    |
| Events         | 210                        |
| Users affected | 0                          |
| First seen     | 2026-06-30 04:06 UTC       |
| Last seen      | 2026-07-29 12:06 UTC       |
| Release        | api@1.4.2                  |
| Status         | Muted (auto-resolves)      |

```
FetchError: request to https://api.meteocontrol.de/v2/systems/status failed, reason: socket hang up (ECONNRESET)
  at ClientRequest.<anonymous> (node:internal/deps/undici/undici:12345:11)
  at connectorPoll (apps/api/src/workers/jobs/connectorPoll.js:24:22)
  at runJob (apps/api/src/workers/lib/jobRunner.js:22:28)
```

**Tags:** vendor `meteocontrol`, job `connector-status-poll`

**Note (Daniel, 2026-07-02):** meteocontrol's EU API resets long-lived
connections during their nightly maintenance window and intermittently at
other times. Retries succeed; weather stations don't feed billing figures.
Muted — revisit if a station misses a full day.
