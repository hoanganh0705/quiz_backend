# Redis-Backed Socket.IO Deployment Runbook

> Operational guide for the Phase 3 horizontal-scaling infrastructure
> (`RedisIoAdapter` + `RedisSocketConnectionRegistry`). Aim: keep the
> application runnable in single-instance development and CI, while
> making horizontal scaling a deployment-time concern that does not
> require code changes.

---

## What this runbook covers

Phase 3 of the Instance architecture review introduces two Redis-backed
collaborators:

| Component | Purpose | Failure mode if Redis is down |
|---|---|---|
| `RedisIoAdapter` (`src/core/redis/redis-io.adapter.ts`) | Replaces the in-process Socket.IO adapter with the Redis pub/sub adapter so `server.to(room).emit(...)` reaches every replica the room spans. | App refuses to boot (the adapter throws on the first `createIOServer()` call). |
| `RedisSocketConnectionRegistry` (`src/modules/instance/infrastructure/repositories/redis-socket-connection.registry.ts`) | Stores `{ instanceId, userId }` keyed by `socketId` so cross-instance disconnects can still emit `PlayerDisconnectedEvent`. | Socket joins and disconnects silently degrade to single-process semantics (the previous Map-based behavior). |

Both are gated on Redis availability at boot time. **Redis is a hard
dependency for production**; this runbook explains how to develop without
it (single-process) and how to deploy with it (horizontally scaled).

---

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `REDIS_URL` | required in production | `redis://host:port` URL passed to `RedisService` and to the Socket.IO Redis adapter. Validated at boot by `env.validation.ts` (`redis://` or `rediss://`). |
| `DISABLE_REDIS_SOCKET_ADAPTER` | unset | When set to `true` the bootstrap skips `app.useWebSocketAdapter(new RedisIoAdapter(app))` — `main.ts` falls back to the in-process Socket.IO adapter. **Use only for single-process development and CI.** Never set this in any environment that runs more than one application replica. |

`RedisService` does not expose a separate config knob for the
cross-instance socket metadata; the registry's TTL has a sensible default
of 60 seconds and is operator-tunable via
`RedisSocketConnectionRegistry.setTtlMs(...)` (currently a code-side
configuration — operators wanting a different window should escalate).

---

## Boot-time failure modes

### 1. `REDIS_URL` unset

`REDIS_URL` is required by `env.validation.ts` — the application refuses
to boot:

```
REDIS_URL is not defined in environment variables
```

If you hit this in a horizontally-scaled deployment, you almost
certainly forgot to set it in your orchestrator's secret store.

### 2. `REDIS_URL` set, but Redis unreachable

The first time the application creates a Socket.IO server
(`createIOServer(...)`), the adapter opens two ioredis clients and
checks the readiness handshake. If that fails:

```
Error: Redis connection to redis://quizredis:6379 failed
```

The application **fails fast** — it does not start listening on the
HTTP port. This is intentional: silently degrading to an in-process
adapter would mean horizontal scaling silently drops every cross-instance
event, which is much harder to detect than a hard boot failure.

To run with a single replica in this condition while you recover Redis,
set `DISABLE_REDIS_SOCKET_ADAPTER=true`. That opts out of the Socket.IO
adapter only — `RedisSocketConnectionRegistry` still works against the
shared `RedisService`.

---

## Production checklist

When promoting the application to a horizontally-scaled environment:

1. **Provision Redis with persistence disabled**. The `@socket.io/redis-adapter`
   pub/sub channel carries transient events only — Redis AOF/RDB does not
   replicate pub/sub state. You want memory-only Redis (or `save ""` in
   `redis.conf`), not a managed Redis that costs per GB of disk.
2. **Run Redis with at least the persistence of the application** — if
   the application is multi-AZ, so should Redis be. Socket.IO
   reconnecting from a clean Redis means every active room is lost
   across the cluster.
3. **Wire Redis monitoring** (memory, connected clients, pub/sub channel
   count). Three signals matter:
    - `connected_clients` should be ≥ the number of application replicas
      (each replica opens ~3 connections — 1 long-lived command
      connection via `RedisService`, plus 2 for the Socket.IO adapter).
      During a rolling deploy, brief spikes are normal.
    - `used_memory` should trend with cluster size, not grow unbounded.
    - `pubsub_patterns` / `pubsub_channels` count of `socket.io*`
      channels gives you an upper bound on the cross-instance fan-out
      rate.
4. **Don't share Redis with an unrelated workload** if that workload
   consumes large keyspaces. The Socket.IO adapter uses
   `socket.io#<nsp>#` channels plus a request/response pair; these are
   small but fire on every emit.

---

## Local development

`DISABLE_REDIS_SOCKET_ADAPTER=true` flips the application into
single-process mode:

```bash
# Single-instance dev — start Postgres + Redis ONLY for the things
# that actually need Redis (rate limit, leaderboard cache, session
# invalidation, attempt outbox, attempts retry queue, etc.).
pnpm db:start
pnpm redis:start

DISABLE_REDIS_SOCKET_ADAPTER=true pnpm start:dev
```

The application boots with the default in-process Socket.IO adapter.
Cross-instance events are now scoped to the running replica — fine for
dev, broken in any deployment with N ≥ 2. The `RedisSocketConnectionRegistry`
itself still works against the shared `RedisService`, so its tests
exercise the live infrastructure.

To run two replicas against the same Redis for manual cross-instance
verification:

```bash
# Terminal A
PORT=8080 pnpm start:dev

# Terminal B (load balancer target — different port)
PORT=8081 pnpm start:dev
```

Open the frontend against either replica and trigger a host-driven
event (`start_countdown`, `start_game`); the client should receive the
broadcast regardless of which replica it attached to.

---

## CI

`pnpm test:e2e` runs all `*.e2e-spec.ts` files. Phase 3 additions:
- `test/socket-connection-registry.e2e-spec.ts` — gates on
  `REDIS_URL`; skipped when unset. Verifies the registry round-trips
  against a live `RedisService`.

Both follow the established pattern from `review-helpful.e2e-spec.ts`:
skip the whole suite when `REDIS_URL` is empty so engineers without
local Redis can still run the suite. CI environments that have Redis
provisioned should run the suite non-skipped.

---

## Monitoring & observability

The application emits structured pino logs for every adapter and
registry event. Operationally important signals:

| Log event | When | Why it matters |
|---|---|---|
| `redis_socket_adapter_attached` | Once per process at boot (one per namespace actually, but practically once). | If this log line is **missing** on a replica, the adapter was disabled — investigate before scaling out. |
| `redis_socket_adapter_client_error` | ioredis reports a connection error after boot. | Transient errors are normal during rolling deploys; persistent errors mean Redis is sick. |
| `socket_connection_registry_record_failed` | `record(...)` against the registry threw. | Should be rare; spikes correlate with Redis instability or with clients joining during a Redis blip. |
| `socket_connection_registry_consume_failed` | `consume(...)` threw. | Means `PlayerDisconnectedEvent` was not emitted for that socket. Correlate with `instance_phase3_disconnect_event_dropped_count` if you add one. |
| `socket_connection_registry_get_failed` | `getMeta(...)` threw. | Read-side observability gap. The TTL ensures the entry eventually disappears, so this is non-fatal. |

If you add a custom log field (e.g. `connected_clients_count`,
`replica_count`), thread it through the existing
`@InjectPinoLogger(RedisIoAdapter.name)` / `@InjectPinoLogger(RedisSocketConnectionRegistry.name)`
loggers. Both services already log structured pino events.

---

## Tuning

### TTL on `SocketConnectionRegistry`

Default: 60 seconds, set in
`RedisSocketConnectionRegistry.DEFAULT_TTL_MS`.

The TTL must be:
- **Greater than the Socket.IO reconnection backoff**. Default
  Socket.IO reconnects at 1s ± jitter, doubling to 5s. 60 s covers
  that with a wide margin.
- **Shorter than any meaningful idle window you care about for
  presence**. If you need accurate `connected = true` for a long-idle
  client, the registry will silently drop the entry and a subsequent
  disconnect becomes a no-op.

To change: edit `DEFAULT_TTL_MS` and redeploy, or call
`setTtlMs(...)` from `InstanceModule.onApplicationBootstrap(...)`.

### Adapter prefix

`RedisIoAdapter` accepts a `key` option, used as the Redis pub/sub
channel prefix:

```ts
app.useWebSocketAdapter(new RedisIoAdapter(app, { key: 'quiz-instances' }));
```

This defaults to `'socket.io'`. Override only when multiple
independent Socket.IO clusters share a single Redis — otherwise the
clusters' packets will interleave.

---

## What this runbook deliberately does NOT cover

- **Sharded Redis pub/sub**. Phase 3 uses the standard
  `createAdapter(pubClient, subClient)` API. Moving to
  `createShardedAdapter(...)` is a single-file change to
  `redis-io.adapter.ts` and is on the post-Phase-3 roadmap if
  `PUBSUB_CHANNELS` ever becomes a bottleneck.
- **Failover between two Redis primaries**. The `RedisService` is
  configured against a single URL; failover orchestration is the
  operator's responsibility (sentinel, managed-Redis HA, etc.).
- **Socket-side retry budget**. Phase 3's idempotency contract (the
  registry's `consume`-via-`GETDEL`) covers the disconnect hot path;
  the join hot path uses optimistic connection-state-restoration and
  is not affected by Redis blips at the cost of a missed
  `PlayerDisconnectedEvent`.

---

## Reference

- [`src/core/redis/redis-io.adapter.ts`](../src/core/redis/redis-io.adapter.ts) — the WebSocket adapter.
- [`src/modules/instance/domain/ports/socket-connection-registry.port.ts`](../src/modules/instance/domain/ports/socket-connection-registry.port.ts) — the registry port.
- [`src/modules/instance/infrastructure/repositories/redis-socket-connection.registry.ts`](../src/modules/instance/infrastructure/repositories/redis-socket-connection.registry.ts) — the registry implementation.
- [`docs/instance-architecture-review.md`](../instance-architecture-review.md) §"Phase 3 — Production Deployment Readiness" — the design rationale.
