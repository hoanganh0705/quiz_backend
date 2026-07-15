# Project Constitution — Quiz Backend

> Highest-level engineering document for this codebase.
> Defines the engineering philosophy, architectural principles, and decision hierarchy that every future change must follow.
> It is **descriptive of what already exists**, not aspirational. Rules are stated only when the implementation supports them.

---

## How to read this document

Every rule below is evidence-backed. A reader who disagrees with a rule should be able to verify it from the code or test files referenced in the surrounding commit history. If a rule cannot be verified from the source tree, it does not belong in this document.

When two sources disagree about behavior, the decision hierarchy (in priority order, highest first) is:

1. **Implementation** — the compiled TypeScript in `src/` is authoritative for runtime behavior.
2. **Tests** — `*.spec.ts` files lock specific invariants of that runtime behavior.
3. **OpenAPI artifact** — `docs/generated/openapi.json` is a *snapshot* of the live Swagger document; the curl-driven regeneration step in `package.json` (`generate:openapi`) keeps it honest. It is never edited by hand.
4. **Generated SDK / client expectations** — clients are expected to track the OpenAPI artifact, not vice versa.
5. **Documentation under `docs/` and `README.md`** — describes the system; it does not redefine it.

---

## 1. Project Philosophy

The system is built around six recurring engineering values. None of these are decorative; each one corresponds to a concrete pattern in the source tree.

### 1.1 Explicit over implicit
Business-relevant identifiers travel as named values, not as positions or inferred shapes.

- Domain exceptions carry a stable string `code` (`BaseDomainException` makes it an `abstract readonly code: string`); HTTP status and title are looked up by that string in `ProblemCodeMapping` rather than read off the exception instance.
- Repository contracts use named Symbol tokens (`TAG_REPOSITORY_PORT`, `QUIZ_LISTING_PORT`, `EXTERNAL_EVENT_BUS_PRODUCER_PORT`, …) bound to implementations through `{ provide: TOKEN, useClass: … }` registrations, not through class-name lookup.

### 1.2 Backward compatibility is preserved deliberately
The project explicitly tracks "phases" of contract changes (see `ProblemCodeMapping.spec.ts` and the long-form RFC 7807 migration plan referenced in its docblocks). Existing wire shapes are layered additively (`extensions.code`, `meta.pagination.kind` discriminator, `WrappedDto<T>` wrapper that aliases pre-existing flat shapes).

### 1.3 Consistency over personal preference
Every controller follows the same dispatch:

```
controller handler
  → application service (orchestration, may inject ports)
  → presenter method (wraps the result in { data, meta })
```

There is a one-line comment in `tag.controller.ts` for every endpoint: it always calls `this.presenter.<endpoint>(this.tagApplicationService.<...>())`. The same shape is observable in `health.controller.ts` and the broader module set.

### 1.4 Maintainability through small, composable layers
Module subtrees are uniform: `domain/`, `application/`, `infrastructure/`, `mappers/`, `transport/`, `dto/`, `types/`. A developer joining the project can navigate any module by the same map.

### 1.5 Readability over cleverness
The code prefers plain TypeScript classes and explicit DTOs over generic helper magic. Names are full words (`CreateTagDto`, `TagApplicationService`, `getTagBySlug`). Decorators are spelled out (`@Permissions(Permission.TAG_MANAGE)`, `@Throttle(...)`, `@Public()`).

### 1.6 Incremental, contract-aware evolution
API changes are gated by:

- A new entry in `ProblemCodeMapping` is required before any new domain `code` can be thrown at runtime (`GlobalExceptionFilter` loud-fails otherwise).
- A new endpoint decorator must be reachable through `tag-swagger-decorators.ts` (or the equivalent per-module file) so the spec files in `src/common/swagger/openapi-schemas.spec.ts` and `src/modules/tag/transport/tag-openapi.spec.ts` keep catching broken `$ref`s.
- DTO validation contracts (`@IsOptional`, `@Min`, `@Max`, `@Type(() => Number)`) are locked by co-located unit specs (see `tag-ranking-query.dto.spec.ts`).

---

## 2. Architecture Principles

### 2.1 Dependency direction

```
transport (controllers, presenters, swagger decorators, DTOs)
  ↑
application (orchestrates domain + cross-module ports)
  ↑
domain (pure business logic, ports, events, exceptions)
  ↑
infrastructure (Drizzle repositories, third-party adapters)
```

Concrete evidence:

- `src/modules/tag/application/tag.application.service.ts` imports `TagDomainService`, mapper classes, and Symbol-typed ports (`QUIZ_LISTING_PORT`, `QUIZ_ANALYTICS_PORT`). It does not import `drizzle-orm` or anything from `core/database`.
- `src/modules/tag/domain/tag.service.ts` imports its `tag-repository.port` (interfaces only) and its own domain event bus port. It does not import anything from `transport/` or `infrastructure/`.
- `src/modules/tag/infrastructure/repositories/tag.repository.ts` is the only tag-side file that touches `drizzle-orm` and `core/database/schema`.
- The wire envelope is produced in `src/modules/tag/transport/presenters/tag.presenter.ts`, which knows about the application-layer DTOs and `ApiResponse` but nothing about `TagDomainService` internals.

This direction is enforced socially (by linting + review) and mechanically by the import-boundary test in the per-module layout. It is not enforced by a build-time dependency-linter today.

### 2.2 Layer responsibilities

| Layer | Owns | Does not own |
|---|---|---|
| `domain/` | Aggregates, business rules, domain events, domain ports, domain exceptions | HTTP status, JSON shape, Drizzle |
| `application/` | Cross-aggregate orchestration; adapts domain output to DTOs; constructs DTOs | Templates, Drizzle queries |
| `infrastructure/` | Concrete persistence (Drizzle), external service adapters | Business rules, HTTP contracts |
| `mappers/` | Pure functions/classes that convert domain rows → DTOs | Side effects, logging, throws |
| `dto/` | Request and response shapes — annotated for Swagger + validated by class-validator | Logic |
| `transport/controllers/` | Route declaration, param/query/body DTO binding, auth/permission guards, delegation to application service + presenter | Business logic, response shaping |
| `transport/presenters/` | Wire-envelope construction; final pass before the global interceptor | State changes |
| `transport/swagger/` | OpenAPI decoration per endpoint (composed with `applyDecorators`); `examples/` fixtures | Runtime behavior |

### 2.3 Separation of concerns that must not collapse

- The domain layer is **transitive-transport-agnostic**. The same `TagDomainService` could feed a GraphQL or CLI adapter tomorrow; nothing in it imports from `@nestjs/common` HTTP-specific surface (the `@Injectable` decorator is on the class, but the methods return domain shapes).
- Persisting decisions and adapter choices belong in `infrastructure/`, never in controllers or application services.
- The `core/` layer is the only place that owns Drizzle (`core/database`), Redis (`core/redis`), logger config (`core/logger`), Swagger config (`core/swagger`), environment validation (`core/config`), and reusable low-level utilities (`core/utils`). Feature modules consume these via DI tokens; they do not re-implement them.

### 2.4 Cross-module communication

Three patterns exist, and each has a single, enforced entry point:

1. **Within a single request**: Controller → Application service → Domain service. Symmetric, direct calls.
2. **Bounded contexts that must not see each other's internals**: go through a Symbol-typed port exported from one module and bound to an implementation in the importing module's `providers` (see `QUIZ_LISTING_PORT` resolved by `TagApplicationService`; the binding is `{ provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService }` inside `TagModule`).
3. **Events that must cross instance boundaries** (multi-pod deployments): published on `CommonExternalEventBus` (Redis pub/sub channel `external:events`). The bus exposes split ports so producers cannot depend on the subscription surface and vice versa (`EXTERNAL_EVENT_BUS_PRODUCER_PORT`, `EXTERNAL_EVENT_BUS_CONSUMER_PORT`).
4. **In-process domain events**: emitted on a per-module `DomainEventBus` synchronously, with an `<module>-event-bootstrap.service.ts` that wires observers (cache invalidation, audit, side effects).

### 2.5 Where business logic lives

- All branching that depends on the entity's state or invariants lives in the domain layer. The repository layer is not allowed to invent business rules; it exposes parameterized primitives (`softDelete`, `restore`, `followTag`, …).
- Idempotency is implemented in the domain layer, where it has access to throw the domain exception (`TagAlreadyActiveError`, `RESTORE_INVARIANT`, etc.) and to invalidate caches.
- Cross-cutting concerns (transactions, caching, correlation IDs, response envelope) are interceptors run by `AppModule.providers` — they have no place inside a domain service.

### 2.6 Modules are independent bounded contexts

A module is a NestJS module class (`tag.module.ts`, `quiz.module.ts`, …) that:

- declares its own `controllers[]`,
- declares and binds its own Symbol-typed ports,
- explicitly `imports` the cross-module Nest modules it depends on (e.g. `TagModule.imports = [DatabaseModule, RedisModule, QuizModule]`),
- `exports` a tightly-named surface (`TagApplicationService`, `TAG_REPOSITORY_PORT`, `TAG_DOMAIN_EVENT_BUS`) and nothing else.

Cross-module imports go through NestJS modules, not through circular TypeScript imports.

---

## 3. Engineering Principles

### 3.1 Where code belongs at a glance

- New validation rules → on the DTO class with `class-validator` decorators.
- New HTTP status mapping → `common/errors/problem-code-mapping.ts`.
- New wire-shape → `common/responses/api-response.ts` plus a presenter.
- New Swagger shape for a module → that module's `transport/swagger/<module>-swagger-decorators.ts` file (composed via `applyDecorators`); not inline in the controller.
- New shared low-level primitive (cursor, slug, ID) → `common/utils/` with a co-located spec.
- New DTO shared by two+ modules → `dto/` at the boundary that needs it, not in `common/` unless it is genuinely cross-cutting.
- New cross-module event → declare the type alongside its module's domain events and route producers through `EXTERNAL_EVENT_BUS_PRODUCER_PORT` if it must survive process restarts.

### 3.2 Boundaries that must never move

- The transport layer **never** sets an HTTP status or builds a `ProblemDetail`. The `GlobalExceptionFilter` is the single producer.
- Domain exceptions **never** encode HTTP-specific data. They carry `code` and `message` only.
- Repositories **never** call into the application layer (no upward imports).
- Presenters **never** call into the domain layer.
- Mappers **never** throw business exceptions.

### 3.3 Rules that apply to changes

- **Every new domain exception class** must add (a) `readonly code` and (b) an entry in `ProblemCodeMapping` with a sensible `status`/`title`/`typeUri`. The `GlobalExceptionFilter` loud-fails on a missing entry, and the `ProblemCodeMapping.spec.ts` uniqueness invariant guards the table.
- **Every new endpoint** must have a co-located Swagger decorator that documents at minimum: success status with schema, every error status the application can throw, and the security requirement (`@ApiBearerAuth(AUTH_SECURITY_NAME)` if it is not `@Public()`).
- **Every new endpoint that uses a UUID path param** must be documented as `format: 'uuid'` (the project's per-endpoint decorator factories include `ApiTagIdParam`, etc.). The `tag-openapi.spec.ts` file is the regression guard.
- **Every new endpoint that emits a DB timestamp** must rely on the existing normalization (temporal fields are auto-converted to ISO 8601 by `ApiResponse.ok` / `ApiResponse.page` / `ResponseFormatInterceptor` via `temporal-normalizer.util.ts`). Do not hand-format timestamps in mappers.
- **Every new endpoint** must accept `nowIso` from the application layer rather than calling `new Date()` directly in the repository, so tests can pin the clock.
- **Every new module** must register its `*Module` in `AppModule.imports` in dependency order.
- **Every new operational script** (CLI under `src/commands/`) must refuse to run in production unless an explicit override is set, modeled after `src/commands/outbox.ts`'s `ALLOW_PROD_OUTBOX_OPERATIONS` guard.
- **Every new entry in `core/database/schema/`** must be re-exported from `core/database/schema/index.ts` so `drizzle(pool, { schema })` continues to register it.

### 3.4 Choices already made; do not relitigate

- **Single database** (PostgreSQL 18, Drizzle ORM). All persistence is through Drizzle repositories.
- **Single cache** (Redis 8 via `ioredis`). All caching and pub/sub go through `RedisService` and the `CACHE_PROVIDER` / `PUBSUB_PROVIDER` tokens.
- **Authentication**: JWT access tokens on `Authorization: Bearer …`; refresh tokens in HTTP-only cookies. The `JwtGuard` is registered globally with `@Public()` as the opt-out.
- **Authorization**: role + permission enum, with `ROLE_PERMISSIONS` lookup and the `PermissionsGuard` global guard.
- **Rate limiting**: `@nestjs/throttler` globally, with an `/internal` skip and per-endpoint `@Throttle(...)` overrides.
- **Validation**: a single global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Override only with documented justification.
- **Logger**: `nestjs-pino` exclusively. New log lines are structured (`{ event: '...', ... }`) and include the correlation ID via `correlationIdStorage`.

### 3.5 Things that are explicitly out of scope

- Designing new architectural styles. The current module layering is the architecture.
- Re-introducing patterns the project already moved away from. The `BaseDomainException` docblock explicitly notes the removal of intermediate "operation failure" abstract classes; do not reintroduce them.
- Cross-cutting refactors that would change the wire shape without an audit document and a corresponding spec change.

---

## 4. API Principles

### 4.1 Versioning, prefix, and surface

- All HTTP endpoints are served under the global prefix **`/api/v1`** (set in `src/main.ts`). Versioning is path-based.
- Sub-resources mount at nested paths consistent with their module's `ApiTags` value (e.g. the tag module declares `@ApiTags('tags')`).
- The `OpenAPI` snapshot lives at `http://<host>/api/v1/docs/openapi.json` and is mirrored to `docs/generated/openapi.json` by `pnpm generate:openapi`. Treat this file as a build artifact; never hand-edit it.

### 4.2 Successful response shape

Every successful endpoint returns:

```json
{ "data": <payload>, "meta": { "timestamp": "<ISO 8601>" } }
```

For cursor-paginated lists, `meta.pagination` carries the discriminated `CursorPagination` (`{ kind: 'cursor', limit, hasNextPage, nextCursor }`); for offset-paginated lists it carries `OffsetPagination` (`{ kind: 'offset', page, limit, total, hasMore }`). The `kind` field is the discriminator.

This contract is enforced by `ApiResponseEnvelope<T>`, `ApiResponse.ok`, `ApiResponse.page`, and `ResponseFormatInterceptor`. The interceptor pass-through guards on plain-object shape so any service-layer drift is observable.

For lists that wrap a DTO class instance (`{ items, pagination }`), the presenter re-projects to a plain object so the interceptor's plain-object check passes.

### 4.3 Error response shape (RFC 7807)

Every error response is an RFC 7807 `application/problem+json` document with:

- `type` (URI reference to a status-scoped page under `https://api.quiz.local/problems/...`).
- `title` (the conceptual category, e.g. `"NotFound"`).
- `status` (numeric).
- `detail` (the concrete message — the `exception.message`).
- `instance` (the request URL).
- `extensions.code` (the stable domain identifier; synthesized by the filter when missing).
- `extensions.requestId`, `extensions.timestamp`.

This is the only allowed error envelope. New error paths must resolve through `ProblemCodeMapping` (no ad-hoc `{ error: ... }` shapes).

### 4.4 DTO conventions

- Request DTOs live under `modules/<x>/dto/request/` and are decorated with both `class-validator` (for runtime validation) and `class-transformer` + `@nestjs/swagger` `@ApiProperty*` (for OpenAPI documentation).
- Response DTOs live under `modules/<x>/dto/response/`. They declare the **wire shape after the presenter projection**; they must not include envelope fields (`data`, `meta`).
- A DTO field name should match the database column it represents, **unless** the project has explicitly translated it (e.g. `lastUpdated` from the existing analytics DTO). When in doubt, follow what existing adjacent DTOs already do.
- DTOs that are identical to others across modules (e.g. `PaginatedResponseDto` shapes) are intentionally not deduplicated; copying them keeps the wire shape anchored to each module's `tag-swagger-decorators.ts` chain.

### 4.5 Pagination

Two flavors, both declared via the same `PaginationMeta` discriminated union at the application-layer boundary:

- **Cursor** — base64-encoded JSON of the last row's sort-key tuple. Documented by `CursorQueryDto`. Default for any list endpoint whose items are large or unbounded.
- **Offset** — `{ page, limit, total, hasMore }`. Used only where the client needs random page access or total counts (leaderboards, ranking tables).

The `kind` discriminator must be present in both the runtime payload and the OpenAPI schema (`@ApiProperty({ example: 'cursor' | 'offset' })`).

### 4.6 Security and authorization

- Authentication is global via `JwtGuard`. `@Public()` opts a handler out.
- Authorization is global via `PermissionsGuard`. The handler declares `@Permissions(Permission.X)` to require a permission; the user must have a `UserRole` that includes it via `ROLE_PERMISSIONS`.
- Cookies used as request parameters are documented in the OpenAPI document via the `ApiCookieParam`/`injectCookieParams` plugin. Renaming routes requires updating the registry call site.

### 4.7 Throttling and abuse prevention

- A coarse `ThrottlerGuard` runs before `JwtGuard` to shed bulk request volume cheaply.
- Sensitive endpoints (e.g. `/tags/:id/follow`) add a tighter `@Throttle(...)` override.
- Internal endpoints under `/internal` are exempted from coarse throttling (`skipIf` in `AppModule.throttler`).

### 4.8 Backward compatibility posture

- Adding fields to success responses is additive.
- Removing fields is a breaking change and must be accompanied by an audit-style doc and an entry on the corresponding RFC 7807 migration phase.
- Adding a new HTTP status mapping is additive (filters synthesize `extensions.code` based on status when no `BaseDomainException` is involved).
- New error `code`s require a new `ProblemCodeMapping` entry in the same commit.

---

## 5. Data Principles

### 5.1 Identifiers

- All primary keys are UUID **v7** (`sql\`uuidv7()\`` on the DB side, `generateUuidV7()` on the application side). The shape is locked at `src/common/utils/id-generator.ts` and matched in the PG schema (`core/database/schema/`).
- App code never invents v4 UUIDs. If a script needs one outside DI, it uses `generateUuidV7()`.

### 5.2 Timestamps

- Every table has `createdAt`, `updatedAt` columns, both `timestamp with timezone`, both DTO-string mode.
- `deletedAt` is the **only** deletion marker. There is no "is_deleted" boolean.
- Timestamps are stored as Postgres-formatted strings and normalized to **canonical ISO 8601** at the wire by `temporal-normalizer.util.ts`. The application code may pass them around as strings; it must never hand-format them in mappers.

### 5.3 Soft delete

- Tables that can be deleted from the user-facing API have `deletedAt: timestamp | null`.
- Reads filter with `isNull(table.deletedAt)` unless the caller explicitly opts in (the `findByIdIncludingDeleted` pattern).
- The restore endpoint must refuse to act on rows where `deletedAt` is already null (state-machine guard; emits a domain error with a 409 code).

### 5.4 Uniqueness and re-follow semantics

- For follow-through tables (`tagFollows`, `categoryFollows`), uniqueness is enforced by **partial** unique indexes on `(userId, targetId) WHERE deletedAt IS NULL`. This allows a previously unfollowed row to be re-followed by re-using the same primary key.
- Other uniqueness (e.g. slug, name) follows the same partial-index pattern.

### 5.5 Transactions

- Handlers opt into a transactional scope by `@Transactional()`. The interceptor (`TransactionalInterceptor`) provides the AsyncLocalStorage scope; repositories opt in to reuse an open transaction via `TransactionalContext.getDbClient()`.

### 5.6 Schema discipline

- The schema lives in `src/core/database/schema/<bounded-context>/` (e.g. `taxonomy/`, `auth/`, `quiz/`). Every bounded context exports a `schema.ts` (tables) and `relations.ts` (Drizzle relations).
- Migrations are generated by `drizzle-kit` and committed under `src/core/database/migrations/` with the `0000_*.sql` naming convention.
- New tables go in the bounded context that owns them, not in a "shared" catch-all (the existing `shared/` directory is for enums and cross-context types only).

### 5.7 Repository shape

- Repositories take the `DrizzleDB` client via the `DRIZZLE` injection token (a `@Global()` `DatabaseModule` provides it). They never construct a connection themselves.
- Repositories return plain `Row` interfaces declared in `domain/ports/<x>-repository.port.ts`, not Drizzle types. The mapping to DTOs happens upstream in the application layer.
- A repository may throw a typed error (`TagRepositoryConstraintError` in the tag module) to surface a DB-level failure that should be re-translated by the domain layer; it does not throw domain exceptions directly.

---

## 6. Documentation Principles

### 6.1 What lives where

| Source | Purpose | Source of truth? |
|---|---|---|
| Code in `src/` | All runtime behavior | **Yes (primary)** |
| `*.spec.ts` in `src/` | Locked invariants on the behavior above | **Yes (test)** |
| `docs/generated/openapi.json` | Snapshot of Swagger document | Mirror of code |
| `README.md` | How to run the project | Reference only |
| `SEED_RECORD.md` | Re-generated by seed commands | Reference only |
| `docs/api-contract-audit-*.md` and `docs/migrations/*.md` | Phase-by-phase audit trail of contract changes | Reference only |

### 6.2 Implementation is the primary documentation

When the README, an audit doc, or the OpenAPI artifact says one thing and the implementation says another, the implementation wins. A reader who finds a discrepancy should:

1. Verify which one is older.
2. Open a PR that reconciles the stale source.

### 6.3 OpenAPI generation discipline

- `docs/generated/openapi.json` is **regenerated**, not edited.
- The pipeline is: `pnpm start:dev` running → `pnpm generate:openapi` curls the live spec into the repo. Both commands live in `package.json`.
- This file is read by regression-guard specs (`openapi-schemas.spec.ts`, `tag-openapi.spec.ts`) that verify schema integrity. Adding decorators without `ApiExtraModels(...)` for the wrapper DTOs makes those specs fail.

### 6.4 Examples live with Swagger

OpenAPI examples for each endpoint live under `modules/<x>/transport/swagger/examples/` and are imported by the per-module decorators. The pattern (per `tag-swagger-decorators.ts`) is one example per error class plus one per success shape, named with the `TAG_*_EXAMPLE` convention.

### 6.5 Audit and migration documents

The codebase carries long-form migration plans (`docs/migrations/...`). Those documents are durable design history:

- They explain *why* a contract decision was made, not just *what* it is.
- They cite the spec files that lock each phase.
- They must be updated only when introducing a new phase, not when fixing typos.

---

## 7. Testing Principles

### 7.1 Test placement and shape

- All tests live as `*.spec.ts` **co-located with the source** under `src/`. There is no `__tests__` directory. Jest config (`package.json`) sets `rootDir: 'src'` and `testRegex: '.*\\.spec\\.ts$'`.
- A test file imports the implementation directly. The end-to-end specs under `test/` are reserved for cross-module contract checks (`rfc7807.e2e-spec.ts`, `envelope.e2e-spec.ts`, `app.e2e-spec.ts`) and use a separate Jest config.

### 7.2 Tests are the spec

These specs encode current invariants and must be updated deliberately:

- `src/common/errors/problem-code-mapping.spec.ts` — every entry's status/title/typeUri, plus uniqueness and unknown-code fallback.
- `src/common/filters/global-exception.filter.spec.ts` — every wire shape, including the unknown-code loud-failure branch.
- `src/common/interceptors/response-format.interceptor.spec.ts` (via `temporal-normalizer.util.ts`) — every ISO-8601 normalization edge.
- `src/common/swagger/openapi-schemas.spec.ts` — wrapper DTOs and broken `$ref` detection.
- `src/modules/<x>/transport/tag-openapi.spec.ts` (per-module analogue) — `format: 'uuid'` on `:id` params, examples on every operation, response envelope shape.
- `src/modules/<x>/transport/tag-timestamp.spec.ts` (per-module analogue) — that the presenter actually emits ISO timestamps.
- `src/modules/<x>/dto/request/*.dto.spec.ts` — validation contract on optional + range fields.
- `src/modules/<x>/domain/errors/*.errors.spec.ts` — that each exception class sets its `code`, has a mapping entry, and inherits from the namespace marker.

### 7.3 What is tested where

| Concern | Layer of test |
|---|---|
| Validation rules | DTO spec (no Nest boot) |
| DTO conversion | DTO spec |
| Domain exception `code` + mapping | `domain/errors/*.errors.spec.ts` + `common/errors/problem-code-mapping.spec.ts` |
| Wire shape on success | Presenter spec (`tag-timestamp.spec.ts`-style) |
| Wire shape on error | `common/filters/global-exception.filter.spec.ts` |
| OpenAPI snapshot | `common/swagger/openapi-schemas.spec.ts` + per-module analogue |
| Cross-endpoint behavior | `test/*.e2e-spec.ts` |

### 7.4 New code without a test

- Pure refactors: still allowed, but the existing specs must continue to pass.
- New endpoint, decorator, or domain class: must come with the test that locks the contract part it adds.
- New test fixtures: must be added under `transport/swagger/examples/` and imported by the per-module decorators, not duplicated inline.

---

## 8. AI Collaboration Principles

These rules apply to any automated assistant — code generation agent, reviewer, or migration tool — operating on this codebase. They are written as engineering rules, not as instructions to a specific product.

### 8.1 Never silently break an API contract

- Adding or removing fields in a DTO is a wire-level change. Both directions require updating the OpenAPI spec and a contract-hardening spec.
- Removing or renaming an endpoint, status code, or `code` requires an audit/migration document update and the relevant spec changes.
- Renaming a route requires updating `injectCookieParams` if the route consumes cookies and any cross-module references.

### 8.2 Never redesign the architecture

- Do not introduce new layers (e.g. controller → use case → service → repository) without an explicit project decision. Modules already follow the documented layering.
- Do not replace Drizzle, Redis, JWT, or pino as the implementation. They are choices the project has made.
- Do not move code across layer boundaries (`domain/` ↔ `application/` ↔ `infrastructure/` ↔ `transport/`) for taste reasons. There must be a concrete reason grounded in the existing patterns.

### 8.3 Investigate before modifying

- Read the entire affected module and at least one sibling module before changing a cross-cutting concern (envelope, error filter, response format, pagination).
- When a behavior is locked by a spec (see §7.2), match that exact behavior. Do not "improve" it under the cover of a refactor.
- When in doubt, trace from controller → application service → domain service → repository; that is the canonical path.

### 8.4 Preserve existing conventions

- Match the per-module file layout. A new module is laid out like `tag/`, `quiz/`, `user/` — even if the new module looks simpler than those.
- Match the per-module Swagger pattern. A new endpoint has both a per-route decorator function (`Api<Verb><Resource>Response()`) and an entry in the per-module `transport/swagger/<module>-swagger-decorators.ts` file.
- Match the per-module presenter pattern. Every endpoint has a presenter method even if it is a one-line alias to `ApiResponse.ok(payload)`. The seam exists for future redaction/aggregation.
- Match the per-module port-binding pattern. New dependencies between modules are exposed as Symbol-typed ports and bound via `{ provide: PORT, useExisting: Implementation }` in the consumer module.

### 8.5 Prefer consistency over personal preference

- When the same problem has multiple defensible solutions, pick the one that matches an existing module's solution.
- When introducing a new shared utility, place it next to existing siblings in `common/utils/`, not in a new directory.
- When changing the way errors are formatted, change them everywhere through the existing surface (`ProblemCodeMapping`, `BaseDomainException`); do not add a parallel error pipeline.

### 8.6 Surface uncertainty, do not fabricate

- If a rule cannot be verified from the source tree, say so in the PR description and ask for clarification. Do not invent one.
- If a request implies new architecture, push back with a reference to §2 of this document before writing code.
- If a test is failing for an unclear reason, prefer to read the relevant spec file over guessing.

### 8.7 What "no change to architecture" looks like

Concrete patterns that an AI must NOT introduce without a decision:

- Multiple inheritance / mixins on domain services.
- Decorator-based CQRS or command-bus middleware.
- Schema-first validation outside `class-validator`/`class-transformer`.
- A second logger alongside `nestjs-pino`.
- A second repository pattern (DAO, Active Record, etc.) alongside Drizzle.
- Persistence outside `core/database/schema/` or via raw SQL strings.
- Module-level state inside feature modules.

---

## 9. Decision hierarchy at a glance

```
Project Constitution (this document)
  ↓  defines the rules
Architecture Principles  (§2)
  ↓  defines how the layers compose
Engineering Principles   (§3)
  ↓  defines where each concern lives
API Principles           (§4)  ┐
Data Principles          (§5)  ├─ covered by tests + specs
Documentation Principles (§6)  │
Testing Principles       (§7)  ┘
```

A change that violates any section of this document is not a refactor; it is a redesign, and requires:

1. An updated audit/migration document under `docs/migrations/`.
2. The corresponding test additions listed in §7.
3. A note in the commit message that links to both.

---

## 10. Changes to this document

This constitution is a **derived** artifact. Every rule above must be traceable to existing code or tests; if a rule can no longer be traced, it is stale and must be removed.

When the project genuinely changes — for instance, when a new bounded context requires a new cross-module event format — this document is updated **in the same PR** that introduces the change. The PR must cite the spec(s) that the change implies and the tests that lock it.

When two rules in this document come into conflict with each other, the more specific rule wins (a per-module pattern overrides a general one). When two rules in this document come into conflict with the implementation, the implementation wins and this document is updated.
