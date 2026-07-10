import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiOkResponse,
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
      schema: {
        allOf: [
          { $ref: getSchemaPath(WrappedDto) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
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
      schema: {
        allOf: [
          { $ref: getSchemaPath(WrappedPaginatedDto) },
          {
            properties: {
              data: {
                type: 'array',
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
      },
    }),
  );
};
