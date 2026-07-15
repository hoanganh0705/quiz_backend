# ADR-0007: Repository Pattern — Port/Adapter with Symbol Tokens

## Status

Accepted

## Context

Application services must be decoupled from the database implementation so that the domain and application layers remain testable and the persistence mechanism can be swapped. Direct imports of repository implementations into application services create tight coupling and make unit testing impossible without a real database.

## Decision

**Ports** are TypeScript interfaces (e.g. `TagRepositoryPort`, `UserRepositoryPort`) defined in `domain/ports/`. They declare the complete set of data access operations for a module.

**Adapters** are concrete implementations of ports, defined in `infrastructure/repositories/`. They use Drizzle ORM to query the database.

**Dependency direction:** Application services depend on ports. Infrastructure adapters implement ports. The DI container injects adapters wherever a port is required.

**DI tokens:** Every port is associated with a `Symbol` token defined alongside the port interface. Adapters are bound to their token via `module.providers`. Controllers and application services receive the port interface (not the adapter class) via constructor injection.

**Single adapter per module:** Each module has exactly one concrete repository adapter bound to its port token. No conditional binding or environment-based adapter selection exists in the current codebase.

**The repository is the boundary:** All database queries — including raw SQL, Drizzle query builders, and transaction management — live in repository adapters. Application services and domain services MUST NOT call the database directly.

## Consequences

**Advantages**
- Application services are unit-testable: inject a mock port implementation in tests, no database needed.
- The port interface is a clear contract: all data access is surfaced in one place per module.
- Swapping the database (e.g. for testing) requires only a new adapter, not changes to application services.
- `Symbol` tokens prevent direct instantiation and enforce DI container usage.

**Trade-offs**
- The port/adapter split adds indirection. For simple CRUD modules the overhead may not justify the abstraction.
- Keeping ports and adapters in sync requires discipline — adding a query to the adapter without updating the port creates an unused method.
- The current architecture has no infrastructure abstraction above the repository layer; if the ORM needs to change, every adapter must be rewritten.

## Evidence

- `src/modules/tag/domain/ports/tag-repository.port.ts` — `TagRepositoryPort` interface.
- `src/modules/tag/infrastructure/repositories/tag.repository.ts` — `TagRepositoryImpl` implements `TagRepositoryPort`.
- `src/modules/tag/tag.module.ts` — `providers: [TagRepositoryPort, { provide: TAG_REPOSITORY, useClass: TagRepositoryImpl }]`.
- `src/modules/tag/domain/tag.service.ts` — injects `TagRepositoryPort` (not the implementation).
- `src/modules/auth/domain/ports/user-repository.port.ts` — `UserRepositoryPort` with `softDeleteAccount` and `revokeAllSessions`.
- `docs/PROJECT_CONSTITUTION.md` §2 (Architecture Principles) — explicitly defines the port/adapter architecture.
- `docs/architecture/overview.md` — dependency direction diagram showing `application` → `domain/ports` → `infrastructure`.
