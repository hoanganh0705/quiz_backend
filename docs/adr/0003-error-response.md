# ADR-0003: Error Response Strategy — RFC 7807 Problem Details

## Status

Accepted

## Context

All HTTP error responses must be consistent in shape, machine-readable, and debuggable. Clients consuming the API need a stable structure they can parse without guessing field names. The system must distinguish between client errors (4xx), server errors (5xx), and domain/business logic errors.

## Decision

**Format:** Every error response uses `application/problem+json` content type and conforms to RFC 7807 with the following fields:

```Shell
type     — stable URI from RFC7807_TYPE_URIS or a project-specific URI
title    — short human-readable summary
status   — HTTP status code (number)
detail   — concrete context-specific message
instance — request URL
extensions.code    — machine-readable domain identifier (stable)
extensions.requestId — x-correlation-id value
extensions.timestamp — ISO 8601 UTC timestamp
```

**Single producer:** `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`) is the only component that produces error responses. Controllers, application services, and domain services MUST NOT return error responses directly.

**Code registry:** Every domain error has a stable string `code` (e.g. `TAG_NOT_FOUND`, `AUTH_INVALID_CREDENTIALS`) declared on the exception class. `ProblemCodeMapping` (`src/common/errors/problem-code-mapping.ts`) is the single registry mapping `code` → `{ status, title, typeUri }`. `GlobalExceptionFilter` resolves domain exceptions via this table.

**Loud failure:** If a domain exception's `code` is not found in `ProblemCodeMapping`, the filter throws an assertion error rather than silently mapping to 500. Every code added to the codebase must have a corresponding mapping entry in the same commit.

**HTTP status is derived, not encoded:** Domain exceptions carry `code` and `message` only. They do not carry HTTP status codes. The status is looked up from `ProblemCodeMapping` in the filter. This separation allows the same domain error to return different HTTP statuses in different contexts (e.g. `TAG_NOT_FOUND` → 404 everywhere, but a generic `RESOURCE_CONFLICT` → 409).

## Consequences

**Advantages**

- A single source of truth for all error semantics makes the API predictable.
- Clients can programmatically handle errors by `code` without parsing `detail`.
- The `code` is stable across API versions; the HTTP status may change without breaking clients that key on `code`.
- The loud-failure invariant (`ProblemCodeMapping.spec.ts` asserts every code has an entry) prevents silent misconfiguration.

**Trade-offs**

- The `type` URI requires maintenance when the URI structure changes.
- Synthesizing an error code for non-domain exceptions (e.g. `HttpException`) loses domain-specific nuance — the `STATUS_TO_GLOBAL_CODE` mapping is coarser than per-code mapping.
- The `detail` field is the only human-readable message; it is not i18n-ready.

## Evidence

- `src/common/filters/global-exception.filter.ts` — `GlobalExceptionFilter`; handles `BaseDomainException`, `HttpException`, `Error` in three distinct branches.
- `src/common/errors/problem-code-mapping.ts` — the canonical `{ [code]: { status, title, typeUri } }` registry; every entry has a docblock citing the throw site.
- `src/common/types/problem-detail.type.ts` — `ProblemDetail` type and `RFC7807_TYPE_URIS` map.
- `src/common/swagger/swagger-schemas.ts` — `ProblemDetailDto` schema for OpenAPI.
- `test/rfc7807.e2e-spec.ts` — regression test asserting all canonical RFC 7807 fields on every error path.
- Every module has a `*.spec.ts` co-located with its errors asserting that every `code` resolves in `ProblemCodeMapping`.
- `docs/PROJECT_CONSTITUTION.md` §4.3 — explicitly locks RFC 7807 as the error format.
