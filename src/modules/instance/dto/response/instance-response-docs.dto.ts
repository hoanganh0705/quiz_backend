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

class InstanceLeaderboardMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiPropertyOptional({
    description: 'Leaderboard cursor-pagination metadata',
  })
  pagination?: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

class InstanceListMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Instance list cursor-pagination metadata', type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedCreateInstanceResponseDto {
  @ApiProperty({
    description: 'Instance creation result',
    type: () => CreateInstanceResponseDto,
  })
  data!: CreateInstanceResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedJoinInstanceResponseDto {
  @ApiProperty({
    description: 'Instance join result',
    type: () => JoinInstanceResponseDto,
  })
  data!: JoinInstanceResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedStartInstanceResponseDto {
  @ApiProperty({
    description: 'Instance start result',
    type: () => StartInstanceResponseDto,
  })
  data!: StartInstanceResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedCloseInstanceResponseDto {
  @ApiProperty({
    description: 'Instance close result',
    type: () => CloseInstanceResponseDto,
  })
  data!: CloseInstanceResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedInstanceDetailResponseDto {
  @ApiProperty({
    description: 'Instance detail',
    type: () => InstanceDetailResponseDto,
  })
  data!: InstanceDetailResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedInstancePlayersResponseDto {
  @ApiProperty({
    description: 'Instance player list',
    type: () => InstancePlayersResponseDto,
  })
  data!: InstancePlayersResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

// ─── Paginated wrappers ────────────────────────────────────────────────────────
//
// For paginated responses, ResponseFormatInterceptor wraps the root-level
// { items, pagination } as { data: items, meta: { timestamp, pagination } }.
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

export class WrappedInstanceLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [InstanceLeaderboardEntryDto],
  })
  data!: InstanceLeaderboardEntryDto[];

  @ApiProperty({ description: 'Response metadata', type: InstanceLeaderboardMetaDto })
  meta!: InstanceLeaderboardMetaDto;
}
