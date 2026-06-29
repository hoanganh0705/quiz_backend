import { ApiProperty } from '@nestjs/swagger';
import {
  RankingStatusResponseDto,
  RecalculateResponseDto,
  PeriodResetResponseDto,
  ConsistencyReportResponseDto,
} from './ranking-admin-response.dto';
import { LeaderboardResponseDto, UserRankResponseDto } from './leaderboard-response.dto';
import {
  LeaderboardDistributionResponseDto,
  UserPercentileResponseDto,
} from './leaderboard-stats.dto';
import { TopMoversResponseDto } from './leaderboard-top-movers.dto';
import { NearbyRanksResponseDto } from './leaderboard-nearby.dto';
import {
  RankingHistoryResponseDto,
  PublicRankingHistoryResponseDto,
  PeakRanksResponseDto,
  RankMovementResponseDto,
  RankingMilestonesResponseDto,
} from './leaderboard-history.dto';
import { UserRankSummaryDto } from './leaderboard-stats.dto';

// ─── Ranking module documentation-only wrapper DTOs ──────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated payloads ({ items, pagination }), the interceptor extracts
// the items as data and nests pagination inside meta:
//   { data: items, meta: { timestamp, pagination } }
//
// Ranking-specific responses return objects like { entries, ... } or
// { above, me, below } or { items } — these do NOT have a top-level
// `pagination` key, so they are wrapped as non-paginated:
//   { data: <root>, meta: { timestamp } }
//
// Runtime DTOs live in their own response DTO files and are imported here for
// use in wrapper type refs.
//
// ─── Ranking Domain Error Shape ────────────────────────────────────────────────
//
// RankingDomainExceptionFilter uses @Catch() (catches ALL exceptions).
// This means EVERY error from the ranking controller — including JwtGuard's
// UnauthorizedException, PermissionsGuard's ForbiddenException, and class-validator
// BadRequestException — is intercepted and re-written to the same shape:
//   { statusCode, message, code, timestamp }
//
// The code field is NOT the HTTP status text; it is a domain-specific
// machine-readable string like "UNAUTHORIZED", "BAD_REQUEST", etc. The filter
// extracts it from HttpException response objects, falling back to a
// status-based default (e.g., BAD_REQUEST for 400, NOT_FOUND for 404).
//

export const RANKING_ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'BAD_REQUEST',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;
export type RankingErrorCode = (typeof RANKING_ERROR_CODES)[number];

/**
 * Error envelope emitted by `RankingDomainExceptionFilter` for every HTTP error
 * originating from the ranking controller (including JWT failures, permission
 * denials, and validation errors). Distinct from RFC 7807 ProblemDetailDto.
 */
export class RankingDomainErrorDto {
  @ApiProperty({
    description: 'HTTP status code produced by the ranking domain exception filter',
    example: 401,
  })
  statusCode!: number;

  @ApiProperty({
    description:
      'Human-readable message. For JwtGuard failures this is the message from ' +
      '`UnauthorizedException`. For `BadRequestException` (validation) it is the ' +
      'validation message. For PermissionsGuard failures it is the message from ' +
      '`ForbiddenException`. The message content varies by source.',
    example: 'Authorization header is missing',
  })
  message!: string;

  @ApiProperty({
    description:
      'Machine-readable error code. The filter extracts this from the exception ' +
      'response shape (`code` field). For HttpExceptions without an explicit code, ' +
      'defaults to status-based strings: `UNAUTHORIZED` (401), `FORBIDDEN` (403), ' +
      '`BAD_REQUEST` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500).',
    enum: RANKING_ERROR_CODES,
    example: 'UNAUTHORIZED',
  })
  code!: RankingErrorCode;

  @ApiProperty({
    description: 'ISO 8601 timestamp of when the error was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

// ─── Meta schemas ───────────────────────────────────────────────────────────────

class RankingResponseMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class RankingLeaderboardMetaDto extends RankingResponseMetaDto {
  @ApiProperty({ description: 'Leaderboard pagination metadata' })
  pagination!: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard data',
    type: () => LeaderboardResponseDto,
  })
  data!: LeaderboardResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingLeaderboardMetaDto,
  })
  meta!: RankingLeaderboardMetaDto;
}

export class WrappedUserRankResponseDto {
  @ApiProperty({
    description: 'User rank data',
    type: () => UserRankResponseDto,
  })
  data!: UserRankResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedLeaderboardDistributionResponseDto {
  @ApiProperty({
    description: 'Leaderboard distribution data',
    type: () => LeaderboardDistributionResponseDto,
  })
  data!: LeaderboardDistributionResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedTopMoversResponseDto {
  @ApiProperty({
    description: 'Top movers data',
    type: () => TopMoversResponseDto,
  })
  data!: TopMoversResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedNearbyRanksResponseDto {
  @ApiProperty({
    description: 'Nearby ranks data',
    type: () => NearbyRanksResponseDto,
  })
  data!: NearbyRanksResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedRankingHistoryResponseDto {
  @ApiProperty({
    description: 'Ranking history data',
    type: () => RankingHistoryResponseDto,
  })
  data!: RankingHistoryResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedPublicRankingHistoryResponseDto {
  @ApiProperty({
    description: 'Public ranking history data',
    type: () => PublicRankingHistoryResponseDto,
  })
  data!: PublicRankingHistoryResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedPeakRanksResponseDto {
  @ApiProperty({
    description: 'Peak ranks data',
    type: () => PeakRanksResponseDto,
  })
  data!: PeakRanksResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedRankMovementResponseDto {
  @ApiProperty({
    description: 'Rank movement data',
    type: () => RankMovementResponseDto,
  })
  data!: RankMovementResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedRankingMilestonesResponseDto {
  @ApiProperty({
    description: 'Ranking milestones data',
    type: () => RankingMilestonesResponseDto,
  })
  data!: RankingMilestonesResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedUserPercentileResponseDto {
  @ApiProperty({
    description: 'User percentile data',
    type: () => UserPercentileResponseDto,
  })
  data!: UserPercentileResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedUserRankSummaryDto {
  @ApiProperty({
    description: 'User rank summary data',
    type: () => UserRankSummaryDto,
  })
  data!: UserRankSummaryDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

// ─── Admin wrappers ────────────────────────────────────────────────────────────

export class WrappedRankingStatusResponseDto {
  @ApiProperty({
    description: 'Ranking system status',
    type: () => RankingStatusResponseDto,
  })
  data!: RankingStatusResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedRecalculateResponseDto {
  @ApiProperty({
    description: 'Recalculation result',
    type: () => RecalculateResponseDto,
  })
  data!: RecalculateResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedPeriodResetResponseDto {
  @ApiProperty({
    description: 'Period reset result',
    type: () => PeriodResetResponseDto,
  })
  data!: PeriodResetResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}

export class WrappedConsistencyReportResponseDto {
  @ApiProperty({
    description: 'Consistency check report',
    type: () => ConsistencyReportResponseDto,
  })
  data!: ConsistencyReportResponseDto;

  @ApiProperty({
    description: 'Response metadata',
    type: RankingResponseMetaDto,
  })
  meta!: RankingResponseMetaDto;
}
