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
    enum: ['weekly', 'monthly', 'all_time'],
    example: 'weekly',
  })
  type!: 'weekly' | 'monthly' | 'all_time';

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

export class RankTrendDto {
  @ApiPropertyOptional({ description: 'Previous rank', example: 47 })
  previousRank!: number | null;

  @ApiPropertyOptional({ description: 'Current rank', example: 42 })
  currentRank!: number | null;

  @ApiPropertyOptional({ description: 'Amount of change (negative means dropped)', example: 5 })
  change!: number | null;
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
  period!: 'weekly' | 'monthly' | 'all_time';

  @ApiProperty({ description: 'Reset time', example: 86400 })
  resetInSeconds!: number;
}
