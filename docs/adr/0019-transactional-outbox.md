# ADR-0019 — Transactional Outbox for Cross-Domain Events

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-08-19 |
| Deciders  | Backend Lead |
| Amends    | ADR-0014 (Event Architecture) |

## Context

The quiz backend raises cross-domain events — `QuizCreatedEvent`,
`AttemptCompletedEvent`, `BadgeRevokedEvent`, etc. — that downstream
services (notifications, leaderboards, coins, audit) consume.
ADR-0014 already mandates a three-layer event bus:
in-process events, Redis pub/sub for cross-instance coordination,
and a transactional outbox for at-least-once delivery of critical
events. This ADR records the specific implementation of the outbox
layer that ADR-0014 names but does not pin.

The naïve implementation runs `INSERT INTO events` *after* the
domain mutation has committed:

```ts
await db.transaction(async (tx) => {
  await tx.insert(quizzes).values(...);
});
await eventsTable.insert({ kind: 'quiz.created', ... });  // ← separate write
```

This breaks the **atomicity invariant**: if the second write fails
(crash, network blip, connection drop), the domain row commits but
no event is ever emitted. Downstream consumers see a quiet state
that doesn't match reality. The same problem applies in reverse: if
the event succeeds but the domain write rolls back, downstream
consumers see a phantom event that points to a non-existent
resource.

## Decision

The outbox layer writes the event row inside the *same database
transaction* as the domain mutation. A separate processor polls the
`outbox_events` table (or is notified via `LISTEN/NOTIFY`) and
dispatches the event to downstream consumers.

### Schema

```sql
CREATE TABLE outbox_events (
  event_id       uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id   uuid NOT NULL,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL,
  processed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

A partial index on `processed_at IS NULL` makes the polling query
fast as the table grows.

### Production dispatcher

Two delivery modes, used together:

1. **`LISTEN/NOTIFY` (preferred).** When the application commits a
   domain mutation that schedules an outbox event, the same
   transaction issues `NOTIFY outbox_events, '<event_id>'`. A
   dedicated listener (`OutboxNotifyListener`) holds a long-lived
   `pg.Client` and calls `OutboxProcessorService.processPendingEvents()`
   on each notification. Latency from commit to dispatch is
   sub-second.

2. **30-second fallback poll.** A `@Cron('*/30 * * * * *')` job
   runs `processPendingEvents()` regardless of notifications. This
   catches events whose `NOTIFY` was lost (connection drop, listener
   restart) without a separate sweeper job.

The polling and `LISTEN/NOTIFY` paths share the same single-flight
guarantee so duplicate dispatch cannot occur.

### Idempotency

Downstream consumers MUST treat outbox dispatch as at-least-once.
The processor marks the row `processed_at = now()` after a
successful dispatch; a crash between dispatch and update will
cause a redelivery on the next polling cycle.

## Consequences

### Positive

- **Atomic commit.** A domain mutation and its event either both
  commit or both roll back. The audit trail is exhaustive.
- **Recovery from crashes.** The fallback poll guarantees forward
  progress even when `NOTIFY` events are dropped.
- **Single source of truth.** The database is the only place that
  knows what happened. A read-replica replica can be set up without
  re-plumbing the event bus.
- **Testable in isolation.** The pattern's correctness depends on
  transaction semantics, which we test in unit with an in-memory
  executor (`user.repository.transaction.spec.ts`).

### Negative

- **Latency floor.** Without `LISTEN/NOTIFY`, the polling cadence
  is the floor. We chose 30 seconds to keep cost low; the
  `LISTEN/NOTIFY` path brings the floor to ~0 in the happy case.
- **At-least-once semantics.** Consumers must be idempotent. The
  coin ledger and notification dispatcher both check a
  `(event_id, consumer_id)` uniqueness key.
- **Retention.** Old `processed_at IS NOT NULL` rows accumulate.
  The `OutboxProcessorService` runs a retention purge nightly that
  deletes rows older than 30 days.

## Alternatives considered

- **Dual-write with retries.** Rejected: the failure mode is
  fundamentally non-coordinable across two systems without a 2PC
  or a saga. The outbox is the simpler invariant.
- **Change-data-capture (Debezium, Kafka Connect).** Rejected for
  the current scale: CDC requires Kafka and an operational
  pipeline that exceeds the project's footprint. The outbox
  delivers 90% of the value (atomicity, replay, decoupling) for
  one Postgres table and a few hundred lines of TypeScript.

## References

- Hohpe, G. & Woolf, B. (2003). *Enterprise Integration Patterns*.
- ADR-0014 — Event Architecture.
- Source: `src/modules/auth/infrastructure/outbox/`,
  `src/common/ports/outbox.port.ts`.