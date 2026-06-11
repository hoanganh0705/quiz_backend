/**
 * Leaderboard Response DTOs
 *
 * Response types for leaderboard endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'User rank position (ordinal with ties)', example: 1 })
  rank!: number;

  @ApiProperty({ description: 'Dense rank (no gaps for ties)', example: 1 })
  denseRank!: number;

  @ApiProperty({ description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'User display name', example: 'QuizMaster' })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.png',
  })
  avatarUrl?: string | null;

  @ApiProperty({ description: 'Experience points for this period', example: 1500 })
  xp!: number;

  @ApiProperty({ description: 'Whether this user is tied with others', example: false })
  isTied!: boolean;

  @ApiPropertyOptional({ description: 'Current user indicator', example: true })
  isCurrentUser?: boolean;
}

export class PeriodInfoDto {
  @ApiProperty({
    description: 'Period type',
    enum: ['daily', 'weekly', 'monthly', 'all_time'],
    example: 'weekly',
  })
  type!: 'daily' | 'weekly' | 'monthly' | 'all_time';

  @ApiProperty({ description: 'Period start date', example: '2026-05-25T00:00:00.000Z' })
  start!: string;

  @ApiPropertyOptional({
    description: 'Period end date (null for all_time)',
    example: '2026-05-31T23:59:59.999Z',
  })
  end!: string | null;

  @ApiProperty({ description: 'Seconds until next reset', example: 86400 })
  resetInSeconds!: number;
}

export class PaginationDto {
  @ApiProperty({ description: 'Number of items per page', example: 100 })
  limit!: number;

  @ApiProperty({ description: 'Number of items skipped', example: 0 })
  offset!: number;

  @ApiProperty({ description: 'Whether there are more items', example: true })
  hasMore!: boolean;
}

export class UserRankPositionDto {
  @ApiProperty({ description: 'User rank position', example: 42 })
  rank!: number;

  @ApiProperty({ description: 'Dense rank (no gaps for ties)', example: 42 })
  denseRank!: number;

  @ApiProperty({ description: 'Percentile (0-100)', example: 95.5 })
  percentile!: number;

  @ApiProperty({ description: 'Percentile label', example: 'Top 5%' })
  percentileLabel!: string;

  @ApiProperty({ description: 'Current XP in this period', example: 1500 })
  xp!: number;

  @ApiPropertyOptional({ description: 'XP needed to reach next rank', example: 200 })
  xpToNextRank!: number | null;

  @ApiPropertyOptional({ description: 'XP of the next rank position', example: 1700 })
  nextRankXp!: number | null;

  @ApiProperty({
    description: 'Rank trend compared to previous',
    enum: ['up', 'down', 'same', 'new'],
  })
  trend!: 'up' | 'down' | 'same' | 'new';

  @ApiPropertyOptional({ description: 'Amount of rank change', example: 5 })
  trendAmount!: number | null;
}

export class GlobalRankingDto {
  @ApiProperty({ description: 'Weekly ranking info' })
  weekly!: UserRankPositionDto | null;

  @ApiProperty({ description: 'Monthly ranking info' })
  monthly!: UserRankPositionDto | null;

  @ApiProperty({ description: 'All-time ranking info' })
  allTime!: UserRankPositionDto | null;
}

export class PeakRanksDto {
  @ApiPropertyOptional({ description: 'Best weekly rank achieved', example: 15 })
  weekly!: number | null;

  @ApiPropertyOptional({ description: 'Best monthly rank achieved', example: 8 })
  monthly!: number | null;

  @ApiPropertyOptional({ description: 'Best all-time rank achieved', example: 3 })
  allTime!: number | null;
}

export class UserBadgesDto {
  @ApiProperty({ description: 'Whether user is newer than 7 days', example: false })
  isNew!: boolean;

  @ApiProperty({ description: 'Whether user is a rising star (top weekly gainer)', example: true })
  isRisingStar!: boolean;

  @ApiProperty({ description: 'Whether user was active in the last 7 days', example: true })
  isActive!: boolean;
}

export class RankingHistoryItemDto {
  @ApiProperty({ description: 'Snapshot date in YYYY-MM-DD format', example: '2026-06-01' })
  date!: string;

  @ApiProperty({ description: 'User rank at the snapshot time', example: 142 })
  rank!: number;
}

export class RankingHistoryResponseDto {
  @ApiProperty({ description: 'Historical ranking snapshots', type: [RankingHistoryItemDto] })
  items!: RankingHistoryItemDto[];
}

export class PublicRankingHistoryResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Public username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Historical ranking snapshots', type: [RankingHistoryItemDto] })
  history!: RankingHistoryItemDto[];
}

export class PeakRankDto {
  @ApiProperty({ description: 'Best rank achieved for the period', example: 1 })
  rank!: number;

  @ApiPropertyOptional({
    description: 'Timestamp when the peak rank was achieved',
    example: '2026-05-01T12:00:00Z',
    nullable: true,
  })
  achievedAt!: string | null;
}

export class PeakRanksResponseDto {
  @ApiPropertyOptional({ type: PeakRankDto, nullable: true })
  daily!: PeakRankDto | null;

  @ApiPropertyOptional({ type: PeakRankDto, nullable: true })
  weekly!: PeakRankDto | null;

  @ApiPropertyOptional({ type: PeakRankDto, nullable: true })
  monthly!: PeakRankDto | null;

  @ApiPropertyOptional({ type: PeakRankDto, nullable: true })
  allTime!: PeakRankDto | null;
}

export class RankMovementResponseDto {
  @ApiPropertyOptional({ description: 'Previous snapshot rank', example: 120, nullable: true })
  previousRank!: number | null;

  @ApiPropertyOptional({ description: 'Current snapshot rank', example: 95, nullable: true })
  currentRank!: number | null;

  @ApiPropertyOptional({
    description: 'Rank change computed as previousRank - currentRank',
    example: 25,
    nullable: true,
  })
  change!: number | null;

  @ApiProperty({
    description: 'Movement direction',
    enum: ['up', 'down', 'stable', 'unknown'],
    example: 'up',
  })
  direction!: 'up' | 'down' | 'stable' | 'unknown';
}

export class TopMoverDto {
  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Public username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Current snapshot rank', example: 34 })
  currentRank!: number;

  @ApiProperty({ description: 'Previous snapshot rank', example: 454 })
  previousRank!: number;

  @ApiProperty({
    description: 'Positive rank change computed as previousRank - currentRank',
    example: 420,
  })
  change!: number;
}

export class TopMoversResponseDto {
  @ApiProperty({
    description: 'Users with the largest positive ranking movement',
    type: [TopMoverDto],
  })
  items!: TopMoverDto[];
}

export class NearbyRankEntryDto {
  @ApiProperty({ description: 'User rank position', example: 50 })
  rank!: number;

  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Public username', example: 'Anh' })
  username!: string;

  @ApiProperty({ description: 'Experience points in the selected period', example: 12450 })
  xp!: number;
}

export class NearbyRanksResponseDto {
  @ApiProperty({
    description: 'Entries immediately above the authenticated user',
    type: [NearbyRankEntryDto],
  })
  above!: NearbyRankEntryDto[];

  @ApiPropertyOptional({
    description: 'Authenticated user entry',
    type: NearbyRankEntryDto,
    nullable: true,
  })
  me!: NearbyRankEntryDto | null;

  @ApiProperty({
    description: 'Entries immediately below the authenticated user',
    type: [NearbyRankEntryDto],
  })
  below!: NearbyRankEntryDto[];
}

export class RankingMilestoneDto {
  @ApiProperty({
    description: 'Milestone identifier',
    enum: ['TOP_10000', 'TOP_1000', 'TOP_100', 'TOP_50', 'TOP_10', 'TOP_3', 'TOP_1'],
    example: 'TOP_100',
  })
  milestone!: 'TOP_10000' | 'TOP_1000' | 'TOP_100' | 'TOP_50' | 'TOP_10' | 'TOP_3' | 'TOP_1';

  @ApiProperty({ description: 'Rank threshold achieved for this milestone', example: 100 })
  rank!: number;

  @ApiProperty({
    description: 'Timestamp when the milestone was first achieved',
    example: '2026-03-10T10:00:00Z',
  })
  achievedAt!: string;
}

export class RankingMilestonesResponseDto {
  @ApiProperty({
    description: 'Ranking milestones achieved by the authenticated user',
    type: [RankingMilestoneDto],
  })
  items!: RankingMilestoneDto[];
}

export class LeaderboardDistributionBucketDto {
  @ApiProperty({ description: 'Bucket label', example: 'Top 100' })
  label!: string;

  @ApiProperty({ description: 'Number of users in this bucket', example: 90 })
  count!: number;
}

export class LeaderboardDistributionResponseDto {
  @ApiProperty({ description: 'Total users in the selected leaderboard', example: 125430 })
  totalUsers!: number;

  @ApiProperty({ description: 'Users not included in the explicit top buckets', example: 115320 })
  remainingUsers!: number;

  @ApiProperty({
    description: 'Distribution buckets for the selected leaderboard',
    type: [LeaderboardDistributionBucketDto],
  })
  buckets!: LeaderboardDistributionBucketDto[];
}

export class UserPercentileResponseDto {
  @ApiPropertyOptional({
    description: 'Current user rank in the selected period',
    example: 125,
    nullable: true,
  })
  rank!: number | null;

  @ApiProperty({ description: 'Total ranked users in the selected period', example: 10000 })
  totalUsers!: number;

  @ApiPropertyOptional({
    description: 'Percent of ranked users that the authenticated user is ahead of',
    example: 98.75,
    nullable: true,
  })
  percentile!: number | null;

  @ApiPropertyOptional({
    description: 'Number of users the authenticated user is ahead of',
    example: 9875,
    nullable: true,
  })
  betterThanUsers!: number | null;

  @ApiPropertyOptional({
    description: 'Number of users ranked ahead of the authenticated user',
    example: 124,
    nullable: true,
  })
  worseThanUsers!: number | null;
}

export class LeaderboardResponseDto {
  @ApiProperty({ description: 'Leaderboard entries', type: [LeaderboardEntryDto] })
  entries!: LeaderboardEntryDto[];

  @ApiProperty({ description: 'Total number of participants in this ranking', example: 1542 })
  totalParticipants!: number;

  @ApiPropertyOptional({ description: 'Current user position (if authenticated)' })
  userPosition?: UserRankPositionDto;

  @ApiProperty({ description: 'Period information', type: PeriodInfoDto })
  period!: PeriodInfoDto;

  @ApiProperty({ description: 'Pagination information', type: PaginationDto })
  pagination!: PaginationDto;
}

export class UserRankResponseDto {
  @ApiProperty({ description: 'Global rankings across all periods', type: GlobalRankingDto })
  global!: GlobalRankingDto;

  @ApiProperty({ description: 'Best ranks ever achieved', type: PeakRanksDto })
  peakRanks!: PeakRanksDto;

  @ApiPropertyOptional({ description: 'Last activity timestamp' })
  lastActivityAt!: string | null;

  @ApiProperty({ description: 'User ranking badges', type: UserBadgesDto })
  badges!: UserBadgesDto;
}

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

  @ApiPropertyOptional({ description: 'XP to next rank' })
  xpToNextRank!: number | null;

  @ApiPropertyOptional({ description: 'XP of next rank' })
  nextRankXp!: number | null;

  @ApiProperty({ description: 'Rank trend', enum: ['up', 'down', 'same', 'new'] })
  trend!: 'up' | 'down' | 'same' | 'new';

  @ApiPropertyOptional({ description: 'Amount of trend' })
  trendAmount!: number | null;

  @ApiProperty({ description: 'Period type' })
  period!: 'daily' | 'weekly' | 'monthly' | 'all_time';

  @ApiProperty({ description: 'Reset time', example: 86400 })
  resetInSeconds!: number;
}
