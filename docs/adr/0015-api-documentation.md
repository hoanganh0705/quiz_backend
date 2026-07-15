# ADR-0015: API Documentation — Code-First OpenAPI with Decorators

## Status

Accepted

## Context

The API needs machine-readable documentation for client code generation, interactive API explorers, and contract testing. The documentation must stay in sync with the implementation without requiring a separate specification file. A "code-first" approach (decorators on source) keeps the spec and implementation co-located, but must not introduce excessive boilerplate or obscure the controller logic.

## Decision

**Toolchain:** `@nestjs/swagger` with `DocumentBuilder`. OpenAPI 3.0 is generated from decorators at build time. The generated spec is written to `docs/generated/openapi.json` as a CI artifact.

**Decorator placement:** Swagger decorators (`@ApiProperty`, `@ApiResponse`, `@ApiBearerAuth`, `@ApiTags`, etc.) are placed directly on DTOs, controllers, and query DTOs. Decorators for grouped endpoints (e.g. `@ApiCookieParam`) are placed on controller classes.

**Schema generation:** `class-validator` decorators on DTOs (`@IsString`, `@IsUUID`, `@MaxLength`, etc.) are automatically picked up by `@nestjs/swagger` via `class-validator-openapi` plugin. This eliminates duplicate decorator maintenance.

**Plugin:** The `injectCookieParams` plugin in `swagger.plugin.ts` automatically injects `ApiCookieParam` for methods that accept `cookies` parameters.

**Response documentation:** Controllers use `@ApiOkResource()` for single-object responses and `@ApiResponse({ status: ..., type: ... })` for non-200 responses. Pagination responses document the `{ data, meta.pagination }` envelope shape.

**Security:** `@ApiBearerAuth('JWT')` on protected controllers. `@ApiUnauthorizedResponse({ type: ProblemDetailDto })` documents the 401 envelope.

**No inline schemas:** Complex schemas are defined as DTO classes, not inline object literals. This ensures reusability and correct type generation for clients.

## Consequences

**Advantages**
- The spec is always in sync with the code — adding a new field to a DTO automatically updates the OpenAPI schema.
- `class-validator` dual-use: validation at runtime + schema generation at build time.
- CI generates `openapi.json` from every commit, making API drift visible in pull requests.
- `ApiOkResource()` and `injectCookieParams` plugin reduce boilerplate significantly.

**Trade-offs**
- Controller files accumulate Swagger decorators, which can obscure the HTTP semantics.
- OpenAPI 3.0 does not fully represent the full richness of JSON Schema (e.g. discriminated unions require workaround patterns).
- The generated spec must be validated to catch cases where the decorator does not reflect the actual runtime behavior (e.g. a nullable field missing `@ApiProperty({ nullable: true })`).

## Evidence

- `docs/generated/openapi.json` — generated OpenAPI 3.0 spec checked into the repository.
- `src/main.ts` — `DocumentBuilder` configuration with JWT security, problem detail type, and all module controllers.
- `src/modules/tag/transport/swagger/tag-swagger-decorators.ts` — grouped Swagger decorators for the tag module.
- `src/modules/tag/transport/swagger/examples/tag.examples.ts` — concrete examples for request/response bodies.
- `src/modules/tag/dto/request/tag-ranking-query.dto.ts` — `@ApiPropertyOptional()` + `class-validator` dual decorators.
- `src/common/swagger/api-ok.ts` — `ApiOkResource()` custom decorator.
- `src/common/swagger/swagger.plugin.ts` — `injectCookieParams` plugin.
- `src/common/responses/paginated-result.ts` — pagination type with OpenAPI decorators.
- `docs/PROJECT_CONSTITUTION.md` §4.1 (Versioning, prefix, and surface) — OpenAPI as the API documentation standard.
