# ADR-0027: BaseOutboxProcessor — Standard Outbox Processor Implementation

## Status

Accepted

## Context

The codebase has six outbox processors that each drain `outbox_events` rows for their respective domain. Before this decision, each processor had its own implementation of:

- **Row selection** — selecting pending rows with `FOR UPDATE SKIP LOCKED` to avoid contention between replicas.
- **Idempotency handling** — detecting duplicate-key violations against the partial unique index on `idempotency_key`.
- **Retry scheduling** — exponential backoff with a max-retry count before moving a row to the dead-letter state.
- **DLQ alerting** — logging a high-severity alert when a row exhausts its retries.

Each implementation was subtly different, creating a risk that a future author would implement one aspect incorrectly. The same bug (e.g., missing `SKIP LOCKED`) could appear in multiple processors independently.

We need a shared abstract base class that all processors extend, with sensible defaults and override points for domain-specific behavior.

## Decision

**`BaseOutboxProcessor<T>`** is the abstract base class in `src/common/outbox/base-outbox-processor.ts`. All six processors extend it.

**Row selection.** The base class builds the `SELECT ... FOR UPDATE SKIP LOCKED` query with a configurable `batchSize` (default: 100) and `maxRetries` (default: 8). Subclasses provide `buildAggregateFilter()` to narrow by `aggregate_type` and optionally `buildPendingWhere()` for additional predicates. The query always orders by `created_at ASC` to process oldest rows first.

**Idempotency detection.** The base class detects unique-violation errors via `isIdempotencyConflict(error)`. The default implementation matches PostgreSQL SQLSTATE `23505`, the string `duplicate`, or `unique constraint` / `unique violation` in the message. Subclasses that publish to Redis or other stores may override this to handle driver-specific error codes. When a conflict is detected, the row is marked processed without retrying — the outbox idempotency key guarantees at-least-once delivery semantics.

**Retry and DLQ.** After dispatching, if the external call fails, the base class computes the backoff delay as `baseDelaySeconds × 2^(attemptCount - 1)` (exponential backoff). If `attemptCount >= maxRetries`, the row is moved to DLQ: `failed_at` is set and `dlq_reason` records the error message. Subclasses override `handleFailure()` to add domain-specific logging before the DLQ decision is made.

**Template method hooks.** Subclasses implement:

- `dispatch(row: T): Promise<void>` — publishes the event to the external system. Returns a rejected promise on failure.
- `buildAggregateFilter(): SQL | undefined` — optionally narrows by `aggregate_type` / `event_type`.

Optional overrides:
- `buildPendingWhere(): SQL | undefined` — add extra predicates.
- `handleFailure(db, row, error, nowIso)` — domain-specific failure logic.
- `onIdempotencyConflict(row: T)` — log the skip event.
- `isIdempotencyConflict(error)` — override the conflict detector.

**DLQ monitor.** The base class provides `runMonitorDeadLetterQueue(db)` that selects DLQ rows and returns their count. Subclasses expose a `@Cron` method that calls this and emits a structured alert. The DLQ monitor runs every 5 minutes (`*/5 * * * *`).

**Concurrency.** The base class is safe for concurrent execution: `SKIP LOCKED` ensures multiple replicas partition the work without coordination. The `isRunning` guard (where needed) prevents a single instance from processing the same batch twice.

## Consequences

**Advantages**

- `SKIP LOCKED` is implemented correctly in every processor; a future author cannot forget it.
- Idempotency detection is centralized and can be updated in one place when new error codes surface.
- The retry/backoff/DLQ lifecycle is consistent across all domains.
- New outbox processors require only `dispatch()` and optionally `buildAggregateFilter()`.

**Trade-offs**

- Subclasses must pass constructor arguments in the expected order; the base class constructor does not validate them.
- The `handleFailure` hook is `protected` and called before the retry/DLQ decision; subclasses cannot abort the decision after the hook runs.

## Evidence

- `src/common/outbox/base-outbox-processor.ts` — the abstract base class.
- `src/modules/coins/infrastructure/outbox/coin-outbox-processor.service.ts` — extends `BaseOutboxProcessor`, overrides `dispatch` and `handleFailure`.
- `src/modules/auth/infrastructure/outbox/outbox-processor.service.ts` — catch-all processor (no `aggregateFilter`), overrides `handleFailure` for custom logging.
- `src/modules/attempt/infrastructure/outbox/attempt-xp-outbox-processor.service.ts` — extends with `buildAggregateFilter` for `event_type = 'attempt.xp_to_publish'`.
- `ADR-0019` — the Transactional Outbox decision that established the pattern.
- `ADR-0022` — stampede protection that informs the cache TTL decisions for referential validation.
