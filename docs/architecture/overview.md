# Architecture Overview

## High-Level Structure

The application is a NestJS monolithe deployed as a single Node.js process. It uses PostgreSQL for persistence, Redis for caching and pub/sub, and Drizzle ORM as the query builder. All HTTP routes are prefixed with `/api/v1`.

```
┌──────────────────────────────────────────────────────────────┐
│                     HTTP Layer                                │
│  Controllers (transport/swagger/DTOs)  ←  @Public, @Permissions │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                Application Layer                               │
│  Application Services  (orchestration, DTO mapping, ports)     │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   Domain Layer                                │
│  Domain Services  (pure business logic, ports, events)         │
│  Domain Events   (in-process, fire-and-forget)               │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│               Infrastructure Layer                            │
│  Drizzle Repositories, External Adapters, Event Buses         │
│  Database (PostgreSQL)  ←  Cached via  Redis                │
└──────────────────────────────────────────────────────────────┘

     ↑ Global Interceptors  (ResponseFormat, Correlation, Transactional)
     ↑ Global Filters     (GlobalExceptionFilter — RFC 7807)
     ↑ Global Guards      (Throttler, Jwt, Permissions)
     ↑ Global Pipes       (ValidationPipe — whitelist/forbidNonWhitelisted/transform)
```

## Dependency Direction

Imports flow strictly downward. No upward imports exist in the codebase.

```
transport   ← caller (HTTP)
    ↑
application ← controller
    ↑
domain      ← application
    ↑
infrastructure ← domain
    ↑
core        ← infrastructure
```

`core/` is the only package that imports `drizzle-orm`, `pg`, `ioredis`, `nestjs-pino`, `class-validator`, or `class-transformer`. Feature modules consume `core/` via NestJS DI tokens only; they do not import these packages directly.

`common/` provides shared infrastructure (guards, interceptors, filters, responses, Swagger helpers, utilities) that `core/` and feature modules both import. `common/` itself has no `core/` dependency.

## Module Organization

Each bounded context is a NestJS module directory under `src/modules/<name>/`. Every context follows an identical internal layout:

```
src/modules/<name>/
├── domain/
│   ├── errors/           ← domain exceptions (extend BaseDomainException)
│   ├── events/           ← domain events + event bus port + event bus impl
│   ├── ports/            ← Symbol-typed port interfaces (repository + cross-module)
│   ├── services/         ← pure domain logic
│   └── *.service.ts      ← domain service (business rules, invariants)
├── application/
│   └── *.application.service.ts  ← orchestration, DTO mapping, cross-module ports
├── infrastructure/
│   └── repositories/      ← Drizzle implementations of repository ports
├── mappers/              ← row → DTO projections (pure functions)
├── dto/
│   ├── request/          ← class-validator DTOs (Swagger + validation)
│   └── response/         ← response DTOs (Swagger schemas)
├── transport/
│   ├── controllers/      ← route declarations, guards, presenter calls
│   ├── presenters/       ← wire-envelope construction (ApiResponse.ok/page)
│   └── swagger/         ← composed decorators, examples/
├── types/                ← domain value objects, enums
└── *.module.ts           ← NestJS module registration, DI bindings
```

**Reference module:** `src/modules/tag/` — every other bounded context mirrors this layout.

## Core Modules

| Module | Path | Role |
|---|---|---|
| `ConfigModule` | `src/core/config/` | Environment variable validation and typed config access |
| `DatabaseModule` | `src/core/database/` | Drizzle ORM client, schema registry, migrations |
| `RedisModule` | `src/core/redis/` | ioredis client, `CACHE_PROVIDER` / `PUBSUB_PROVIDER` tokens |
| `LoggerModule` / `CoreLoggerModule` | `src/core/logger/` | nestjs-pino singleton |
| `SwaggerConfig` | `src/core/swagger/` | DocumentBuilder, plugin registration |
| `CommonModule` | `src/common/` | Global guards, interceptors, filters, audit, domain event buses |
| `ScheduleModule` | `@nestjs/schedule` | Cron jobs for outbox processors and scheduled tasks |
| `ThrottlerModule` | `@nestjs/throttler` | Rate limiting backed by Redis |

## Dependency Injection

All cross-module and cross-layer dependencies use **Symbol tokens** declared as `Symbol('<description>')` and bound in the consuming module's `providers` array.

```
{ provide: TAG_REPOSITORY_PORT, useClass: TagRepository }
{ provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService }
```

The pattern decouples the interface from the implementation and makes the dependency graph observable from the module file alone.

## Response Envelope

All successful HTTP responses use the canonical `{ data, meta: { timestamp } }` envelope produced by `ResponseFormatInterceptor`. Errors use RFC 7807 `application/problem+json` produced by `GlobalExceptionFilter`. The envelope format is fixed — see `docs/standards/api.md`.

## Event Architecture

Three propagation layers exist:

| Layer | Scope | Delivery | Persistence |
|---|---|---|---|
| In-process domain event | Single process | Synchronous, fire-and-forget | None |
| External event bus | Multi-process (all instances) | Redis pub/sub | None |
| Transactional outbox | Multi-process (shared queue) | Background cron job | PostgreSQL `outbox_events` |

See `docs/architecture/event-flow.md` for the full diagram.

## Global Provider Stack

```
APP_GUARD #1  ThrottlerGuard     ← rate-limit, runs before auth
APP_GUARD #2  JwtGuard            ← JWT verification, attaches JwtPayload to request
APP_GUARD #3  PermissionsGuard    ← RBAC permission check

APP_INTERCEPTOR  TransactionalInterceptor  ← creates AsyncLocalStorage scope for @Transactional()
APP_INTERCEPTOR  CorrelationInterceptor   ← writes x-correlation-id, scopes PinoLogger
APP_INTERCEPTOR  ResponseFormatInterceptor ← wraps response in { data, meta }

APP_FILTER  GlobalExceptionFilter ← RFC 7807 problem-detail on any exception
```

Execution order: guards → interceptors → controller → interceptors → filter. See `docs/architecture/request-flow.md`.

## Persistence

- PostgreSQL via Drizzle ORM (schema in `src/core/database/schema/<context>/`)
- UUIDv7 primary keys generated via `generateUuidV7()`
- Soft-delete via `deletedAt` column with partial unique indexes scoped to `WHERE deleted_at IS NULL`
- Transactions via `@Transactional()` + `AsyncLocalStorage` (`TransactionalContext`)
- No raw SQL strings; all queries via Drizzle query builders
- See `docs/architecture/persistence-flow.md`

## Configuration

All environment variables are validated at startup by `validateEnv()` in `src/core/config/env.validation.ts`. Unknown or malformed variables fail-fast before any module initializes. No environment variable is read directly outside of this module.

## Naming Conventions

| Concern | Convention |
|---|---|
| DI tokens | `Symbol('<module>_<port>')`, all-caps (e.g. `TAG_REPOSITORY_PORT`) |
| Domain exceptions | `<Entity><Condition>Error` (e.g. `TagNotFoundError`, `TagSlugConflictError`) |
| Domain events | `<Noun><PastTense>Event` (e.g. `TagCreatedEvent`, `TagFollowedEvent`) |
| Error codes | `<MODULE>_<ENTITY>_<CONDITION>` (e.g. `TAG_NOT_FOUND`) |
| Event types | dot-notation string (e.g. `'tag.created'`, `'attempt.completed'`) |
| DTO suffix | `Create<Dto`, `Update<Dto`, `<Entity>ResponseDto`, `<Entity>ListResponseDto` |
| Swagger examples | `TAG_*_EXAMPLE` constant in `transport/swagger/examples/` |

## Module Dependency Graph

```
core/
├── ConfigModule          ← all modules
├── DatabaseModule        ← all feature modules
├── RedisModule          ← all feature modules
├── LoggerModule         ← all modules
└── SwaggerConfig       ← app bootstrap only

common/                   ← all feature modules + app bootstrap
├── JwtGuard             ← ThrottlerGuard, JwtGuard, PermissionsGuard
├── ResponseFormatInterceptor
├── CorrelationInterceptor
├── TransactionalInterceptor
├── GlobalExceptionFilter
└── AuditLogService

auth/                     ← UserModule
user/                     ← QuizModule, RankingModule
quiz/                     ← TagModule, CategoryModule, AttemptModule, CommentModule,
│                          BookmarkModule, ReviewModule, InstanceModule
tag/                      ← (quiz exposes QUIZ_LISTING_PORT consumed by tag)
category/                 ← (quiz exposes QUIZ_LISTING_PORT consumed by category)
attempt/                  ← (quiz listens to ATTEMPT_DOMAIN_EVENT_BUS)
comment/               ← (comment section per quiz; quiz provides QuizExistencePort; notification consumes COMMENT_DOMAIN_EVENT_BUS)
bookmark/                 ← (quiz provides QUIZ_ANALYTICS_PORT consumed by bookmark)
review/                   ← (quiz listens to REVIEW_DOMAIN_EVENT_BUS)
tournament/               ← (ranking, achievement, instance consume SHARED_TOURNAMENT_EVENT_BUS)
instance/                 ← (tournament, attempt consume SHARED_TOURNAMENT_EVENT_BUS)
ranking/                  ← (achievement consumes SHARED_RANKING_EVENT_BUS)
achievement/              ← (notification consumes SHARED_ACHIEVEMENT_EVENT_BUS)
search/                   ← (direct Drizzle queries on core schema)
health/                   ← (no dependencies)
email/                    ← (injected by auth, notification)
notification/             ← (fan-out; subscribes to many event buses)
social/                   ← (cross-module hub; subscribes to many event buses)
```

## Architectural Principles

The architectural decisions are derived from the codebase, not invented:

1. **Explicit dependencies over implicit coupling** — every cross-module dependency is declared as a Symbol token in the consumer's `providers` array; the producer binds it via `useExisting` or `useClass`.
2. **Domain layer is transport-agnostic** — domain services have no `@nestjs/common` HTTP imports. The same domain service could feed a CLI or GraphQL endpoint without modification.
3. **No upward imports** — infrastructure never calls application; application never calls transport.
4. **Global concerns are truly global** — interceptors, guards, filters, and the validation pipe are registered once at the application root and apply to every request.
5. **Events are typed and scoped** — every domain event is a named class with typed payload; event types are strings for Redis serialization; idempotency keys are deterministic per event shape.
6. **Fail-fast on misconfiguration** — `validateEnv()` throws at startup; `ProblemCodeMapping` loud-fails on unknown codes; the interceptor's `isFormattedResponse` guard catches response drift immediately.

For the full normative rules governing these decisions, see `docs/PROJECT_CONSTITUTION.md` and `docs/standards/architecture.md`.