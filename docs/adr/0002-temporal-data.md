# ADR-0002: Temporal Data — UTC Timestamps, ISO 8601 Wire Format

## Status

Accepted

## Context

All timestamps in the system must be stored, transmitted, and compared without timezone ambiguity. The system has multiple layers (database, application, HTTP wire) that each represent time differently, and inconsistent formats cause bugs in pagination, audit, and event ordering.

## Decision

**Storage:** All timestamps are stored as `timestamp with time zone` in PostgreSQL, always in UTC. The database server's `TimeZone` must be set to `UTC`.

**Generation:** Application code generates timestamps via `new Date().toISOString()` or `new Date().toISOString()` equivalents. `Date` objects are never stored directly; they are always stringified first.

**Wire format:** All timestamps on the HTTP response wire are ISO 8601 UTC strings with millisecond precision: `2025-01-15T08:30:00.000Z`. The `ResponseFormatInterceptor` normalizes all temporal fields in the response body via `normalizeTemporalFields()` from `src/common/utils/temporal-normalizer.util.ts` before the response is sent.

**Request handling:** Controllers receive temporal fields as ISO 8601 strings via `class-transformer`'s `@Type(() => Date)`. The `ValidationPipe` with `transform: true` performs the conversion.

**Cursor encoding:** Cursor objects encode timestamps as ISO 8601 strings (not `Date` objects or Unix epoch numbers). `encodeCursor()` and `decodeCursor()` in `src/common/utils/cursor.util.ts` handle the serialization.

## Consequences

**Advantages**
- A single normalization point (`normalizeTemporalFields`) catches all temporal fields regardless of nesting depth, including arrays and objects inside arrays.
- ISO 8601 UTC is unambiguous across clients and timezones.
- Cursor strings are human-readable in logs.
- The database stores UTC always; no timezone conversion at the application boundary.

**Trade-offs**
- `normalizeTemporalFields()` does a deep traversal of the response object; for very large payloads this adds overhead. The interceptor short-circuits on `StreamableFile` and already-formatted responses.
- Postgres `timestamp with time zone` is stored as UTC internally but renders with the session timezone when selected without `AT TIME ZONE`. Drizzle handles this transparently; raw SQL would need `AT TIME ZONE 'UTC'`.

## Evidence

- `src/common/utils/temporal-normalizer.util.ts` — `normalizeTemporalFields()` with suffix-based field detection (`time`, `timestamp`, `date`, `at`, `updated`).
- `src/common/interceptors/response-format.interceptor.ts` — calls `normalizeTemporalFields(payload)` after intercepting the response body.
- `src/common/responses/api-response.ts` — `ApiResponse.ok()` and `ApiResponse.page()` accept `Date` objects and convert them to ISO strings via `normalizeTemporalFields()`.
- `src/core/database/schema/taxonomy/schema.ts` — every table uses `timestamp({ withTimezone: true })`.
- `src/modules/tag/transport/swagger/examples/_timestamp.ts` — `EXAMPLE_TIMESTAMP = '2026-06-25T10:30:00.000Z'`.
- `src/modules/tag/transport/tag-timestamp.spec.ts` — regression test asserting ISO 8601 normalization for all presenter return paths.
- `docs/PROJECT_CONSTITUTION.md` §5.2 (Timestamps) — ISO 8601 as the canonical wire format.
