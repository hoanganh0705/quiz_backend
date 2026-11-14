---
name: nestjs-resilience
description: Designs resilient NestJS integrations with timeouts, bounded retries, circuit breakers, bulkheads, graceful degradation, and downstream failure handling.
---

# Resilience Engineering

Resilience mechanisms should reflect dependency behavior and user-facing guarantees. Retries can amplify outages.

## Workflow
Map synchronous and asynchronous dependencies, their timeouts, idempotency properties, capacity limits, and criticality.

## Rules
- Set explicit timeouts for outbound HTTP, database, and other network operations.
- Retry only transient failures and only when the operation is safe to retry.
- Use bounded retries with exponential backoff and jitter.
- Do not retry validation, authorization, or other permanent business failures.
- Respect downstream rate limits and `Retry-After` where applicable.
- Use circuit breakers or bulkheads when they protect a meaningful failure boundary; avoid adding them mechanically.
- Define fallback behavior and whether stale/degraded responses are acceptable.
- Propagate cancellation/deadlines where supported.
- Prevent retry multiplication across multiple layers.
- Ensure shutdown stops accepting new work and drains or safely abandons in-flight work.
- Make external side effects idempotent where possible.

## Verification
Test timeouts, transient/permanent failures, retry exhaustion, circuit recovery, concurrency limits, and graceful shutdown.
