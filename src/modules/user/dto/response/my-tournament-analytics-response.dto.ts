import { ApiProperty } from '@nestjs/swagger';

export class MyTournamentAnalyticsResponseDto {
  @ApiProperty({ description: 'Completed tournaments participated in', example: 45 })
  tournamentsPlayed!: number;

  @ApiProperty({ description: 'Number of tournament wins', example: 6 })
  wins!: number;

  @ApiProperty({ description: 'Number of top 3 finishes', example: 11 })
  top3Finishes!: number;

  @ApiProperty({ description: 'Number of top 10 finishes', example: 18 })
  top10Finishes!: number;

  @ApiProperty({
    description: 'Average final rank across completed tournaments',
    example: 21,
    nullable: true,
  })
  averageRank!: number | null;

  @ApiProperty({ description: 'Best final rank achieved', example: 1, nullable: true })
  bestRank!: number | null;

  @ApiProperty({ description: 'Average final score across completed tournaments', example: 84 })
  averageScore!: number;

  @ApiProperty({ description: 'Total final tournament score', example: 12540 })
  totalTournamentScore!: number;

  @ApiProperty({ description: 'Completion rate percentage', example: 91 })
  completionRate!: number;

  @ApiProperty({
    description: 'Most recent completed tournament timestamp (ISO 8601)',
    example: '2026-06-01T00:00:00Z',
    nullable: true,
  })
  lastTournamentAt!: string | null;
}
