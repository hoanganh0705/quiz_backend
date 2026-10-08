# ADR-0029 — Per-Cache Fail-Open vs Fail-Closed Failure Policy

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-25 |

## Context

ADR-0023 established that the application must remain responsive
when Redis is down: every `RedisService` call routes through a
three-state circuit breaker that returns a documented fallback
when OPEN. But the **fallback value** is not the same for every
call — and choosing the wrong one can either expose users to abuse
or break a legitimate business invariant.

The Redis cache audit
(`docs/runbooks/redis-cache-audit.md`) classified each cache by
the blast radius of a degraded response. Two specific findings
during the audit showed how easy it is to drift toward an unsafe
default:

- **F-12** — `SecurityService` rate-limit buckets must not allow
  free burst during a Redis outage if the bucket would otherwise
  have been a hard-limit. We adopted a *two-tier policy*: limit
  short-lived IP-bound buckets aggressively, but soften user-bound
  buckets (which already have an upper bound in the JWT rate).
- **F-16** — Session-invalidation replays must not be silently
  swallowed by an offline cache; we keep the replay list opt-in
  (TTL only, no event-bus fallback) so a Redis outage delays
  delivery rather than dropping it.

This ADR captures the policy that the codebase follows when it
encounters a new Redis-backed cache and must choose between
fail-open and fail-closed.

## Decision

We classify every Redis-backed call by its **stale-while-degraded
risk** and pick the policy accordingly.

### Fail-open (cache miss / event lost / counter reset)

The default for everything except the cases below. When Redis is
unreachable, the call returns a fallback that mimics a "no data
yet" response so the caller falls through to a slower source of
truth (database / deterministic recompute).

Use fail-open when:

- The cache is **read-only** with a bounded staleness budget
  (cache TTL < SLO).
- The fallback is to recompute from the source of truth at an
  acceptable cost.
- An outage would otherwise create a louder 5xx; the user impact
  of "the request is slower" is preferable to "the request fails".

Examples:

| Operation | Fallback | Rationale |
| --- | --- | --- |
| `CacheProvider.get` | `null` | Caller treats it as a miss and queries the database. |
| `CacheProvider.set` | `undefined` | Write lost; subsequent reads will repopulate from source. |
| `incrementWindowCounter` (IP rate limit) | `0` | First hit within the window — caller may apply a hard IP cap downstream. |
| `incrementWindowCounterWithPttl` | `{count: 0, pttlMs: -2}` | Throttler treats it as no recent activity. |
| `incrementCounterWithInitialTtlSeconds` (feed activity) | `0` | Counters reset; over-limit check downstream protects against bursts. |
| `publish` (cross-instance pub/sub) | `0` | Event lost; consumers rely on TTL refresh + replay list to recover. |

### Fail-closed (permissive fallback → temporary lockout)

Use fail-closed when an outage of the cache would **silently
disable** a security or rate-limit guarantee. In these cases the
caller picks a conservative response (reject, throttle harder,
require re-auth) rather than degrade silently.

Use fail-closed when:

- The cache stores a **reject list** (revoked JWTs, banned IPs,
  blocked refresh-token JTIs) — failing open would let revoked
  tokens through.
- The cache acts as an **advisory lock** for a scheduler or job;
  failing open would allow duplicate work.
- A specific feature has been audited and the operator explicitly
  requires it (e.g. login throttling for brute-force protection).

Examples:

| Operation | Fallback | Rationale |
| --- | --- | --- |
| `SecurityService` per-user refresh-token rate limiter | Caller checks the bound bucket; if the cache has been silent for > 60 s, applies an **admin lockout** instead of allowing the request. | F-12 audit finding; refuses to be a soft-burst vector. |
| `acquireAdvisoryLock` for schedulers | `null` | Scheduler skips the cycle and increments `quiz_scheduler_skipped_total`; the next cron tick retries. |
| `setIfNotExistsWithTtlSeconds` (lock-and-set) | `false` | Caller treats it as "lock already taken" — duplicates are rejected rather than permitted during outage. |

### Fail-closed is **opt-in via audit**

Adding a new cache to fail-closed requires a finding recorded in
`docs/runbooks/redis-cache-audit.md`. Operators and on-call need a
written justification for any cache that returns errors to the
client during an outage.

### Metrics for failure policy

Every cache reads or returns to its fallback increment a metric:

- `quiz_cache_invalidation_failed_total{kind}` — counter, business
  domain failed invalidation.
- `quiz_scheduler_skipped_total{reason="redis_circuit_open"}` —
  counter, scheduler skipped due to Redis circuit.
- `quiz_auth_rate_limiter_fail_open_total` — counter, security
  service entered fail-open mode.

Operators alert when the rate of these counters exceeds the SLO
budget even while `redis_circuit_state == 0` (closed) — that signals
a transient failure that the breaker is masking.

## Consequences

### Positive

- **Defaults are safe.** New contributors copy from a recent
  precedent, which is almost always fail-open (matches the
  codebase).
- **Security-relevant caches opt in.** Revoked-token lookups and
  brute-force protections cannot silently turn into fail-open
  without an audit trail.
- **Operators see the policy at a glance.** The fallback table on
  `RedisService` documents the policy alongside the method.

### Negative

- **Two policies in one codebase.** Operators reading the code may
  find that one cache short-circuits to `null` and another to
  `false`; the audit runbook and the JSDoc on `RedisService.exec`
  explain the differences.
- **Audit cost.** Every fail-closed cache requires an audit
  write-up; for a small team, this is the bottleneck to adding
  new security caches. We accept that as the price of safety.

## Alternatives considered

- **Always fail-open.** Rejected: revoked-token lookups and
  brute-force protection depend on Redis for accuracy; an outage
  would silently disable them.
- **Always fail-closed.** Rejected: most read-through caches are
  safe to recache on demand, and a fail-closed stance would
  surface Redis outages to users as 5xx, which is the worst-case
  outcome we are trying to avoid.
- **Operator-tunable per cache.** Considered and rejected:
  per-cache configuration puts the policy in code that requires a
  redeploy to change, defeating the on-call responsiveness the
  circuit breaker is meant to provide.

## References

- Source: `src/core/redis/redis.service.ts` (fallback table),
  `src/modules/auth/domain/security.service.ts` (two-tier
  policy), `src/core/redis/scheduler-lock.helper.ts`
  (fail-closed advisory locks), `src/core/observability/metrics.registry.ts`
  (failure-policy metrics).
- Runbook: `docs/runbooks/redis-cache-audit.md`.
- ADR-0023 (Fail-Open Circuit Breaker).
