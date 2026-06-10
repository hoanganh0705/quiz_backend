import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── GET /users/me/attempts/stats ────────────────────────────────────────────

export class AttemptStatsFavoriteCategoryDto {
  @ApiProperty({
    description: 'Category identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category display name', example: 'Science' })
  name!: string;
}

export class AttemptStatsFavoriteTagDto {
  @ApiProperty({
    description: 'Tag identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag display name', example: 'Physics' })
  name!: string;
}

export class UserAttemptStatsResponseDto {
  @ApiProperty({ description: 'Total number of attempts ever started', example: 42 })
  totalAttempts!: number;

  @ApiProperty({ description: 'Number of attempts that reached completed status', example: 35 })
  completedAttempts!: number;

  @ApiProperty({ description: 'Number of attempts that were abandoned', example: 5 })
  abandonedAttempts!: number;

  @ApiProperty({
    description: 'Average score across all completed attempts (0–100)',
    example: 78.5,
  })
  averageScore!: number;

  @ApiProperty({
    description: 'Total time spent across all attempts, in seconds',
    example: 12540,
  })
  totalTimeSpentSeconds!: number;

  @ApiPropertyOptional({
    description: 'Category attempted most frequently. Null if no attempts have been made.',
    type: () => AttemptStatsFavoriteCategoryDto,
    nullable: true,
  })
  favoriteCategory!: AttemptStatsFavoriteCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Tag attempted most frequently. Null if no attempts have been made.',
    type: () => AttemptStatsFavoriteTagDto,
    nullable: true,
  })
  favoriteTag!: AttemptStatsFavoriteTagDto | null;

  @ApiPropertyOptional({
    description: 'Timestamp of the most recent attempt (ISO 8601). Null if no attempts exist.',
    example: '2025-06-05T14:30:00.000Z',
    nullable: true,
  })
  lastAttemptAt!: string | null;
}

// ─── GET /attempts/:attemptId/analytics ──────────────────────────────────────

export class AttemptAnalyticsResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiPropertyOptional({
    description: 'Final score as a percentage (0–100). Null if not yet scored.',
    example: 82.5,
    nullable: true,
  })
  score!: number | null;

  @ApiPropertyOptional({
    description:
      'Accuracy: ratio of correct answers to total questions (0–100). Null when totalQuestions is 0.',
    example: 80.0,
    nullable: true,
  })
  accuracy!: number | null;

  @ApiPropertyOptional({
    description: 'Number of questions answered correctly.',
    example: 16,
    nullable: true,
  })
  correctAnswers!: number | null;

  @ApiPropertyOptional({
    description: 'Number of questions answered incorrectly (answered but wrong).',
    example: 4,
    nullable: true,
  })
  incorrectAnswers!: number | null;

  @ApiProperty({
    description: 'Number of questions that were not answered (skipped or never reached).',
    example: 0,
  })
  unansweredQuestions!: number;

  @ApiPropertyOptional({
    description: 'Total time spent on the attempt in seconds. Null if not recorded.',
    example: 345,
    nullable: true,
  })
  timeSpentSeconds!: number | null;

  @ApiProperty({
    description:
      'Percentile rank among all completed attempts for the same quiz version (0–100). ' +
      'A value of 75 means this attempt scored better than 75% of peers.',
    example: 75.0,
  })
  percentileRank!: number;

  @ApiPropertyOptional({
    description: 'Attempt completion timestamp (ISO 8601). Null if not yet completed.',
    example: '2025-06-01T12:45:00.000Z',
    nullable: true,
  })
  completedAt!: string | null;
}

// ─── GET /attempts/:attemptId/answers ────────────────────────────────────────

export class AttemptAnswerItemDto {
  @ApiProperty({
    description: 'Question identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Selected option identifier (null if the question was skipped)',
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiPropertyOptional({
    description: 'Whether the answer was correct (null until the attempt is completed)',
    nullable: true,
  })
  isCorrect!: boolean | null;

  @ApiProperty({
    description: 'Answer submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  submittedAt!: string;
}

export class AttemptAnswersResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'All answers submitted within this attempt',
    type: () => [AttemptAnswerItemDto],
  })
  answers!: AttemptAnswerItemDto[];
}

export class AttemptAnswerResponseDto {
  @ApiProperty({
    description: 'Unique answer record identifier',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  attemptAnswerId!: string;

  @ApiProperty({
    description: 'Question identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Selected option identifier',
    format: 'uuid',
    nullable: true,
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Answer submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  answeredAt!: string;

  @ApiPropertyOptional({ description: 'Time taken in milliseconds', nullable: true })
  timeTakenMs!: number | null;

  @ApiPropertyOptional({
    description: 'Whether the answer was correct (null if attempt is not yet complete)',
    nullable: true,
  })
  isCorrect!: boolean | null;
}

export class AttemptResponseDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({ description: 'Version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({ description: 'Difficulty level', example: 'medium' })
  difficulty!: string;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600000 })
  durationMs!: number;

  @ApiProperty({ description: 'Passing score percent', example: 70 })
  passingScorePercent!: number;

  @ApiProperty({ description: 'XP reward', example: 100 })
  rewardXp!: number;

  @ApiProperty({ description: 'Context type', example: 'solo' })
  contextType!: string;

  @ApiPropertyOptional({ description: 'Context reference ID', nullable: true })
  contextRefId!: string | null;

  @ApiProperty({ description: 'Attempt status', example: 'started' })
  status!: string;

  @ApiPropertyOptional({
    description: 'Final score as a percentage string (null if not yet complete)',
    nullable: true,
  })
  scorePercent!: string | null;

  @ApiPropertyOptional({
    description: 'Number of correct answers (null if not yet complete)',
    nullable: true,
  })
  correctCount!: number | null;

  @ApiProperty({
    description: 'Attempt start timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  startedAt!: string;

  @ApiPropertyOptional({
    description: 'Completion timestamp (ISO 8601, null if not yet complete)',
    nullable: true,
  })
  finishedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Total time taken in milliseconds (null if not yet complete)',
    nullable: true,
  })
  timeTakenMs!: number | null;

  @ApiProperty({ description: 'Total XP earned from this attempt', example: 100 })
  xpEarned!: number;

  @ApiProperty({ description: 'Individual answer records', type: () => [AttemptAnswerResponseDto] })
  answers!: AttemptAnswerResponseDto[];
}

export class AttemptSummaryResponseDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({ description: 'Version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({ description: 'Difficulty level', example: 'medium' })
  difficulty!: string;

  @ApiProperty({ description: 'Context type', example: 'solo' })
  contextType!: string;

  @ApiProperty({ description: 'Attempt status', example: 'completed' })
  status!: string;

  @ApiPropertyOptional({ description: 'Score percent (null if not yet complete)', nullable: true })
  scorePercent!: string | null;

  @ApiPropertyOptional({
    description: 'Correct answer count (null if not yet complete)',
    nullable: true,
  })
  correctCount!: number | null;

  @ApiProperty({ description: 'Start timestamp (ISO 8601)', example: '2025-06-01T12:00:00.000Z' })
  startedAt!: string;

  @ApiPropertyOptional({ description: 'Completion timestamp (ISO 8601)', nullable: true })
  finishedAt!: string | null;

  @ApiProperty({ description: 'XP earned', example: 100 })
  xpEarned!: number;
}

export class AttemptPaginationResponseDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiPropertyOptional({ description: 'Cursor for next page', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Has more pages', example: true })
  hasNextPage!: boolean;
}

export class AttemptListResponseDto {
  @ApiProperty({ description: 'Attempt summaries', type: () => [AttemptSummaryResponseDto] })
  items!: AttemptSummaryResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: () => AttemptPaginationResponseDto })
  pagination!: AttemptPaginationResponseDto;
}

export class SubmitAnswerResponseDto {
  @ApiProperty({
    description: 'Answer record identifier',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  attemptAnswerId!: string;

  @ApiProperty({
    description: 'Question identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Selected option identifier',
    format: 'uuid',
    nullable: true,
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  answeredAt!: string;

  @ApiPropertyOptional({ description: 'Time taken in ms', nullable: true })
  timeTakenMs!: number | null;

  @ApiPropertyOptional({ description: 'Whether the answer was correct', nullable: true })
  isCorrect!: boolean | null;
}

export class AbandonAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({ description: 'Final status', example: 'abandoned' })
  status!: string;

  @ApiProperty({
    description: 'Abandonment timestamp (ISO 8601)',
    example: '2025-06-01T12:30:00.000Z',
  })
  finishedAt!: string;

  @ApiProperty({ description: 'Status message', example: 'Attempt abandoned. No XP was earned.' })
  message!: string;
}

export class CompleteAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Final status', example: 'completed' })
  status!: string;

  @ApiProperty({ description: 'Final score percent', example: '85.00' })
  scorePercent!: string | null;

  @ApiProperty({ description: 'Correct answer count', example: 17 })
  correctCount!: number | null;

  @ApiPropertyOptional({ description: 'Total time taken in milliseconds', nullable: true })
  timeTakenMs!: number | null;

  @ApiProperty({ description: 'Total XP earned', example: 100 })
  xpEarned!: number;

  @ApiProperty({
    description: 'Completion timestamp (ISO 8601)',
    example: '2025-06-01T12:45:00.000Z',
  })
  finishedAt!: string;
}

export class WithdrawAnswerResponseDto {
  @ApiProperty({ description: 'Question identifier', example: '550e8400-e29b-41d4-a716-446655440001' })
  questionId!: string;

  @ApiProperty({
    description: 'Withdrawal timestamp (ISO 8601)',
    example: '2025-06-01T12:20:00.000Z',
  })
  withdrawnAt!: string;
}
