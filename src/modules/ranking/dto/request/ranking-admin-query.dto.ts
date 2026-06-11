/**
 * Admin Ranking Request DTOs
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { RankingPeriodEnum } from './leaderboard-query.dto';

export class RecalculateQueryDto {
  @IsOptional()
  @IsEnum(RankingPeriodEnum)
  @ApiPropertyOptional({
    enum: RankingPeriodEnum,
    description: 'Limit recalculation to a specific period',
  })
  period?: RankingPeriodEnum;
}

export class PeriodResetQueryDto {
  @IsOptional()
  @IsEnum(RankingPeriodEnum)
  @ApiPropertyOptional({
    enum: RankingPeriodEnum,
    description: 'Limit reset to a specific period (defaults to all due periods)',
  })
  period?: RankingPeriodEnum;
}
