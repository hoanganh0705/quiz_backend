# ADR-0032 — WebSocket Rate Limiting & Connection Policy

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-09-26 |

## Context

WebSocket gateways (notifications, comments, quiz instance, coins)
were not gated by a throttler, so a single misbehaving client could
spam any `@SubscribeMessage` handler and overload the gateway workers.
The Phase 8 audit also flagged that:

- Unauthenticated sockets were accepted on the initial handshake and
  only rejected on the first event, leaking partial server time
  before disconnect.
- The CORS allow-list for WS connections was inferred independently
  from `server.corsOrigins` and could drift.
- Quiz-room broadcasts were forwarding `reporterId` from raw event
  payloads, exposing reporter-identifying fields on public comments.

## Decision

The WebSocket layer is now a first-class gated surface:

- **`WsThrottlerGuard`** is wired into every gateway. It mirrors the
  HTTP `RedisThrottlerStorage` so the same circuit-breaker,
  fail-open, and metrics semantics apply. Per-handler limits are
  declared with `@WsThrottle({ default: { limit, ttl } })` on each
  `@SubscribeMessage` handler.
- **Pre-auth disconnect.** The first `handleConnection` returns
  `false` for sockets that arrive without a valid session, and
  disconnects them immediately. No work is performed for anonymous
  sockets.
- **WS CORS derives from `server.corsOrigins`.** The
  `RedisIoAdapter` reuses the same parsed origin allow-list as
  HTTP, so the two surfaces cannot drift.
- **reporterId redaction.** Quiz-room payloads strip the
  `reporterId` field before broadcast. Domain events carry a
  generic `actorType` (`user`, `system`, `moderator`) that does
  not identify the reporter to other participants.

## Consequences

### Positive

- A misbehaving socket cannot drive the gateway workers above the
  declared per-handler rate; rejects are exposed through
  `quiz_ws_throttler_rejections_total{namespace,handler}` for
  operator alerting.
- The Redis circuit-breaker applies uniformly to HTTP and WS
  throttler reads, so a Redis outage degrades both surfaces the
  same way (fail-open) instead of silently disabling throttling on
  one surface.
- Public WS rooms cannot leak the reporter of a comment or review.

### Negative

- Each WS namespace ships an additional decorator on every
  handler; the discipline is checked in code review. A missing
  `@WsThrottle` on a new handler defaults to a low global ceiling
  applied by `WsThrottlerGuard`, so a forgotten decorator is
  safe-by-default rather than unbounded.
- Authenticated sockets that drop a refresh token mid-session
  continue receiving messages until the next heartbeat checks the
  session; the runbook documents the expected disconnect latency.

## Evidence

- `src/common/decorators/ws-throttle.decorator.ts`.
- `src/common/guards/ws-throttler.guard.ts`.
- `src/core/throttler/redis-throttler.storage.ts`.
- `src/core/redis/redis-io.adapter.ts`.
- `src/modules/notification/transport/gateway/notification.gateway.ts`.
- `src/modules/comment/transport/gateway/comment.gateway.ts`.
- `src/modules/instance/transport/gateway/instance.gateway.ts`.
- `src/modules/coins/transport/gateway/coin.gateway.ts`.
- `src/core/observability/metrics.registry.ts`
  (`quiz_ws_throttler_rejections_total`).

## References

- ADR-0013 (Authorization Model — Three-Layer RBAC + Permissions).
- ADR-0029 (Per-Cache Fail-Open vs Fail-Closed Failure Policy).
- `docs/audit/phase8-security-trust-boundary-audit.md`.
- `docs/audit/phase9-security-remediation-plan.md` § P4.1–P4.4.
