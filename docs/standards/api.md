# API Standard

> Project-specific rules for HTTP API shape, versioning, pagination, and backward compatibility.
> Wire-format rules for errors live in `error-handling.md`; wire-format rules for documentation live in `swagger.md`.

## Purpose

Defines the project's HTTP API conventions: response envelope, versioning, pagination, endpoint naming, DTO usage, and backward compatibility. Every new endpoint MUST comply.

## Scope

Applies to controllers and the wire-format only. Out of scope: error mapping (see `error-handling.md`), Swagger mechanics (see `swagger.md`), security headers (see `security.md`).

## Source of Truth

- `src/main.ts` — global prefix `api/v1`, Helmet, CORS, cookie parser, body parsers (lines 31, 37, 60-86).
- `src/app.module.ts` — global `ThrottlerGuard` (lines 76-86).
- `src/common/interceptors/response-format.interceptor.ts` — successful response envelope shape.
- `src/common/responses/api-response.ts` — `ApiResponseEnvelope`, `ApiResponse.ok`, `ApiResponse.page`, `isApiResponse`.
- `src/common/responses/pagination.ts` — `CursorPagination`, `OffsetPagination`, `PaginationMeta`.
- `src/common/swagger/api-ok.ts` — `ApiOkResource`, `ApiCreatedResource`, `ApiOkResourceList`, `ApiOkResourceArray`.
- `src/modules/tag/` — full reference (controllers, presenter, DTOs).
- `test/envelope.e2e-spec.ts` — wire-shape regression guard.

## Rules

### Versioning and prefix

- The HTTP prefix MUST be `api/v1` (reference: `src/main.ts:31`, `GlobalPrefix: 'api/v1'`).
- New endpoints MUST live under `api/v1/...`. New versions MUST live under `api/v2/...` with the prior version removed only after a deprecation cycle defined in `migration.md`.
- Path parameters MUST use lowercase, plural nouns (`/tags`, `/quizzes`, `/users`, `/follows`) unless the resource is itself singular (`/health`).
- Path parameters MUST be UUIDv7 by default; MUST surface human-readable slugs only via `ParseUUIDOrSlugPipe` (reference: `src/common/pipes/parse-uuid-or-slug.pipe.ts`).

### Response envelope

- Every successful HTTP response MUST be wrapped in `{ data, meta }` by `ResponseFormatInterceptor` (`src/common/interceptors/response-format.interceptor.ts:ResponseFormatInterceptor#intercept`). The interceptor is registered globally and MUST NOT be re-registered per-module.
- A controller that returns a pre-built `ApiResponseEnvelope` MUST return it via the presenter only, and the presenter MUST project the inner value into a plain object first (`src/modules/tag/transport/presenters/tag.presenter.ts:wrapPaginatedDto`). Returning a class instance directly bypasses the interceptor's `isFormattedResponse()` check and re-wraps the body.
- The `meta` block MUST contain at minimum `timestamp` (ISO 8601 UTC string). For lists, `meta.pagination` MUST follow `PaginationMeta` in `src/common/responses/pagination.ts`.
- MUST NOT introduce a different envelope (e.g. `{ result, error }`, `{ items, total }`). The envelope is fixed.
- The envelope's `data` MUST be the canonical DTO instance or array, NEVER a class instance (`instanceof`) because `@nestjs/swagger` schema generation fails on class instances. See `tag.presenter.ts:wrapPaginatedDto`.
- Errors MUST NOT return the `{ data, meta }` envelope. Errors are emitted by `GlobalExceptionFilter` as `application/problem+json` only.

### Pagination

- List endpoints MUST use cursor pagination with `?limit=…&cursor=…` parameters and MUST return `PaginationMeta` with `kind: 'cursor'`, `limit`, `hasNextPage`, `nextCursor` (`src/common/responses/pagination.ts:11-37`).
- Cursor values MUST be base64-encoded JSON objects produced by `encodeCursor` and decoded by `decodeCursor` in `src/common/utils/cursor.util.ts`. They MUST NOT be raw database row IDs.
- Offset pagination MUST be reserved for endpoints without a stable natural sort key (e.g. audit log search). When used, the response MUST include `kind: 'offset'` and `total` (see `OffsetPagination` in `src/common/responses/pagination.ts`).
- The default `limit` MUST be 20 unless domain-specific semantics demand otherwise. MUST NOT exceed the per-endpoint maximum enforced by `@Max(…)` validators.
- Empty results MUST be `data: []` with `hasNextPage: false` and the metadata block still present.

### DTO usage

- Request bodies, query strings, and path parameters MUST be declared as a `class-validator` DTO. Controllers MUST use `@Body() dto` / `@Query() dto` / `@Param('id', Pipe)` and MUST NOT receive raw Express types (`Request`, `Response`) in production code paths.
- DTOs MUST be co-located by direction under `dto/request/` and `dto/response/` (or `dto/` for nested cases such as `mappers/ranked-tag-response.mapper.ts`).
- Response DTOs MUST be plain TypeScript classes with `@ApiProperty` annotations so they can be referenced from `@nestjs/swagger`.
- Request DTOs SHOULD use `class-transformer`'s `@Transform` to canonicalize inputs (e.g. trim string, lowercase) before validation.
- See `validation.md` for the canonical validator and transform rules.

### Endpoint declarations

- Each controller route MUST declare at least: the right guard via class-level or method-level decorator, success via `ApiOkResource*`, and error responses (see `swagger.md`).
- Rate-limited endpoints MUST use `@Throttle({ default: { limit, ttl } })` per-route AND/OR rely on the global `ThrottlerGuard` from `src/app.module.ts:76-86`.
- Public endpoints MUST be marked with `@Public()` from `src/common/decorators/public.decorator.ts`. Anything not annotated is implicitly authenticated by the global `JwtGuard`.

### Backward compatibility

- MUST NOT remove, rename, or repurpose a field on a response DTO. Additions are allowed; renames MUST go through a deprecation cycle.
- MUST NOT change a path parameter's type or format (e.g. UUID → slug) without a deprecation window during which both shapes are accepted. See `migration.md`.
- MUST NOT alter cursor encoding. Backwards compatibility for cursors that were valid yesterday must hold tomorrow. A new cursor encoding is a major version.
- New optional query parameters MUST default to a value that preserves existing behavior.

### Naming

- Collection endpoints MUST use plural nouns (`GET /tags`, `GET /users/me/followed-tags`). Singleton endpoints MUST use the singular form on the path with a stable identifier (`GET /tags/:id`, `GET /users/:idOrSlug`).
- Action endpoints (verbs) MUST be restricted to state-changing operations that cannot be expressed as a resource manipulation: `POST /tags/:id/follow`, `POST /quizzes/:id/bookmark`. Reference: `src/modules/tag/transport/controllers/tag.controller.ts:followTag`, `unfollowTag`.
- Nested resources SHOULD be expressed via a leading `me` segment when the parent is the authenticated user (`/users/me/followed-tags`, achieved with a controller mounted at `''` parent — `user-tag.controller.ts`).

### Timestamps and IDs on the wire

- Every timestamp on the wire MUST be ISO 8601 UTC with milliseconds (`2025-01-15T08:30:00.000Z`). The `ResponseFormatInterceptor` normalizes via `src/common/utils/temporal-normalizer.util.ts`. Application code MUST emit `Date` objects; the interceptor MUST normalize them.
- Every identifier on the wire MUST be a UUIDv7 string. Application code MUST NOT emit numeric IDs in DTOs.
- Boolean flags MUST be present and MUST use a JSON `boolean`, not `0/1`.

### Headers

- The response MUST include `X-Correlation-Id` on every request, generated by `CorrelationInterceptor` (`src/common/interceptors/correlation.interceptor.ts`). Echoing the inbound header is required.
- The response MUST include `Content-Type: application/json; charset=utf-8` for non-empty bodies. Errors use `application/problem+json` (see `error-handling.md`).
- Versioning is via the URL prefix, not via headers (no `Accept: application/vnd.quiz.v2+json`).
- Helmet defaults MUST stay enabled (`src/main.ts:60-86`); security headers are documented in `security.md`.

### OpenAPI synchronization

- Controllers MUST keep their Swagger composition under `transport/swagger/` updated. The generated `docs/generated/openapi.json` is the wire contract and MUST be regenerated (`pnpm generate:openapi`) and committed with code that changes any response DTO or endpoint shape. See `swagger.md`.

## Examples

### Envelope construction (tag presenter)

```typescript
// src/modules/tag/transport/presenters/tag.presenter.ts:wrapPaginatedDto
return ApiResponse.page(tagDtos, this.toPagination(items), { timestamp });
```

### Cursor encoding

```typescript
// src/common/utils/cursor.util.ts
const cursor = encodeCursor({ createdAt: row.createdAt.toISOString(), id: row.id });
// Sending: GET /tags?limit=20&cursor=<base64(JSON)>
```

### Reference controller

```typescript
// src/modules/tag/transport/controllers/tag.controller.ts
@Controller('tags')
@ApiTags('Tags')
@UseGuards(JwtGuard)
export class TagController {
  @Get(':idOrSlug')
  @Public()
  @ApiOperation({ summary: 'Retrieve a single tag' })
  @ApiOkResource(TagResponseDto, TAG_DETAIL_EXAMPLE)
  @ApiErrorResponses({ notFound: 'TAG_NOT_FOUND' })
  async findOne(@Param('idOrSlug', ParseUUIDOrSlugPipe) idOrSlug: string) { … }
}
```

## Non-goals

- Documenting HTTP semantics or status codes (framework knowledge).
- Documenting RFC 7807 details — see `error-handling.md`.
- Documenting REST or HATEOAS — not implemented in this project.

## Future considerations

- If a v2 prefix is introduced, a dual-prefixed listener period is allowed; the migration belongs in `migration.md`.
- A consistent approach for `OPTIONS` discovery or signed HTTP routes is not yet defined in the codebase; future work MUST add a new standard rather than expand this file.