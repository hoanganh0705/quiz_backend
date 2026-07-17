import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiOptionalTimestampProperty } from '@/common/decorators/api-uuid-property.decorator';
import { RankingPeriodEnum } from '../../dto/request/leaderboard-query.dto';

export class RankingStatusResponseDto {
  @ApiProperty({
    description: 'Whether the background scheduler is currently running',
    example: true,
  })
  schedulerRunning!: boolean;

  @ApiProperty({
    description: 'Number of users with dirty rankings awaiting recalculation',
    example: 0,
  })
  dirtyQueueSize!: number;

  @ApiOptionalTimestampProperty({
    description: 'ISO 8601 timestamp of the next scheduled consistency check',
  })
  nextConsistencyCheck!: string | null;

  @ApiProperty({
    description: 'ISO 8601 timestamps for next resets of each period',
  })
  nextPeriodReset!: {
    weekly: string | null;
    monthly: string | null;
    daily: string | null;
  };
}

export class RecalculateResponseDto {
  @ApiProperty({
    description: 'Recalculation result message',
    example: 'Recalculation triggered for all periods',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Period that was recalculated (undefined means all periods)',
    enum: RankingPeriodEnum,
    nullable: true,
  })
  period!: string | undefined;
}

export class PeriodResetResponseDto {
  @ApiProperty({
    description: 'Reset result message',
    example: 'Period reset initiated for weekly',
  })
  message!: string;

  @ApiProperty({
    description: 'Period that was reset',
    enum: RankingPeriodEnum,
    example: 'weekly',
  })
  period!: string;
}

export class ConsistencyReportIssueDto {
  @ApiProperty({
    description: 'Type of consistency issue detected',
    enum: ['xp_mismatch', 'rank_gap', 'missing_rank'],
    example: 'xp_mismatch',
  })
  type!: 'xp_mismatch' | 'rank_gap' | 'missing_rank';

  @ApiPropertyOptional({
    description: 'Affected user identifier',
    format: 'uuid',
    nullable: true,
  })
  userId!: string | null | undefined;

  @ApiProperty({
    description: 'Human-readable description of the issue',
    example: 'XP mismatch between ranking and user table',
  })
  description!: string;

  @ApiProperty({
    description: 'Severity level of the issue',
    enum: ['low', 'medium', 'high', 'critical'],
    example: 'medium',
  })
  severity!: 'low' | 'medium' | 'high' | 'critical';
}

export class ConsistencyReportResponseDto {
  @ApiProperty({ description: 'Total number of issues detected', example: 0 })
  totalIssues!: number;

  @ApiProperty({ description: 'Number of issues automatically fixed', example: 0 })
  fixed!: number;

  @ApiProperty({
    description: 'Individual issues detected during the consistency check',
    type: () => [ConsistencyReportIssueDto],
  })
  issues!: ConsistencyReportIssueDto[];
}
