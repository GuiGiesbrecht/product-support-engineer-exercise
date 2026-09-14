# Scheduler design options for the worker pool

Supporting note for
[TICKET-4847 · Customer received duplicate offline alerts](../TICKET-4847-duplicate-offline-alerts.md).
The report establishes that two worker replicas run every scheduled job, that
`alert-scan` is the only job harmed by it, and that a database constraint on
the job run stays inert until job runs have an identity every scheduler
computes identically. This note works through the designs that follow from
that requirement, and through what would actually add capacity for the Q3
onboarding batch. It is a design discussion, not part of the incident record.

## The requirement every option shares

Every option below rests on the same requirement as the unique key on the job
run that the report examines:
**an identity for a scheduled run that every scheduler computes identically.**
The current scheduler derives its due time from each process's own clock, so
that has to change first — quantising onto a shared grid rather than
`Date.now() + interval` — whichever design is chosen.

## Options

| Option                                                                                                                                                        | What it solves                                                        | What it costs                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **One instance**                                                                                                                                              | Duplication. Nothing else                                             | No code. No failover                                                                          |
| **Leader election** — `pg_advisory_lock` per job name; the holder schedules, the others stand by and take over if it dies                                     | Duplication, with failover                                            | A few lines, no new infrastructure. Still one worker doing all the work                       |
| **PostgreSQL as a work queue** — a scheduler enqueues work items with a unique key on `(job, slot)`; executors claim with `SELECT ... FOR UPDATE SKIP LOCKED` | Duplication and distribution                                          | No new infrastructure, adequate at this volume. Two components to reason about instead of one |
| **SQS FIFO + executors**                                                                                                                                      | Duplication and distribution, with retry, DLQ and visibility built in | Another system to operate and pay for                                                         |

## The SQS shape

It is the option most often reached for, so its specifics are worth setting out:

- `MessageGroupId = <job name>` gives exactly "one job of this type in flight at
  a time" — the next message in a group is not delivered until the previous is
  deleted or its visibility timeout expires. Standard queues do not offer this;
  FIFO queues do.
- `MessageDeduplicationId = <job>:<slot>` collapses the duplicate enqueue that
  two schedulers would otherwise produce, within a five-minute window. This is
  where the shared slot key is needed: without a deterministic slot the
  deduplication has nothing to match on, and the defect simply moves up one
  layer into the enqueue.
- SQS does not call anything. Consumers long-poll, or a Lambda event source or
  ECS service does it for them, and the visibility timeout must exceed the job
  duration or the message reappears mid-run.
- Delivery is at-least-once by design. Jobs still have to be idempotent, or the
  invariant has to be enforced in the database — which is the argument for
  keeping `alerts_open_asset_type_uq` regardless of which option is chosen.

A queue only distributes load if it carries **units of work** — one message per
connector, per site — rather than one message per job. Enqueueing "run
connector-status-poll" still executes twenty serial HTTP calls on one consumer.

## Why more replicas will not relieve Q3

The scale-out was justified as capacity for the Q3 onboarding batch. The
measurements in the report show it provided none. **Adding replicas increases
cost in proportion to the replica count and capacity by zero,** because no job
partitions its work.

If the goal is to absorb more sites and assets, two things actually do that,
in this order:

**Concurrency inside the job — cheapest and largest win.**
`connector-status-poll` issues 20 HTTP calls one after another, roughly 0.5s
each, for a ~10s cycle. Running them with a bounded `Promise.all` brings that to
about 2 seconds. It needs no new infrastructure, no new failure mode, and scales
to several hundred connectors before anything else has to change. `alert-scan`
has a smaller version of the same problem: one query per offline connector where
a single query would do.

**Distribution across processes — only when the above is exhausted,** and only
via one of the queue options, with granular work items.
