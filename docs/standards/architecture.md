# Architecture Standard

> Project-specific structural rules. Every rule is normative and derived from the existing codebase.
> See `docs/PROJECT_CONSTITUTION.md` for the philosophy; this file is the engineering detail.

## Purpose

Defines the module layout, dependency direction, and layer responsibilities that every new code change MUST follow.

## Scope

Applies to everything under `src/`. Out of scope for this document: API envelope rules (see `api.md`), error-handling rules (see `error-handling.md`), persistence rules (see `database.md`), and HTTP/Swagger rules (see `swagger.md`).

## Source of Truth

- `docs/PROJECT_CONSTITUTION.md` §2 (Architecture Principles), §3.2 (Boundaries that must never move), §3.3 (Rules that apply to changes).
- `src/app.module.ts` — global provider wiring.
- `src/modules/tag/` — reference module; every other module (`quiz/`, `user/`, `category/`, `auth/`, `attempt/`, `bookmark/`, `review/`, `tournament/`, `instance/`, `ranking/`, `achievement/`, `notification/`, `comment/`, `social/`, `search/`, `health/`) mirrors the same shape.
- `src/core/` — infrastructure layer; the only place that imports `drizzle-orm`, `pg`, `ioredis`, `nestjs-pino`, or owns `core/database/schema/`.

## Rules

### Module shape

- MUST lay out a feature module as `src/modules/<name>/` with these subfolders when present: `domain/`, `application/`, `infrastructure/`, `mappers/`, `dto/request/`, `dto/response/`, `transport/controllers/`, `transport/presenters/`, `transport/swagger/`, `transport/swagger/examples/`. Reference: `src/modules/tag/`.
- MUST NOT introduce additional layers (e.g. a `use case/` layer between `application/` and `domain/`, or a `dao/` layer between `infrastructure/` and `domain/`). The current four-layer split is the architecture.
- MUST declare the module as a NestJS `@Module(...)` class (e.g. `tag.module.ts`, `quiz.module.ts`) that exports a tightly-named surface — application services and Symbol-typed ports only, never `DomainService` or repositories.
- MUST register the module in `AppModule.imports` in dependency order (`src/app.module.ts:92-109`).

### Dependency direction

Imports MUST flow strictly downward in this diagram:

```
transport (controllers, presenters, swagger, DTOs)
    ↑
application (orchestrates domain + cross-module ports)
    ↑
domain (pure business logic, ports, events, exceptions)
    ↑
infrastructure (Drizzle repositories, third-party adapters)
```

- `domain/` MUST NOT import from `application/`, `transport/`, `infrastructure/`, `core/`, `drizzle-orm`, or anything HTTP-specific. Reference: `src/modules/tag/domain/tag.service.ts` (only imports its own port, event bus port, `RedisService` for cache, and `class-validator`-free pure code).
- `application/` MUST NOT import from `drizzle-orm` or directly from `core/database`. Reference: `src/modules/tag/application/tag.application.service.ts` only imports `TagDomainService`, mapper classes, and Symbol-typed ports (`QUIZ_LISTING_PORT`, `QUIZ_ANALYTICS_PORT`).
- `infrastructure/` is the only layer that imports `drizzle-orm` and `core/database/schema`. Reference: `src/modules/tag/infrastructure/repositories/tag.repository.ts` is the sole importer of `drizzle-orm` and `core/database/schema` for the tag bounded context.
- `mappers/` MUST NOT throw business exceptions and MUST NOT call into `domain/` or `application/`. Reference: `src/modules/tag/mappers/tag-response.mapper.ts` is a pure projection.

### Layer responsibilities

- `domain/` owns: aggregates, business rules, domain events, domain ports (`Symbol`-typed), domain exceptions (extending `BaseDomainException`).
- `application/` owns: cross-aggregate orchestration; DTO construction; calling mappers; orchestrating cross-module ports.
- `infrastructure/` owns: Drizzle queries, DB-side constraint translation (`TagRepositoryConstraintError`).
- `transport/controllers/` MUST: declare routes, bind param/query/body DTOs, declare guards (`@Public()`, `@Permissions()`, `@Throttle()`), delegate to `applicationService.<method>()`, return `presenter.<method>(...)`.
- `transport/controllers/` MUST NOT: throw `HttpException`, build `ProblemDetail`, or call a repository directly.
- `transport/presenters/` owns: wire envelope construction. MUST call `ApiResponse.ok` / `ApiResponse.page` from `common/responses/api-response.ts`. MUST project class-instance DTOs into plain objects so the interceptor's `isFormattedResponse` check passes (`src/modules/tag/transport/presenters/tag.presenter.ts:wrapPaginatedDto`).
- `transport/swagger/` owns: per-endpoint composed decorators using `applyDecorators`, error and success examples under `examples/`. MUST NOT add runtime behavior.
- `core/` is the only owner of Drizzle (`core/database`), Redis (`core/redis`), logger config (`core/logger`), Swagger config (`core/swagger`), env validation (`core/config`), and reusable low-level utilities (`core/utils`).

### Cross-module communication

- Within a single request, a controller MUST call an application service, not another module's controller or domain service directly.
- Between bounded contexts, MUST use a Symbol-typed port exported from the consumer module (`TAG_REPOSITORY_PORT`, `QUIZ_LISTING_PORT`, `EXTERNAL_EVENT_BUS_PRODUCER_PORT`). The binding MUST be declared in the importing module's `providers` with `{ provide: PORT, useExisting: <ImplementationClass> }` or `{ provide: PORT, useClass: <ImplementationClass> }`. Reference: `src/modules/tag/tag.module.ts:30` binds `QUIZ_LISTING_PORT` to `QuizApplicationService`.
- For events that cross pod boundaries, MUST use `CommonExternalEventBus` (`src/common/events/common-external-event-bus.ts`). Producers inject `EXTERNAL_EVENT_BUS_PRODUCER_PORT`; consumers inject `EXTERNAL_EVENT_BUS_CONSUMER_PORT`. The aggregate port (`EXTERNAL_EVENT_BUS`) is reserved for modules that publish AND subscribe.
- For in-process side effects within one request, MUST use the per-module `DomainEventBus` (e.g. `TagDomainEventBus`) and the matching `<module>-event-bootstrap.service.ts` file (reference: `src/modules/tag/tag-event-bootstrap.service.ts`).

### Identifiers, ports, and symbols

- A repository contract MUST be declared in `domain/ports/<name>-repository.port.ts` and exported as a `Symbol(...)` token. MUST NOT depend on Drizzle types in this interface (reference: `src/modules/tag/domain/ports/tag-repository.port.ts` exposes only TS interfaces).
- The repository implementation MUST be registered via `{ provide: <PORT>, useClass: <Implementation> }` (reference: `src/modules/tag/tag.module.ts:28`).
- Domain event bus ports MUST use the same Symbol pattern (`TAG_DOMAIN_EVENT_BUS` in `src/modules/tag/domain/events/tag-domain-event-bus.port.ts`).
- All primary keys MUST be generated through `ID_GENERATOR` / `generateUuidV7()` (`src/common/utils/id-generator.ts`). Application code MUST NOT use `crypto.randomUUID()` for business identifiers.

### Boundaries that MUST NOT move

- The transport layer MUST NOT set HTTP status or build a `ProblemDetail` directly. The `GlobalExceptionFilter` is the single producer.
- Domain exceptions MUST NOT encode HTTP data. They carry `code` and `message` only (`src/common/errors/base-domain.exception.ts`).
- Repositories MUST NOT call into the application layer (no upward imports).
- Presenters MUST NOT call into the domain layer.
- Mappers MUST NOT throw business exceptions.
- A new bounded context MUST NOT reach across to another module's `domain/` or `infrastructure/` package — go through ports.

### Where new code belongs

| Concern | Belongs in |
|---|---|
| New validation rule | The request DTO with `class-validator` decorators |
| New HTTP status mapping | `src/common/errors/problem-code-mapping.ts` |
| New wire-shape | `src/common/responses/api-response.ts` + a presenter |
| New Swagger shape for a module | The module's `transport/swagger/<module>-swagger-decorators.ts` (composed via `applyDecorators`) |
| New low-level primitive (cursor, slug, ID) | `src/common/utils/` with a co-located spec |
| New cross-module event | The producing module's `domain/events/` + `EXTERNAL_EVENT_BUS_PRODUCER_PORT` if it must survive process restarts |

### What MUST NOT be introduced

These patterns are explicitly out of scope for AI and human contributions. See `docs/PROJECT_CONSTITUTION.md` §8.7 for the full list. Highlights:

- Multiple inheritance or mixins on domain services.
- A command-bus or CQRS middleware pipeline.
- Schema-first validation outside `class-validator`/`class-transformer`.
- A second logger alongside `nestjs-pino`.
- A second repository pattern (DAO, Active Record) alongside Drizzle.
- Persistence via raw SQL strings outside `core/database/schema/`.
- Module-level mutable state inside feature modules.

## Examples

### Cross-module port binding

```typescript
// src/modules/tag/tag.module.ts:30
{ provide: QUIZ_LISTING_PORT, useExisting: QuizApplicationService }
```

The quiz module exports the `QUIZ_LISTING_PORT` Symbol; the tag module binds the consumer-side symbol to the producer-side application service. No direct import of `quiz.domain.*` exists anywhere in `tag/`.

### Layer-only dependencies

`src/modules/tag/infrastructure/repositories/tag.repository.ts` is the only tag-side file that imports `drizzle-orm` and `core/database/schema`:

```typescript
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizzes, tags, tagFollows, quizTags, quizStats } from '@/core/database/schema';
import { and, desc, eq, isNull, or, sql, asc, ne } from 'drizzle-orm';
```

## Non-goals

- Documenting NestJS-specific terminology (decorators, providers, modules). These are framework knowledge.
- Justifying architectural decisions; that is the constitution's role.
- Suggesting alternative layering schemes. The current four-layer split is the project architecture.

## Future considerations

- If a module legitimately needs a new layer (e.g. an outbox writer), the change MUST be made in this document and the constitution in the same PR, with a corresponding spec.
- If the in-process `DomainEventBus` is generalized into a common bus (today it is per-module), the change MUST add a new "common" rules section and migrate modules incrementally.