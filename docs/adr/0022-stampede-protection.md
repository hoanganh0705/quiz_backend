# ADR-0022 — Stampede Protection in the Cache Layer

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-08-19 |

## Context

Read-through caching protects the database from hot reads — the
`GET /quizzes` list, the user profile bundle, and the per-quiz
stats endpoints are all read-through. The naïve pattern is

```ts
async function get(key) {
  const hit = await cache.get(key);
  if (hit) return hit;
  const fresh = await fetcher();
  await cache.set(key, fresh, ttl);
  return fresh;
}
```

This works for steady traffic, but a popular key's TTL expires
during a traffic spike: every concurrent request sees the miss
and runs the fetcher. If the fetcher is "fetch all quizzes from
Postgres and render them", the database takes 100 concurrent
queries for the same row — the classic **cache stampede** (or
*thundering-herd* problem).

The naïve mitigation — global request deduplication — does not
work because the requests come from different HTTP connections.

## Decision

We implement **per-key stampede protection** with a Redis lock
held by the first concurrent miss. The pattern is:

1. **Read.** `cache.get(key)`. If hit, return.
2. **Acquire.** `SET key:lock <owner> NX PX 5000`. If success, this
   caller owns the fetch.
3. **If lock acquired**, run the fetcher, `SET key <value> EX ttl`,
   `DEL key:lock`, and return the value.
4. **If lock not acquired** (someone else is fetching), poll
   `cache.get(key)` every 50 ms for up to 500 ms. If the result
   appears, return it. If not, fall back to the fetcher directly
   (the lock owner may have crashed; we tolerate a small stampede
   rather than blocking the user indefinitely).

### Lock TTL

The lock TTL is 5 seconds, longer than the worst-case fetcher
runtime. A crashed lock owner leaves the lock to expire on its
own; the next caller will see the expired lock and acquire it.

The retry delay is 50 ms with a maximum of 10 retries (500 ms
worst-case wait). Beyond that we degrade to direct fetch — the
stampede protection is best-effort, not a hard barrier.

### Code surface

The implementation lives in
`CacheProvider.getOrSetWithStampedeProtection(...)` in
`src/common/ports/cache.provider.ts`. Every cache call site that
needs the protection (quiz list, quiz stats, user profile bundle)
uses this method. The simpler `getOrSet` helper remains for keys
where a stampede is impossible (per-user, write-once).

The Redis circuit breaker (`RedisCircuitBreaker`) wraps the lock
acquisition; when Redis is down, the lock returns `false` and the
caller falls through to direct fetch.

## Consequences

### Positive

- **Database load stays flat during traffic spikes.** A 1 000-rps
  request burst against the quiz list hits the fetcher exactly
  once, not 1 000 times. Postgres takes one query; the other 999
  wait briefly and then read the cached value.
- **Lock TTL bounds stuck locks.** A crashed lock owner cannot
  block subsequent callers beyond the lock TTL.
- **Degradation is graceful.** When the lock contention exceeds
  the retry budget, the caller falls through to the fetcher
  rather than receiving an error — the user still gets a
  response.

### Negative

- **Best-effort, not absolute.** The 500 ms retry budget means a
  pathological case (e.g. fetcher hangs for 600 ms) results in a
  short stampede. We accept this because the alternative
  (blocking the user indefinitely) is worse.
- **Redis dependency.** The lock mechanism depends on Redis. We
  mitigate this with the circuit breaker: when Redis is down, the
  lock acquisition throws, the call falls through to the fetcher,
  and the database takes the hit. The cost is acceptable because a
  Redis outage already degrades cache reads to direct fetches.
- **Latency under contention.** A request that arrives 50 ms into
  a 200 ms fetcher waits another 100 ms for the cache. The
  `STAMPEDE_RETRY_DELAY_MS` and `STAMPEDE_MAX_RETRIES` tunables
  let us tune the trade-off for each cache namespace.

## Alternatives considered

- **Probabilistic early refresh (XFetch).** Rejected: harder to
  reason about, and the lock-based approach is easier to test
  deterministically.
- **Background refresh job.** Rejected: requires a scheduler and
  duplicates logic across modules. The lock approach uses the
  existing `CacheProvider` infrastructure.
- **Application-level mutex (`async-mutex`).** Rejected: the
  mutex would only deduplicate requests inside one Node.js
  process, not across replicas. Redis is the only coordination
  point that works for horizontally-scaled deployments.
- **Stale-while-revalidate with a long TTL.** Rejected: the stale
  window is a correctness/availability trade-off we don't want
  to make for the quiz list (new quizzes should appear within a
  second of creation).

## References

- Source:
  `src/common/ports/cache.provider.ts#getOrSetWithStampedeProtection`,
  `src/core/redis/redis-circuit-breaker.ts`,
  `src/modules/quiz/application/quiz-cache.service.ts`,
  `src/modules/quiz/application/quiz-cache.utils.ts`.