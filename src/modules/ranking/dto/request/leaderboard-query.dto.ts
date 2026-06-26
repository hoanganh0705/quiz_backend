import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

export enum RankingPeriodEnum {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time',
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Ranking period',
    enum: RankingPeriodEnum,
    default: RankingPeriodEnum.ALL_TIME,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.ALL_TIME;

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
    enum: RankingPeriodEnum,
    default: RankingPeriodEnum.DAILY,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.DAILY;
}

export class TopMoversQueryDto {
  @ApiPropertyOptional({
    description: 'Top movers period',
    enum: [RankingPeriodEnum.DAILY, RankingPeriodEnum.WEEKLY, RankingPeriodEnum.MONTHLY],
    default: RankingPeriodEnum.DAILY,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.DAILY;

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
    enum: RankingPeriodEnum,
    default: RankingPeriodEnum.ALL_TIME,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.ALL_TIME;

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
    enum: RankingPeriodEnum,
    default: RankingPeriodEnum.ALL_TIME,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.ALL_TIME;
}
