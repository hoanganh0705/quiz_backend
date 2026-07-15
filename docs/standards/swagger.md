# Swagger / OpenAPI Standard

> Project-specific rules for the OpenAPI document, Swagger decorators, examples, and the regression tests that guard the spec.
> Out of scope: payload validation (see `validation.md`), envelope shape (see `api.md`), error responses (see `error-handling.md`).

## Purpose

Defines how the OpenAPI document is generated, what each endpoint MUST describe, how examples are structured, and how the generated spec is regressed against the wire contract.

## Scope

Applies to `src/core/swagger/`, `src/common/swagger/`, every module's `transport/swagger/`, and the generated artifact `docs/generated/openapi.json`.

## Source of Truth

- `src/core/swagger/swagger.config.ts` — `DocumentBuilder`, security definitions, cookie plugin.
- `src/common/swagger/swagger-decorators.ts` — error and standard decorators.
- `src/common/swagger/swagger-schemas.ts` — `ProblemDetailDto` and envelope wrapper DTOs.
- `src/common/swagger/api-ok.ts` — success response helpers.
- `src/common/swagger/cookie-params.plugin.ts` — `injectCookieParams` Swagger plugin.
- `src/modules/tag/transport/swagger/tag-swagger-decorators.ts` and `examples/` — module-specific examples and decoration patterns.
- `src/common/swagger/openapi-schemas.spec.ts` — OpenAPI regression test (e2e).
- `src/modules/tag/transport/tag-openapi.spec.ts` — module-level OpenAPI regression.
- `package.json` — `generate:openapi` script.

## Rules

### Configuration

- The Swagger config MUST be loaded in `src/core/swagger/swagger.config.ts`. Controllers and modules MUST NOT call `SwaggerModule.setup(...)` themselves.
- `DocumentBuilder` MUST be extended with `addBearerAuth()` for JWT (so `bearerAuth` security is global), and MUST integrate the `injectCookieParams` plugin (`src/common/swagger/cookie-params.plugin.ts`).
- The OpenAPI path MUST be `/api/docs` (or `env.SWAGGER_PATH`); the JSON artifact MUST land in `docs/generated/openapi.json` via `generate:openapi`.
- MUST NOT expose Swagger when `NODE_ENV=production` unless `SWAGGER_ENABLED=true` is explicit.

### Endpoint documentation

- Every controller method MUST be annotated with `@ApiOperation({ summary, description? })`, an HTTP success decorator (`@ApiOkResource`, `@ApiCreatedResource`, `@ApiOkResourceArray`, etc.), and the canonical error responses.
- The class MUST be annotated with `@ApiTags('<ModuleName>')` to group endpoints under a tag.
- The HTTP success decorator MUST describe the canonical envelope (`WrappedDto<T>`, `WrappedPaginatedDto<T>` — see `src/common/swagger/swagger-schemas.ts`). An endpoint that wraps a single resource MUST use `ApiOkResource`; arrays MUST use `ApiOkResourceArray` or `ApiOkResourceList`.
- An endpoint with a non-default content type MUST set `content` explicitly. Default is `application/json`.
- An endpoint that returns no content (`204`) MUST use `@ApiNoContentResponse({ description })`. The envelope is omitted in this case.
- Endpoints requiring authentication MUST declare `ApiBearerAuth()` (global default) AND/OR the cookie plugin entry. Public endpoints MUST mark the absence of auth via `@ApiOperation({ security: [] })` is NOT used here — public endpoints are public precisely because `@Public()` removes the bearer requirement; the spec does not list a security scheme for them.

### Request shape

- Path parameters (`@Param`) MUST be documented with `@ApiParam({ name, type, format, example })`. UUIDv7 path parameters MUST set `format: 'uuid'` explicitly (this is enforced by `tag-openapi.spec.ts`).
- Query DTOs and body DTOs MUST be referenced via `class-validator` DTOs with `@ApiProperty` / `@ApiPropertyOptional` annotations. A property declared in TypeScript without `@ApiProperty` will be absent from the schema — the regression test fails if expected properties are missing.
- Query DTOs MUST declare optionality correctly: optional fields MUST use `@ApiPropertyOptional`, not `@ApiProperty({ required: false })` — the spec test enforces correct optionality.
- DTO properties SHOULD declare `example` AND either a `description`, `pattern`, `minLength/maxLength`, or `minimum/maximum` for every user-controllable field. Examples in this project MAY be domain-realistic, but MUST NOT leak real production IDs.
- Date / timestamp DTO fields MUST use `type: 'string', format: 'date-time'` and an ISO 8601 `example`. UUIDs MUST use `type: 'string', format: 'uuid'` with an example UUIDv7.

### Response decoration

- Per status code, only the canonical error decorators from `src/common/swagger/swagger-decorators.ts` MUST be used. Endpoints MUST NOT define custom inline `@ApiResponse` for `400`, `401`, `403`, `404`, `409`, `429`, `500`.
- Error response examples MUST live under `src/modules/<module>/transport/swagger/examples/error-examples.ts` and MUST be referenced via the module's `tag-swagger-decorators.ts` (or equivalent).
- Each endpoint SHOULD include at least one realistic example for the success response. The example MUST match the canonical envelope (`{ data, meta }`); the module-level example file MUST export the envelope — see `src/modules/tag/transport/swagger/examples/tag.examples.ts`.
- Modules MUST re-export their response DTO schemas; schemas MUST NOT be inlined.

### Examples directory layout

- Under every module's `transport/swagger/`, examples MUST live under `examples/` and MUST be TypeScript objects exported as `const`.
- Examples MUST share an `EXAMPLE_TIMESTAMP` constant (`examples/_timestamp.ts`) so example payloads look like one wire-shape was sampled at the same moment. Reference: `src/modules/tag/transport/swagger/examples/_timestamp.ts`.
- Examples MUST NOT include valid production secrets or valid real user IDs.

### Schema generation and packaging

- The DTO classes are the source of truth for schemas; schemas MUST NOT be hand-edited in `openapi.json`. Regenerate via `pnpm generate:openapi`.
- Schemas MUST use `$ref` across files to keep the document small (DTOs in shared modules are reused). `@nestjs/swagger` produces this automatically when classes are referenced by type.
- Schema names MUST follow `<ModuleName><ResponsePurpose>Dto` (e.g. `TagDetailResponseDto`, `QuizRankingResponseDto`). Verb-noun names like `UserDto` are reserved for cross-module imports.

### OpenAPI regression tests

- `src/common/swagger/openapi-schemas.spec.ts` MUST pass before any PR is merged. Tests assert `$ref` resolves, wrapper DTOs exist, and required schemas are present.
- Each module MUST keep a module-level contract test under `src/modules/<module>/transport/` (e.g. `tag-openapi.spec.ts`) that asserts path parameter `format: 'uuid'`, query parameter optionality, and presence of response examples. Module-level tests MUST be added whenever a new module is created.
- A change in a response DTO MUST update both the example files and the module-level OpenAPI test in the same PR. The integration test is the regression guard.

### OpenAPI synchronization

- The generated spec MUST be regenerated and committed when any DTO, controller, or transport-layer decorator changes. Generating locally is required; CI MUST re-run `test:e2e` on the regenerated spec.
- Drift detection (e.g. `_internal_ignore` vs. controller) MUST be added in the regression test when introduced. Reference patterns in `openapi-schemas.spec.ts` for the conventions.

## Examples

### Composed Swagger decorator

```typescript
// src/modules/tag/transport/swagger/tag-swagger-decorators.ts
export function ApiTagDetailResponses() {
  return applyDecorators(
    ApiOkResource(TagDetailResponseDto, TAG_DETAIL_EXAMPLE),
    ApiErrorResponses({ notFound: 'TAG_NOT_FOUND', unauthorized: 'AUTH_REQUIRED' }),
  );
}
```

### Request DTO with proper optionality

```typescript
// src/modules/tag/dto/request/tag-ranking-query.dto.ts
@ApiPropertyOptional({ type: String, description: 'Cursor from a previous page', example: 'eyJ...' })
@IsOptional()
@IsString()
cursor?: string;
```

### Regression test

```typescript
// src/modules/tag/transport/tag-openapi.spec.ts
it('marks path id as uuid format', () => {
  const op = openApi.paths['/tags/{idOrSlug}'].get;
  expect(op.parameters[0].schema.format).toBe('uuid');
});
```

### Cookie parameter plugin

```typescript
// src/core/swagger/swagger.config.ts
const config = new DocumentBuilder().addBearerAuth().build();
const document = SwaggerModule.createDocument(app, config);
injectCookieParams(document, app);
await app.use('/api/docs-json', ...);
```

## Non-goals

- Documenting OpenAPI 3.x features beyond what `@nestjs/swagger` supports today.
- Recommending third-party doc generators (e.g. SpectaCLI).
- Documenting GraphQL or JSON-RPC.

## Future considerations

- If server-side routes are renamed, `openapi-schemas.spec.ts` SHOULD track the rename and assert there are no orphaned operations.
- If the project adopts an API spec validator (e.g. vacuum, spectral), the rules belong here as additions, not modifications to the existing ones.