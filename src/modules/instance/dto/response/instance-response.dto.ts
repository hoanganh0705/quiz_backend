import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { QuizDifficulty } from '@/modules/quiz/types/quiz.types';

export class InstancePlayerResponseDto {
  @ApiProperty({
    description: 'Instance player record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  instancePlayerId!: string;

  @ApiProperty({
    description: 'Parent instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Player user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Player username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({ description: 'Player display name', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ description: 'Player avatar URL', format: 'uri', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Player status in the instance', example: 'joined' })
  status!: string;

  @ApiPropertyOptional({
    description: 'Attempt identifier if player has started',
    format: 'uuid',
    nullable: true,
  })
  attemptId!: string | null;

  @ApiProperty({ description: 'Join timestamp (ISO 8601)', example: '2025-06-01T12:00:00.000Z' })
  joinedAt!: string;
}

export class InstanceDetailResponseDto {
  @ApiProperty({
    description: 'Unique instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Quiz version hosted in this instance',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Host user identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  hostUserId!: string;

  @ApiProperty({ description: 'Host username', example: 'alice_wonder' })
  hostUsername!: string;

  @ApiPropertyOptional({ description: 'Host display name', nullable: true })
  hostDisplayName!: string | null;

  @ApiPropertyOptional({
    description: 'Maximum player capacity (null = unlimited)',
    nullable: true,
  })
  maxPlayers!: number | null;

  @ApiProperty({ description: 'Instance lifecycle status', example: 'waiting' })
  status!: string;

  @ApiProperty({ description: 'Quiz version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({
    description: 'Quiz difficulty',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600000 })
  durationMs!: number;

  @ApiProperty({ description: 'Passing score percent', example: 70 })
  passingScorePercent!: number;

  @ApiProperty({ description: 'XP reward for completing', example: 100 })
  rewardXp!: number;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440099',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({
    description: 'Instance creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({ description: 'Start timestamp (ISO 8601)', nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ description: 'Close timestamp (ISO 8601)', nullable: true })
  closedAt!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Players currently in the instance',
    type: () => [InstancePlayerResponseDto],
  })
  players!: InstancePlayerResponseDto[];
}

export class CreateInstanceResponseDto {
  @ApiProperty({
    description: 'New instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Instance creation result',
    example: 'Instance created successfully',
  })
  message!: string;
}

export class JoinInstanceResponseDto {
  @ApiProperty({ description: 'Join result', example: 'Successfully joined the instance' })
  message!: string;
}

export class StartInstanceResponseDto {
  @ApiProperty({ description: 'Start result', example: 'Instance started. Players can now begin.' })
  message!: string;
}

export class CloseInstanceResponseDto {
  @ApiProperty({ description: 'Close result', example: 'Instance closed' })
  message!: string;
}

export class InstanceLeaderboardEntryDto {
  @ApiProperty({ description: 'Rank position', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'Instance player record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  instancePlayerId!: string;

  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({ description: 'Display name', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ description: 'Avatar URL', format: 'uri', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Player status', example: 'finished' })
  status!: string;

  @ApiPropertyOptional({ description: 'Score percent', nullable: true })
  scorePercent!: number | null;

  @ApiPropertyOptional({ description: 'Correct answer count', nullable: true })
  correctCount!: number | null;

  @ApiPropertyOptional({ description: 'Total time in milliseconds', nullable: true })
  timeTakenMs!: number | null;
}

export class InstanceLeaderboardResponseDto {
  @ApiProperty({
    description: 'Parent instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [InstanceLeaderboardEntryDto],
  })
  items!: InstanceLeaderboardEntryDto[];

  @ApiProperty({ description: 'Whether more entries exist beyond this page', example: true })
  hasNextPage!: boolean;

  @ApiPropertyOptional({
    description: 'Base64-encoded cursor for fetching the next page. Null when no more pages.',
    nullable: true,
  })
  nextCursor!: string | null;
}

// ---------------------------------------------------------------------------
// List / discovery DTOs
// ---------------------------------------------------------------------------

export class InstanceListItemDto {
  @ApiProperty({
    description: 'Instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({
    description: 'Quiz version identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({ description: 'Host user identifier', example: '770e8400-e29b-41d4-a716-446655440000' })
  hostUserId!: string;

  @ApiProperty({ description: 'Host username', example: 'alice_wonder' })
  hostUsername!: string;

  @ApiPropertyOptional({ description: 'Host display name', nullable: true })
  hostDisplayName!: string | null;

  @ApiPropertyOptional({ description: 'Maximum player capacity (null = unlimited)', nullable: true })
  maxPlayers!: number | null;

  @ApiProperty({ description: 'Instance lifecycle status', example: 'open' })
  status!: string;

  @ApiProperty({
    description: 'Quiz difficulty',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600000 })
  durationMs!: number;

  @ApiProperty({ description: 'Parent quiz identifier', example: '660e8400-e29b-41d4-a716-446655440099' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({
    description: 'Number of players currently in the instance',
    example: 5,
  })
  playerCount!: number;

  @ApiProperty({
    description: 'Instance creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;
}

export class InstanceListPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({ description: 'Cursor for next page', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: true })
  hasNextPage!: boolean;
}

export class InstanceListResponseDto {
  @ApiProperty({ description: 'Instance items', type: () => [InstanceListItemDto] })
  items!: InstanceListItemDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => InstanceListPaginationDto })
  pagination!: InstanceListPaginationDto;
}

// ---------------------------------------------------------------------------
// Players endpoint DTOs
// ---------------------------------------------------------------------------

export class InstancePlayersResponseDto {
  @ApiProperty({
    description: 'Parent instance identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  instanceId!: string;

  @ApiProperty({ description: 'Players in the instance', type: () => [InstancePlayerResponseDto] })
  items!: InstancePlayerResponseDto[];

  @ApiProperty({ description: 'Total number of players', example: 8 })
  total!: number;
}
