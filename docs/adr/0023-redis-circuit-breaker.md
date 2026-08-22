# ADR-0023 — Fail-Open Circuit Breaker for Redis

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-08-19 |

## Context

Redis is on the critical path for:

- Refresh-token storage and rotation.
- Rate limiting (`incrementWindowCounter`).
- Caching (and stampede locks — see ADR-0022).
- BullMQ's internal job buffer.
- Health checks and metrics scrapes.

When Redis becomes unreachable (network partition, pod restarts,
`OOMKill`), every request that touches the cache or rate-limits
the user would otherwise block on a 30-second TCP timeout. A
single Redis incident becomes a full application outage.

Worse, every request that *already failed* continues to issue new
Redis commands on a connection that we know is down. We saw one
incident where a 90-second Redis stall was followed by a 3-minute
recovery as the application drained its timeout queue.

## Decision

We wrap every business-critical Redis call (cache reads/writes,
rate-limit counters, stampede locks) in a **per-operation circuit
breaker**. The breaker has three states:

```
         ┌────────────────────┐
         │      CLOSED        │ ← normal operation; counts failures
         └────────┬───────────┘
                  │ failure threshold reached
                  ▼
         ┌────────────────────┐
         │      OPEN          │ ← short-circuit; call default open
         └────────┬───────────┘
                  │ reset timeout elapsed
                  ▼
         ┌────────────────────┐
         │    HALF-OPEN       │ ← allow one trial
         └────────┬───────────┘
                  │
       ┌──────────┴──────────┐
       │ trial succeeds      │ trial fails
       ▼                     ▼
    CLOSED                OPEN
```

### Configuration

| Setting | Default | Rationale |
| --- | --- | --- |
| `REDIS_CIRCUIT_FAILURE_THRESHOLD` | 5 | A handful of transient errors is normal; 5 in a row is a real outage. |
| `REDIS_CIRCUIT_RESET_TIMEOUT_MS` | 30 000 | 30 s gives Redis enough room to recover without flooding it with probes. |

Both are environment variables validated at startup and exposed as
typed `redisConfig` properties.

### What is short-circuited

- `CacheProvider.get`, `set`, `del`, `incrementWindowCounter`,
  `acquireStampedeLock`.
- The Redis `ping()` health probe is **not** short-circuited — we
  want the probe to report the truth even when the circuit is open
  (the `/health` endpoint depends on it).

### Fail-open behavior

When the circuit is open, the wrapper returns a configured fallback:

| Operation | Fallback |
| --- | --- |
| `get` / `getOrSet` | `undefined` (the fetcher re-runs) |
| `incrementWindowCounter` | `1` (always count this attempt; caller enforces limits downstream) |
| `acquireStampedeLock` | `false` (treats it as a stampede-able miss; the call site falls through to direct fetch) |

This is "fail-open" on purpose. We trade a temporary loss of
cache and rate-limit precision for the certainty that the API
keeps responding to clients during a Redis incident.

### Metrics

Every state transition is logged as a `trace_span`-class event
with `circuit_state`, `circuit_target`, and the prior/new state.
The `redis_circuit_state` gauge is exposed via `/metrics` so an
operator can alert on `state=open` for more than 30 seconds.

## Consequences

### Positive

- **Bounded blast radius.** A Redis incident surfaces as cache
  misses and looser rate limits; it does not propagate to the
  user-visible 5xx.
- **Self-healing.** The half-open trial recovers the circuit the
  moment Redis comes back; no operator action required.
- **Observable.** Every state transition is logged and metered,
  so on-call can see the cycle in Grafana / the audit log without
  needing to read source code.

### Negative

- **Loosened rate limits during incidents.** A user who would have
  been rate-limited at 60 requests/minute can burst up to the
  process-level limit during the open state. We accept this
  trade-off (the alternative is 503 to legitimate users).
- **Threshold tuning.** A new deployment in a network with
  higher-than-expected transient failure rates can be tricked
  into opening the circuit. The defaults are conservative but a
  deployment with greenfield networking should consider raising
  the threshold.

## Alternatives considered

- **Fail-closed.** Rejected: the user impact of a Redis outage is
  the impact we are trying to avoid; fail-closed is the same as
  no defense.
- **Per-call timeout + retry.** Rejected: it doesn't bound the
  total request latency and it compounds the load on a sick Redis.
- **External circuit-breaker library (e.g. `opossum`).** Considered
  but rejected: the project's footprint is small and the extra
  dependency added more unknown than the 200-line implementation
  removed.

## References

- Source: `src/core/redis/redis-circuit-breaker.ts`,
  `src/core/redis/redis.service.ts`, `src/core/config/redis.config.ts`.