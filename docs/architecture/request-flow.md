# Request Flow

This document describes the end-to-end lifecycle of an HTTP request, from the inbound TCP connection to the final wire response.

## Request Lifecycle Diagram

```
TCP Connection
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│  Express Middleware Stack (src/main.ts)                    │
│  1. Helmet (security headers)                           │
│  2. cookieParser()                                      │
│  3. Custom body parsers (raw, json)                      │
│  4. Global prefix: /api/v1                              │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_GUARD #1 — ThrottlerGuard                         │
│  • Checks x-forwarded-for / req.ip against Redis TTL  │
│  • Rejects with 429 if bucket exhausted               │
│  • Skips /internal routes via skipIf()                 │
│  • No user context required                           │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_GUARD #2 — JwtGuard                               │
│  • Reads @Public() metadata via Reflector             │
│  • If @Public(): passes through immediately            │
│  • Else: validates Authorization: Bearer <token>       │
│  • Attaches JwtPayload to request.user                │
│  • Throws 401 on missing/invalid token                │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_GUARD #3 — PermissionsGuard                        │
│  • Reads @Permissions(...) metadata                    │
│  • If no @Permissions(): passes through                │
│  • Else: looks up user.role → ROLE_PERMISSIONS       │
│  • Checks required permission exists in user role set  │
│  • Throws 403 on missing permission                   │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_INTERCEPTOR #4 — CorrelationInterceptor            │
│  • Reads x-correlation-id header (or generates UUID)    │
│  • Sets response x-correlation-id header              │
│  • PinoLogger.assign({ correlationId })               │
│  • correlationIdStorage.run({ correlationId }, ...)    │
│  • Subsequent getCorrelationId() calls return it     │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_INTERCEPTOR #5 — TransactionalInterceptor          │
│  • Checks @Transactional() metadata via Reflect        │
│  • If absent: next.handle() immediately (zero cost)   │
│  • If present:TransactionalContext.run(() => next.handle()) │
│  • Repositories call getDbClient() to reuse tx        │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
                    Controller Handler
                            │
              ┌─────────────┴──────────────┐
              │                              │
              ▼                              ▼
┌────────────────────┐      ┌──────────────────────────────┐
│  ValidationPipe     │      │  Param Pipes                  │
│  (global, no-op   │      │  ParseUUIDOrSlugPipe         │
│   on this layer —  │      │  • UUID: validate format     │
│   ran before guards)│      │  • Slug: validate pattern     │
└────────────────────┘      │  • Throws BadRequest on fail  │
                            └──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Controller                                              │
│  • Binds @Body(), @Query(), @Param() DTOs             │
│  • Calls applicationService.method(dto, currentUser)     │
│  • Receives application DTO                             │
│  • Calls presenter.method(dto)                          │
│  • Returns ApiResponse envelope                         │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_INTERCEPTOR #6 — ResponseFormatInterceptor        │
│  • Intercepts Response stream                          │
│  • If ApiResponseEnvelope or StreamableFile: pass      │
│  • Else: wraps in { data: body, meta: { timestamp } }│
│  • normalizeTemporalFields() on every response        │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  APP_FILTER — GlobalExceptionFilter                     │
│  • Catches any unhandled exception                     │
│  • BaseDomainException → lookup ProblemCodeMapping     │
│  • HttpException → synthesize code from status         │
│  • Error → 500 INTERNAL_SERVER_ERROR                 │
│  • Writes x-correlation-id to response header          │
│  • All responses: application/problem+json (RFC 7807)   │
└────────────────────────────┬─────────────────────────────┘
                            │
                            ▼
                  HTTP Response
                  { data, meta }
                  or
                  application/problem+json
```

## Step-by-Step Description

### 1. Express Middleware (`src/main.ts`)

`main.ts` applies raw Express middleware before NestJS processes the route:

1. **Helmet** — security headers (CSP relaxed for Swagger UI).
2. **cookieParser()** — populates `req.cookies` for refresh-token cookie access.
3. **Body parsers** — two parsers: one for raw bytes, one for JSON (`verify: rejectUnauthorized: false`).
4. **Global prefix** — `app.setGlobalPrefix('api/v1')`; all routes are `/api/v1/...`.

### 2. Guards (in registration order)

Guards run before interceptors. The order matters:

**`ThrottlerGuard`** runs first because it is the cheapest check (Redis TTL bucket lookup). Rejecting at this layer avoids the cost of JWT signature verification.

**`JwtGuard`** runs second. If the route has `@Public()`, the guard reads `Reflector.get(IS_PUBLIC_KEY)` and passes immediately. Otherwise it:
1. Extracts `Authorization: Bearer <token>` from the header.
2. Calls `JwtService.verifyAsync(token)` against the configured secret/issuer/audience.
3. Attaches `payload` to `request.user`.
4. Throws `UnauthorizedException` on failure.

**`PermissionsGuard`** runs last. It reads `@Permissions(...)` metadata. If none, it passes. If present, it resolves the user's role to its `Permission[]` set and checks whether the required permission is included. Throws `ForbiddenException` on failure.

### 3. Interceptors (in reverse registration order)

NestJS interceptors are applied in reverse of their registration order at the route level (but guards always run first):

**`CorrelationInterceptor`** writes the correlation ID into three places: the response `x-correlation-id` header, the Pino logger (`logger.assign({ correlationId })`), and `correlationIdStorage.run()`. This scopes the ID to the entire async chain including domain events and async handlers.

**`TransactionalInterceptor`** is a zero-overhead gate. It checks for `@Transactional()` metadata; if absent, it returns `next.handle()` immediately. If present, it wraps the handler in `TransactionalContext.run()`, which creates an `AsyncLocalStorage` scope. Any code called downstream — repositories, services, mappers — can call `getTransactionalDbClient()` to access the shared transaction client.

**`ResponseFormatInterceptor`** intercepts the `Observable` returned by the controller. After the controller returns, it checks the response type. If the response is already an `ApiResponseEnvelope`, a `StreamableFile`, or headers are already sent, it passes through. Otherwise it wraps the body in `{ data: body, meta: { timestamp } }`.

### 4. Controller

The controller is the thinnest layer. It:
1. Receives validated DTOs (from `ValidationPipe`) and typed `JwtPayload` (from `@CurrentUser()`).
2. Delegates all logic to the application service.
3. Passes the application DTO to the presenter.
4. Returns the presenter result (already an `ApiResponseEnvelope`).

The controller MUST NOT call repositories directly, throw `HttpException`, construct `ProblemDetail`, or import from `drizzle-orm`.

### 5. Exception Filter

`GlobalExceptionFilter` catches any unhandled exception that escapes the controller. It handles three categories in order:

1. **`BaseDomainException`** — looks up `ProblemCodeMapping` by `exception.code`. Writes the mapped HTTP status, title, and `typeUri` into the RFC 7807 body. Adds `code` to `extensions`.

2. **`HttpException`** — synthesizes a code from the status using `STATUS_TO_GLOBAL_CODE`. Special case: `BadRequestException` with `string[]` messages (from `ValidationPipe`) gets `GLOBAL_VALIDATION_FAILED`.

3. **`Error`** (or non-`Error`) — returns `500` with `GLOBAL_INTERNAL_ERROR`. The actual message is replaced with a generic `'Internal server error'` in production; the full cause chain is logged.

All responses include the correlation ID in a header and in `extensions.requestId`.

## Complete Data Transformation Path

For a typical successful GET `/tags/:idOrSlug`:

```
HTTP Request (TCP)
    ↓ ParseUUIDOrSlugPipe
idOrSlug: string (validated)
    ↓
Controller
    → TagApplicationService.getTagBySlug(idOrSlug)
        → TagDomainService.getTagBySlug(idOrSlug)        [domain — pure logic]
            → TagRepositoryPort.findBySlug(slug)        [port — interface]
                → TagRepository.findBySlug(slug)        [adapter — Drizzle]
                    → SELECT ... FROM tags WHERE slug = $1 AND deleted_at IS NULL
                    → TagRow { tagId, name, slug, createdAt, updatedAt }
            → TagResponseMapper.toResponse(row)          [mapper — row → DTO]
                → TagResponseDto { tagId, name, slug, createdAt, updatedAt }
        → TagPresenter.getTagBySlug(dto)                [presenter — envelope]
            → ApiResponse.ok(TagResponseDto)
                → ApiResponseEnvelope { data: TagResponseDto, meta: { timestamp } }
    ← ApiResponseEnvelope { data: {...}, meta: { timestamp: "..." } }
    ↓ ResponseFormatInterceptor
    → normalizeTemporalFields(envelope)
    ↓
HTTP Response
Content-Type: application/json
{ "data": { "tagId": "...", "name": "...", ... }, "meta": { "timestamp": "2026-07-15T..." } }
```

## Response Format Decisions

The `ResponseFormatInterceptor` decides whether to wrap based on three conditions (evaluated in order):

1. **`response.headersSent`** — if another layer already sent the response (e.g. a redirect), pass through.
2. **`isApiResponse(value)`** — if the controller returned an `ApiResponseEnvelope`, pass through.
3. **`value instanceof StreamableFile`** — if the controller returned a file download, pass through.
4. Otherwise — wrap in `{ data: value, meta: { timestamp } }`.

This means a presenter MUST return `ApiResponse.ok(dto)` or `ApiResponse.page(...)` — not a raw object. If a presenter returns a raw object, it gets double-wrapped.

## Needs Clarification

- The body-parser configuration with `verify: rejectUnauthorized: false` may be intentional for dev/prod parity but the rationale is not documented.
- The `bufferLogs: true` in `NestFactory.create()` accumulates logs during boot; the mechanism for flushing them after the app is ready is not investigated.