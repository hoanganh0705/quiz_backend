# ADR-0008: Dependency Injection — Symbol Tokens for Ports

## Status

Accepted

## Context

The system must avoid tight coupling between application code and concrete implementations. String-based DI token names are fragile (typos are not caught at compile time) and pollute the global namespace. Using class constructors as tokens works for class-based providers but does not work for interface-based ports.

## Decision

**Token strategy:** Every port interface (`*RepositoryPort`, `*EventBus`, `*Service`) is paired with a unique `Symbol` constant defined in the same file as the port. These symbols are the DI tokens — never strings, never class constructors.

**Token naming convention:** `TAG_REPOSITORY`, `USER_REPOSITORY`, `TAG_DOMAIN_EVENT_BUS`, `COMMON_EXTERNAL_EVENT_BUS`. The pattern is `MODULE_RESOURCE` in SCREAMING_SNAKE_CASE.

**Module binding:** Each module binds its adapter class to its port token in the NestJS `providers` array:

```typescript
providers: [
  TagRepositoryPort,
  { provide: TAG_REPOSITORY, useClass: TagRepositoryImpl }
]
```

**Injection:** Constructor injection using the port interface as the type and the `Symbol` as the token:

```typescript
constructor(
  @Inject(TAG_REPOSITORY) private readonly tagRepo: TagRepositoryPort
) {}
```

**Cross-cutting tokens:** Infrastructure-wide tokens (e.g. `TransactionalContext`, event buses) are defined in `src/common/di/` as `COMMON_*` constants.

## Consequences

**Advantages**
- `Symbol` tokens are unique — a typo in an `@Inject()` call causes a runtime DI resolution failure, not a silent wrong token.
- Ports are true interfaces (not classes used as interfaces), keeping the dependency surface minimal.
- Token naming is consistent: SCREAMING_SNAKE_CASE everywhere.
- Cross-module dependencies use the same token pattern, making the DI graph uniform.

**Trade-offs**
- `Symbol` tokens cannot be stringified or inspected in logs without the Symbol registry. Debugging missing providers requires the token Symbol object, not just its name.
- IDE autocomplete on `@Inject()` with `Symbol` tokens requires the symbol to be imported; unlike string tokens, there is no autocomplete from a magic string constant.
- Adding a new port requires defining a new Symbol — this is intentional friction to prevent accidental proliferation of ports.

## Evidence

- `src/common/di/common.di-tokens.ts` — `COMMON_EXTERNAL_EVENT_BUS`, `COMMON_OUTBOX_PROCESSOR`.
- `src/modules/tag/domain/ports/tag-repository.port.ts` — `TAG_REPOSITORY = Symbol('TAG_REPOSITORY')` alongside `TagRepositoryPort`.
- `src/modules/tag/domain/ports/tag-domain-event.port.ts` — `TAG_DOMAIN_EVENT_BUS = Symbol('TAG_DOMAIN_EVENT_BUS')`.
- `src/modules/auth/domain/ports/user-repository.port.ts` — `USER_REPOSITORY = Symbol('USER_REPOSITORY')`.
- `src/modules/tag/tag.module.ts` — binding pattern `{ provide: TAG_REPOSITORY, useClass: TagRepositoryImpl }`.
- `docs/PROJECT_CONSTITUTION.md` §1.1 (Explicit over implicit) — Named Symbol tokens for port interfaces; §2.1 (Dependency direction).
