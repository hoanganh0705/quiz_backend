# Validation Standard

> Project-specific rules for input validation, transformation, and the global validation pipeline.
> Authentication, authorization, and rate-limit checks are out of scope; see `security.md`.

## Purpose

Defines how request payloads are validated and transformed. Every endpoint MUST validate through DTOs with `class-validator` and `class-transformer`. Manual validation in controllers is forbidden.

## Scope

Applies to `src/main.ts:53-58` (global `ValidationPipe`), every `src/modules/<name>/dto/`, and custom pipes under `src/common/pipes/`. Out of scope: business-rule validation, which lives in domain services and is exercised by unit tests.

## Source of Truth

- `src/main.ts:53-58` — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- `src/modules/tag/dto/request/` — full DTO reference.
- `src/common/pipes/parse-uuid.pipe.ts` and `parse-uuid-or-slug.pipe.ts` — custom path-param pipes.
- `src/modules/tag/transport/controllers/tag.controller.ts:ApplyPatch`, `findOne` — usage patterns.

## Rules

### Global pipeline

- The global `ValidationPipe` MUST be configured with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `transformOptions: { enableImplicitConversion: true }`. Reference: `src/main.ts`.
- Controllers MUST NOT register a per-handler `ValidationPipe` that overrides the global config. Re-applying `whitelist` on a subset is forbidden.
- DTOs MUST be the only mechanism for validating inbound payloads. Application services MUST assume their inputs already conform to DTO constraints — additional checks belong in domain services and are documented in domain tests.

### DTO requirements

- Every `@Body`, `@Query`, and `@Param` (with a typed pipe) MUST bind to a class DTO. Using `Record<string, unknown>` or untyped objects is forbidden in production code paths.
- DTOs MUST live in `src/modules/<module>/dto/request/`. Nested DTOs (e.g. address subobjects, pagination cursor objects) MUST be nested classes exported from the same file.
- DTOs MUST export a single class with the suffix `Dto` (e.g. `CreateQuizDto`, `TagRankingQueryDto`).
- DTO fields MUST use `class-validator` decorators directly — no custom wrapper validators are introduced.
- DTO fields MUST apply `class-transformer` `@Transform` BEFORE any `@IsXxx` decorator when the transformation matters (decorators run bottom-up in TS; transform is applied per field by `ValidationPipe`). When a field accepts whitespace-only input, MUST trim before validation (see `update-tag.dto.ts` for the project's convention: `trimString`, `trimStringToLowerCase`).

### Per-field rules

- A string field MUST declare at minimum a maximum length. Repeated `t.text().notNull()` style sloppiness is forbidden. Use `@IsString`, `@MinLength(1)`, `@MaxLength(N)` for free text; `@Matches(PATTERN, { message })` for slugs; `@IsEmail(...)` for emails; `@IsUrl(...)` for URLs.
- A numeric field MUST declare `minimum`/`maximum`. The query DTO for tag ranking (limit, page) uses `@Type(() => Number)` and `@Min(1)`, `@Max(100)` — that pattern is canonical.
- A boolean field MUST use `@IsBoolean()` and `@Transform` from the appropriate source (query strings default to string).
- An enum field MUST declare `@IsEnum(EnumType)` and `@ApiProperty({ enum: EnumType })`.
- A date field MUST declare `@Type(() => Date)` from `class-transformer` and `@IsDate()` or `@IsISO8601()` depending on the contract. The wire format is ISO 8601 UTC (see `api.md`).
- An optional field MUST use `@IsOptional()` AND `@ApiPropertyOptional()`. Order matters: `@IsOptional()` MUST appear BEFORE the type-specific decorator (per `class-validator` semantics).
- A nested object field MUST declare `@ValidateNested({ each: true })` and `@Type(() => NestedDto)`. Reference: any paged DTO with embedded filters.

### Path parameters

- A `@Param('id')` MUST be paired with a pipe. UUID-only paths MUST use `ParseUUIDPipe`. Mixed-form paths MUST use `ParseUUIDOrSlugPipe` (`src/common/pipes/parse-uuid-or-slug.pipe.ts`). The pipe MUST fail with `BadRequestException` on invalid input.
- Custom pipes MUST be reusable — when a new pattern is needed in two or more controllers, it MUST live under `src/common/pipes/`. A one-off pipe belongs to the module's `transport/` folder.
- A custom pipe MUST NOT throw `HttpException` directly with a domain-code; it MUST throw `BadRequestException` (or `NotFoundException` for slug resolution). Domain error codes belong in `error-handling.md`.

### Validation messages

- Validation messages MUST be stable strings. Cross-module constants live in `src/modules/<module>/<module>.constants.ts`. Reference: `TAG_SLUG_INVALID_MESSAGE` is exported from `tag.constants.ts`.
- Validation messages MUST be human-readable and actionable: `"Tag slug may only contain lowercase letters, digits, and dashes."` is preferred to `"Invalid slug."`.
- Locale-specific messages are not configured in this codebase; English-only is the default.

### Pagination and query DTOs

- Page DTOs MUST declare `limit` with `@Min(1)` and a project-wide maximum (`@Max(100)`).
- Cursor fields MUST be `@IsOptional()` + `@IsString()`. The cursor is decoded later by `cursor.util.ts`, not during DTO validation — domain code MUST re-validate the decoded cursor.
- Sorting parameters MUST be enums: `@IsOptional() @IsEnum(SortDirection)` is the canonical pattern.

### Headers and cookies

- Headers validated by DTOs MUST come from a class DTO with `@Headers() dto`. Bare `@Headers('x-foo')` is allowed only for non-validating reads.
- Cookie-validated payloads MUST follow the same DTO rules. Validation pipes expose `req.cookies` to a DTO.

### Exception propagation

- `ValidationPipe` failures produce `400 Bad Request` with a structured response. MUST NOT translate these into domain exceptions in user code. Reference: `src/common/filters/global-exception.filter.ts` translates `HttpException` consistently.
- The `correlationId` MUST be added to validation error responses by the global filter, not by `class-validator`.

### Cross-cutting

- A new DTO field MUST be added to the matching Swagger annotation in the same PR. The DTO is the API contract and the doc is derived from it. See `swagger.md`.
- A change to a constraint (e.g. new `maxLength`) MUST be backward-compatible per `api.md` unless paired with a deprecation plan in `migration.md`.

## Examples

### Trim and validate a slug

```typescript
// src/modules/tag/dto/request/update-tag.dto.ts
@ApiPropertyOptional({ … })
@IsOptional()
@Transform(({ value }) => trimStringToLowerCase(value))
@IsString()
@MaxLength(120)
@Matches(DEFAULT_SLUG_PATTERN, { message: TAG_SLUG_INVALID_MESSAGE })
slug?: string;
```

### Bounded numeric query

```typescript
// src/modules/tag/dto/request/tag-ranking-query.dto.ts
@ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(100)
limit?: number = 20;
```

### Custom path pipe

```typescript
// src/modules/tag/transport/controllers/tag.controller.ts
@Get(':idOrSlug')
async findOne(@Param('idOrSlug', ParseUUIDOrSlugPipe) idOrSlug: string) { … }
```

### Nested object validation

```typescript
// paged DTOs reference
@ApiPropertyOptional({ type: () => TagFilterDto })
@IsOptional()
@ValidateNested()
@Type(() => TagFilterDto)
filter?: TagFilterDto;
```

## Non-goals

- Documenting how `class-validator` itself works.
- Re-validating at multiple layers (DTO, service, repository) when one place is enough. Domain invariants belong in repositories or domain services (see `database.md`).
- Documenting Joi/Zod/JSON Schema validation libraries — this project standardizes on `class-validator`.

## Future considerations

- If a request requires runtime-derived validation (e.g. cross-field checks), a custom `class-validator` constraint (`registerDecorator`) belongs in `src/common/validators/`. The pattern is not currently used; if added, this standard MUST add a section.