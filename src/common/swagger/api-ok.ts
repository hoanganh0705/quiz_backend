import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  OffsetPaginationMetaDto,
  PaginatedResponseMetaDto,
  PaginationMetaDto,
  ResponseMetaDto,
  WrappedDto,
  WrappedPaginatedDto,
} from './swagger-schemas';

/**
 * Options accepted by `ApiOkResource` / `ApiCreatedResource` / `ApiOkResourceList`
 * / `ApiOkResourceArray`. A superset of the schema-host variant of
 * `@nestjs/swagger`'s `ApiResponseOptions`, but with `schema` and `type` removed
 * (the helpers compose those internally) and with `example` / `examples` re-enabled
 * so callers can attach documentation metadata that the underlying schema-host
 * variant of `ApiResponseOptions` disallows.
 *
 * At runtime, `@nestjs/swagger`'s response-object factory
 * (`node_modules/@nestjs/swagger/dist/services/response-object-factory.js`)
 * transparently moves `example` into `content['application/json'].example`
 * regardless of whether the input was the schema-host variant or the
 * `ApiResponseMetadata` variant. So accepting `example` here matches the
 * actual runtime behavior.
 *
 * `headers` and `links` are typed loosely because the underlying
 * `HeadersObject` / `LinksObject` types from `@nestjs/swagger`'s
 * `interfaces/open-api-spec.interface` are not re-exported from the package's
 * top-level entrypoint, and the schema-host variant of `ApiResponseOptions`
 * uses a stricter shape than the `ApiResponseMetadata` variant. Callers that
 * need to attach response headers should use the loose `Record<string, unknown>`
 * shape — it round-trips through `@nestjs/swagger` correctly at runtime.
 */
export type ApiResourceOptions = {
  description?: string;
  example?: unknown;
  examples?: Record<string, { summary: string; value: unknown }>;
  headers?: Record<string, unknown>;
  links?: Record<string, unknown>;
};

const buildResourceSchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    { properties: { data: { $ref: getSchemaPath(model) } } },
  ],
});

const buildResourceArraySchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    {
      properties: {
        data: {
          type: 'array' as const,
          items: { $ref: getSchemaPath(model) },
        },
      },
    },
  ],
});

const buildPaginatedSchema = <T extends Type>(
  model: T,
  paginationMetaSchema: typeof PaginationMetaDto | typeof OffsetPaginationMetaDto,
) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedPaginatedDto) },
    {
      properties: {
        data: {
          type: 'array' as const,
          items: { $ref: getSchemaPath(model) },
        },
        meta: {
          properties: {
            pagination: { $ref: getSchemaPath(paginationMetaSchema) },
          },
        },
      },
    },
  ],
});

/**
 * Compose `@ApiOkResponse({ ..., schema: { allOf: [...] } })` for a single
 * (non-paginated) resource wrapped in the canonical envelope.
 *
 * Use this on controller methods that return `ApiResponse.ok(payload)` or
 * whose service returns a single DTO (the interceptor will wrap it).
 *
 * Replaces the ad-hoc `AuthWrappedLoginDto` / `CategoryWrappedMessageDto` /
 * etc. classes — see docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md §5.3.
 *
 * @example
 *   @ApiOkResource(LoginResponseDto)
 *   @Get('login')
 *   async login(): Promise<LoginResponseDto> { ... }
 *
 * @example
 *   // Override the description and pass through any other @ApiOkResponse options:
 *   @ApiOkResource(MessageResponseDto, {
 *     description: 'Account deleted successfully',
 *     headers: { 'Set-Cookie': clearCookieHeaderSchema },
 *   })
 */
export const ApiOkResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiOkResponse({
      ...options,
      schema: buildResourceSchema(model),
    } as Parameters<typeof ApiOkResponse>[0]),
  );

/**
 * 201 Created variant of {@link ApiOkResource}. Same envelope shape, but the
 * OpenAPI spec lists the response under the `201` status code instead of
 * `200`. NestJS's `POST` handler returns 201 by default at runtime, so this is
 * purely a documentation concern.
 */
export const ApiCreatedResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiCreatedResponse({
      ...options,
      schema: buildResourceSchema(model),
    } as Parameters<typeof ApiCreatedResponse>[0]),
  );

/**
 * 202 Accepted variant of {@link ApiOkResource}. Same envelope shape, but the
 * OpenAPI spec lists the response under the `202` status code instead of
 * `200`. Use this for state-transition operations that trigger asynchronous
 * side effects (e.g. WebSocket broadcasts, scheduler interactions) where the
 * response is returned before processing is complete.
 *
 * @example
 *   @ApiAcceptedResource(StartInstanceResponseDto)
 *   @Post(':id/start')
 *   async startInstance(...): Promise<...> { ... }
 */
export const ApiAcceptedResource = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiResponse({
      status: 202,
      ...options,
      schema: buildResourceSchema(model),
    } as Parameters<typeof ApiResponse>[0]),
  );

/**
 * Compose `@ApiOkResponse({ ..., schema: { allOf: [...] } })` for a paginated
 * list wrapped in the canonical envelope. The `kind` argument picks the
 * pagination schema (`PaginationMetaDto` for cursor, `OffsetPaginationMetaDto`
 * for offset). The runtime `kind` field on the actual `meta.pagination` object
 * matches this choice.
 *
 * @example
 *   // Cursor pagination:
 *   @ApiOkResourceList(QuizListItemDto, 'cursor')
 *   @Get('feed')
 *   async getFeed(): Promise<...> { ... }
 *
 * @example
 *   // Offset pagination:
 *   @ApiOkResourceList(LeaderboardEntryDto, 'offset')
 *   @Get('leaderboard')
 *   async getLeaderboard(): Promise<...> { ... }
 */
export const ApiOkResourceList = <T extends Type>(
  model: T,
  kind: 'cursor' | 'offset',
  options: ApiResourceOptions = {},
): MethodDecorator => {
  const paginationMetaSchema = kind === 'cursor' ? PaginationMetaDto : OffsetPaginationMetaDto;

  return applyDecorators(
    ApiExtraModels(WrappedPaginatedDto, PaginatedResponseMetaDto, paginationMetaSchema, model),
    ApiOkResponse({
      ...options,
      schema: buildPaginatedSchema(model, paginationMetaSchema),
    } as Parameters<typeof ApiOkResponse>[0]),
  );
};

/**
 * Compose `@ApiOkResponse({ ..., schema: { allOf: [...] } })` for a
 * non-paginated bare-array resource wrapped in the canonical envelope.
 *
 * Use this on endpoints whose runtime payload is `{ data: T[], meta }` — i.e.
 * a bare array of items with no `pagination` meta block. Examples include
 * `GET /categories/popular`, `GET /tags/trending`, and the bare-array
 * "F-variant" endpoints documented in
 * `docs/migrations/RESPONSE_ENVELOPE_MIGRATION.md` §2.1.
 *
 * If the endpoint actually returns a cursor-paginated list, use
 * {@link ApiOkResourceList} instead — the two produce different `meta` shapes
 * (`{ timestamp }` vs `{ timestamp, pagination }`) and the schema must match.
 *
 * Added during Phase 5 of the response-envelope migration to replace the
 * ad-hoc `CategoryWrappedRankedListDto` / `TagWrappedRankedListDto` /
 * `CategoryWrappedRelatedListDto` classes — see
 * `docs/migrations/PHASE_5_SUBPLAN.md` §4 Step 2.
 *
 * @example
 *   @ApiOkResourceArray(RankedCategoryResponseDto, {
 *     description: 'Returns the ranked categories.',
 *     example: CATEGORY_RANKED_LIST_EXAMPLE,
 *   })
 *   @Get('popular')
 *   async getPopular() { ... }
 */
export const ApiOkResourceArray = <T extends Type>(
  model: T,
  options: ApiResourceOptions = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(WrappedDto, ResponseMetaDto, model),
    ApiOkResponse({
      ...options,
      schema: buildResourceArraySchema(model),
    } as Parameters<typeof ApiOkResponse>[0]),
  );
