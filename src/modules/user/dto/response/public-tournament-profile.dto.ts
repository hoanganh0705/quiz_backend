import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicTournamentProfileResponseDto {
  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Number of completed tournaments participated in',
    example: 32,
  })
  tournamentsPlayed!: number;

  @ApiProperty({ description: 'Number of completed tournaments won', example: 4 })
  tournamentsWon!: number;

  @ApiPropertyOptional({
    description: 'Best final rank achieved',
    type: Number,
    nullable: true,
    example: 1,
  })
  bestRank!: number | null;

  @ApiPropertyOptional({
    description: 'Average final rank across completed tournaments',
    type: Number,
    nullable: true,
    example: 18,
  })
  averageRank!: number | null;

  @ApiProperty({ description: 'Number of top 10 finishes', example: 12 })
  top10Finishes!: number;

  @ApiProperty({
    description: 'Total final tournament score across completed tournaments',
    example: 15420,
  })
  totalTournamentScore!: number;

  @ApiPropertyOptional({
    description: 'Most recent completed tournament timestamp (ISO 8601)',
    type: String,
    nullable: true,
    example: '2026-06-01T00:00:00.000Z',
  })
  lastTournamentAt!: string | null;
}
