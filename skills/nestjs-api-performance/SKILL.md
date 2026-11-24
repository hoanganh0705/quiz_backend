---
name: nestjs-api-performance
description: Diagnoses and improves NestJS API performance, including event-loop blocking, database access, serialization, concurrency, memory, and latency. Use when endpoints are slow or before performance-sensitive releases.
---

# NestJS API Performance

Measure before optimizing. Do not claim an improvement without evidence.

## Workflow
1. Establish the endpoint's latency, throughput, payload size, error rate, and workload.
2. Trace time across application logic, database, Redis, queues, and external services.
3. Inspect query plans and database pool behavior before changing indexes or query structure.
4. Identify CPU, memory, event-loop, serialization, and network bottlenecks.
5. Make one focused change and compare against a baseline.

## Rules
- Avoid N+1 queries, unbounded reads, and over-fetching.
- Use pagination and bounded request sizes.
- Use appropriate indexes based on query plans and real access patterns.
- Keep CPU-heavy work off the event loop when it is material.
- Set timeouts and cancellation behavior for external dependencies.
- Avoid unbounded Promise fan-out; use controlled concurrency.
- Cache only when the data's freshness and invalidation semantics are understood.
- Do not add caching to hide an inefficient or incorrect query without understanding the source problem.
- Consider response serialization and large object graphs.
- Check connection pool sizing against replica count and database capacity.

## Verification
Compare p50/p95/p99 latency, throughput, resource use, and correctness under representative load. Include the test method and limitations.
