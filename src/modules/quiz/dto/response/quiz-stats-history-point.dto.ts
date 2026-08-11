import { ApiProperty } from '@nestjs/swagger';

/**
 * Phase 2 (S-11): one point on the `QuizStatsResponseDto.recentActivity`
 * sparkline. The array is densified server-side so the client can
 * render a 30-day timeline without gaps — every missing day is
 * returned as `{ date: 'YYYY-MM-DD', attempts: 0, completions: 0,
 * uniquePlayers: 0 }`.
 */
export class QuizStatsHistoryPointDto {
  @ApiProperty({
    description: 'Bucket start date (ISO 8601, day- or hour-grained depending on the route)',
    example: '2026-07-13',
  })
  date!: string;

  @ApiProperty({ description: 'Attempts that started in this bucket', example: 8 })
  attempts!: number;

  @ApiProperty({ description: 'Attempts that completed in this bucket', example: 6 })
  completions!: number;

  @ApiProperty({
    description: 'Distinct users who attempted this quiz in this bucket',
    example: 5,
  })
  uniquePlayers!: number;
}
