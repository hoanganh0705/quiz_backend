# ADR-0010: Layered Architecture — Domain, Application, Infrastructure, Transport

## Status

Accepted

## Context

The codebase must maintain a clear separation of concerns so that domain logic (business rules, invariants) is independent of how requests arrive (HTTP, events) and how data is persisted (PostgreSQL, Redis). Without this separation, domain logic becomes tangled with HTTP concerns and database queries.

## Decision

Each module follows a four-layer structure:

**`domain/`** — Business logic, invariants, domain errors, and port interfaces. This layer has zero imports from `infrastructure` or `transport`. Domain services receive port interfaces via constructor injection; they do not know how data is stored or retrieved.

**`application/`** — Use-case orchestration. Receives domain services and ports via DI. Handles cross-module coordination, permission checks, and command/query dispatch. Does not import infrastructure implementations.

**`infrastructure/`** — Adapters implementing port interfaces: repositories (PostgreSQL via Drizzle), event bus implementations (Redis pub/sub, domain event bus), external service clients, CLI tools. Infrastructure imports from `domain/` (for port implementations) and from `src/core/`.

**`transport/`** — HTTP entry points: controllers, presenters (DTO transformation), guards, pipes, Swagger decorators. Receives application services via DI. Does not contain business logic.

**Dependency rule:** Dependencies flow inward only. `transport` → `application` → `domain`. `infrastructure` implements `domain` ports. No layer depends on a layer above it.

**Cross-module calls:** Modules communicate via public application service interfaces and domain event buses. Direct cross-module repository access is prohibited — a module reads another module's data only through the owning module's application service or a dedicated query interface.

## Consequences

**Advantages**
- Domain logic is testable without HTTP or database dependencies.
- Swapping infrastructure (e.g. moving from Drizzle to Prisma) requires changes only in `infrastructure/`.
- The dependency rule makes it easy to reason about what a change can affect.
- Clear roles: domain = "what", application = "how", infrastructure = "where", transport = "HTTP entry".

**Trade-offs**
- The four-layer structure requires discipline — a developer can technically import infrastructure into domain and the TypeScript compiler will not prevent it.
- For small modules the overhead of four directories is substantial relative to the code size.
- Cross-module orchestration often requires careful module boundary management; cyclic dependencies between modules are possible if not managed.

## Evidence

- `src/modules/tag/domain/` — `tag.service.ts`, port interfaces, domain errors, domain event definitions.
- `src/modules/tag/application/` — application services that orchestrate tag operations.
- `src/modules/tag/infrastructure/` — `tag.repository.ts` (implements `TagRepositoryPort`), event bus adapters.
- `src/modules/tag/transport/` — `tag.controller.ts`, `tag.presenter.ts`, Swagger decorators.
- `src/modules/auth/domain/ports/user-repository.port.ts` — port interface in `domain/`, implementation in `infrastructure/repositories/`.
- `src/modules/category/domain/ports/category-repository.port.ts` — port in `domain/`, impl in `infrastructure/`.
- `src/modules/category/infrastructure/repositories/category.repository.ts` — implements `CategoryRepositoryPort`.
- `docs/PROJECT_CONSTITUTION.md` §2 (Architecture Principles) — defines the dependency direction and layer responsibilities.
- `docs/architecture/overview.md` — layered diagram with `transport → application → domain/infrastructure`.
