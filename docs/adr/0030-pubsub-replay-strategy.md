# ADR-0030 — Redis Pub/Sub Replay Strategy

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-25 |

## Context

Several application flows rely on Redis pub/sub for
cross-instance coordination:

- `SessionInvalidationBus` — session invalidation broadcast across
  API instances so all of them can revoke a token family at once.
- `CommonExternalEventBus` — generic event bus for cross-module
  fan-out (e.g. user profile updates notify achievements,
  bookmarks, social).

Pub/sub is fire-and-forget by design: an instance that is
disconnected (network blip, pod restart, rolling deploy) misses
every event that fires during the gap. The audit identified two
incidents where a brief Redis hiccup caused some instances to miss
a "session invalidated" event and continue to honour a token that
had already been revoked.

We need a recovery strategy that:

- Replays missed events on reconnect without overloading Redis.
- Bounded memory: the replay window cannot grow unboundedly.
- Per-instance opt-in: not every consumer can safely replay an
  event (idempotency requirements).

## Decision

We add a **bounded replay list** alongside every pub/sub channel.
Producers publish both to the channel (live consumers) and `RPUSH`
the event payload onto a Redis list (recovery). Consumers subscribe
to the channel and on reconnect call a `replayAndDispatch()` method
that walks the list, dispatches each entry to subscribers, and
`LTRIM`s it as it goes.

### The shape

For each pub/sub bus:

| Symbol | Default | Purpose |
| --- | --- | --- |
| `REPLAY_KEY` | `<channel>:replay` | Redis list key where producers also `RPUSH`. |
| `REPLAY_LIMIT` | `1000` | Maximum entries retained. |
| `REPLAY_TTL_SECONDS` | `120` | Time-to-live on each entry. |

The producer side runs **two operations** on every publish:

1. `PUBLISH <channel> <payload>` — live consumers.
2. `RPUSH <replay-list> <payload>` followed by
   `LTRIM <replay-list> -<limit> -1` and `EXPIRE <replay-list>
   <ttl>` — bounded replay list.

Both go through `RedisService` and inherit the circuit-breaker
fallback. A Redis outage skips both writes; we accept the loss
because the alternative is buffering in process memory.

### The consumer side

On reconnect (e.g. `connect()` re-establishes the subscriber
connection), the consumer:

1. Subscribes to the channel.
2. Calls `replayAndDispatch()` which:
   - Reads the replay list with `LRANGE 0 -1`.
   - Dispatches each entry through the same handler chain as live
     events.
   - Clears the replay list with `DEL` only after successful
     dispatch (consumer never `LTRIM`s partially).
3. Resumes normal subscription semantics.

If a handler throws during replay dispatch, the bus logs a
`warn` event and continues with the next entry — replay must not
stall on a single bad payload. The list is consumed exactly once
per consumer (per reconnect); there is no double-dispatch because
the consumer `DEL`s the list at the end.

### Opt-in for safety

Not every bus needs a replay list. We enable it only when:

1. The bus carries **business-critical** events (security,
   authorisation).
2. Consumers are **idempotent** — replay must not double-apply an
   effect.
3. The event payload size is **small** (under 4 KB) so the
   bounded list consumes bounded memory.

`SessionInvalidationBus` opted in (security + idempotent
handlers). `CommonExternalEventBus` carries the same mechanism
but consumers must explicitly opt in by listing their subscriber
in the bus's `bindReplayHandlers()` method.

### Failure semantics

- If the replay list is unreadable (Redis OPEN, truncated,
  evicted), `replayAndDispatch()` returns the number of events
  that were successfully processed and logs the remainder; the
  consumer must treat the rest as lost.
- If a handler is non-idempotent it MUST be wrapped in an
  idempotent adapter (the bus exports a helper for this).

## Consequences

### Positive

- **No silent gaps.** Reconnecting consumers recover the events
  they missed in the previous window.
- **Bounded cost.** `LTRIM` + `EXPIRE` keep the list at a fixed
  upper bound; this does not affect live publish latency.
- **Bounded delivery window.** Consumers that reconnect after
  more than `REPLAY_TTL_SECONDS` see no replay — at that point the
  live tail is authoritative.

### Negative

- **Two writes per publish.** Every event pays a 2× IO cost. We
  accept this as the price of reliability for the buses that
  opted in.
- **Not a general at-least-once delivery layer.** Replay is
  best-effort within the bounded list window. For strict
  at-least-once delivery, callers must use the transactional
  outbox (ADR-0019) instead.
- **Producer memory pressure** for high-rate channels. We cap the
  list at `REPLAY_LIMIT` entries to bound this.

## Alternatives considered

- **Transactional outbox everywhere.** Rejected: outbox has a
  per-write cost (a Postgres row per event) that is too high for
  the high-frequency, low-stakes channels.
- **Long-lived pub/sub with persistent subscriptions.** Rejected:
  Redis pub/sub is fire-and-forget by design; persistent
  subscriptions require Kafka or NATS, neither of which is on the
  project's deployment footprint.
- **Consumer-side consumer group offsets (Redis Streams).**
  Considered and rejected: would change the channel primitive for
  every consumer in the codebase, and Streams add a `XACK` /
  `XPENDING` lifecycle the current consumers do not need.

## References

- Source: `src/modules/auth/infrastructure/session/session-invalidation.bus.ts`,
  `src/common/events/common-external-event-bus.ts`,
  `src/common/ports/pubsub.provider.ts`.
- Tests: `session-invalidation.bus.spec.ts`,
  `common-external-event-bus.spec.ts`.
- Runbook: `docs/runbooks/redis-cache-audit.md`.
- ADR-0014 (Event Architecture), ADR-0019 (Transactional Outbox),
  ADR-0023 (Fail-Open Circuit Breaker).
