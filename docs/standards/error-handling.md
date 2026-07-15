# Error Handling Standard

> Project-specific rules for error responses, domain exceptions, and the canonical error wire format.
> Out of scope: framework-level error mechanics; only RFC 7807 conventions used in this codebase are documented.

## Purpose

Defines how errors are constructed in domain and infrastructure layers, how they map to HTTP responses, and what the wire format MUST look like.

## Scope

Applies to `src/common/errors/`, `src/common/filters/`, `src/common/swagger/swagger-schemas.ts`, every domain exception in `src/modules/<m>/domain/errors/`, and the repository layer where constraint violations are translated.

## Source of Truth

- `src/common/errors/base-domain.exception.ts` — abstract `BaseDomainException` carrying `code`.
- `src/common/errors/problem-code-mapping.ts` — code → HTTP status/title/typeUri map.
- `src/common/filters/global-exception.filter.ts` — global `GlobalExceptionFilter` that emits `application/problem+json`.
- `src/common/types/problem-detail.type.ts` — `ProblemDetail` shape and `RFC7807_TYPE_URIS` map.
- `src/common/swagger/swagger-schemas.ts` — `ProblemDetailDto` schema.
- `src/modules/tag/domain/errors/tag-domain.errors.ts` — example module errors.
- `src/modules/tag/infrastructure/repositories/tag.repository.ts` — constraint-to-exception translation.
- `test/rfc7807.e2e-spec.ts` — wire-format regression.

## Rules

### Error wire format

- Every error response MUST be `application/problem+json` content type and conform to RFC 7807 (`type`, `title`, `status`, `detail`, `instance`) plus the project's machine-readable `code`. Reference: `src/common/types/problem-detail.type.ts` and `src/common/swagger/swagger-schemas.ts:ProblemDetailDto`.
- A canonical error response MUST include:
  - `type` — stable URI from `RFC7807_TYPE_URIS` or a project-specific URI added to that map.
  - `title` — short human-readable summary.
  - `status` — HTTP status code (number).
  - `detail` — context-specific message (already produced by the domain's exception).
  - `instance` — request URI.
  - `code` — project's machine-readable identifier, populated from the domain exception.
- The canonical error response MUST NOT include `data` or `meta`. Successful responses carry the envelope; errors do not. See `api.md`.
- The correlation ID MUST be included in headers (`X-Correlation-Id`) AND, when configured, in a problem-detail extension. The canonical extension key is `correlationId`.

### Domain exceptions

- A domain exception MUST extend `BaseDomainException` (`src/common/errors/base-domain.exception.ts`) and MUST carry a unique, stable, machine-readable `code` property. The `code` is the contract — changing it is a breaking change.
- A domain exception MUST NOT include HTTP data (no status, no title, no URI). It MUST carry only `code` and a human-readable `message`. The mapping to HTTP lives in `ProblemCodeMapping`.
- A domain exception MUST be defined in the module's `domain/errors/<module>-domain.errors.ts`. The error class file MUST be small and focused; if the count grows, split by sub-domain.
- The error class name MUST end with `Error` (e.g. `TagNotFoundError`, `TagSlugConflictError`) and MUST be exported from `domain/errors/index.ts` when the module exports all domain errors there.
- A domain exception MUST NOT be thrown from `infrastructure/` directly without a translation step. Repositories translate database errors (`23505`, `23503`, `23514`) into domain exceptions (`src/modules/tag/infrastructure/repositories/tag.repository.ts#mapDatabaseErrorToDomainError`).
- Cross-cutting exceptions (e.g. `NotFoundError`, `ValidationError`, `UnauthorizedError`) MUST live under `src/common/errors/cross-cutting/`. They MUST map through `ProblemCodeMapping`.

### Code mapping

- `ProblemCodeMapping` (`src/common/errors/problem-code-mapping.ts`) is the single registry that maps a `code` (string) to `{ status, title, typeUri }`. Adding a new domain exception MUST be paired with an entry in this file.
- The mapping entry MUST include the same `code` string as the domain exception class.
- The `typeUri` MUST be a stable URL or URN. Adding a new one requires `RFC7807_TYPE_URIS` to be updated in `src/common/types/problem-detail.type.ts`.
- A code SHOULD be namespaced: `<MODULE>_<ENTITY>_<CONDITION>` (e.g. `TAG_NOT_FOUND`, `TAG_SLUG_CONFLICT`). The namespace is the module's uppercase short name.

### Global filter

- `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`) MUST be the only producer of error responses. Controllers and services MUST NOT return `HttpException` instances directly to the wire (exceptions are caught and re-shaped).
- The filter MUST handle three input categories in this order:
  1. `BaseDomainException` — translated via `ProblemCodeMapping`.
  2. NestJS `HttpException` — translated to a stable synthesized code (e.g. `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`).
  3. Native errors — translated to a generic `INTERNAL_ERROR` with status 500. Sensitive details MUST NOT leak; only the canonical fields are returned.
- The filter MUST add the correlation ID to the problem-detail extension block.
- The filter MUST log the error with the request context (correlation ID, actorId when available, module name from the route).

### HTTP status vs. domain code

- The HTTP status MUST be decided in `ProblemCodeMapping`, never in the throwing layer.
- A 4xx code MUST be used for client mistakes (validation, not found, conflict, unauthorized, forbidden, throttled).
- A 5xx code MUST be reserved for genuine server faults. Domain bugs that surface as client errors MUST remain 4xx, not 5xx.
- A 409 (Conflict) MUST be used for state-machine conflicts (e.g. duplicate slug). A 422 (Unprocessable Entity) MUST be used when payload is structurally valid but semantically rejected (e.g. invariants violated by the request). A 400 (Bad Request) MUST be used for validation failures raised by `ValidationPipe`.

### Repository error translation

- A repository MUST map Postgres error codes (`23505` unique violation, `23503` foreign-key violation, `23514` check violation, `23502` not-null violation, etc.) to the matching domain exception. Reference: `src/modules/tag/infrastructure/repositories/tag.repository.ts` translates unique-violation slug errors into `TagSlugConflictError`.
- The mapping MUST be exhaustive per code that the queries can produce. A silent re-throw of the raw error is forbidden.
- A repository MUST NOT construct a `ProblemDetail`, set HTTP status, or import from `common/filters/`. The translation is to the domain's exception; the filter does the rest.
- A constraint violation that has no matching domain exception SHOULD surface as an `INTERNAL_ERROR` with a structured log line documenting the un-mapped code. Adding a new domain exception MUST be preferred over an `INTERNAL_ERROR` for known cases.

### Application and transport layers

- An application service MUST let domain exceptions bubble up unchanged. It MUST NOT catch a `BaseDomainException` to log-and-rethrow as a different code.
- A controller MUST NOT construct an `HttpException`. The flow is: domain → `BaseDomainException` → `GlobalExceptionFilter` → wire response.
- An authorization failure (e.g. missing permission) MUST be raised by `PermissionsGuard`; the filter MUST emit `FORBIDDEN` with the synthesized code `FORBIDDEN`. A controller MUST NOT throw `ForbiddenException` directly.
- A throttled request MUST produce a `429` via `ThrottlerGuard`. Application code MUST NOT throw `ThrottlerException` directly.

### Validation errors

- `ValidationPipe` failures are produced by `@nestjs/common` as `BadRequestException`. The filter MUST translate this to `BAD_REQUEST` with a synthesized code, preserving the per-field error structure (the validation `messages` field in the response body) for debugging.
- A request shape error MUST NOT reuse a domain code (e.g. `TAG_NOT_FOUND`). It MUST always be `BAD_REQUEST`.

### Not found cases

- A resource that is not found MUST raise a domain exception with code `<MODULE>_<ENTITY>_NOT_FOUND`. The mapping MUST set HTTP status to 404. Reference: `TagNotFoundError` (`src/modules/tag/domain/errors/tag-domain.errors.ts`).
- A controller MUST NOT return `res.status(404).json(...)` directly. The flow is: domain check → `BaseDomainException` → filter.

### Conflict and concurrency

- A unique constraint violation MUST be translated to a domain conflict exception. The repository pattern is the single source of truth for this translation.
- A concurrency violation (`SerializationFailure`) MUST surface as `INTERNAL_ERROR` (Postgres serialization failures are typically retryable). A retry strategy is not currently in the codebase; future addition MUST update this standard.

### Logging on errors

- Errors MUST be logged at the appropriate level: 4xx at `warn` or `info`, 5xx at `error`. The default filter classifies by status.
- Logs MUST include the `correlationId`, the route, the `actorId` (when the request reached `JwtGuard`), and the thrown `code` (when known).
- Logs MUST NOT include the request body for sensitive endpoints (e.g. login). Filter-level redaction is required.

### Test coverage

- A new domain exception MUST add an assertion that `ProblemCodeMapping` returns the expected tuple.
- A new mapping MUST update `test/rfc7807.e2e-spec.ts` with at least one case for the new code. The canonical fields and extension fields are checked.
- A repository translation MUST be exercised in a unit test or integration test that asserts the right domain exception is thrown for the matching Postgres error code.

### Consistency rules

- The error wire format MUST NOT be branched. There is one filter; one shape; one mapping table.
- A second producer of error responses (e.g. middleware, custom decorator that returns 4xx directly) is forbidden.
- A custom error envelope beside `{ type, title, status, detail, instance, code }` is forbidden.

## Examples

### Domain exception class

```typescript
// src/modules/tag/domain/errors/tag-domain.errors.ts
export class TagNotFoundError extends BaseDomainException {
  readonly code = 'TAG_NOT_FOUND';
  constructor(message = 'Tag not found') {
    super(message);
  }
}
```

### Mapping entry

```typescript
// src/common/errors/problem-code-mapping.ts
[TAG_NOT_FOUND]: {
  status: 404,
  title: 'Tag not found',
  typeUri: 'https://api.quiz.dev/problems/tag-not-found',
}
```

### Repository translation

```typescript
if (e.code === '23505' && e.constraint?.includes('slug')) {
  throw new TagSlugConflictError(`Tag slug '${slug}' already exists.`);
}
```

### Filter emission (high-level)

```typescript
// src/common/filters/global-exception.filter.ts
const problem: ProblemDetail = {
  type: entry.typeUri,
  title: entry.title,
  status: entry.status,
  detail: exception.message,
  instance: request.url,
  code: exception.code,
};
response.status(entry.status).type('application/problem+json').json(problem);
```

## Non-goals

- Documenting HTTP status code semantics in general.
- Documenting RFC 7807 from scratch.
- Explaining when to choose between transport and domain layers for an error — that is the constitution's call.

## Future considerations

- A standardized i18n problem-detail `detail` translation layer is not yet implemented. If added, the new layer MUST live in `common/errors/i18n/` and the filter MUST consume it.
- A retry / circuit-breaker layer around `INTERNAL_ERROR` may be added; this standard MUST be updated to describe how retries interact with the canonical filter.