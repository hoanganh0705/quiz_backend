# Performance Standard

> Project-specific rules for caching, throttling, query patterns, and resource ceilings.
> Generic optimization advice is not documented here; only conventions that already exist in the codebase.

## Purpose

Defines how this project enforces acceptable latency and resource usage without dictating new optimization strategies. Documentation is intentionally narrow: only existing rules are captured.

## Scope

Applies to `src/core/redis/`, the global `ThrottlerGuard`, paginated queries, soft-deletion filters, and per-controller resource ceiling decorators.

## Source of Truth

- `src/core/redis/redis.module.ts` — Redis integration.
- `src/core/redis/redis.service.ts` — `RedisService` (cache + pub/sub + counters).
- `src/app.module.ts:76-86` — global `ThrottlerGuard` and per-route `@Throttle` configuration.
- `src/modules/tag/dto/request/tag-ranking-query.dto.ts` — pagination ceilings.
- `src/modules/tag/domain/tag.service.ts` — cache invalidation pattern after writes.
- `src/common/responses/pagination.ts` — `CursorPagination` and `OffsetPagination` ceilings.
- `src/common/utils/cursor.util.ts` — cursor encoding/decoding utilities.

## Rules

### Pagination ceilings

- A paginated query MUST declare a maximum page size at the DTO level. The current canonical value is `100` (see `TagRankingQueryDto`); a different module MUST document its own maximum in its DTO and this standard.
- A controller MUST NOT accept unbounded `limit` or `take` values. The `@Max(N)` decorator is the canonical enforcement point.
- A controller MUST NOT accept `offset` (large numerical offsets) for cursor-paginated endpoints. Offset pagination is restricted to small-result pages (audit, search) and MUST be guarded by an upper bound on `offset` to keep query plans bounded.

### Caching

- The project uses Redis (`src/core/redis/redis.module.ts`) for both caching and pub/sub. Redis is the canonical cache; adding an in-process cache module is forbidden.
- Cache writes MUST live in the application or domain service that owns the aggregate, not in the controller. References: `src/modules/tag/domain/tag.service.ts`.
- Cache keys MUST be namespaced per bounded context. The namespacing convention is `rl:<module>:<aggregate>:<id-or-pattern>` for rate-limit counters and the aggregate's own key prefix for domain caches. A new module MUST define its prefix in its `module.constants.ts`.
- Cache invalidation MUST be paired with the write that invalidates the data. After `softDelete`, the cache entry MUST be deleted. After `update`, the cache entry MUST be replaced (or deleted).
- A `cache miss` MUST NOT throw. The fallback path is the canonical read path through the repository.
- Sensitive payloads (audit, password reset tokens) MUST NOT be stored in Redis plaintext. Tokens and secrets MUST be encrypted at rest before being placed in Redis, or MUST NOT be cached.
- MUST NOT introduce per-feature cache libraries (e.g. cache-manager, lru-cache). The Redis client is the only allowed cache.

### Rate limiting

- Rate limiting MUST go through the global `ThrottlerGuard` (`src/app.module.ts:76-86`) backed by Redis. The throttler storage MUST remain Redis across replicas.
- Per-route limits MUST use `@Throttle({ <bucket>: { limit, ttl } })`. The bucket name MUST be declared and documented here or in the module that owns the route.
- Default global limits MUST be conservative; route-specific overrides MUST be additive, not replacing the global.
- `RateLimit-*` response headers MUST be enabled by the throttler configuration and SHOULD be documented in OpenAPI per-route.

### Query patterns

- A list query MUST filter `WHERE deleted_at IS NULL` before any join. The canonical rule and the soft-deletion contract live in `database.md`; this entry exists here because the filter is also a query-plan concern. Reference: `src/modules/tag/infrastructure/repositories/tag.repository.ts`.
- A cursor-based query MUST include a stable sort key alongside `id` so cursors remain stable after inserts (createdAt + id is the canonical pattern, see `cursor.util.ts`).
- An aggregate query (`count(*)`, percentile) MUST NOT run on a hot path. Aggregate queries live under `application/analytics` and are scheduled, not request-driven.
- A query that scans many rows MUST use an index. Reference: `src/core/database/schema/taxonomy/schema.ts` indexes and the migration `0000_lean_ken_ellis.sql` cover most cases.

### Transactions

- A multi-write endpoint MUST be wrapped in `@Transactional()`. For each transaction, the connection is reused from `TransactionalContext`; new clients are forbidden inside the transaction.
- A long transaction MUST be split into smaller transactions (write side → event bus → outbox). The project uses an outbox pattern (`src/common/outbox/`).
- A read-only request MUST NOT open a transaction.

### Logging and observability

- Structured logging MUST use `nestjs-pino` and MUST include `correlationId`. Adding a duplicate logger at a different verbosity is forbidden.
- The `correlationId` MUST flow from HTTP request → domain → outbox event in async events. The `CommonExternalEventBus` MUST restore the correlation ID via `AsyncLocalStorage` (`src/common/events/common-external-event-bus.ts`).
- Critical-path metrics (rate limit hits, cache hits/misses) MUST be logged at the `info` level with structured fields. Latency-sensitive paths MUST log duration with `info`.

### Resource ceilings

- Endpoint-specific ceilings:
  - Search endpoints MUST cap `limit` at the module-specific maximum.
  - Bulk endpoints (e.g. follow-many, bulk-update) MUST declare a `@Max(N)` on the array length or its equivalent.
  - File-upload-style endpoints are not yet implemented; when added, MUST declare per-upload size and per-request count caps.
- The default body parser limit (`src/main.ts`) MUST NOT be relaxed without a security review.

### What MUST NOT be introduced

- Background workers, schedulers, or cron jobs inside the NestJS app. The codebase does not currently include them; the outbox processor and event consumers are not implemented as in-process servers today. Future schedulers MUST be added behind a port, with a separate standard describing their lifecycle.
- Query result caches that bypass Redis.
- Cache stampedes by issuing identical upstream calls: when a key is missing, the load MUST be limited (e.g. SET-NX lock or single-flight at the application layer). The pattern is not yet implemented in this codebase; if introduced, this standard MUST be updated.
- Eager fan-out for relationship expansion (e.g. `findByIdWithEverything()` style queries). A presenter MUST compose fields through targeted queries.

### Performance testing

- Performance testing under load is not part of CI in this codebase. When added, this standard MUST be updated with the tool, the environment, and the SLO acceptance thresholds.
- A change that introduces a query scanning many rows MUST require the reviewer to mark the change in `docs/migrations/<name>.md` with a measured baseline.

## Examples

### Caching with Redis

```typescript
// src/modules/tag/domain/tag.service.ts (after find)
const cached = await this.redis.get(`tag:detail:${id}`);
if (cached) return JSON.parse(cached);
const tag = await this.repository.findByIdOrSlug(id);
await this.redis.set(`tag:detail:${id}`, JSON.stringify(tag), 'EX', 300);
return tag;
```

### Pagination ceiling

```typescript
// src/modules/tag/dto/request/tag-ranking-query.dto.ts
@ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
limit?: number = 20;
```

### Rate limiting per-route

```typescript
@Post('login')
@Throttle({ auth: { limit: 5, ttl: 60_000 } })
async login(@Body() dto: LoginDto) { … }
```

### Soft-delete indexed query

```typescript
// src/modules/tag/infrastructure/repositories/tag.repository.ts
const rows = await this.db.select()
  .from(tags)
  .where(and(isNull(tags.deletedAt), /* ... */))
  .orderBy(asc(tags.createdAt), asc(tags.id))
  .limit(limit);
```

## Non-goals

- General micro-optimization (memoization, premature inlining).
- Recommending CDN or caching strategies outside the codebase.
- Recommending connection-pool tuning unless a documented invariant requires it.

## Future considerations

- If a query-result cache pattern is introduced, this document MUST add a dedicated "Cache stampede prevention" section and a corresponding test category in `testing.md`.
- If a read-replica is added, the read/write routing rules belong here (not in `database.md`).
- If a job/scheduler pattern is adopted, the rules belong in this standard, not invented in code without one.