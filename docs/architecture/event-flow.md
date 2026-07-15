# Event Flow

This document describes how events propagate through the system. Three propagation layers exist, each serving a distinct purpose:

| Layer | Scope | Delivery | Persistence |
|---|---|---|---|
| In-process domain event | Single process | Synchronous, fire-and-forget | None |
| External event bus | All processes | Redis pub/sub | None |
| Transactional outbox | All processes | Background cron job | PostgreSQL |

## Architecture Diagram

```
HTTP Request (within @Transactional() scope)
        │
        ▼
Domain Service
        │
        ├──► Domain Events ──────────────────────────────────────────┐
        │    (class instances)                                         │
        │                                                             │
        ▼                                                             ▼
In-process DomainEventBus                         Outbox Adapter
(array of handlers)                                 (INSERT outbox_events
        │                                          in same tx)
        ▼                                                             ▼
Event Handler                              ┌──► Outbox Processor
(e.g. TagEventBootstrapService)           │     (cron, every 30s–1min)
        │                                  │
        │                              Publish to External Bus?
        │                                  │     (Redis PUBLISH)
        │                                  │
        │                              ┌───► ExternalEventBus
        │                              │     (shared channel)
        │                              │           │
        └──────────────────────────────┘           ▼
                                           All instances receive
                                           (Redis SUBSCRIBE)
                                                   │
                                                   ▼
                                           Instance Handler
                                           (Notification, Social, etc.)
```

## Layer 1 — In-Process Domain Event Bus

### Pattern

Each bounded context has a local event bus:

```
TagDomainEventBus    →  TagEventBootstrapService
QuizDomainEventBus   →  QuizDomainEventBootstrapService
CategoryDomainEventBus → CategoryEventBootstrapService
BookmarkDomainEventBus →  (log-only)
DiscussionDomainEventBus → (Notification + Social listeners)
```

### Files

```
src/modules/<name>/domain/events/
├── <name>-domain.events.ts        ← event class definitions
├── <name>-domain-event-bus.port.ts ← interface
└── <name>-domain.event-bus.ts    ← implementation

src/modules/<name>/
└── <name>-event-bootstrap.service.ts  ← subscriber registration
```

### Event Class

```typescript
// src/modules/tag/domain/events/tag-domain.events.ts
export class TagCreatedEvent {
  readonly eventType = 'tag.created';
  constructor(
    public readonly tagId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly nowIso: string,
  ) {}
}
```

### Event Bus Interface

```typescript
// src/modules/tag/domain/events/tag-domain-event-bus.port.ts
export interface TagDomainEventBusPort {
  subscribe(handler: (event: unknown) => void): () => void;
  emitTagCreated(event: TagCreatedEvent): void;
  emitTagDeleted(event: TagDeletedEvent): void;
  // ...
}
```

### Event Bus Implementation

```typescript
// src/modules/tag/domain/events/tag-domain.event-bus.ts
export class TagDomainEventBus implements TagDomainEventBusPort {
  private handlers: Array<(event: unknown) => void> = [];

  subscribe(handler: (event: unknown) => void): () => void {
    this.handlers.push(handler);
    return () => { this.handlers.splice(this.handlers.indexOf(handler), 1); };
  }

  emitTagCreated(event: TagCreatedEvent): void {
    for (const handler of this.handlers) { handler(event); }
  }
}
```

### Bootstrap Registration

```typescript
// src/modules/tag/tag-event-bootstrap.service.ts
export class TagEventBootstrapService implements OnModuleInit {
  onModuleInit(): void {
    this.unsubscribe = this.tagEventBus.subscribe((event) => {
      this.handleEvent(event as TagDomainEvent);
    });
  }
}
```

### Domain Event → Handler Dispatch

```typescript
// TagEventBootstrapService.handleEvent()
private handleEvent(event: TagDomainEvent): void {
  if (event instanceof TagDeletedEvent) {
    this.handleTagDeleted(event);
  } else if (event instanceof TagCreatedEvent) {
    this.handleTagCreated(event);
  }
  // ...
}
```

### Summary

| Property | Value |
|---|---|
| Scope | Single Node.js process |
| Delivery | Synchronous, fire-and-forget |
| Transaction | No — events fire after the DB transaction commits |
| Retry | None |
| Idempotency | None |
| AsyncLocalStorage | No — same async context as the HTTP request |
| When to use | Side effects that must happen in the same request (e.g. cache invalidation) |

## Layer 2 — External Event Bus (Redis Pub/Sub)

### Purpose

Broadcasts events to all running instances of the application for cross-instance coordination (e.g. real-time notifications, session revocation across replicas).

### Shared Channel

```
REDIS_CHANNEL = 'external:events'
```

### Port Interface

```typescript
// src/common/events/common-external-event-bus.ts
EXTERNAL_EVENT_BUS_PRODUCER_PORT = Symbol('EXTERNAL_EVENT_BUS_PRODUCER_PORT')
EXTERNAL_EVENT_BUS_CONSUMER_PORT = Symbol('EXTERNAL_EVENT_BUS_CONSUMER_PORT')
EXTERNAL_EVENT_BUS = Symbol('EXTERNAL_EVENT_BUS')  // producer + consumer
```

### Event Format

```typescript
interface ExternalEvent {
  eventType: string;       // 'external.xp.earned'
  payload: Record<string, unknown>;
  correlationId: string;   // from HTTP request
  timestamp: string;       // ISO 8601
}
```

### Producer Flow

```
Domain Service (within same HTTP request)
        │
        ▼
ExternalEventBusProducerPort.publish(event)
        │
        ▼
RedisClient.publish('external:events', JSON.stringify(event))
        │
        ▼
No confirmation — fire-and-forget
```

### Consumer Flow

```
RedisSubscriber.on('message', (channel, message) => {
  const event = JSON.parse(message) as ExternalEvent;
  invokeHandlers(event);
})
        │
        ▼
invokeHandlers(event)
        │
        ├── correlationIdStorage.run({ correlationId }, () => { dispatch(); })
        │
        └── for (const handler of typeHandlers.get(event.eventType)) {
                handler(event);
            }
```

### Correlation ID Restoration

```typescript
// src/common/events/common-external-event-bus.ts
if (event.correlationId) {
  correlationIdStorage.run({ correlationId: event.correlationId }, () => {
    dispatch();
  });
} else {
  dispatch();
}
```

This ensures that all downstream log lines (in Notification, Social, etc.) carry the original HTTP request's correlation ID.

### Summary

| Property | Value |
|---|---|
| Scope | All Node.js instances sharing the same Redis server |
| Delivery | Fire-and-forget, at-most-once |
| Transaction | No — not transactional with the HTTP request |
| Retry | None |
| Idempotency | Consumer-side (not enforced here) |
| AsyncLocalStorage | Yes — `correlationIdStorage.run()` restores request context |
| When to use | Cross-instance coordination (notifications, social feeds, session revocation) |

## Layer 3 — Transactional Outbox

### Purpose

Guarantees eventual delivery of events for critical side effects that must survive process crashes. Used for: Auth security events, Ranking XP events, Achievement badge events.

### Architecture

```
HTTP Request (@Transactional() scope)
        │
        ▼
Domain Service writes:
  1. Domain data  (INSERT INTO quizzes, INSERT INTO user_sessions, ...)
  2. Outbox row   (INSERT INTO outbox_events)
        │
        ▼
COMMIT  ← atomic: both succeed or both fail
        │
        ▼
Outbox Processor (cron, every 30s–1min)
        │
        ├── SELECT ... FROM outbox_events
        │   WHERE processed_at IS NULL
        │   AND failed_at IS NULL
        │   AND next_attempt_at <= now
        │   ORDER BY created_at
        │   LIMIT 100
        │
        ▼
  For each event:
    dispatch(event)
        │
        ├── update attempt count, next_attempt_at
        │
        ├── if idempotency key conflict:
        │       mark processed (ON CONFLICT DO NOTHING already applied at write time)
        │
        ├── if success:
        │       processed_at = now
        │
        └── if failure:
                attempt_count++
                next_attempt_at = now + 30s * 2^(attempt_count-1)
                if attempt_count > 8:
                        failed_at = now
                        dlq_reason = error.message
```

### Outbox Schema

```sql
CREATE TABLE outbox_events (
  event_id        UUID PRIMARY KEY DEFAULT uuidv7(),
  aggregate_type  TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  idempotency_key TEXT,
  failed_at       TIMESTAMPTZ,
  dlq_reason      TEXT,
  correlation_id  TEXT
);
```

### Idempotency

Two layers of idempotency:

1. **Producer-side**: `ON CONFLICT DO NOTHING` on `idempotency_key` where `processed_at IS NULL` — the DB rejects duplicate inserts.
2. **Processor-side**: the same partial unique index prevents processing a row that was inserted by a concurrent producer before the current row was inserted.

### Outbox Processor Services

| Module | Schedule | Aggregates |
|---|---|---|
| Auth | `*/30 * * * * *` (every 30s) | `account`, `session`, `password_reset`, `oauth_account`, `oauth_login` |
| Ranking | `* * * * *` (every minute) | `ranking` |
| Achievement | `* * * * *` (every minute) | `Achievement` |

### Events Emitted by Outbox

The outbox processors emit events into the appropriate downstream bus after processing:

```
Auth Outbox Processor
    ├── account_deleted      → AuthSecurityNotificationService (send email)
    ├── password_changed    → AuthSecurityNotificationService (send email)
    ├── session_revoked     → AuthSecurityNotificationService (send email)
    └── ...

Ranking Outbox Processor
    ├── xp.added            → RankingDomainEventBus → RankingService
    └── rank.changed        → RankingDomainEventBus → RankingService

Achievement Outbox Processor
    ├── achievement.awarded → SharedAchievementEventBus → NotificationService
    └── badge.revoked       → SharedAchievementEventBus → NotificationService
```

### Summary

| Property | Value |
|---|---|
| Scope | All Node.js instances sharing the same PostgreSQL database |
| Delivery | At-least-once, with exponential backoff |
| Transaction | Yes — atomic with the domain write |
| Retry | Exponential: 30s × 2^(attempt_count-1), max 8 attempts |
| Idempotency | Dual: ON CONFLICT DO NOTHING + processor conflict detection |
| AsyncLocalStorage | Yes — `correlationIdStorage.run()` in processor dispatch |
| DLQ | After 8 failures: `failed_at` set, `dlq_reason` stored |
| When to use | Events that must survive process crash and be processed exactly-once |

## Event Bus Comparison

| Property | In-Process | External (Redis) | Transactional Outbox |
|---|---|---|---|
| Persistence | None | None | PostgreSQL |
| Scope | Single process | All instances | All instances |
| Delivery | Immediate, sync | Immediate, async | Delayed (cron) |
| Transactional | No | No | Yes |
| Retry | None | None | Exponential backoff |
| Idempotency | None | Consumer-side | Dual (DB + processor) |
| Use case | Cache invalidation, log-only | Notifications, social feeds | Security events, XP, badges |

## Correlation ID Flow Across Layers

```
HTTP Request
        │
        ▼ CorrelationInterceptor
correlationIdStorage.run({ correlationId }, () => {
        │
        ▼ Domain Service emits domain event
TagDomainEventBus.emitTagCreated(event)  ──► TagEventBootstrapService.handleTagDeleted(event)
        │                                           │
        ▼ External Event Bus (optional)            ▼ Same process, same storage
RedisClient.publish('external:events', { ..., correlationId })
        │
        ▼ (other instance)
RedisSubscriber.on('message', ...)
        │
        ▼ correlationIdStorage.run({ correlationId }, () => {
                handler(event);  ← logs carry same correlationId
            })

        ▼ Outbox Processor (async, separate tick)
correlationIdStorage.run({ correlationId }, () => {
        dispatch(event);  ← logs carry original correlationId
    })
```

## Needs Clarification

- The `DiscussionDomainEventBus` is referenced but the social/notification listeners are not traced to confirm whether they subscribe to it or to a separate integration event.
- The `SocialModule` subscribes to many event buses; whether the social feed is computed eagerly (on event) or lazily (on read) is not traced.
- The `NotificationModule` is the fan-out delivery layer; the preference-gating logic (which channels to use per user) is referenced but the implementation is not traced.