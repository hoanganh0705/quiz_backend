/**
 * Leaderboard Request DTOs
 *
 * Query and request types for leaderboard endpoints.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum RankingPeriodEnum {
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

export class CategoryLeaderboardQueryDto extends LeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Category ID to filter leaderboard',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsOptional()
  categoryId?: string;
}

export class UserRankQueryDto {
  @ApiPropertyOptional({
    description: 'Ranking period',
    enum: RankingPeriodEnum,
    default: RankingPeriodEnum.ALL_TIME,
  })
  @IsEnum(RankingPeriodEnum)
  @IsOptional()
  period?: RankingPeriodEnum = RankingPeriodEnum.ALL_TIME;
}
