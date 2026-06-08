import { ApiProperty } from '@nestjs/swagger';

export class PublicTournamentProfileResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Number of completed tournaments participated in', example: 32 })
  tournamentsPlayed!: number;

  @ApiProperty({ description: 'Number of completed tournaments won', example: 4 })
  tournamentsWon!: number;

  @ApiProperty({ description: 'Best final rank achieved', example: 1, nullable: true })
  bestRank!: number | null;

  @ApiProperty({ description: 'Average final rank across completed tournaments', example: 18, nullable: true })
  averageRank!: number | null;

  @ApiProperty({ description: 'Number of top 10 finishes', example: 12 })
  top10Finishes!: number;

  @ApiProperty({ description: 'Total final tournament score across completed tournaments', example: 15420 })
  totalTournamentScore!: number;

  @ApiProperty({
    description: 'Most recent completed tournament timestamp (ISO 8601)',
    example: '2026-06-01T00:00:00Z',
    nullable: true,
  })
  lastTournamentAt!: string | null;
}
