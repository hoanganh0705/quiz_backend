import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';

/**
 * Phase 3 (S-14): a single row in the daily-challenge history.
 * Mirrors the public DTO with `score` (best-score percentage) and
 * `rank` (1-indexed global rank) instead of the lifecycle status
 * (the history is always finalised — every row has been scored).
 */
export class DailyChallengeHistoryItemDto {
  @ApiProperty({
    description: 'Challenge date (ISO 8601, midnight UTC)',
    example: '2026-08-09T00:00:00.000Z',
  })
  date!: string;

  @ApiProperty({
    description: 'Quiz identifier for the day',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title rendered on the history row',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Quiz slug for deep-linking',
    example: 'javascript-fundamentals',
  })
  slug!: string;

  @ApiProperty({
    description: 'Difficulty surfaced on the history row',
    example: 'medium',
    enum: ['easy', 'medium', 'hard'],
  })
  difficulty!: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    description: 'Best-score percentage the user achieved on the day (0–100)',
    example: 92.5,
  })
  score!: number;

  @ApiProperty({
    description: '1-indexed global rank the user achieved on the day',
    example: 7,
  })
  rank!: number;
}

export class DailyChallengeHistoryResponseDto {
  @ApiProperty({
    description: 'History rows, newest first',
    type: () => [DailyChallengeHistoryItemDto],
  })
  items!: DailyChallengeHistoryItemDto[];

  @ApiProperty({ description: 'Cursor pagination metadata', type: () => CursorPagination })
  pagination!: CursorPagination;
}

/**
 * Phase 3 (S-14): one row in the day's leaderboard. The leaderboard
 * is anonymous outside the user's own row — names of other players
 * are not exposed in this Phase 3 scope.
 */
export class DailyChallengeLeaderboardEntryDto {
  @ApiProperty({
    description: '1-indexed rank within the period',
    example: 1,
  })
  rank!: number;

  @ApiProperty({
    description: 'User identifier for the row',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({ description: 'Username for the row', example: 'alice_wonder' })
  username!: string;

  @ApiProperty({ description: 'Display name', example: 'Alice', nullable: true })
  displayName!: string | null;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Best score percentage in the period (0–100)',
    example: 98.4,
  })
  scorePercent!: number;
}

export class DailyChallengeLeaderboardResponseDto {
  @ApiProperty({
    description: 'Aggregation period',
    enum: ['daily', 'weekly', 'monthly'],
    example: 'daily',
  })
  period!: 'daily' | 'weekly' | 'monthly';

  @ApiProperty({
    description: 'Leaderboard rows',
    type: () => [DailyChallengeLeaderboardEntryDto],
  })
  entries!: DailyChallengeLeaderboardEntryDto[];
}

/**
 * Phase 3 (S-14): response for `POST /daily-challenge/answer`. The
 * caller submits one answer at a time and the server returns the
 * correctness signal, the next question index, and a `completed`
 * flag — the client drives the playthrough by calling this endpoint
 * once per question.
 */
export class DailyChallengeAnswerResponseDto {
  @ApiProperty({ description: 'Whether the submitted answer is correct', example: true })
  correct!: boolean;

  @ApiProperty({
    description: '0-indexed position of the next question; equals `totalQuestions` when complete',
    example: 3,
  })
  nextQuestionIndex!: number;

  @ApiProperty({ description: 'Total questions in the day', example: 12 })
  totalQuestions!: number;

  @ApiProperty({ description: 'Whether the attempt is now complete', example: false })
  completed!: boolean;

  @ApiProperty({
    description: 'Final score percentage (only set when `completed === true`)',
    example: 91.6,
    nullable: true,
  })
  scorePercent!: number | null;
}
