import { ApiProperty } from '@nestjs/swagger';
import { CursorPagination } from '@/common/responses/pagination';

/**
 * A single row in the daily-challenge history. Mirrors the public DTO with
 * `score` (best-score percentage) and `rank` (1-indexed global rank) instead
 * of the lifecycle status (the history is always finalised — every row has
 * been scored).
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
 * One row in the day's leaderboard. The leaderboard is anonymous outside
 * the user's own row — names of other players are not exposed.
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
 * Response for `POST /daily-challenge/answer`. The caller submits one
 * answer at a time and the server returns the correctness signal, the
 * next question index, and a `completed` flag — the client drives the
 * playthrough by calling this endpoint once per question.
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

/**
 * One row in the per-category distribution for the viewer's
 * daily-challenge attempts.
 *
 * The shape is intentionally rollup-level — we surface the user's
 * aggregate accuracy per category, NOT a per-question breakdown.
 * The server already persists `dailyChallengeAttempt.scorePercent`
 * (0–100, set on completion), so the breakdown is a single
 * SQL aggregate (see `DailyChallengeRepository.getCategoryBreakdown`).
 *
 * `averageScorePercent` is the arithmetic mean of every completed
 * attempt's `score_percent` for the category; for the public pie
 * chart it can be rendered as a "share of total correct answers".
 */
export class DailyChallengeCategoryBreakdownItemDto {
  @ApiProperty({
    description: 'Category identifier (UUIDv7)',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  categoryName!: string;

  @ApiProperty({
    description: 'Category slug (kebab-case, URL-safe)',
    example: 'science',
  })
  categorySlug!: string;

  @ApiProperty({
    description: 'Number of completed daily-challenge attempts in this category',
    example: 3,
  })
  attemptCount!: number;

  @ApiProperty({
    description:
      'Mean of `scorePercent` across attempts in this category (0–100, rounded to 2 decimals)',
    example: 78.33,
  })
  averageScorePercent!: number;
}

export class DailyChallengeCategoryBreakdownResponseDto {
  @ApiProperty({
    description: 'Per-category performance rollup, ordered by attempt count desc',
    type: () => [DailyChallengeCategoryBreakdownItemDto],
  })
  items!: DailyChallengeCategoryBreakdownItemDto[];
}
