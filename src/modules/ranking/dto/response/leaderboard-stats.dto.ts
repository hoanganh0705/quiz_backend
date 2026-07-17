import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RANK_TREND_VALUES, type RankTrend } from './leaderboard-entry.dto';

export class LeaderboardDistributionBucketDto {
  @ApiProperty({ description: 'Bucket label', example: 'Top 100' })
  label!: string;

  @ApiProperty({ description: 'Number of users in this bucket', example: 90 })
  count!: number;
}

export class LeaderboardDistributionResponseDto {
  @ApiProperty({
    description: 'Total users in the selected leaderboard',
    example: 125430,
  })
  totalUsers!: number;

  @ApiProperty({
    description: 'Users not included in the explicit top buckets',
    example: 115320,
  })
  remainingUsers!: number;

  @ApiProperty({
    description: 'Distribution buckets for the selected leaderboard',
    type: () => [LeaderboardDistributionBucketDto],
  })
  buckets!: LeaderboardDistributionBucketDto[];
}

export class UserPercentileResponseDto {
  @ApiPropertyOptional({
    description: 'Current user rank in the selected period',
    type: Number,
    example: 125,
    nullable: true,
  })
  rank!: number | null;

  @ApiProperty({
    description: 'Total ranked users in the selected period',
    example: 10000,
  })
  totalUsers!: number;

  @ApiPropertyOptional({
    description: 'Percent of ranked users that the authenticated user is ahead of',
    type: Number,
    example: 98.75,
    nullable: true,
  })
  percentile!: number | null;

  @ApiPropertyOptional({
    description:
      'Human-readable percentile bucket (e.g. "Top 5%"). ' +
      'Mirrors `UserRankPositionDto.percentileLabel` and `UserRankSummaryDto.percentileLabel`. ' +
      'Null when the user has no rank in the selected period.',
    type: String,
    example: 'Top 5%',
    nullable: true,
  })
  percentileLabel!: string | null;

  @ApiPropertyOptional({
    description: 'Number of users the authenticated user is ahead of',
    type: Number,
    example: 9875,
    nullable: true,
  })
  betterThanUsers!: number | null;

  @ApiPropertyOptional({
    description: 'Number of users ranked ahead of the authenticated user',
    type: Number,
    example: 124,
    nullable: true,
  })
  worseThanUsers!: number | null;
}

export const RANKING_PERIOD_VALUES = ['daily', 'weekly', 'monthly', 'all_time'] as const;
export type RankingPeriodValue = (typeof RANKING_PERIOD_VALUES)[number];

export class UserRankSummaryDto {
  @ApiProperty({ description: 'User rank position', example: 42 })
  rank!: number;

  @ApiProperty({ description: 'Dense rank', example: 42 })
  denseRank!: number;

  @ApiProperty({ description: 'Percentile (0-100)', example: 95.5 })
  percentile!: number;

  @ApiProperty({ description: 'Percentile label', example: 'Top 5%' })
  percentileLabel!: string;

  @ApiProperty({ description: 'XP in this period', example: 1500 })
  xp!: number;

  @ApiPropertyOptional({
    description: 'XP to next rank',
    type: Number,
    example: 200,
    nullable: true,
  })
  xpToNextRank!: number | null;

  @ApiPropertyOptional({
    description: 'XP of next rank',
    type: Number,
    example: 1700,
    nullable: true,
  })
  nextRankXp!: number | null;

  @ApiProperty({
    description: 'Rank trend',
    enum: RANK_TREND_VALUES,
  })
  trend!: RankTrend;

  @ApiPropertyOptional({
    description: 'Amount of trend',
    type: Number,
    example: 5,
    nullable: true,
  })
  trendAmount!: number | null;

  @ApiProperty({
    description: 'Period type',
    enum: RANKING_PERIOD_VALUES,
    example: 'all_time',
  })
  period!: RankingPeriodValue;

  @ApiProperty({ description: 'Reset time', example: 86400 })
  resetInSeconds!: number;
}
