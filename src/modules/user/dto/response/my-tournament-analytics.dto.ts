import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MyTournamentAnalyticsResponseDto {
  @ApiProperty({ description: 'Completed tournaments participated in', example: 45 })
  tournamentsPlayed!: number;

  @ApiProperty({ description: 'Number of tournament wins', example: 6 })
  wins!: number;

  @ApiProperty({ description: 'Number of top 3 finishes', example: 11 })
  top3Finishes!: number;

  @ApiProperty({ description: 'Number of top 10 finishes', example: 18 })
  top10Finishes!: number;

  @ApiPropertyOptional({
    description: 'Average final rank across completed tournaments',
    type: Number,
    nullable: true,
    example: 21,
  })
  averageRank!: number | null;

  @ApiPropertyOptional({
    description: 'Best final rank achieved',
    type: Number,
    nullable: true,
    example: 1,
  })
  bestRank!: number | null;

  @ApiProperty({
    description: 'Average final score across completed tournaments',
    example: 84,
  })
  averageScore!: number;

  @ApiProperty({ description: 'Total final tournament score', example: 12540 })
  totalTournamentScore!: number;

  @ApiProperty({ description: 'Completion rate percentage', example: 91 })
  completionRate!: number;

  @ApiPropertyOptional({
    description: 'Most recent completed tournament timestamp (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-06-01T00:00:00.000Z',
  })
  lastTournamentAt!: string | null;
}