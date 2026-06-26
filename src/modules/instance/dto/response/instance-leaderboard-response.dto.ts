import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  INSTANCE_PLAYER_STATUSES,
  type QuizInstancePlayerStatus,
} from '../../types/instance.types';

export class InstanceLeaderboardEntryDto {
  @ApiProperty({ description: 'Rank position', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'Instance player record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  instancePlayerId!: string;

  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({
    description: 'Display name',
    type: String,
    example: 'Alice Wonder',
    nullable: true,
  })
  displayName!: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    type: String,
    format: 'uri',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Player status',
    enum: INSTANCE_PLAYER_STATUSES,
    example: 'finished',
  })
  status!: QuizInstancePlayerStatus;

  @ApiPropertyOptional({
    description: 'Score percent',
    type: Number,
    example: 85,
    nullable: true,
  })
  scorePercent!: number | null;

  @ApiPropertyOptional({
    description: 'Correct answer count',
    type: Number,
    example: 17,
    nullable: true,
  })
  correctCount!: number | null;

  @ApiPropertyOptional({
    description: 'Total time in milliseconds',
    type: Number,
    example: 450_000,
    nullable: true,
  })
  timeTakenMs!: number | null;
}

export class InstanceLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [InstanceLeaderboardEntryDto],
  })
  items!: InstanceLeaderboardEntryDto[];

  @ApiProperty({ description: 'Whether more entries exist beyond this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Base64-encoded cursor for fetching the next page. Null when no more pages.',
    type: String,
    example:
      'eyJyYW5rIjI0LCJpbnN0YW5jZVBsYXllcklkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDk5In0',
    nullable: true,
  })
  nextCursor!: string | null;
}
