# ADR-0018 — Ports-and-Adapters Choice for Hexagonal Architecture

| Status    | Accepted |
| --------- | -------- |
| Date      | 2026-08-19 |
| Deciders  | Backend Lead |
| Consulted | Domain Engineers |
| Informed  | Whole engineering team |
| Amends    | ADR-0007 (Repository Pattern), ADR-0010 (Layered Architecture) |

## Context

The quiz backend must persist state in PostgreSQL, cache in Redis,
publish events through BullMQ, and upload media to Cloudinary.
Without a deliberate boundary, every controller would import its
concrete infrastructure (`pg`, `ioredis`, `bullmq`, `cloudinary`),
and a refactor of any of those — let alone a swap to DynamoDB or
S3 — would touch every layer of the application.

ADR-0007 and ADR-0010 already establish the *Repository Pattern*
and *Layered Architecture* (`transport → application → domain →
infrastructure`). Those decisions mandate that the domain layer
depends on abstract ports; this ADR records the specific shape of
that port system and the rationale for the choices that
ADR-0007 left implicit.

## Decision

We adopt **Ports and Adapters** (also called the Hexagonal
Architecture, after Cockburn 2005). Every cross-cutting or external
dependency is hidden behind a TypeScript interface — a *port* — that
the domain layer consumes, and the dependency-injection container
wires the concrete adapter at boot time.

The pattern has three artefacts per dependency:

1. **Port** — `src/common/ports/<name>.port.ts`. A pure interface
   in domain language (e.g. `StoragePort.uploadAvatar(...)`).
2. **Adapter** — `src/core/<dep>/infrastructure/`. Implements the
   port against a specific technology (Cloudinary, S3, …).
3. **Module** — `src/core/<dep>/`. Registers the adapter as the
   port provider with NestJS's DI.

Ports are the only thing the domain layer ever imports from
infrastructure. The runtime tokens (`StoragePort`, `CacheProvider`,
`QuizRepositoryPort`, …) are re-exported via DI symbols that the
modules consume through `@Inject(STORAGE_PORT)` /
`@Inject(CACHE_PROVIDER)`.

### Example

```ts
// src/common/ports/storage.port.ts
export interface StoragePort {
  upload(...): Promise<UploadResult>;
  delete(...): Promise<void>;
  ping(): Promise<void>;
}

// src/modules/upload/application/upload.application.service.ts
@Inject(STORAGE_PORT) private readonly storage: StoragePort {}

// src/core/storage/infrastructure/cloudinary/cloudinary.adapter.ts
export class CloudinaryStorageAdapter implements StoragePort { ... }
```

The domain layer tests pass an in-memory fake via `useValue`. The
production container binds the real adapter via `useClass`. Nothing
in between needs to change.

## Consequences

### Positive

- **Testability.** A unit test for the upload application service
  boots a `TestingModule` with `{ provide: STORAGE_PORT,
  useValue: inMemoryStorage }`. No `pg`, no `cloudinary`, no Docker.
- **Replaceability.** The same upload application service runs
  against Cloudinary in dev/prod and an in-memory fake in tests; a
  future S3 adapter can be slotted in by replacing one provider
  binding.
- **Domain purity.** `upload.application.service.ts` cannot import
  `cloudinary` directly — the TypeScript compiler rejects it because
  the port does not expose those types. The domain stays free of
  vendor types.
- **Cross-cutting observability.** Port boundaries are the natural
  place to wrap Redis (`redis-tracing.wrapper.ts`), Drizzle
  (`drizzle-tracing.wrapper.ts`), and BullMQ
  (`bullmq-tracing.wrapper.ts`) with tracing spans. Without the
  port, every call site would need its own tracing instrumentation.

### Negative

- **Indirection cost.** Each port introduces one more layer to
  navigate. New contributors need a few minutes to find the adapter
  that backs a port.
- **Verification overhead.** A refactor that changes the
  implementation but not the port contract requires verifying that
  every consumer is still satisfied. We mitigate this with the
  `test/fixtures/authz-matrix.ts`-style matrix tests and the
  application-service unit tests that assert on port contracts.
- **Port proliferation risk.** Each new external dependency tends
  to grow a port of its own. We control this by collapsing related
  capabilities into a single port (`StoragePort` covers *upload*,
  *delete*, and *ping*) rather than fragmenting per method.

## Alternatives considered

- **Active Record / repository-mixin style.** Rails-style models
  expose `pg.Pool` directly to controllers. Rejected: it couples the
  domain to `pg` and makes every query a potential test-bottleneck.
- **Hexagonal with one port per method** (functional core,
  imperative shell). Considered but rejected: too verbose for the
  size of the surface, and the per-method ports grew into a maze of
  30+ interfaces per module.
- **Direct DI of infrastructure clients.** Rejected: every test
  would need a real `pg.Pool` mock, and a swap to DynamoDB would
  cascade through the entire domain.

## References

- Cockburn, A. (2005). *Hexagonal Architecture*.
- Vaughn, V. (2017). *Implementing Domain-Driven Design*. Chapter 3.
- ADR-0007 — Repository Pattern.
- ADR-0008 — Dependency Injection Tokens.
- Source: `src/common/ports/`, `src/core/observability/`,
  `src/core/storage/`, `src/modules/*/domain/ports.ts`.