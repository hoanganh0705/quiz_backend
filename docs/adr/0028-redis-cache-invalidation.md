# ADR-0028 — Redis Cache Invalidation Patterns

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-25 |

## Context

The application has several dozen Redis caches that back read-heavy
features (leaderboards, profile bundles, tag rankings, notification
preferences, achievement rules, tournament brackets, …). Each cache
must be invalidated when the underlying data mutates, but a single
pattern does not fit every cache:

- Some caches are tightly scoped to one module and only that module
  writes through; an in-process event is enough to invalidate.
- Some caches are read by **many** modules and written by fewer
  (e.g. the leaderboard `pos:` keys). Process-local events would not
  reach the other instances.
- Some caches hold data that is **expensive to recompute** but also
  **fast-changing**; invalidating eagerly on every mutation would
  amplify write storms.

An audit (see `docs/runbooks/redis-cache-audit.md`) found that the
codebase had already drifted toward three patterns organically but
without an explicit decision recorded. We capture that decision
here.

## Decision

We standardise on **three cache-invalidation patterns**, each
chosen by the cache's owner and the rate at which it is mutated.

### 1. Event-driven invalidation for owned caches

When a module owns both the writes and the reads of a cache, the
write path emits a domain event on its in-process bus. Any other
service in the same process that holds the cached value subscribes
to that event and invalidates the key.

Use cases: per-user profile bundles, per-collection bookmark
analytics, per-badge achievement caches, quiz detail caches.

Implementation: NestJS lifecycle hook `onModuleInit()` subscribes to
the appropriate domain-event bus; `onModuleDestroy()` unsubscribes.
Failures during invalidation are logged at `warn` and increment the
`quiz_cache_invalidation_failed_total` (and peers) metrics — they
never abort the mutation.

### 2. Version-bump invalidation for shared caches

When a cache is read by many modules (or many instances), pushing
the invalidation event through every consumer is fragile. Instead,
the cache key includes a monotonically-increasing version number,
and the writer increments it on a Redis-backed counter (e.g.
`tag:ranking:version`, `ranking:version:<period>`). The next reader
computes a **new** cache key under the bumped version, which points
at empty storage; the writer's atomic `INCR + SET(...,86400000)`
guarantees the version survives a Redis restart (the new instance
defaults to 0, the first invalidation writes 1).

Use cases: tag popular/trending rankings, ranking leaderboards and
per-user positions, total-active-users counters.

The version key itself has a long TTL (24 h) so a Redis flush
returns the system to a coherent state within a day; in practice a
new deploy invalidates it eagerly.

### 3. TTL-only invalidation for ephemeral data

For caches whose lifetime is short relative to the staleness
budget (rate-limit windows, feed-activity throttles, transient
counters), we set a short TTL and accept reads that may be
milliseconds stale. No explicit invalidation logic exists.

Use cases: throttler counters (1 s – 60 s windows), per-user feed
activity counters (60 s), session-invalidation replay entries
(120 s).

### Why we do not use a single invalidation library

External libraries (Cacheaside, Oboe, custom `redis-invalidate`
hooks) were considered and rejected:

- They would tie every cache to a write-hook lifecycle that our
  repositories do not currently expose.
- They hide the semantic difference between "shared" and
  "owned", which is the most important signal for choosing an
  invalidation strategy.
- Auditability: an explicit `invalidate()` call in the mutation
  service is much easier to grep than a side-effect injection.

### Choosing the right pattern

| Cache | Pattern | Reason |
| --- | --- | --- |
| `user:profile-bundle:v1:*` | Event-driven | Owned by `UserProfileBundleService`, invalidates on user mutation. |
| `bookmark:collection:*:analytics:*` | Event-driven | Owned by bookmark domain, pattern-wiped on add/remove. |
| `achievement:cache:badges` / `:rules` | Event-driven | Owned by achievement domain, wiped on `badge.revoked` / `badge.restored`. |
| `notif:prefs:*` | Event-driven + TTL | Per-user prefs; explicit del on `updatePreferences` AND 5 min TTL. |
| `tag:ranking:popular:*:v<n>` | Version-bump | Reads across many services, one writer (tag mutations). |
| `ranking:version:<period>` + `lb:*:v<n>` | Version-bump | Reads across many services, writers limited to XP gain. |
| `pos:<user>:<period>:v<n>` | Version-bump | Shares the ranking version counter. |
| `total:<period>:v<n>` | Version-bump | Shares the ranking version counter. |
| `throttler:*` | TTL-only | Fleet-wide rate-limit window; recomputed every request. |
| `social:feed-activity:*` | TTL-only | Per-minute throttle; oldest writes naturally age out. |
| `session:invalidate:*` | TTL-only | Replay list bounded by `REPLAY_TTL_SECONDS`; consumers read latest. |

## Consequences

### Positive

- **Predictable failure modes.** Each pattern has well-understood
  semantics: an event-driven cache eventually invalidates; a
  version-bump cache bumps immediately; a TTL-only cache ages out.
- **Cross-instance consistency.** Pattern 2 (version-bump) works
  correctly across multiple backend instances without any extra
  pub/sub machinery.
- **No coupling between services.** A cache consumer does not need
  to know about a specific writer; the version counter is the only
  shared state.

### Negative

- **Cognitive overhead.** New contributors must learn which
  pattern a given cache uses; we mitigate this with the table on
  `RedisService` (Cache key namespace index) and the audit runbook.
- **Manual discipline.** Adding a new cache requires picking the
  right pattern and wiring it up. A linter rule could enforce this
  but the surface area is too small to justify one today.
- **Version counter loss.** If Redis is wiped, version counters
  reset to 0; subsequent invalidations write `1`, which is
  effectively a re-cache. There is no way to read "the cache is
  stale" without materialising it first.

## References

- Source: `src/modules/tag/domain/tag.service.ts` (version-bump),
  `src/modules/achievement/infrastructure/cache/achievement-cache.service.ts`
  (event-driven), `src/modules/ranking/domain/services/leaderboard.service.ts`
  (version-bump), `src/core/throttler/redis-throttler.storage.ts`
  (TTL-only).
- Runbook: `docs/runbooks/redis-cache-audit.md`.
- ADR-0014 (Event Architecture), ADR-0022 (Stampede Protection),
  ADR-0023 (Fail-Open Circuit Breaker).
