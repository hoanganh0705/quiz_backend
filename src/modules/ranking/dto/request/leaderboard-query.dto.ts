import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { RankingPeriod } from '../../domain/types/ranking.types';

export enum RankingPeriodEnum {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time',
}

/**
 * Periods supported by the *leaderboard* endpoints (`/leaderboard`,
 * `/leaderboard/distribution`, `/leaderboard/me/rank`, `/leaderboard/:userId/rank`,
 * `/leaderboard/me/nearby`).
 *
 * Note: `daily` is intentionally **not** exposed here. The `user_ranking`
 * snapshot only tracks `weekly` / `monthly` / `all_time` XP — daily XP is
 * captured separately and the repository's `getXpColumn` rejects
 * `RankingPeriod.DAILY`. Keeping this enum in sync with what the repository
 * can serve means invalid `period` values are rejected at the controller
 * boundary (400) instead of crashing inside the SQL layer (500).
 *
 * Admin endpoints (`/admin/ranking/recalculate`, `/admin/ranking/reset`)
 * continue to use the full `RankingPeriodEnum` because they *write* to
 * the daily XP fields.
 */
export enum LeaderboardPeriodEnum {
  WEEKLY = RankingPeriodEnum.WEEKLY,
  MONTHLY = RankingPeriodEnum.MONTHLY,
  ALL_TIME = RankingPeriodEnum.ALL_TIME,
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Ranking period',
    enum: LeaderboardPeriodEnum,
    default: LeaderboardPeriodEnum.ALL_TIME,
  })
  @IsEnum(LeaderboardPeriodEnum)
  @IsOptional()
  period?: LeaderboardPeriodEnum = LeaderboardPeriodEnum.ALL_TIME;

  @ApiPropertyOptional({
    description: 'Number of items to return',
    default: 100,
    minimum: 1,
    maximum: 500,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Number of items to skip',
    default: 0,
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}

export class MyRankingHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Ranking history period',
    enum: RankingPeriodEnum,
    default: RankingPeriodEnum.ALL_TIME,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.ALL_TIME;

  @ApiPropertyOptional({
    description: 'Start date filter in YYYY-MM-DD format',
    example: '2026-01-01',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date filter in YYYY-MM-DD format',
    example: '2026-06-01',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsDateString()
  @IsOptional()
  to?: string;
}

export class RankMovementQueryDto {
  @ApiPropertyOptional({
    description: 'Ranking movement period',
    enum: LeaderboardPeriodEnum,
    default: LeaderboardPeriodEnum.WEEKLY,
  })
  @IsEnum(LeaderboardPeriodEnum)
  @IsOptional()
  period?: LeaderboardPeriodEnum = LeaderboardPeriodEnum.WEEKLY;
}

/**
 * Periods supported by the *top movers* endpoint (`/leaderboard/top-movers`).
 *
 * Note: `daily` is intentionally **not** supported. Top movers track ranking
 * movement over a period — daily resets would cause excessive volatility and
 * are not meaningful for this feature. `all_time` is also excluded since
 * "movement" over all time is not semantically meaningful.
 */
export enum TopMoversPeriodEnum {
  WEEKLY = LeaderboardPeriodEnum.WEEKLY,
  MONTHLY = LeaderboardPeriodEnum.MONTHLY,
}

export class TopMoversQueryDto {
  @ApiPropertyOptional({
    description: 'Top movers period. Only weekly and monthly are supported.',
    enum: TopMoversPeriodEnum,
    default: TopMoversPeriodEnum.WEEKLY,
  })
  @IsEnum(TopMoversPeriodEnum)
  @IsOptional()
  period?: TopMoversPeriodEnum = TopMoversPeriodEnum.WEEKLY;

  @ApiPropertyOptional({
    description: 'Number of top movers to return',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}

export class NearbyRanksQueryDto {
  @ApiPropertyOptional({
    description: 'Nearby ranks period',
    enum: LeaderboardPeriodEnum,
    default: LeaderboardPeriodEnum.ALL_TIME,
  })
  @IsEnum(LeaderboardPeriodEnum)
  @IsOptional()
  period?: LeaderboardPeriodEnum = LeaderboardPeriodEnum.ALL_TIME;

  @ApiPropertyOptional({
    description: 'Number of ranks above and below to return',
    default: 2,
    minimum: 1,
    maximum: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  radius?: number = 2;
}

export class LeaderboardDistributionQueryDto {
  @ApiPropertyOptional({
    description: 'Leaderboard distribution period',
    enum: LeaderboardPeriodEnum,
    default: LeaderboardPeriodEnum.ALL_TIME,
  })
  @IsEnum(LeaderboardPeriodEnum)
  @IsOptional()
  period?: LeaderboardPeriodEnum = LeaderboardPeriodEnum.ALL_TIME;
}

/** Map TopMoversPeriodEnum to domain RankingPeriod. */
export function mapTopMoversPeriodEnumToDomain(
  period: TopMoversPeriodEnum | undefined,
): RankingPeriod {
  return period as unknown as RankingPeriod;
}
