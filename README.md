# Quiz Backend

NestJS backend for a quiz application. The API uses PostgreSQL through
Drizzle ORM, Redis for auth/session/cache, JWT authentication with
refresh-token rotation, fine-grained RBAC, structured logging via
Pino, OpenTelemetry-compatible tracing, Prometheus metrics, and a
production-grade recovery story (circuit breakers, transactional
outbox, stampede-protected caches).

## Why this codebase is interesting

This is **not** a CRUD tutorial. It is a portfolio piece that
demonstrates the engineering decisions you would expect of a
mid-senior backend engineer:

| | Decision | Where |
| --- | --- | --- |
| ◉ | **Hexagonal / Ports-and-Adapters** — domain depends on ports, not on `pg` or `ioredis` | [`docs/adr/0018-ports-and-adapters.md`](docs/adr/0018-ports-and-adapters.md) |
| ◉ | **Transactional Outbox** — domain mutations and their events commit atomically; LISTEN/NOTIFY for sub-second dispatch | [`docs/adr/0019-transactional-outbox.md`](docs/adr/0019-transactional-outbox.md) |
| ◉ | **Optimistic Locking** — quiz-instance state machine uses a `version` column, surfacing conflicts as `409` | [`docs/adr/0020-optimistic-locking.md`](docs/adr/0020-optimistic-locking.md) |
| ◉ | **UUIDv7 primary keys** — time-ordered, RFC 9562, B-tree-friendly | [`docs/adr/0021-uuidv7-primary-keys.md`](docs/adr/0021-uuidv7-primary-keys.md) |
| ◉ | **Stampede-protected read-through cache** — Redis-coordinated `SET NX PX` locks prevent cache-stampedes | [`docs/adr/0022-stampede-protection.md`](docs/adr/0022-stampede-protection.md) |
| ◉ | **Fail-open Redis circuit breaker** — five consecutive failures and Redis calls short-circuit to a safe fallback | [`docs/adr/0023-redis-circuit-breaker.md`](docs/adr/0023-redis-circuit-breaker.md) |
| ◉ | **RFC 7807 problem-detail errors** with a mapped, loud failure on any unmapped code | [`docs/adr/0003-error-response.md`](docs/adr/0003-error-response.md) |
| ◉ | **Cursor pagination** by default; offset pagination reserved for endpoints without a stable sort key | [`docs/adr/0004-pagination-strategy.md`](docs/adr/0004-pagination-strategy.md) |
| ◉ | **JWT access + refresh rotation with reuse detection** that revokes the entire token family on replay | [`docs/adr/0012-authentication.md`](docs/adr/0012-authentication.md) |
| ◉ | **Three-layer authorization** — `JwtGuard` → `PermissionsGuard` → domain ownership checks | [`docs/adr/0013-authorization.md`](docs/adr/0013-authorization.md) |
| ◉ | **Custom OpenTelemetry-compatible tracing** for HTTP, Redis, Drizzle, and BullMQ — with W3C `traceparent` propagation | `src/core/observability/` |
| ◉ | **Prometheus-compatible `/metrics`** with histograms, gauges, and dynamic-scraping for circuit state, queue depth, outbox lag | `src/modules/health/metrics.controller.ts` |
| ◉ | **Multi-stage Dockerfile**, non-root user, all secrets via env | `Dockerfile` |
| ◉ | **Authorization test matrix** — every (role, route) is enforced by `test/authz.e2e-spec.ts` driven from a single fixture table | [`test/fixtures/authz-matrix.ts`](test/fixtures/authz-matrix.ts) |
| ◉ | **Race-condition test** for `joinInstanceAtomic` that demonstrates the `FOR UPDATE` semantics under concurrency | `src/modules/instance/infrastructure/repositories/quiz-instance.repository.race.spec.ts` |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Client (Browser/Mobile)                                        │
└─────────────────┬──────────────────────────────────────────────┘
                  │ HTTPS (TLS terminated at LB)
┌─────────────────▼──────────────────────────────────────────────┐
│ NestJS Application Pods  (HPA 3-12, 1 vCPU / 1 GB each)        │
│                                                                │
│  ┌─────────────────────────────┐   ┌────────────────────────┐ │
│  │  HTTP Layer (Controllers)   │   │  Worker Layer          │ │
│  │  ─ Validators, throttle,    │   │  ─ BullMQ email queue  │ │
│  │    rate-limit, traceparent  │   │  ─ Outbox processor    │ │
│  └──────────────┬──────────────┘   └────────────┬───────────┘ │
│                 │                               │             │
│  ┌──────────────▼───────────────────────────────▼───────────┐ │
│  │  Application Services (use-case orchestration)            │ │
│  └──────────────┬───────────────────────────────────────────┘ │
│  ┌──────────────▼───────────────────────────────────────────┐ │
│  │  Domain Layer (entities, value objects, policies)         │ │
│  │  ─ depends only on port interfaces (`STORAGE_PORT`,       │ │
│  │    `CACHE_PROVIDER`, `QUIZ_REPOSITORY_PORT`, …)           │ │
│  └──────────────┬───────────────────────────────────────────┘ │
│  ┌──────────────▼───────────────────────────────────────────┐ │
│  │  Infrastructure Adapters                                   │ │
│  │  ─ Drizzle (Postgres), ioredis, BullMQ, Cloudinary, …     │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                  │                       │
        ┌─────────▼──────────┐  ┌─────────▼─────────┐
        │ Postgres (RDS)     │  │ Redis (ElastiCache)│
        │ ─ primary only     │  │ ─ cache,           │
        │ ─ optional replica │  │   rate-limit,      │
        └────────────────────┘  │   sessions,        │
                                │   stampede locks   │
                                └────────────────────┘
                                        │
                                ┌───────▼────────┐
                                │ Cloudinary     │
                                │ Resend (email) │
                                └────────────────┘
```

A more detailed module map is in
[`docs/architecture/overview.md`](docs/architecture/overview.md).

## Requirements

- **Node.js** 20.x or 22.x (NestJS 11)
- **pnpm** 9.x (pinned via `packageManager` in `package.json`; activate with `corepack enable`)
- **Docker** for the local Postgres + Redis scripts
- **Postgres 18** and **Redis 8** if you want to run them outside Docker

## Setup

```bash
pnpm install
cp .env.example .env
# Generate JWT secrets (two different values!)
openssl rand -base64 32   # → JWT_ACCESS_TOKEN_SECRET
openssl rand -base64 32   # → JWT_REFRESH_TOKEN_SECRET
```

> **Need a step-by-step bootstrap?** Follow
> [`docs/runbooks/local-bootstrap.md`](docs/runbooks/local-bootstrap.md)
> for a 15-minute walkthrough from clone to running smoke checks.

## Development

```bash
pnpm db:start
pnpm redis:start
pnpm db:migrate
pnpm start:dev
```

The API is served under the global prefix `/api/v1`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/health` | Liveness + dependency health (Postgres, Redis, Storage, Email queue, Redis circuit) |
| `GET /api/v1/health/live` | Process liveness only |
| `GET /api/v1/metrics` | Prometheus-format metrics |
| `GET /api/v1/docs` | Swagger UI (disabled in production by default) |
| `GET /api/v1/docs/openapi.json` | OpenAPI 3.0 document — used by the frontend SDK generator |

Use **Authorize** in Swagger UI with a Bearer access token for
protected routes.

## Project Layout

```text
src/
  app.module.ts                Root DI wiring
  main.ts                      HTTP bootstrap
  common/                      Cross-cutting utilities:
                               decorators, filters, guards, interceptors,
                               port interfaces (see ADR-0018)
  core/
    config/                    Zod-validated env config
    database/                  Drizzle + connection pool
    logger/                    Pino structured logging
    observability/             Tracing, metrics, tracing wrappers
    redis/                     Redis client + circuit breaker (ADR-0023)
    storage/                   Cloudinary + storage port (Phase 7)
  modules/
    auth/                      Auth, RBAC, sessions, refresh tokens
    user/                      Profile bundles (cache + i18n)
    quiz/                      Quiz CRUD, cache, invalidation handlers
    instance/                  Real-time game rooms (optimistic locking)
    attempt/                   Quiz attempt flow
    upload/                    Media upload (→ presigned URLs in Phase 7)
    admin/                     Admin operations (audit log search)
    health/                    Health + metrics endpoints
    email/                     BullMQ queue + email workers
docs/
  adr/                         Architecture Decision Records
  architecture/                Module-level architecture notes
  standards/                   Engineering standards (api, security, testing, …)
  runbooks/                    Operational procedures (local-bootstrap,
                               redis-socket-deployment, …)
  modules/                     Per-module notes
  OPERATIONS.md                Production operations manual
  generated/                   OpenAPI document (CI artifact)
test/                          E2E tests + fixtures
  authz.e2e-spec.ts            Authorization matrix coverage
```

Auth-specific RBAC and permission code lives in `src/modules/auth`.
Cross-cutting utilities live in `src/common`.

## Testing

```bash
pnpm test               # Unit tests (Jest)
pnpm test:e2e           # E2E (Postgres + Redis required)
pnpm exec eslint "{src,test}/**/*.ts"
pnpm tsc --noEmit       # Type-check
```

The repo enforces a strict test pyramid:

- **Unit** — application services with fake ports; no Docker required.
- **Integration** — repository tests against an in-memory executor for
  transaction semantics (no Docker required).
- **E2E** — full Nest app, real Postgres + Redis; covers
  authorization (via the matrix), outbox, race conditions, and metrics.

See [`docs/standards/testing.md`](docs/standards/testing.md) for the
canonical writeup.

## Useful Scripts

```bash
pnpm build
pnpm start              # production
pnpm start:dev          # watch mode
pnpm db:generate        # Generate Drizzle migrations from schema
pnpm db:migrate         # Apply migrations
pnpm db:seed:foundation # Roles, permissions, base taxonomy
pnpm db:reset           # Drop + re-create (DESTRUCTIVE — local only)
pnpm redis:start        # Local Redis container
pnpm db:start           # Local Postgres container
pnpm smoke              # Smoke check on the running API
pnpm smoke:openapi      # Verify Swagger is reachable
```

## ADRs (Architecture Decision Records)

New engineers: start with these to understand the *why* behind the
code. The full list is in
[`docs/adr/README.md`](docs/adr/README.md).

| | ADR | |
| --- | --- | --- |
| 0018 | [Ports and Adapters](docs/adr/0018-ports-and-adapters.md) | Hexagonal architecture; domain depends on port interfaces |
| 0019 | [Transactional Outbox](docs/adr/0019-transactional-outbox.md) | Domain mutations + events commit atomically |
| 0020 | [Optimistic Locking](docs/adr/0020-optimistic-locking.md) | `version` column on quiz instances |
| 0021 | [UUIDv7](docs/adr/0021-uuidv7-primary-keys.md) | All primary keys, RFC 9562 |
| 0022 | [Stampede Protection](docs/adr/0022-stampede-protection.md) | Redis-coordinated cache locks |
| 0023 | [Redis Circuit Breaker](docs/adr/0023-redis-circuit-breaker.md) | Fail-open on Redis outages |

## Operations

For production operations — env vars, scaling, incident response,
on-call rotation — see
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## License

This is a private portfolio project. Replace this section with the
appropriate license for your needs (e.g. MIT, Apache-2.0).

_Last regenerated: 2026-08-19 against `quiz_backend/package.json` on
branch `main`._
