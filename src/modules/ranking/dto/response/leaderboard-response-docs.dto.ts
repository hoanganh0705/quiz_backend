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
// For ranking-specific responses, some responses have root-level { entries, ... }
// or { above, me, below } or { above, below } or { items } — these are NOT
// detected as paginated payloads (no top-level `items` + `pagination` pair),
// so they are wrapped as { data: <root>, meta: { timestamp } }.
//
// Runtime DTOs live in their own response DTO files and are imported here for
// use in wrapper type refs.
//
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse
// decorators to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Paginated meta ─────────────────────────────────────────────────────────────

class RankingLeaderboardMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({ description: 'Leaderboard pagination metadata' })
  pagination!: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ─── Non-paginated wrappers ────────────────────────────────────────────────────

export class WrappedLeaderboardResponseDto {
  @ApiProperty({ description: 'Leaderboard data', type: () => LeaderboardResponseDto })
  data!: LeaderboardResponseDto;

  @ApiProperty({ description: 'Response metadata', type: RankingLeaderboardMetaDto })
  meta!: RankingLeaderboardMetaDto;
}

export class WrappedUserRankResponseDto {
  @ApiProperty({ description: 'User rank data', type: () => UserRankResponseDto })
  data!: UserRankResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedLeaderboardDistributionResponseDto {
  @ApiProperty({
    description: 'Leaderboard distribution data',
    type: () => LeaderboardDistributionResponseDto,
  })
  data!: LeaderboardDistributionResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedTopMoversResponseDto {
  @ApiProperty({ description: 'Top movers data', type: () => TopMoversResponseDto })
  data!: TopMoversResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedNearbyRanksResponseDto {
  @ApiProperty({ description: 'Nearby ranks data', type: () => NearbyRanksResponseDto })
  data!: NearbyRanksResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedRankingHistoryResponseDto {
  @ApiProperty({ description: 'Ranking history data', type: () => RankingHistoryResponseDto })
  data!: RankingHistoryResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedPublicRankingHistoryResponseDto {
  @ApiProperty({
    description: 'Public ranking history data',
    type: () => PublicRankingHistoryResponseDto,
  })
  data!: PublicRankingHistoryResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedPeakRanksResponseDto {
  @ApiProperty({ description: 'Peak ranks data', type: () => PeakRanksResponseDto })
  data!: PeakRanksResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedRankMovementResponseDto {
  @ApiProperty({ description: 'Rank movement data', type: () => RankMovementResponseDto })
  data!: RankMovementResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedRankingMilestonesResponseDto {
  @ApiProperty({
    description: 'Ranking milestones data',
    type: () => RankingMilestonesResponseDto,
  })
  data!: RankingMilestonesResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedUserPercentileResponseDto {
  @ApiProperty({ description: 'User percentile data', type: () => UserPercentileResponseDto })
  data!: UserPercentileResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedUserRankSummaryDto {
  @ApiProperty({ description: 'User rank summary data', type: () => UserRankSummaryDto })
  data!: UserRankSummaryDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

// ─── Admin wrappers ────────────────────────────────────────────────────────────

export class WrappedRankingStatusResponseDto {
  @ApiProperty({ description: 'Ranking system status', type: () => RankingStatusResponseDto })
  data!: RankingStatusResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedRecalculateResponseDto {
  @ApiProperty({ description: 'Recalculation result', type: () => RecalculateResponseDto })
  data!: RecalculateResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedPeriodResetResponseDto {
  @ApiProperty({ description: 'Period reset result', type: () => PeriodResetResponseDto })
  data!: PeriodResetResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}

export class WrappedConsistencyReportResponseDto {
  @ApiProperty({
    description: 'Consistency check report',
    type: () => ConsistencyReportResponseDto,
  })
  data!: ConsistencyReportResponseDto;

  @ApiProperty({ description: 'Response metadata' })
  meta!: { timestamp: string };
}
