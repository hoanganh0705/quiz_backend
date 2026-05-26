import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  TournamentDifficulty,
  TournamentStatus,
  TournamentRoundStatus,
} from '../../types/tournament.types';

export class TournamentRoundResponseDto {
  @ApiProperty({ description: 'Round identifier', example: '550e8400-e29b-41d4-a716-446655440001' })
  roundId!: string;

  @ApiProperty({
    description: 'Parent tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Round number (1-based)', example: 1 })
  roundNumber!: number;

  @ApiProperty({ description: 'Round name', example: 'Quarter Finals' })
  name!: string;

  @ApiPropertyOptional({ description: 'Round description', nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Quiz version used in this round',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiPropertyOptional({ description: 'Scheduled start timestamp (ISO 8601)', nullable: true })
  startAt!: string | null;

  @ApiPropertyOptional({ description: 'Scheduled end timestamp (ISO 8601)', nullable: true })
  endAt!: string | null;

  @ApiPropertyOptional({ description: 'Round duration in milliseconds', nullable: true })
  durationMs!: number | null;

  @ApiProperty({
    description: 'Round status',
    enum: ['pending', 'open', 'running', 'finished'],
    example: 'pending',
  })
  status!: TournamentRoundStatus;

  @ApiProperty({ description: 'Whether incorrect answers result in elimination', example: true })
  isElimination!: boolean;

  @ApiPropertyOptional({ description: 'Maximum participants in this round', nullable: true })
  participantLimit!: number | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

export class TournamentResponseDto {
  @ApiProperty({
    description: 'Unique tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'Tournament title', example: 'Weekly Trivia Challenge' })
  title!: string;

  @ApiPropertyOptional({ description: 'Tournament description', nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Difficulty level',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: TournamentDifficulty;

  @ApiProperty({
    description: 'Lifecycle status',
    enum: ['upcoming', 'registration', 'ongoing', 'finished', 'cancelled'],
    example: 'registration',
  })
  status!: TournamentStatus;

  @ApiPropertyOptional({ description: 'Prize description', nullable: true })
  prize!: string | null;

  @ApiProperty({ description: 'Start timestamp (ISO 8601)', example: '2025-07-01T10:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ description: 'End timestamp (ISO 8601)', example: '2025-07-01T12:00:00.000Z' })
  endAt!: string;

  @ApiPropertyOptional({ description: 'Maximum participants', nullable: true })
  maxParticipants!: number | null;

  @ApiPropertyOptional({ description: 'Associated category identifier', nullable: true })
  categoryId!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

export class TournamentDetailResponseDto extends TournamentResponseDto {
  @ApiPropertyOptional({ description: 'Associated category name', nullable: true })
  categoryName!: string | null;

  @ApiPropertyOptional({ description: 'Associated category slug', nullable: true })
  categorySlug!: string | null;

  @ApiProperty({ description: 'Number of registered participants', example: 47 })
  totalParticipants!: number;

  @ApiProperty({ description: 'Tournament rounds', type: () => [TournamentRoundResponseDto] })
  rounds!: TournamentRoundResponseDto[];
}

export class TournamentPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({ description: 'Cursor for next page', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: true })
  hasNextPage!: boolean;
}

export class TournamentListResponseDto {
  @ApiProperty({ description: 'Tournament items', type: () => [TournamentResponseDto] })
  items!: TournamentResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => TournamentPaginationResponseDto })
  pagination!: TournamentPaginationResponseDto;
}

export class TournamentParticipantResponseDto {
  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({
    description: 'Registration timestamp (ISO 8601)',
    example: '2025-06-15T08:00:00.000Z',
  })
  registeredAt!: string;

  @ApiProperty({ description: 'Total score accumulated', example: 8500 })
  totalScore!: number;

  @ApiProperty({ description: 'Total time spent in milliseconds', example: 3600000 })
  totalTimeMs!: number;

  @ApiPropertyOptional({
    description: 'Final rank (null if tournament not yet finished)',
    nullable: true,
  })
  rankFinal!: number | null;

  @ApiProperty({ description: 'Participant status', example: 'active' })
  status!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-07-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

export class TournamentLeaderboardEntryDto {
  @ApiProperty({ description: 'Current rank', example: 1 })
  rank!: number;

  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Username', example: 'alice_wonder' })
  username!: string;

  @ApiPropertyOptional({ description: 'Display name', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ description: 'Avatar image URL', format: 'uri', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Total accumulated score', example: 8500 })
  totalScore!: number;

  @ApiProperty({ description: 'Total time in milliseconds', example: 3600000 })
  totalTimeMs!: number;

  @ApiPropertyOptional({ description: 'Final rank (null if not yet decided)', nullable: true })
  rankFinal!: number | null;

  @ApiProperty({ description: 'Participant status', example: 'active' })
  status!: string;
}

export class TournamentLeaderboardResponseDto {
  @ApiProperty({
    description: 'Leaderboard entries sorted by rank',
    type: () => [TournamentLeaderboardEntryDto],
  })
  items!: TournamentLeaderboardEntryDto[];
}

export class RegisterTournamentResponseDto {
  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({
    description: 'Tournament identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  tournamentId!: string;

  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({
    description: 'Registration timestamp (ISO 8601)',
    example: '2025-06-15T08:00:00.000Z',
  })
  registeredAt!: string;

  @ApiProperty({
    description: 'Registration result message',
    example: 'Successfully registered for the tournament.',
  })
  message!: string;
}

export class StartTournamentAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier for the tournament round',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Quiz version identifier for this round',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Participant record identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  participantId!: string;

  @ApiProperty({ description: 'Attempt start message', example: 'Round started. Good luck!' })
  message!: string;
}
