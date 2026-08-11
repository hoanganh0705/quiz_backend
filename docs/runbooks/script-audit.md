# Backend Script Audit

> **Source ticket**: TKT-1.1.1.1
> **Generated**: 2026-07-29 against `quiz_backend/package.json` on branch `main`.
> **Purpose**: Single source of truth for which `scripts.*` entries exist, used by Epic 1.1 onboarding and Phase 1 bootstrap.

## Required scripts (Epic 1.1 baseline)

These six scripts are required for the documented 5-step bootstrap. Each row was verified by running `pnpm run <name> --help` (or, for chained scripts, reading the entry from `package.json`).

| Required script | Status | One-line purpose |
|---|---|---|
| `start:dev` | ✅ present | Start NestJS dev server with watch mode on `localhost:8080` |
| `db:start` | ✅ present | Start the `quizdb` Postgres container (idempotent: starts existing or creates new) |
| `redis:start` | ✅ present | Start the `quizredis` Redis container (idempotent) |
| `db:migrate` | ✅ present | Apply Drizzle migrations to the database |
| `db:seed:foundation` | ✅ present | Seed the foundation dataset (roles, permissions, base taxonomy) |
| `generate:openapi` | ✅ present | Curl the live Swagger `/openapi.json` into `docs/generated/openapi.json` |

**All six required scripts are present.** No follow-up issue is needed for missing scripts. The conditional clause of TKT-1.1.1.2 therefore does not fire; the only ticket action is to update this audit to record that fact.

## Full `scripts` inventory

Every key from `package.json` `scripts`, grouped by purpose. All entries verified present.

### Build / runtime

| Script | Present |
|---|---|
| `build` | ✅ |
| `start` | ✅ |
| `start:dev` | ✅ |
| `start:debug` | ✅ |
| `start:prod` | ✅ |
| `debug` | ✅ |

### Test / lint / format

| Script | Present |
|---|---|
| `lint` | ✅ |
| `format` | ✅ |
| `test` | ✅ |
| `test:watch` | ✅ |
| `test:cov` | ✅ |
| `test:debug` | ✅ |
| `test:e2e` | ✅ |
| `test:scripts` | ✅ |

### Database (Postgres via Drizzle)

| Script | Present |
|---|---|
| `db:start` | ✅ |
| `db:stop` | ✅ |
| `db:cleanall` | ✅ |
| `db:reset` | ✅ |
| `db:generate` | ✅ |
| `db:migrate` | ✅ |
| `db:push` | ✅ |
| `db:check` | ✅ |
| `db:introspect` | ✅ |
| `db:seed` | ✅ |
| `db:seed:foundation` | ✅ |
| `db:seed:development` | ✅ |
| `db:seed:scenarios` | ✅ |
| `db:seed:all` | ✅ |
| `db:backfill:user-streak` | ✅ |
| `db:backfill:user-streak:dry-run` | ✅ |
| `db:backfill:bookmark-metrics` | ✅ |
| `db:backfill:quiz-metrics` | ✅ |
| `seed:reset` | ✅ |

### Redis

| Script | Present |
|---|---|
| `redis:start` | ✅ |
| `redis:stop` | ✅ |
| `redis:reset` | ✅ |
| `redis:cleanall` | ✅ |

### Outbox / operational tooling

| Script | Present |
|---|---|
| `outbox:inspect` | ✅ |
| `outbox:retry` | ✅ |
| `outbox:discard` | ✅ |

### OpenAPI / docs

| Script | Present |
|---|---|
| `generate:openapi` | ✅ |

**Total script keys in `package.json`:** 41 (verified by `jq '.scripts | keys | length'`).
**Missing scripts:** 0.
**Follow-up issues filed:** 0.

## Notes

- No script needs to be added; TKT-1.1.1.2 collapses to the no-op path.
- This audit is regenerated as part of TKT-1.1.1.2 if any future change alters `scripts.*`.
- The audit intentionally does not capture script bodies (commands) — that lives in `package.json` itself.
