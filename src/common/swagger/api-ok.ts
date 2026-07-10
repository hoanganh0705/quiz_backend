import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  getSchemaPath,
  ApiExtraModels,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import {
  OffsetPaginationMetaDto,
  PaginationMetaDto,
  WrappedDto,
  WrappedPaginatedDto,
} from './swagger-schemas';

const buildResourceSchema = <T extends Type>(model: T) => ({
  allOf: [
    { $ref: getSchemaPath(WrappedDto) },
    { properties: { data: { $ref: getSchemaPath(model) } } },
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
  options: Omit<ApiResponseOptions, 'schema' | 'type'> = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      ...options,
      schema: buildResourceSchema(model),
    }),
  );

/**
 * 201 Created variant of {@link ApiOkResource}. Same envelope shape, but the
 * OpenAPI spec lists the response under the `201` status code instead of
 * `200`. NestJS's `POST` handler returns 201 by default at runtime, so this is
 * purely a documentation concern.
 */
export const ApiCreatedResource = <T extends Type>(
  model: T,
  options: Omit<ApiResponseOptions, 'schema' | 'type'> = {},
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      ...options,
      schema: buildResourceSchema(model),
    }),
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
  options: Omit<ApiResponseOptions, 'schema' | 'type'> = {},
): MethodDecorator => {
  const paginationMetaSchema = kind === 'cursor' ? PaginationMetaDto : OffsetPaginationMetaDto;

  return applyDecorators(
    ApiExtraModels(model, paginationMetaSchema),
    ApiOkResponse({
      ...options,
      schema: buildPaginatedSchema(model, paginationMetaSchema),
    }),
  );
};
