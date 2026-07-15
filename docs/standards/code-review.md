# Code Review Standard

> Project-specific rules for what an acceptable change looks like and what must be rejected at review time.
> Out of scope: tool choice (the project uses ESLint/Prettier/Jest); only review-time expectations are documented.

## Purpose

Defines what reviewers MUST expect from a PR, what MUST block a merge, and the reviewer-side expectations so that changes stay aligned with `PROJECT_CONSTITUTION.md` and the engineering standards under `docs/standards/`.

## Scope

Applies to any PR that touches `src/`, `test/`, `docs/standards/`, `docs/PROJECT_CONSTITUTION.md`, `docs/generated/openapi.json`, or `src/core/database/migrations/`.

## Source of Truth

- `docs/PROJECT_CONSTITUTION.md`
- `docs/standards/*.md`
- `package.json` scripts (`lint`, `test`, `test:e2e`, `db:generate`, `generate:openapi`)
- `src/app.module.ts`, `src/main.ts`, `src/core/`, `src/common/`, representative module `src/modules/tag/`
- `src/commands/outbox.ts`

## Rules

### Reviewer-side expectations

- A reviewer MUST read each PR against the constitution first, then against the relevant standards (`architecture.md`, `api.md`, `database.md`, `security.md`, `swagger.md`, `validation.md`, `testing.md`, `migration.md`, `error-handling.md`, `performance.md`).
- A reviewer MUST run the relevant scripts locally:
  - `pnpm lint` MUST pass.
  - `pnpm test` MUST pass.
  - `pnpm test:e2e` MUST pass when the change touches any cross-cutting code (interceptors, filters, guards, OpenAPI, migrations, response envelopes, or error mapping).
  - `pnpm generate:openapi` MUST run when DTOs, controllers, or Swagger decorators change, and the regenerated `docs/generated/openapi.json` MUST be committed in the same PR.
- A reviewer MUST verify that PRs that change schema definitions also include the corresponding migration in `src/core/database/migrations/` and that the migration is generated (not hand-written unless justified).
- A reviewer MUST read the diff for cross-module coupling: a module change MUST NOT reach directly into another module's `domain/`, `infrastructure/`, or `transport/`; ports MUST mediate.
- A reviewer MUST require tests for new business logic (see `testing.md`) and MUST require updated or new contract tests for any wire-level changes.

### What an acceptable change MUST contain

- Tests that cover the changed public surface (unit + e2e where relevant). Co-located specs are preferred.
- Documentation updates in `docs/standards/` when the change introduces a new convention not yet documented. New conventions belong in a standard, not in scattered README files.
- Migration(s) and updated Drizzle schemas for any persistent change.
- A regenerated OpenAPI artifact if the API surface changed.
- An audit record (via `AuditLogService`) if the change introduces a sensitive operation.
- An entry in `docs/migrations/<name>.md` if the change alters a wire contract for current or future consumers.

### Prohibited changes

These MUST block a PR. See `docs/PROJECT_CONSTITUTION.md` §8.7 for the full list. Highlights:

- Reaching across module boundaries to call another module's `domain/`, `infrastructure/`, or `transport/` directly.
- Bypassing the global `GlobalExceptionFilter` to return a custom error envelope.
- Replacing `class-validator` with another validation library.
- Replacing `PinoLogger` with another logger.
- Replacing Drizzle with a different ORM for a subset of modules.
- Skipping the global `ValidationPipe` config in a per-handler pipe.
- Adding a second rate-limiter without removing or subsuming the first.
- Adding raw SQL outside `core/database/schema/` and `core/database/migrations/`.
- Adding HTTP-level concerns (status, headers) inside domain code.

### Naming and placement

- A new file MUST land in the existing layer's directory. A file under `src/modules/<m>/domain/` MUST NOT contain Express imports.
- A new Symbol token MUST be defined in the same file as the port it labels, exported, and used in `module.ts` with `provide`/`useExisting`/`useClass`.
- A new domain exception MUST extend `BaseDomainException` and MUST be mapped through `ProblemCodeMapping` (`src/common/errors/problem-code-mapping.ts`).
- A new domain event MUST extend the module's `DomainEvent` base and use the module's in-process bus; cross-process events MUST publish via `EXTERNAL_EVENT_BUS_PRODUCER_PORT`.

### Lint, types, formatting

- TypeScript MUST compile under the project's `tsconfig`. New `any` is forbidden except in tightly-scoped adapters and SHOULD be reviewed line-by-line.
- ESLint warnings MUST be addressed before merge; suppressions are limited to `eslint-disable-next-line` with a reason comment.
- Prettier formatting MUST pass; the project's format-on-save configuration is acceptable.
- A new `console.log` MUST be flagged for replacement with `PinoLogger`.

### Tests in review

- A reviewer MUST reject a PR that adds a public function without at least one test covering the happy path and one covering each documented edge case.
- A reviewer MUST reject a PR that modifies `GlobalExceptionFilter`, `ResponseFormatInterceptor`, `CorrelationInterceptor`, `TransactionalInterceptor`, or `validateEnv` without updating the corresponding e2e test.
- A reviewer MUST reject a PR that adds a new domain exception without asserting it in the `ProblemCodeMapping` test or the RFC 7807 e2e test.
- A reviewer MUST reject a PR that introduces a new endpoint without an example in `transport/swagger/examples/` and a module-level contract test.

### Security and audit

- A reviewer MUST verify every authentication-optional endpoint is marked with `@Public()`; missing decoration is a defect.
- A reviewer MUST verify every admin / moderator / privileged action is guarded by `@Permissions(...)` and audited where applicable.
- A reviewer MUST verify that any change touching secrets, cookies, or JWTs is staged with a `docs/migrations/<name>.md` note.

### Migration and rollout

- A reviewer MUST confirm that the PR's description explains backward compatibility (additive change vs. breaking change) and ties to the lifecycle in `migration.md`.
- A reviewer MUST require a deprecation plan in the same PR for any breaking change.
- A reviewer MUST confirm that any new CLI tool follows the production-safety pattern (`ALLOW_PROD_*_OPERATIONS`).

### Conflict resolution and consistency

- A reviewer MUST prefer the existing convention over introducing a new one. A new convention belongs in `docs/standards/`, not in the diff.
- A reviewer MUST require a corresponding `docs/standards/` update when the PR introduces a new repeatable pattern.
- When the existing convention is unclear, the reviewer SHOULD defer to the constitution or ask for a decision.

### Performance

- A reviewer MUST require the maintainer's sign-off when the PR introduces a query that scans a large table or creates a new index on an existing populated table.
- A reviewer SHOULD check whether a new endpoint adds cache reads/writes inconsistently with neighbors; new cache keys MUST follow the module's existing namespace.

### Documentation

- A PR that modifies `PROJECT_CONSTITUTION.md` MUST be approved by a project maintainer (the constitution is the top of the standards hierarchy).
- A PR that adds a new standard under `docs/standards/` MUST follow the section template (Purpose, Scope, Source of Truth, Rules, Examples, Non-goals, Future considerations).
- A PR that adds a new rule to an existing standard MUST keep the rule normative (`MUST`/`SHOULD`/`MUST NOT`) and MUST cite the source of evidence in the rule itself or in the `Examples` block.

### PR checklist (reviewer-side)

A reviewer SHOULD use this checklist before merging:

1. Constitution and standards followed.
2. `pnpm lint`, `pnpm test`, `pnpm test:e2e` green.
3. `pnpm generate:openapi` re-run, artifact committed (when applicable).
4. Drizzle schema and migration both updated (when applicable).
5. Module dependency direction respected.
6. Public surface has tests.
7. Sensitive operations emit audit records.
8. Deprecation/rollout plan attached.
9. Naming and layer placement correct.
10. PR description explains backward compatibility.

## Examples

### Acceptable PR shape (illustrative)

```
Title: feat(tag): add user-followed-tags controller

- Adds GET /users/me/followed-tags (UserTagController) with @Public disabled.
- Adds TagRankingCursor DTO with @IsOptional/@IsString decorators.
- Updates OpenAPI examples under examples/.
- Updates tag-openapi.spec.ts to assert path and response schema.
- Updates envelope / rfc7807 e2e only if error code added (none here).
- Generates openapi.json.
- No Drizzle change, no migration, no breaking change.
```

### PR that MUST be blocked (illustrative)

- A PR that adds a raw SQL `pg.query(...)` call inside a domain service to fetch tags.
- A PR that returns `throw new BadRequestException(...)` from a controller while a domain exception already exists.
- A PR that introduces `mongoose` for one bounded context alongside Drizzle.

## Non-goals

- Style nits that ESLint/Prettier can automate — defer to tooling.
- Personal preference disputes that have no bearing on the constitution or standards.
- Reviewing documentation outside `docs/standards/` and `docs/PROJECT_CONSTITUTION.md` unless the PR explicitly touches them.

## Future considerations

- A CODEOWNERS file currently does not exist in the codebase. When added, owners-MUST-flag rules will move from this standard to `CODEOWNERS` itself.
- An automated policy-as-code tool (e.g. Spectral for OpenAPI, custom rule for domain exceptions) is not configured; future addition MUST be tracked here.