import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TournamentStatsResponseDto {
  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Total registered participants', example: 523 })
  participants!: number;

  @ApiProperty({ description: 'Participants who completed the tournament', example: 410 })
  completedParticipants!: number;

  @ApiProperty({ description: 'Average final score', example: 72 })
  averageScore!: number;

  @ApiPropertyOptional({
    description: 'Highest final score',
    type: Number,
    example: 100,
    nullable: true,
  })
  highestScore!: number | null;

  @ApiPropertyOptional({
    description: 'Lowest final score',
    type: Number,
    example: 12,
    nullable: true,
  })
  lowestScore!: number | null;

  @ApiProperty({ description: 'Completion rate percentage', example: 78.39 })
  completionRate!: number;

  @ApiPropertyOptional({
    description: 'Average final rank',
    type: Number,
    example: 262,
    nullable: true,
  })
  averageRank!: number | null;

  @ApiProperty({
    description: 'Tournament start timestamp (ISO 8601)',
    example: '2026-06-01T00:00:00Z',
  })
  startedAt!: string;

  @ApiProperty({
    description: 'Tournament end timestamp (ISO 8601)',
    example: '2026-06-10T00:00:00Z',
  })
  endedAt!: string;
}

export class MyTournamentStandingResponseDto {
  @ApiProperty({ description: 'Current rank of the authenticated user', example: 23 })
  rank!: number;

  @ApiProperty({ description: 'Current score of the authenticated user', example: 542 })
  score!: number;

  @ApiProperty({
    description: 'Percentile based on participants ranked below the user',
    example: 95,
  })
  percentile!: number;

  @ApiProperty({
    description: 'Total number of active participants in the tournament',
    example: 523,
  })
  participantCount!: number;
}
