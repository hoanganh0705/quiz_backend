import { ApiProperty } from '@nestjs/swagger';

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
