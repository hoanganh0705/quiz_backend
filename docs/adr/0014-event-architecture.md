# ADR-0014: Event Architecture — Three-Layer Event Bus

## Status

Accepted

## Context

The system needs to propagate state changes beyond a single request-response cycle. Notifications, social feeds, achievement checks, and cross-instance coordination require asynchronous event handling. The system has three distinct event propagation needs: in-process domain events (fire-and-forget), cross-instance events (Redis pub/sub), and at-least-once delivery for critical external events.

## Decision

**Layer 1 — Domain Event Bus (in-process, fire-and-forget):**

Used for lightweight, best-effort event propagation within a single request. Events are dispatched synchronously within the current process after a transaction commits. If a handler throws, the error is logged but does not roll back the transaction.

Example: `TagCreatedEvent` triggers a badge eligibility check, a social feed update, and an achievement evaluation.

**Layer 2 — External Event Bus (cross-instance, at-most-once):**

Used for events that need to reach other application instances. Uses Redis pub/sub via `CommonExternalEventBus`. Events are published after the controller returns (post-response) to avoid blocking the HTTP response. If Redis is unavailable, the publish fails silently.

Example: `TournamentStartedEvent` published so all instances can update their tournament cache.

**Layer 3 — Transactional Outbox (at-least-once delivery):**

Used for critical events that must eventually reach external consumers. The outbox record is written in the same transaction as the business operation. A cron job (`OutboxProcessor`) polls the `outbox_events` table and publishes to Redis. On successful publish, the record is marked `processed`. Retry with exponential backoff handles transient failures.

Example: `QuizCompletedEvent` with quiz results sent to an external analytics system.

**Correlation ID propagation:** All three layers propagate `x-correlation-id` via `AsyncLocalStorage` so that events can be traced back to the originating HTTP request.

**No message queue broker:** The system uses Redis pub/sub (not RabbitMQ, Kafka, or SQS). Redis is already a dependency; no additional infrastructure is needed.

## Consequences

**Advantages**
- Three distinct patterns address distinct reliability requirements — fire-and-forget for non-critical, at-most-once for coordination, at-least-once for critical events.
- The outbox pattern guarantees at-least-once delivery without distributed transactions (2-phase commit).
- Domain events keep domain logic decoupled from infrastructure (handlers are registered via DI).
- `AsyncLocalStorage` propagates correlation IDs across all three layers without explicit passing.

**Trade-offs**
- Redis pub/sub has no persistence — a subscriber that is down during publish misses the event. For Layer 2, this is acceptable (tournament cache is eventually consistent). For Layer 3, the outbox provides durability.
- The outbox cron introduces a delivery delay (typically seconds) vs. synchronous publishing.
- Duplicate event delivery is possible in the outbox pattern (at-least-once, not exactly-once). Consumers must be idempotent.
- No event schema registry exists; producers and consumers must coordinate the event schema out-of-band.

## Evidence

- `src/modules/tag/domain/ports/tag-domain-event.port.ts` — `TagDomainEventBus` interface.
- `src/modules/tag/infrastructure/event-bus/tag-domain-event.impl.ts` — fire-and-forget `publish()`.
- `src/common/infrastructure/event-bus/common-external-event-bus.impl.ts` — Redis pub/sub via `ioredis`.
- `src/common/infrastructure/outbox/outbox.adapter.ts` — outbox write in the same transaction as the business operation.
- `src/common/infrastructure/outbox/outbox.processor.ts` — cron `OutboxProcessor` with retry and exponential backoff.
- `src/modules/tournament/infrastructure/scheduler/tournament-scheduler.service.ts` — `publishExternalEvent` uses outbox for `TournamentStartedEvent`.
- `src/common/interceptors/correlation.interceptor.ts` — `x-correlation-id` propagated to `AsyncLocalStorage`.
- `src/modules/quiz/domain/quiz/quiz-event-handler.ts` — example domain event handler.
- `docs/architecture/event-flow.md` — three-layer event architecture diagram with comparison table.
- `docs/PROJECT_CONSTITUTION.md` §3.4 (Choices already made) — Redis pub/sub for events listed as a locked decision.
