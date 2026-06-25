/**
 * Admin Ranking Response DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';

export class RankingStatusResponseDto {
  @ApiProperty()
  schedulerRunning!: boolean;

  @ApiProperty()
  dirtyQueueSize!: number;

  @ApiPropertyOptional()
  nextConsistencyCheck!: string | null;

  @ApiProperty()
  nextPeriodReset!: {
    weekly: string | null;
    monthly: string | null;
    daily: string | null;
  };
}

export class RecalculateResponseDto {
  @ApiProperty({ example: 'Recalculation triggered for all periods' })
  message!: string;

  @ApiPropertyOptional({ enum: RankingPeriodEnum })
  period!: string;
}

export class PeriodResetResponseDto {
  @ApiProperty({ example: 'Period reset initiated for weekly' })
  message!: string;

  @ApiProperty({ enum: RankingPeriodEnum })
  period!: string;
}

export class ConsistencyReportIssueDto {
  @ApiProperty()
  type!: 'xp_mismatch' | 'rank_gap' | 'missing_rank';

  @ApiPropertyOptional()
  userId!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  severity!: 'low' | 'medium' | 'high';
}

export class ConsistencyReportResponseDto {
  @ApiProperty()
  totalIssues!: number;

  @ApiProperty()
  fixed!: number;

  @ApiProperty({ type: [ConsistencyReportIssueDto] })
  issues!: ConsistencyReportIssueDto[];
}
