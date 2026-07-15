# Testing Standard

> Project-specific rules for unit tests, e2e tests, contract tests, and regression guards.
> Generic Jest usage is framework knowledge; only conventions used in this codebase are documented.

## Purpose

Defines which categories of tests this project requires, where they live, what they assert, and how the project protects its contracts (envelope, error format, OpenAPI) against drift.

## Scope

Applies to `src/**/*.spec.ts`, `test/*.e2e-spec.ts`, and the database seed script. Out of scope: end-to-end Playwright/Cypress tests (no such tests exist in this codebase), load testing, fuzzing.

## Source of Truth

- `package.json` — `test` (unit), `test:watch`, `test:cov`, `test:e2e`, `test:e2e:cov`.
- `jest.config.ts` — unit config, `roots: ['src']`, `testRegex: '\\.spec\\.ts$'`.
- `test/jest-e2e.json` — e2e Jest config, `testRegex: '\\.e2e-spec\\.ts$'`.
- `src/modules/tag/transport/tag-openapi.spec.ts` — module-level OpenAPI contract test.
- `src/modules/tag/transport/tag-timestamp.spec.ts` — presenter timestamp contract test.
- `src/modules/tag/dto/request/tag-ranking-query.dto.spec.ts` — DTO validation contract test.
- `src/common/swagger/openapi-schemas.spec.ts` — global OpenAPI contract test.
- `src/common/interceptors/response-format.interceptor.spec.ts` — interceptor unit test (co-located).
- `test/envelope.e2e-spec.ts` — global envelope regression.
- `test/rfc7807.e2e-spec.ts` — global RFC 7807 regression.
- `src/common/responses/api-response.spec.ts` — response builder unit test (co-located).

## Rules

### Test placement and naming

- Unit tests MUST be co-located with the file under test, with the suffix `.spec.ts`. Example: `src/modules/tag/transport/presenters/tag.presenter.ts` ⇄ `src/modules/tag/transport/presenters/tag.presenter.spec.ts` (or, for the same module, `src/modules/tag/transport/tag-timestamp.spec.ts` is the test for `tag.presenter.ts` — both co-located in `transport/` is acceptable; follow whatever layout the module uses consistently).
- End-to-end (e2e) tests MUST live under `test/` with the suffix `.e2e-spec.ts`. They MUST NOT live under `src/`.
- A test file MUST export a `describe(...)` whose first string segment matches the subject under test (e.g. `describe('TagController', …)`) and use `it(...)` for individual cases.
- Test names MUST be declarative: `it('returns the canonical envelope', …)` is preferred over `it('works', …)`.

### Required categories per change

- A change touching a `dto/` MUST add a co-located DTO validation test (`*.dto.spec.ts`) that asserts every per-field constraint and transformation.
- A change touching a presenter MUST assert ISO 8601 UTC normalization (see `tag-timestamp.spec.ts`).
- A change touching `core/swagger/*`, `common/swagger/*`, or a module's `transport/swagger/*` MUST regenerate the OpenAPI spec and update the relevant contract test.
- A change adding or renaming a transport endpoint MUST update the corresponding module-level OpenAPI test.
- A change adding a domain exception MUST assert its presence in `ProblemCodeMapping` and its mapping in the RFC 7807 e2e test (the test name SHOULD include the new code).
- A change to the global envelope or global filter MUST regenerate the e2e contract.

### Coverage expectations

- Critical cross-cutting code MUST have a unit test or an e2e test on file. Specifically: `GlobalExceptionFilter`, `ResponseFormatInterceptor`, `CorrelationInterceptor`, `TransactionalInterceptor`, and `CommonExternalEventBus`. These are exercised by the e2e specs at minimum.
- Repositories have an integration-test footprint via seeds; cross-row invariants are exercised through `db:seed` and manual e2e runs in development. A future standard MAY add a `repository-integration` category.
- Domain services and repository ports MUST have unit tests when they hold business logic that is non-trivial. Pure ports with no logic require no unit test.

### What unit tests MUST assert

- Service-level unit tests MUST assert behavior through the public surface only. They MUST NOT reach into private fields or call internals via `as any`.
- Repository unit tests SHOULD target the application service that uses the repository, not the repository directly, except when the repository owns an error-mapping rule (in which case the test asserts the domain exception thrown on a violation).
- Presenter unit tests MUST assert the canonical `{ data, meta }` envelope structure and ISO 8601 timestamp normalization. Reference: `tag-timestamp.spec.ts`.
- Custom-pipe unit tests MUST assert both the success path and the rejection path (`BadRequestException`).

### What e2e tests MUST assert

- The wire envelope: `GET /<route>` MUST return `{ data, meta: { timestamp } }` for success and `application/problem+json` for failure. Reference: `test/envelope.e2e-spec.ts`.
- The error wire: problem details MUST contain the canonical fields per RFC 7807 (`type`, `title`, `status`, `detail`, `instance`, and the project's `code`). Reference: `test/rfc7807.e2e-spec.ts`.
- The OpenAPI shape: generated `openapi.json` MUST contain all expected schemas, `$ref` resolution, and module-level guarantees (path parameter format, optionality, examples). Reference: `openapi-schemas.spec.ts`, `tag-openapi.spec.ts`.

### Test isolation

- Unit tests MUST NOT use the global module. They MUST instantiate services directly or use a minimal Nest testing module.
- E2e tests MUST boot an isolated Nest application per `describe` block, MUST NOT share DB state across files, and MUST clean their environment before each test. The DB cleanup strategy is the project's `db:seed -r reset`, applied in the test fixtures.
- Tests MUST NOT rely on real network, real Redis, or real third-party APIs. A `mockModule(...)` is the right tool — see `jest-e2e.json` for setup patterns.
- Tests MUST NOT log secrets. Test fixtures MUST mock external clients.

### Mocking boundaries

- Database calls in unit tests MUST be mocked at the repository port boundary. Tests MUST NOT use a partial Drizzle mock.
- Redis calls in unit tests MUST be mocked at the `RedisService` boundary.
- The `<module>-domain-event-bus` MUST be mocked at the port boundary (`TAG_DOMAIN_EVENT_BUS` symbol), never on the implementation.

### Performance and determinism

- A test MUST complete in under 1 second by default; an integration / e2e that needs more SHOULD set `jest.setTimeout(10_000)` at the top of the file.
- Tests MUST be deterministic. `Date.now()` overrides MUST use `jest.useFakeTimers().setSystemTime(...)`.
- Snapshots MUST be reviewed in the same PR. Long snapshots that obscure diffs SHOULD be split into smaller assertions.

### Lint and CI

- `pnpm test` and `pnpm test:e2e` MUST pass before merging. CI MUST NOT allow merge on a red unit or e2e suite.
- A test that requires environment variables MUST declare them via `process.env.<X> = …` at the test's setup. The CI runner MUST provide the same values.

### Test files policy

- MUST NOT create a `tests/` folder — this project uses `src/` (unit) and `test/` (e2e).
- A test MUST NOT import from a sibling module's `domain/` in a unit test (use the bounded context's exposed surface only). Cross-module tests are e2e.
- Test-only utilities MUST live next to the test (or in a `_helpers` colocated folder) and MUST NOT be imported into production source.

## Examples

### Co-located DTO test

```typescript
// src/modules/tag/dto/request/tag-ranking-query.dto.spec.ts
describe('TagRankingQueryDto', () => {
  it('caps limit at 100', async () => {
    const dto = plainToInstance(TagRankingQueryDto, { limit: 500 });
    const errors = await validate(dto);
    expect(errors[0].property).toBe('limit');
  });
});
```

### Module-level OpenAPI test

```typescript
// src/modules/tag/transport/tag-openapi.spec.ts
it('exposes the canonical envelope schema for GET /tags/{idOrSlug}', () => {
  const op = openApi.paths['/tags/{idOrSlug}'].get;
  expect(op.responses['200'].content['application/json'].schema.$ref).toBe(
    '#/components/schemas/WrappedTagDetailResponseDto',
  );
});
```

### Global envelope e2e

```typescript
// test/envelope.e2e-spec.ts
it('wraps a successful response', async () => {
  const res = await request(app).get('/envelope-test/success').expect(200);
  expect(res.body).toHaveProperty('data');
  expect(res.body.meta).toMatchObject({ timestamp: expect.any(String) });
});
```

## Non-goals

- Documenting Jest configuration in detail (already in `jest.config.ts`).
- Recommending coverage thresholds. `test:cov` exists but no explicit percentage is enforced as a hard gate today; the change MUST include a future-considerations note if a threshold is added.
- Load testing, chaos testing, fuzzing.

## Future considerations

- A repository-integration category (against an ephemeral Postgres) is not yet defined in the codebase. If added, this standard MUST be updated to describe its environment, isolation rules, and required assertions.
- A contract-first / Pact consumer-driven testing category is not defined; if added, must live alongside this file.