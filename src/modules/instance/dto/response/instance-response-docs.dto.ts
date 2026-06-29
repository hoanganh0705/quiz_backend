import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/swagger/swagger-schemas';
import {
  CreateInstanceResponseDto,
  JoinInstanceResponseDto,
  StartInstanceResponseDto,
  CloseInstanceResponseDto,
} from './instance-action-response.dto';
import { InstanceDetailResponseDto } from './instance-detail-response.dto';
import { InstanceLeaderboardEntryDto } from './instance-leaderboard-response.dto';
import { InstanceLeaderboardResponseDto } from './instance-leaderboard-response.dto';
import { InstanceListItemDto } from './instance-list-response.dto';
import { InstancePlayersResponseDto } from './instance-players-response.dto';

// ─── Instance module documentation-only wrapper DTOs ────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated payloads ({ items, pagination }), the interceptor extracts
// the items as data and nests pagination inside meta:
//   { data: items, meta: { timestamp, pagination } }
//
// Runtime DTOs live in their own response DTO files and are imported here for
// use in wrapper type refs.
//
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse
// decorators to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Error response schemas ────────────────────────────────────────────────────

/**
 * JSON shape emitted by `InstanceDomainExceptionFilter` for any
 * `InstanceDomainError` (404 / 400 / 403 / 409). Distinct from the RFC 7807
 * `ProblemDetailDto` emitted by `GlobalExceptionFilter` for validation,
 * ParseUUIDPipe, throttler, and JWT failures.
 */
export class InstanceDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the instance domain exception filter',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable message produced by the instance domain exception filter. ' +
      'Note: the filter rewrites the original error message into a generic one ' +
      '(e.g. "Resource not found", "Invalid request data") so client messages are ' +
      'always one of these fixed strings.',
    example: 'Resource not found',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP status text produced by the instance domain exception filter',
    example: 'Not Found',
  })
  error!: string;
}

// ─── Meta schemas ───────────────────────────────────────────────────────────────

class InstanceResponseMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

// Paginated meta detail — defined first to resolve forward references.
class InstanceListPaginationMetaDetailsDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description:
      'Opaque cursor string for fetching the next page. `null` when there is no next page. ' +
      'Pass this value as the `cursor` query parameter on the next request to continue pagination. ' +
      'The cursor is a standard base64-encoded JSON payload `{ createdAt, instanceId }`.',
    type: String,
    nullable: true,
    example:
      'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTI1VDEwOjMwOjAwLjAwMFoiLCJpbnN0YW5jZUlkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=',
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more items exist after this page', example: true })
  hasNextPage!: boolean;
}

class InstanceListMetaDto extends InstanceResponseMetaDto {
  @ApiProperty({
    description: 'Instance list cursor-pagination metadata',
    type: InstanceListPaginationMetaDetailsDto,
  })
  pagination!: InstanceListPaginationMetaDetailsDto;
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedCreateInstanceResponseDto {
  @ApiProperty({
    description: 'Instance creation result',
    type: () => CreateInstanceResponseDto,
  })
  data!: CreateInstanceResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

export class WrappedJoinInstanceResponseDto {
  @ApiProperty({
    description: 'Instance join result',
    type: () => JoinInstanceResponseDto,
  })
  data!: JoinInstanceResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

export class WrappedStartInstanceResponseDto {
  @ApiProperty({
    description: 'Instance start result',
    type: () => StartInstanceResponseDto,
  })
  data!: StartInstanceResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

export class WrappedCloseInstanceResponseDto {
  @ApiProperty({
    description: 'Instance close result',
    type: () => CloseInstanceResponseDto,
  })
  data!: CloseInstanceResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

export class WrappedInstanceDetailResponseDto {
  @ApiProperty({
    description: 'Instance detail',
    type: () => InstanceDetailResponseDto,
  })
  data!: InstanceDetailResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

export class WrappedInstancePlayersResponseDto {
  @ApiProperty({
    description: 'Instance player list (a `{ instanceId, items, total }` object)',
    type: () => InstancePlayersResponseDto,
  })
  data!: InstancePlayersResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

// ─── Leaderboard wrapper (non-paginated envelope) ────────────────────────────
//
// Note: the leaderboard controller returns `{ items, hasNextPage, nextCursor }`.
// Because the payload does NOT contain a `pagination` key, `ResponseFormatInterceptor`
// treats it as a non-paginated plain object, so `data` holds the full object and
// `meta` only contains `timestamp` (no nested `pagination`).
//
export class WrappedInstanceLeaderboardResponseDto {
  @ApiProperty({
    description:
      'Leaderboard page. Because this endpoint returns a `{ items, hasNextPage, nextCursor }` ' +
      'object (not the `{ items, pagination }` shape), the interceptor wraps it as a ' +
      'non-paginated payload: the entire object lives under `data` and `meta` only carries `timestamp`.',
    type: () => InstanceLeaderboardResponseDto,
  })
  data!: InstanceLeaderboardResponseDto;

  @ApiProperty({
    description: 'Response metadata (timestamp only — no pagination field on this endpoint)',
    type: InstanceResponseMetaDto,
  })
  meta!: InstanceResponseMetaDto;
}

// ─── List wrapper (paginated envelope) ────────────────────────────────────────
//
// `listInstances` returns `{ items, pagination }` which the interceptor detects as
// a paginated payload: it hoists `items` to `data` and nests `pagination` under `meta`.
//
export class WrappedInstanceListResponseDto {
  @ApiProperty({
    description: 'Instance list items',
    type: () => [InstanceListItemDto],
  })
  data!: InstanceListItemDto[];

  @ApiProperty({ description: 'Response metadata', type: InstanceListMetaDto })
  meta!: InstanceListMetaDto;
}
