import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TOURNAMENT_PARTICIPANT_STATUSES } from '../../types/tournament.types';

export class TournamentLeaderboardEntryDto {
  @ApiProperty({ description: 'Current rank', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Total accumulated score', example: 8500 })
  totalScore!: number;

  @ApiProperty({ description: 'Total time in milliseconds', example: 3_600_000 })
  totalTimeMs!: number;

  @ApiPropertyOptional({
    description: 'Final rank (null if not yet decided)',
    type: Number,
    example: 1,
    nullable: true,
  })
  rankFinal!: number | null;

  @ApiProperty({
    description: 'Participant status',
    enum: TOURNAMENT_PARTICIPANT_STATUSES,
    example: 'active',
  })
  status!: string;
}

// Issue #28: Added pagination metadata to leaderboard response.
export class TournamentLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [TournamentLeaderboardEntryDto],
  })
  items!: TournamentLeaderboardEntryDto[];

  @ApiProperty({
    description: 'Total number of participants in the leaderboard',
    example: 1523,
  })
  total!: number;

  @ApiProperty({
    description: 'Number of entries returned in this page',
    example: 50,
  })
  limit!: number;

  @ApiProperty({
    description: 'Number of entries skipped (offset)',
    example: 0,
  })
  offset!: number;

  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
  })
  page!: number;
}
