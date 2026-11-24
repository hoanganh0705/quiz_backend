---
name: nestjs-websockets-socketio
description: Designs and maintains NestJS WebSocket gateways using Socket.IO, Redis adapter-based multi-instance broadcasting, handshake authentication, room authorization, and WebSocket rate limiting. Use when changing gateways, socket events, rooms, or real-time delivery.
---

# NestJS WebSockets with Socket.IO and Redis Adapter

This application uses NestJS WebSocket gateways, Socket.IO, and `@socket.io/redis-adapter` for multi-instance broadcasting, with WebSocket rate limiting. Inspect the existing gateway, adapter, auth, and Redis setup before editing. Do not assume a single-instance deployment.

## Required workflow
1. Inspect gateway classes, namespace/path configuration, Socket.IO options, adapter initialization, Redis publisher/subscriber lifecycle, authentication middleware/guards, rate limiter, and event DTOs.
2. Trace the client connection lifecycle: handshake, authentication, connection acceptance, room membership, event handling, disconnect, reconnect, and cleanup.
3. Identify whether an event is local to one process or must reach sockets connected to every application instance.
4. Preserve event names and payload compatibility unless a versioned change is explicitly planned.
5. Verify behavior with multiple server instances for any distributed broadcast or room feature.

## Gateway and lifecycle rules
- Keep gateways focused on transport and connection concerns; delegate business operations to application services.
- Validate event payloads at runtime. TypeScript interfaces do not validate network input.
- Handle connection, disconnection, transport errors, and shutdown without leaking listeners or Redis connections.
- Register the Redis adapter during the correct Socket.IO/NestJS initialization lifecycle for the installed versions.
- Create and close Redis publisher/subscriber clients deliberately; avoid duplicate clients or reconnect loops.
- Ensure the adapter is active on every server instance that participates in the same Socket.IO cluster.
- Do not confuse Redis adapter broadcast with durable message storage or guaranteed delivery to disconnected clients.

## Authentication and authorization
- Authenticate during the handshake using the project's established token/session mechanism.
- Validate token signature, issuer, audience, expiry, and revocation/session policy as applicable.
- Never trust a user ID, role, tenant ID, or permission supplied in socket event payloads.
- Store the authenticated principal in server-controlled socket data/context.
- Re-check authorization for sensitive room joins and every protected event; possession of a room name is not authorization.
- Scope room names safely by tenant/resource and prevent users from joining another user's private room.
- Define token expiry/revocation behavior for long-lived connections, including whether to disconnect or revalidate.
- Avoid logging handshake tokens, cookies, or sensitive payloads.

## Rooms and event design
- Treat room membership as an authorization-controlled capability.
- Join/leave rooms through explicit server-side operations with ownership checks.
- Use stable, namespaced room identifiers and avoid exposing internal identifiers unnecessarily.
- Define event names, payload schemas, acknowledgements, and error behavior consistently.
- Make client handling resilient to duplicate events and reconnects where relevant.
- Do not promise exactly-once delivery. If clients must recover missed state, provide an authoritative resync/query mechanism or durable event history.
- Keep broadcasts minimal; do not send private fields to a broad room and rely on clients to hide them.

## Distributed Redis adapter
- Confirm publisher and subscriber clients are connected and configured correctly before accepting traffic, following the installed adapter's documented lifecycle.
- Verify all application replicas use compatible Socket.IO namespaces, paths, and adapter configuration.
- Distinguish cross-instance broadcast from application-level persistence and job queues.
- Define behavior during Redis outage: whether local sockets continue, whether cluster broadcasts pause, and how clients recover.
- Avoid using adapter internals as a substitute for a durable event bus.
- Monitor Redis connectivity, adapter errors, connection counts, and broadcast failures where supported.

## WebSocket rate limiting and resource protection
- Apply limits at connection/handshake and event levels as appropriate.
- Use distributed counters/storage when limits must apply across replicas.
- Choose identity keys carefully: authenticated principal, IP from a trusted proxy chain, event type, and/or namespace.
- Bound payload sizes, event frequency, room joins, concurrent connections, and expensive operations.
- Treat client-provided forwarded IP headers as untrusted unless proxy trust is configured.
- Ensure throttling failures have deliberate fail-open/fail-closed behavior based on event risk.
- Rate limiting does not replace authorization or payload validation.

## Reconnect and resilience
- Assume clients disconnect, reconnect, and may send duplicate commands.
- Make state-changing commands idempotent where possible, using command/event IDs if the use case requires it.
- Do not assume a missed broadcast will be replayed by Socket.IO Redis adapter.
- Provide a resynchronization strategy for important state after reconnect.
- Use acknowledgements/timeouts for commands where clients need confirmation.
- Handle graceful server shutdown and ensure clients can reconnect to another healthy instance.

## Verification
- Test handshake authentication failures and expired/revoked credentials.
- Test unauthorized room joins and cross-tenant access attempts.
- Test payload validation, event-level throttling, and oversized payload rejection.
- Test broadcast between at least two server instances using the Redis adapter.
- Test Redis outage/recovery, reconnect/resync behavior, duplicate commands, and graceful shutdown.
- Verify no secrets or private fields leak through logs or room broadcasts.
