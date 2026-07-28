import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApiTimestampProperty,
  ApiOptionalTimestampProperty,
  ApiUuidProperty,
} from '@/common/decorators/api-uuid-property.decorator';

export const RANK_TREND_VALUES = ['up', 'down', 'same', 'new'] as const;
export type RankTrend = (typeof RANK_TREND_VALUES)[number];

export const RANK_DIRECTION_VALUES = ['up', 'down', 'stable', 'unknown'] as const;
/**
 * @deprecated Use `RankTrend` from `leaderboard-entry.dto` instead.
 *   `RANK_DIRECTION_VALUES` will be removed in the next major release.
 *   Migrate consumers to `RANK_TREND_VALUES` = `['up', 'down', 'same', 'new']`.
 *   Mapping: `stable` → `same`; `unknown` → `new`.
 */
export type RankDirection = (typeof RANK_DIRECTION_VALUES)[number];

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'User rank position (ordinal with ties)', example: 1 })
  rank!: number;

  @ApiProperty({ description: 'Dense rank (no gaps for ties)', example: 1 })
  denseRank!: number;

  @ApiUuidProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'User display name', example: 'QuizMaster' })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Experience points for this period', example: 1500 })
  xp!: number;

  @ApiProperty({ description: 'Whether this user is tied with others', example: false })
  isTied!: boolean;

  @ApiPropertyOptional({
    description: 'Current user indicator',
    type: Boolean,
    example: true,
    nullable: true,
  })
  isCurrentUser!: boolean | null;
}

export class PeriodInfoDto {
  @ApiProperty({
    description: 'Period type',
    enum: ['daily', 'weekly', 'monthly', 'all_time'],
    example: 'weekly',
  })
  type!: 'daily' | 'weekly' | 'monthly' | 'all_time';

  @ApiTimestampProperty({ description: 'Period start date', example: '2026-05-25T00:00:00.000Z' })
  start!: string;

  @ApiOptionalTimestampProperty({
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

  @ApiPropertyOptional({
    description: 'XP needed to reach next rank',
    type: Number,
    example: 200,
    nullable: true,
  })
  xpToNextRank!: number | null;

  @ApiPropertyOptional({
    description: 'XP of the next rank position',
    type: Number,
    example: 1700,
    nullable: true,
  })
  nextRankXp!: number | null;

  @ApiProperty({
    description: 'Rank trend compared to previous',
    enum: RANK_TREND_VALUES,
  })
  trend!: RankTrend;

  @ApiPropertyOptional({
    description: 'Amount of rank change',
    type: Number,
    example: 5,
    nullable: true,
  })
  trendAmount!: number | null;
}

export class GlobalRankingDto {
  @ApiPropertyOptional({
    description: 'Weekly ranking info',
    type: UserRankPositionDto,
    nullable: true,
  })
  weekly!: UserRankPositionDto | null;

  @ApiPropertyOptional({
    description: 'Monthly ranking info',
    type: UserRankPositionDto,
    nullable: true,
  })
  monthly!: UserRankPositionDto | null;

  @ApiPropertyOptional({
    description: 'All-time ranking info',
    type: UserRankPositionDto,
    nullable: true,
  })
  allTime!: UserRankPositionDto | null;
}

export class UserBadgesDto {
  @ApiProperty({ description: 'Whether user is newer than 7 days', example: false })
  isNew!: boolean;

  @ApiProperty({ description: 'Whether user is a rising star (top weekly gainer)', example: true })
  isRisingStar!: boolean;

  @ApiProperty({ description: 'Whether user was active in the last 7 days', example: true })
  isActive!: boolean;
}
