---
name: nestjs-caching
description: Designs application caching in NestJS with Redis or existing cache infrastructure, including cache-aside, TTLs, invalidation, stampede prevention, and consistency trade-offs.
---

# NestJS Caching

Caching is a consistency decision, not merely a performance decorator.

## Workflow
Identify read patterns, data freshness requirements, update frequency, source of truth, and existing cache infrastructure before choosing a strategy.

## Rules
- Prefer cache-aside when suitable: read cache, load source on miss, populate with a bounded TTL.
- Define cache keys, versioning, TTL, serialization, and invalidation ownership.
- Include tenant/user/permission dimensions in keys when results differ by caller; never share private data across identities.
- Invalidate or update affected entries after successful writes; do not invalidate before a transaction commits.
- Consider stale-while-revalidate or short TTLs only when stale reads are acceptable.
- Protect hot keys from stampedes with request coalescing, locks, or controlled refresh where justified.
- Bound cache memory and avoid unbounded key cardinality.
- Treat Redis cache loss as a normal cache miss, not data loss.
- Do not cache authorization decisions or sensitive responses without a clear security model.
- Avoid caching rapidly changing data without explicit freshness semantics.

## Verification
Test cache hit/miss, invalidation after writes, expiry, concurrent misses, tenant isolation, serialization compatibility, and Redis outage behavior.
