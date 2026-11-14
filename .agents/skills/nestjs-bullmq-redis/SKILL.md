---
name: nestjs-bullmq-redis
description: Designs NestJS background jobs and asynchronous workflows using BullMQ and Redis, including retries, idempotency, scheduling, concurrency, and failure handling. Use when adding queues, workers, or deferred processing.
---

# NestJS BullMQ and Redis

Use background jobs when work should not block a request, needs controlled concurrency, or must survive process restarts.

## Workflow
Inspect installed package versions, Redis configuration, queue names, worker deployment model, and conventions. Define payload, owner, retry policy, idempotency key, timeout, and terminal failure behavior.

## Reliability rules
- Treat jobs as at-least-once work: processors must be idempotent or safely deduplicate.
- Pass small serializable payloads; prefer stable entity IDs over mutable records or secrets.
- Enqueueing and a database transaction are not atomic. If event loss is unacceptable, propose a transactional outbox or explicit reliability design.
- Configure bounded attempts, backoff, and deliberate retention.
- Classify permanent versus transient failures.
- Set concurrency and rate limits based on downstream capacity.
- Make processors safe after restarts and partial completion.
- Do not store credentials or unnecessary personal data in job payloads.
- Define observability and a safe recovery/replay procedure.
- Avoid CPU-bound work on the main event loop.

## Redis rules
Define key namespaces and TTL/invalidation behavior. Redis is not the source of truth for durable business records. Handle connection failures and shutdown gracefully.

## Verification
Test duplicate delivery, retry behavior, permanent failure, worker restart, idempotency, and payload compatibility.
