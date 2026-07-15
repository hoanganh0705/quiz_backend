# ADR-0016: Configuration Strategy — Environment Variables with Zod Validation

## Status

Accepted

## Context

The application runs in multiple environments (development, staging, production) with different database connections, Redis hosts, OAuth credentials, and feature flags. Configuration must be validated at startup so that missing or misconfigured environment variables fail fast, not at runtime when they are first used.

## Decision

**All configuration comes from environment variables.** No configuration is read from files, remote services, or feature flags outside the environment variable model.

**Validation at startup:** `src/common/config/env.validation.ts` uses Zod to define schemas for all environment variables. The `validate` function parses and validates all variables before any NestJS module is bootstrapped. If validation fails, the process exits with a descriptive error listing all missing or invalid variables.

**Schema-driven typing:** Zod schemas generate TypeScript types that are used throughout the codebase. Configuration is accessed via `ConfigService` which returns fully-typed values.

**No default values for secrets:** Secrets (database passwords, JWT private keys, OAuth client secrets) must not have default values. A missing secret must cause startup failure. Non-sensitive configuration (port, log level) may have defaults.

**Structure:** The environment variable namespace is logically grouped:

- `DATABASE_*` — Drizzle database connection pool settings
- `REDIS_*` — Redis connection settings
- `JWT_*` — JWT signing key reference, token expiry
- `OAUTH_*` — Google OAuth client ID/secret
- `APP_*` — application name, environment, CORS origins
- `OUTBOX_*` — outbox cron schedule
- `THROTTLER_*` — rate limiting thresholds

**Secrets in files:** For RS256 JWT signing keys, the private key is loaded from a file path in the environment variable (not inlined in the env var itself). Public key is loaded from its own file.

## Consequences

**Advantages**
- Fail-fast at startup prevents the application from starting in a misconfigured state.
- Zod schemas are self-documenting: the schema IS the documentation for each variable.
- TypeScript types derived from Zod schemas eliminate manual type maintenance.
- Grouped variable names make the environment namespace predictable.
- No secrets with defaults prevents accidentally deploying with a placeholder secret.

**Trade-offs**
- Changing a configuration value requires a process restart; there is no live configuration reload.
- The Zod validation adds startup latency (typically milliseconds).
- Environment variables are stringly-typed at the OS level; Zod bridges this gap but adds an extra conversion step.

## Evidence

- `src/common/config/env.validation.ts` — Zod schema definitions and `validate()` function that exits on failure.
- `src/main.ts` — `validate()` called before `NestFactory.create()`.
- `src/modules/auth/transport/strategies/jwt.strategy.ts` — RS256 key loaded from file path from `JWT_PRIVATE_KEY_PATH`.
- `src/core/config/database.config.ts` — `DATABASE_*` typed config via `ConfigService`.
- `src/core/config/redis.config.ts` — `REDIS_*` typed config.
- `docs/PROJECT_CONSTITUTION.md` §3.1 (Where code belongs) — environment variables as the only configuration source; no remote config services.
