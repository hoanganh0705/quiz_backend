# Database Standard

> Project-specific rules for persistence, schema definition, migrations, and the repository pattern.
> General ORM usage is framework knowledge; only project conventions are documented here.

## Purpose

Defines how PostgreSQL tables are defined with Drizzle ORM, how IDs and timestamps are produced, how soft delete is implemented, how transactions are scoped, and what repositories own. Every schema and repository change MUST comply.

## Scope

Applies to `src/core/database/schema/`, `src/core/database/migrations/`, `src/core/database/database.module.ts`, and every module's `infrastructure/repositories/` directory. Out of scope: cache key conventions (no project-wide convention found in the codebase — `REDIS_CACHE_KEY_PREFIX` is per-module) and read/write splitting.

## Source of Truth

- `src/core/database/schema/` — Drizzle schema definitions and relations.
- `src/core/database/migrations/0000_*.sql` — generated migrations.
- `src/core/database/drizzle.constants.ts` — Symbol tokens and provider keys.
- `src/core/database/database.module.ts` — Drizzle client wiring.
- `src/modules/tag/infrastructure/repositories/tag.repository.ts` — full reference (Drizzle queries, constraint translation, soft delete).
- `package.json` — `db:generate`, `db:migrate`, `db:studio`, `db:seed`.
- `drizzle.config.ts` — schema/migration locations.

## Rules

### Schema definitions

- Every table MUST be defined in a `<context>/schema.ts` file inside `src/core/database/schema/<context>/`. Bounded contexts include `auth/`, `taxonomy/`, `quiz/`, `user/`, `ranking/`, `achievement/`, `social/`, `comment/`, `review/`, `notification/`, `instance/`, and `outbox/`.
- Every table MUST export a TypeScript function returning the columns (`pgTable` factory) — not a constant — so Drizzle can compose relations. Reference: `src/core/database/schema/taxonomy/schema.ts`.
- Every bounded context MUST export a `relations.ts` file that wires Drizzle relations for the context's tables; `core/database/schema/index.ts` MUST re-export both.
- Every table's primary key MUST be `id: uuid('id').primaryKey().default(sql\`uuidv7()\`)` or a named timestamp-prefixed UUIDv7 (`src/common/utils/id-generator.ts`). Other ID strategies MUST go through a new standard.
- Every table MUST expose `createdAt` and `updatedAt` columns with `timestamp with time zone` and `default(sql\`now()\`)`; `updatedAt` MUST be a generic trigger-updated column when business code modifies rows. Reference: `src/core/database/schema/taxonomy/schema.ts:tags.createdAt`.
- Every table SHOULD expose `deletedAt: timestamp('deleted_at', { withTimezone: true })` for soft delete (see Soft Delete below).

### Identifiers and IDs

- Primary key generation MUST go through `generateUuidV7()` from `src/common/utils/id-generator.ts`. Application MUST NOT use `crypto.randomUUID()`.
- Composite natural keys MUST live in `UNIQUE` indexes. Application code MUST query by the primary `id` and not by composite natural keys.
- External identifiers that must be globally unique (e.g. user-facing slugs) MUST be enforced by partial unique indexes scoped to live rows, e.g. `UNIQUE INDEX … ON … (slug) WHERE deleted_at IS NULL` (see Soft Delete).
- Foreign keys MUST use `ON DELETE RESTRICT` by default and MUST be explicit (`src/core/database/schema/taxonomy/schema.ts`).

### Soft delete

- Soft-deleted rows MUST be retained for the retention window defined by `SecurityConfig.authAuditRetentionDays` or a per-domain equivalent.
- Every query against a soft-delete-aware table MUST filter `WHERE deleted_at IS NULL` (reference: `src/modules/tag/infrastructure/repositories/tag.repository.ts#softDeleteFilter`). The `isNull(deletedAt)` helper MUST be defined in the repository's `soft-delete.ts` (or equivalent) and reused.
- A unique constraint on a soft-deletable column MUST be partial: `WHERE deleted_at IS NULL`. This lets a re-using entity reclaim its slug after deletion.
- The repository MUST expose `softDelete(id)` returning the updated row, not the row's raw fields. Hard delete is reserved for outbox/audit cleanup tooling and MUST NOT appear in feature paths.

### Timestamps

- All persisted timestamps MUST be stored as UTC `timestamp with time zone`. Date arithmetic MUST use UTC helpers and MUST NOT rely on local time. Reference: `id-generator.ts`, `temporal-normalizer.util.ts`.
- The wire format is ISO 8601 UTC with milliseconds, enforced by `ResponseFormatInterceptor` after the row is read.
- Date-only fields MUST use `date` (not `timestamp`) when timezone is irrelevant (e.g. daily metrics partitions).
- A row's `updatedAt` MUST reflect the most recent meaningful state change (e.g. updating a name). System writes (audit trail only) MUST NOT touch `updatedAt`. The `outbox` and `authAuditLogs` tables are exempt because their lifecycle is append-only.

### Transactions

- Application code MUST NOT call `db.transaction(...)` directly. Transactions are entered via `@Transactional()` on a controller or application service method, which is wired by `TransactionalInterceptor` (`src/common/interceptors/transactional.interceptor.ts`). The transaction client is propagated through `TRANSACTIONAL_CONTEXT` (`AsyncLocalStorage`).
- Inside a transaction, repositories MUST use the contextual client (`getTransactionalClient()`-equivalent, see `transactional.interceptor.ts`). MUST NOT instantiate a new transaction mid-flight.
- Multi-write operations (e.g. creating a quiz with its tags, audit, and outbox record) MUST be wrapped in `@Transactional()`. Single-write operations SHOULD stay outside a transaction.
- MUST NOT use `SERIALIZABLE` isolation unless a documented invariant requires it. Default is `READ COMMITTED` (Postgres default); cross-row invariants MUST be enforced by `UNIQUE`/`CHECK` constraints.

### Repository responsibilities

- Every module MUST have exactly one repository per aggregate; repositories MUST live in `src/modules/<name>/infrastructure/repositories/` and implement the matching `domain/ports/<name>-repository.port.ts`.
- Repositories MUST own the translation of Drizzle-level constraint errors (e.g. `23505` unique-violation, `23503` foreign-key violation, `23514` check violation) into the module's domain exceptions (see `error-handling.md`). Reference: `src/modules/tag/infrastructure/repositories/tag.repository.ts#mapDatabaseErrorToDomainError` and `TagRepositoryConstraintError` to `TagSlugConflictError`.
- Repositories MUST throw `BaseDomainException` subclasses, not raw `HttpException`s, not Postgres `DatabaseError`s. The repository surface stays framework-agnostic.
- A repository method MUST NOT return drizzle row fragments; the returned shape MUST be a value object (`Tag`, `Quiz`) defined in the module's `domain/`. The application layer maps that value object to DTOs.
- A repository MUST validate at most one invariant per query and MUST split writes that span multiple aggregates into separate repository methods orchestrated by the application service.

### Indexes and constraints

- Index creation MUST be colocated with the table definition in the same `pgTable(...)` factory call. MUST NOT create ad-hoc indexes from migration-time raw SQL unless a generator limitation prevents in-line declaration.
- Multi-column uniqueness MUST be a single `UNIQUE` index with explicit column order (not two single-column unique indexes).
- Domain invariants on rows (e.g. `average_rating BETWEEN 0 AND 5`) MUST live in `CHECK` constraints, not in application code. Reference: `src/core/database/schema/taxonomy/schema.ts` and earlier `0000_*.sql` migrations.
- Index naming MUST follow the `idx_<table>_<columns>` convention. Constraint naming MUST follow `<table>_<column>_<kind>`.

### Migrations

- MUST be generated via Drizzle's tooling (`db:generate`) with the names defined in `drizzle.config.ts`. Manual SQL edits to `migrations/*.sql` are only permitted when the change is structural and accompanied by a comment explaining why.
- MUST run in the order of file timestamps and MUST NOT be deleted. Compacting migrations requires a separate "DB rebuild" runbook, NOT migration deletion.
- MUST be reviewed with the same rigor as application code. Migrations that drop or alter columns MUST also update Drizzle schemas within the same PR (see `code-review.md`).
- Destructive migrations (drop column, drop table) MUST include a brief `rationale` and a rollback path in the PR description or in an adjacent RUNBOOK.

### Migrations specifically — see `migration.md`

Schema evolution, deprecation, and rollout are governed by `migration.md`. This file covers the conventions; that one covers the process.

### Cache invalidation

- A repository MUST NOT directly invalidate cache keys. Cache reads/writes/invalidations live in the application service or domain service that owns the aggregate; the repository is pure persistence.
- The pattern in the codebase: the domain service performs `redis.set` after write and `redis.del` after delete; the application service is responsible for the cache key namespace per bounded context. New bounded contexts MUST follow this pattern.

### Querying

- Use Drizzle's typed query builders. String fragments MUST go through Drizzle's `sql\`\`` helper; raw `pg.query(...)` MUST NOT appear in feature code.
- Page-by-paginating results MUST be expressed with cursor pagination helpers from `src/common/utils/cursor.util.ts`. MUST NOT select `count(*)` for cursor pages.
- Search across many columns MUST use a single GIN index per language column or a dedicated search provider (see `search/`) — MUST NOT do `ILIKE '%term%'` style wildcards at scale.
- Multi-tenant data MUST use a `tenantId` column and a per-query predicate; row-level security is not configured in the current codebase.

### Data integrity

- A change that creates or alters a constraint MUST include a backfill migration when existing data would otherwise fail (e.g. new `NOT NULL` with default via Drizzle).
- Outbox events MUST be written in the same transaction as the domain write that produced them (`src/common/outbox/` patterns).
- A delete that implies a downstream effect (audit log, soft-purged foreign keys) MUST go through a dedicated event listener (the `<module>-event-bootstrap.service.ts` pattern) — application code MUST NOT call cleanup inline.

## Examples

### Drizzle table with UUIDv7, soft delete, and unique partial index

```typescript
// src/core/database/schema/taxonomy/schema.ts:tags
export const tags = pgTable('tags', (t) => ({
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  slug: t.text().notNull(),
  name: t.text().notNull(),
  createdAt: t.timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: t.timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  deletedAt: t.timestamp({ withTimezone: true }),
}), (t) => ({
  slugUniqueIdx: uniqueIndex('idx_tags_slug_unique').on(t.slug).where(sql`deleted_at IS NULL`),
}));
```

### Soft-delete filter in repository

```typescript
// src/modules/tag/infrastructure/repositories/tag.repository.ts
.and(isNull(tags.deletedAt))
```

### Constraint to domain error

```typescript
// src/modules/tag/infrastructure/repositories/tag.repository.ts
if (e.code === '23505' && e.constraint?.includes('slug')) {
  throw new TagSlugConflictError(...);
}
```

### Transactional boundary

```typescript
@Post()
@Transactional()
async create(@Body() dto: CreateQuizDto): Promise<ApiResponseEnvelope<...>> {
  return this.presenter.create(await this.applicationService.create(dto, this.user.actorId));
}
```

## Non-goals

- Documenting Drizzle-specific syntax beyond project conventions.
- Documenting connection pooling — configuration lives in `core/config`.
- Documenting anti-patterns that are not currently implemented in the project (e.g. read replicas, table partitioning).

## Future considerations

- If the project introduces connection pooling at the PGBouncer level, the connection-string handling MUST be updated in `core/config/`, and `database.module.ts` SHOULD NOT change.
- If additional bounded contexts are added, MUST mirror the existing schema/relations/index.ts structure for the new context.