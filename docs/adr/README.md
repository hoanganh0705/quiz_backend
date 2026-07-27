# Architecture Decision Records (ADR)

## Purpose

ADRs are permanent records of important architectural and engineering decisions made during the development of this project. They capture the *why* behind decisions that are already reflected in the codebase — not proposals, plans, or redesigns.

Each ADR documents:
- The **context** that required a decision
- The **decision** the project actually follows
- The **consequences** (advantages and trade-offs)
- **Evidence** from the implementation that demonstrates the decision is real

## ADR Numbering

ADRs are numbered sequentially starting from 0001: `ADR-0001`, `ADR-0002`, etc.

The number is permanent. A superseded ADR retains its number; a new ADR is created for the replacement. Numbers are never reused.

## Lifecycle

Each ADR has a **Status** field with one of the following values:

| Status | Meaning |
|---|---|
| **Accepted** | Currently enforced by the codebase. |
| **Superseded** | Replaced by a newer ADR. The record remains for historical reference. |
| **Deprecated** | No longer enforced; may be removed in a future cleanup. |
| **Experimental** | In use but not yet stable; subject to change. |

## When to Create a New ADR

A new ADR should be created when:

- A new architectural or engineering decision is made that will affect multiple modules or cross-cutting concerns.
- An existing decision is changed (create a new ADR; mark the old one as Superseded).
- A significant technical trade-off is made that future maintainers should understand.

A new ADR is **not** needed for:

- Implementation details (unless they encode a broader architectural principle).
- Coding style and naming conventions (documented in `docs/standards/`).
- Business rules that are not architectural (documented in `docs/modules/`).
- Temporary decisions expected to change within one release cycle.

## When an ADR is Superseded

An ADR is marked **Superseded** when:

- A new ADR explicitly replaces it (the new ADR cites the old one in its Evidence section).
- The decision it records is no longer followed by the codebase.

The Superseded ADR is not deleted. It remains as a historical record of why the old approach was chosen and why it was changed.

## How to Maintain ADRs

- ADRs live in `docs/adr/`. The number in the filename matches the ADR number.
- When an ADR is superseded, add the `Superseded` status and a note citing the replacement ADR.
- When a decision changes, create a new ADR — do not edit an Accepted ADR to retroactively reflect the change.
- The ADR index (below) is updated in the same commit that creates or modifies an ADR.

## Consistency Requirements

ADRs must not contradict:
- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/`
- `docs/modules/`
- `docs/architecture/`

Where an ADR relates to content in those documents, it should reference the document rather than duplicating the information.

---

## ADR Index

| Number | Title | Status | Summary | Related Standards | Related Modules | Related Architecture Documents |
|---|---|---|---|---|---|---|
| ADR-0001 | [Identifier Strategy — UUIDv7 for All Primary Keys](0001-identifier-strategy.md) | Accepted | All primary keys use UUIDv7, generated via `generateUuidV7()` in app and `uuidv7()` in Postgres. App and DB formats are byte-aligned. | `docs/standards/architecture.md` | All modules | `docs/architecture/persistence-flow.md` |
| ADR-0002 | [Temporal Data — UTC Timestamps, ISO 8601 Wire Format](0002-temporal-data.md) | Accepted | All timestamps stored as UTC `timestamp with time zone`; transmitted as ISO 8601 UTC strings with milliseconds. Normalized at the `ResponseFormatInterceptor` boundary. | `docs/standards/architecture.md` | All modules | `docs/architecture/persistence-flow.md` |
| ADR-0003 | [Error Response Strategy — RFC 7807 Problem Details](0003-error-response.md) | Accepted | All errors use RFC 7807 `application/problem+json` via `GlobalExceptionFilter`. Every domain code is registered in `ProblemCodeMapping`. Loud failure for unmapped codes. | `docs/standards/architecture.md` | All modules | `docs/architecture/request-flow.md` |
| ADR-0004 | [Pagination Strategy — Cursor Pagination for Lists](0004-pagination-strategy.md) | Accepted | Default pagination is cursor-based with `(createdAt, id)` sort key encoded as base64url JSON. Offset pagination reserved for endpoints without a stable sort key. | `docs/standards/architecture.md` | Tag, Category, Quiz, Social, Notification, Tournament | `docs/architecture/request-flow.md` |
| ADR-0005 | [Success Response Envelope — Canonical `{ data, meta }`](0005-success-envelope.md) | Accepted | All HTTP responses wrapped in `{ data, meta }` with `meta.timestamp`. Pagination adds `meta.pagination`. Produced by `ResponseFormatInterceptor`. | `docs/standards/architecture.md` | All modules | `docs/architecture/request-flow.md` |
| ADR-0006 | [Request Lifecycle — Global Interceptor Chain](0006-request-lifecycle.md) | Accepted | Three-interceptor chain: `CorrelationInterceptor` → `TransactionalInterceptor` → `ResponseFormatInterceptor`. Guards run before interceptors. `AsyncLocalStorage` for correlation and transaction propagation. | `docs/standards/architecture.md` | All modules | `docs/architecture/request-flow.md` |
| ADR-0007 | [Repository Pattern — Port/Adapter with Symbol Tokens](0007-repository-pattern.md) | Accepted | Domain layer defines port interfaces; infrastructure layer implements them. All database access goes through repository adapters. | `docs/standards/architecture.md` | All modules | `docs/architecture/overview.md` |
| ADR-0008 | [Dependency Injection — Symbol Tokens for Ports](0008-di-tokens.md) | Accepted | Every port is bound to a unique `Symbol` token. Constructor injection uses `@Inject(SYMBOL)`. No string tokens; no class-constructor tokens for interfaces. | `docs/standards/architecture.md` | All modules | `docs/architecture/overview.md` |
| ADR-0009 | [Transaction Management — @Transactional Decorator + AsyncLocalStorage](0009-transaction-management.md) | Accepted | `@Transactional()` decorator on controller handlers opens a Postgres transaction. `AsyncLocalStorage` propagates the transaction to repositories without explicit parameter passing. | `docs/standards/architecture.md` | Auth, Instance, Notification, Category, Social | `docs/architecture/persistence-flow.md` |
| ADR-0010 | [Layered Architecture — Domain, Application, Infrastructure, Transport](0010-layered-architecture.md) | Accepted | Four-layer module structure with enforced dependency direction: `transport` → `application` → `domain`. Infrastructure implements domain ports. | `docs/standards/architecture.md` | All modules | `docs/architecture/overview.md` |
| ADR-0011 | [Soft Delete Strategy — DeletedAt Timestamp + Partial Unique Indexes](0011-soft-delete.md) | Accepted | All deletable entities use `deletedAt` timestamp. Active records have `deletedAt = NULL`. Partial unique indexes enforce uniqueness on active records only. | `docs/standards/data-modeling.md` | Auth, User, Quiz, Tag, Category, Social, Comment, Notification | `docs/architecture/persistence-flow.md` |
| ADR-0012 | [Authentication Model — JWT Access + Refresh Token Rotation](0012-authentication.md) | Accepted | Short-lived RS256 JWT access tokens (15 min) + long-lived refresh tokens (7 days) with single-use rotation. Token reuse detection revokes the entire token family. Google OAuth integration. | `docs/standards/security.md` | Auth | `docs/architecture/authentication-flow.md` |
| ADR-0013 | [Authorization Model — Three-Layer RBAC + Permissions](0013-authorization.md) | Accepted | Three-layer: `JwtGuard` (identity) → `PermissionsGuard` (roles + permissions from JWT) → Domain policies (resource ownership). Permissions embedded in JWT payload for O(1) checks. | `docs/standards/security.md` | Auth, Tag, Quiz, Category, Social, Comment, Tournament | `docs/architecture/authorization-flow.md` |
| ADR-0014 | [Event Architecture — Three-Layer Event Bus](0014-event-architecture.md) | Accepted | Layer 1: in-process fire-and-forget (domain events). Layer 2: Redis pub/sub for cross-instance coordination. Layer 3: transactional outbox for at-least-once delivery of critical events. | `docs/standards/architecture.md` | Tag, Quiz, Tournament, Achievement, Social | `docs/architecture/event-flow.md` |
| ADR-0015 | [API Documentation — Code-First OpenAPI with Decorators](0015-api-documentation.md) | Accepted | OpenAPI 3.0 generated from decorators via `@nestjs/swagger`. `class-validator` dual-use for runtime validation and schema generation. Spec written to `docs/generated/openapi.json` as CI artifact. | `docs/standards/architecture.md` | All modules | `docs/architecture/overview.md` |
| ADR-0016 | [Configuration Strategy — Environment Variables with Zod Validation](0016-configuration.md) | Accepted | All configuration from environment variables, validated by Zod at startup. Fail-fast on missing secrets. RS256 keys loaded from files referenced by env vars. | `docs/standards/architecture.md` | All modules | `docs/architecture/overview.md` |

| ADR-0017 | [Counter Reconciliation — Mutate-In-Transaction or Full-Recompute](0017-counter-reconciliation.md) | Accepted | Every denormalized counter is either mutated inside the source transaction (Strategy A) or never written and always recomputed from source by a service method (Strategy B). All counters ship a daily reconciliation sweep and a production-guarded backfill. | `docs/standards/database.md` | Quiz, Review, Comment, Tournament, Ranking, Bookmark | `docs/architecture/persistence-flow.md` |
