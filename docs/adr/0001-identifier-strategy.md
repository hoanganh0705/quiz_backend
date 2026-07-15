# ADR-0001: Identifier Strategy — UUIDv7 for All Primary Keys

## Status

Accepted

## Context

All entities in the system require a stable, globally unique identifier that is sortable by creation time, resistant to enumeration, and consistent between the application layer and the database.

The system must avoid collisions across distributed instances, support cursor-based pagination using ID + timestamp, and produce identifiers that are safe to emit on the wire.

## Decision

All primary keys use UUID version 7 (RFC 9562), generated via `generateUuidV7()` from `src/common/utils/id-generator.ts`. The PostgreSQL extension `pg_uuid_v7` generates them server-side as the column default. Application code uses `generateUuidV7()` for IDs that must be known before insert (e.g. outbox idempotency keys, audit records).

UUIDv7 is chosen because:
- It is time-ordered (bits 48–64 encode a millisecond-precision Unix timestamp).
- It is globally unique without coordination.
- It is safe to emit on the wire (no PII, no secrets).
- The Postgres `uuidv7()` extension produces the same format as the application library, ensuring byte-alignment between app-generated IDs and DB-default IDs.

The application MUST NOT use `crypto.randomUUID()` (v4) for business identifiers. `crypto.randomUUID()` is acceptable only for correlation IDs and non-business tokens.

## Consequences

**Advantages**
- Cursor pagination can safely use `(createdAt, id)` pairs — `id` alone would sort by UUID generation order, not creation order.
- IDs are safe to expose on the wire; no enumeration risk from the format.
- No coordination needed to generate IDs across multiple instances.
- `generateUuidV7()` produces lowercase hex (matching Postgres `uuidv7()` output), preventing casing mismatches between app and DB.

**Trade-offs**
- UUIDv7 is 128 bits vs. a 64-bit bigint, increasing storage and index size.
- Cross-referencing IDs by timestamp range requires a separate `createdAt` column (which every table already has).

## Evidence

- `src/common/utils/id-generator.ts` — `generateUuidV7()` implementation; comment explicitly warns against `crypto.randomUUID()`.
- Every primary key column in `src/core/database/schema/` uses `uuid('id').primaryKey().default(sql\`uuidv7()\`)`.
- `src/modules/auth/infrastructure/outbox/outbox.adapter.ts` — outbox event IDs generated via `generateUuidV7()` for idempotency keys.
- `src/modules/quiz/transport/presenters/quiz.presenter.ts` — wire responses emit UUIDs as strings in `tagId`, `quizId`, etc. DTOs.
- `docs/PROJECT_CONSTITUTION.md` §5.1 (Identifiers) — explicitly locks UUID v7 as the only acceptable strategy.
