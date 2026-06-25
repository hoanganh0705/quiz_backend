import { ApiProperty } from '@nestjs/swagger';

// ─── Attempt module documentation-only wrapper DTOs ───────────────────────────────
//
// ResponseFormatInterceptor wraps all responses as:
//   { data: <payload>, meta: { timestamp } }
//
// For paginated responses (when payload has { items, pagination }), it transforms to:
//   { data: <items[]>, meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
//
// Runtime DTO classes (AttemptResponseDto, AttemptListResponseDto, etc.) remain unchanged.
// These wrapper DTOs are used ONLY in @ApiOkResponse / @ApiCreatedResponse decorators
// to document the actual wrapped shape in the OpenAPI spec.
//

// ─── Nested data types ─────────────────────────────────────────────────────────

class AttemptAnswerDataDto {
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

  @ApiProperty({
    description: 'Selected option identifier',
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  answeredAt!: string;

  @ApiProperty({
    description: 'Time taken in ms',
    type: Number,
    nullable: true,
  })
  timeTakenMs!: number | null;

  @ApiProperty({
    description: 'Whether the answer was correct',
    type: Boolean,
    nullable: true,
  })
  isCorrect!: boolean | null;
}

class AttemptDataDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'User identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Quiz slug',
    example: 'javascript-fundamentals',
  })
  quizSlug!: string;

  @ApiProperty({
    description: 'Version number',
    example: 1,
  })
  versionNumber!: number;

  @ApiProperty({
    description: 'Difficulty level',
    example: 'medium',
  })
  difficulty!: string;

  @ApiProperty({
    description: 'Time limit in milliseconds',
    example: 600000,
  })
  durationMs!: number;

  @ApiProperty({
    description: 'Passing score percent',
    example: 70,
  })
  passingScorePercent!: number;

  @ApiProperty({
    description: 'XP reward',
    example: 100,
  })
  rewardXp!: number;

  @ApiProperty({
    description: 'Context type',
    example: 'solo',
  })
  contextType!: string;

  @ApiProperty({
    description: 'Context reference ID',
    type: String,
    nullable: true,
  })
  contextRefId!: string | null;

  @ApiProperty({
    description: 'Attempt status',
    example: 'started',
  })
  status!: string;

  @ApiProperty({
    description: 'Final score as a percentage string (null if not yet complete)',
    type: String,
    nullable: true,
  })
  scorePercent!: string | null;

  @ApiProperty({
    description: 'Number of correct answers (null if not yet complete)',
    type: Number,
    nullable: true,
  })
  correctCount!: number | null;

  @ApiProperty({
    description: 'Attempt start timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  startedAt!: string;

  @ApiProperty({
    description: 'Completion timestamp (ISO 8601, null if not yet complete)',
    type: String,
    nullable: true,
  })
  finishedAt!: string | null;

  @ApiProperty({
    description: 'Total time taken in milliseconds (null if not yet complete)',
    type: Number,
    nullable: true,
  })
  timeTakenMs!: number | null;

  @ApiProperty({
    description: 'Total XP earned from this attempt',
    example: 100,
  })
  xpEarned!: number;

  @ApiProperty({
    description: 'Individual answer records',
    type: [AttemptAnswerDataDto],
  })
  answers!: AttemptAnswerDataDto[];
}

class SubmitAnswerDataDto {
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

  @ApiProperty({
    description: 'Selected option identifier',
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  answeredAt!: string;

  @ApiProperty({
    description: 'Time taken in ms',
    type: Number,
    nullable: true,
  })
  timeTakenMs!: number | null;

  @ApiProperty({
    description: 'Whether the answer was correct',
    type: Boolean,
    nullable: true,
  })
  isCorrect!: boolean | null;
}

class WithdrawAnswerDataDto {
  @ApiProperty({
    description: 'Question identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiProperty({
    description: 'Withdrawal timestamp (ISO 8601)',
    example: '2025-06-01T12:20:00.000Z',
  })
  withdrawnAt!: string;
}

class AbandonAttemptDataDto {
  @ApiProperty({
    description: 'Attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Final status',
    example: 'abandoned',
  })
  status!: string;

  @ApiProperty({
    description: 'Abandonment timestamp (ISO 8601)',
    example: '2025-06-01T12:30:00.000Z',
  })
  finishedAt!: string;

  @ApiProperty({
    description: 'Status message',
    example: 'Attempt abandoned. No XP was earned.',
  })
  message!: string;
}

class CompleteAttemptDataDto {
  @ApiProperty({
    description: 'Attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Final status',
    example: 'completed',
  })
  status!: string;

  @ApiProperty({
    description: 'Final score percent',
    type: String,
    nullable: true,
    example: '85.00',
  })
  scorePercent!: string | null;

  @ApiProperty({
    description: 'Correct answer count',
    type: Number,
    nullable: true,
    example: 17,
  })
  correctCount!: number | null;

  @ApiProperty({
    description: 'Total time taken in milliseconds',
    type: Number,
    nullable: true,
  })
  timeTakenMs!: number | null;

  @ApiProperty({
    description: 'Total XP earned',
    example: 100,
  })
  xpEarned!: number;

  @ApiProperty({
    description: 'Completion timestamp (ISO 8601)',
    example: '2025-06-01T12:45:00.000Z',
  })
  finishedAt!: string;
}

class AttemptAnswerItemDataDto {
  @ApiProperty({
    description: 'Question identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiProperty({
    description: 'Selected option identifier (null if the question was skipped)',
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Whether the answer was correct (null until the attempt is completed)',
    type: Boolean,
    nullable: true,
  })
  isCorrect!: boolean | null;

  @ApiProperty({
    description: 'Answer submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  submittedAt!: string;
}

class AttemptAnswersDataDto {
  @ApiProperty({
    description: 'Attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'All answers submitted within this attempt',
    type: [AttemptAnswerItemDataDto],
  })
  answers!: AttemptAnswerItemDataDto[];
}

class AttemptAnalyticsDataDto {
  @ApiProperty({
    description: 'Attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Final score as a percentage (0–100). Null if not yet scored.',
    type: Number,
    nullable: true,
    example: 82.5,
  })
  score!: number | null;

  @ApiProperty({
    description:
      'Accuracy: ratio of correct answers to total questions (0–100). Null when totalQuestions is 0.',
    type: Number,
    nullable: true,
    example: 80.0,
  })
  accuracy!: number | null;

  @ApiProperty({
    description: 'Number of questions answered correctly.',
    type: Number,
    nullable: true,
    example: 16,
  })
  correctAnswers!: number | null;

  @ApiProperty({
    description: 'Number of questions answered incorrectly (answered but wrong).',
    type: Number,
    nullable: true,
    example: 4,
  })
  incorrectAnswers!: number | null;

  @ApiProperty({
    description: 'Number of questions that were not answered (skipped or never reached).',
    example: 0,
  })
  unansweredQuestions!: number;

  @ApiProperty({
    description: 'Total time spent on the attempt in seconds. Null if not recorded.',
    type: Number,
    nullable: true,
    example: 345,
  })
  timeSpentSeconds!: number | null;

  @ApiProperty({
    description: 'Percentile rank among all completed attempts for the same quiz version (0–100).',
    example: 75.0,
  })
  percentileRank!: number;

  @ApiProperty({
    description: 'Attempt completion timestamp (ISO 8601). Null if not yet completed.',
    type: String,
    nullable: true,
    example: '2025-06-01T12:45:00.000Z',
  })
  completedAt!: string | null;
}

class AttemptStatsFavoriteCategoryDataDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category display name',
    example: 'Science',
  })
  name!: string;
}

class AttemptStatsFavoriteTagDataDto {
  @ApiProperty({
    description: 'Tag identifier',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  tagId!: string;

  @ApiProperty({
    description: 'Tag display name',
    example: 'Physics',
  })
  name!: string;
}

class UserStatsDataDto {
  @ApiProperty({
    description: 'Total number of attempts ever started',
    example: 42,
  })
  totalAttempts!: number;

  @ApiProperty({
    description: 'Number of attempts that reached completed status',
    example: 35,
  })
  completedAttempts!: number;

  @ApiProperty({
    description: 'Number of attempts that were abandoned',
    example: 5,
  })
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

  @ApiProperty({
    description: 'Category attempted most frequently. Null if no attempts have been made.',
    nullable: true,
  })
  favoriteCategory!: AttemptStatsFavoriteCategoryDataDto | null;

  @ApiProperty({
    description: 'Tag attempted most frequently. Null if no attempts have been made.',
    nullable: true,
  })
  favoriteTag!: AttemptStatsFavoriteTagDataDto | null;

  @ApiProperty({
    description: 'Timestamp of the most recent attempt (ISO 8601). Null if no attempts exist.',
    type: String,
    nullable: true,
    example: '2025-06-05T14:30:00.000Z',
  })
  lastAttemptAt!: string | null;
}

class AttemptSummaryDataDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({
    description: 'Quiz title',
    example: 'JavaScript Fundamentals',
  })
  quizTitle!: string;

  @ApiProperty({
    description: 'Quiz slug',
    example: 'javascript-fundamentals',
  })
  quizSlug!: string;

  @ApiProperty({
    description: 'Version number',
    example: 1,
  })
  versionNumber!: number;

  @ApiProperty({
    description: 'Difficulty level',
    example: 'medium',
  })
  difficulty!: string;

  @ApiProperty({
    description: 'Context type',
    example: 'solo',
  })
  contextType!: string;

  @ApiProperty({
    description: 'Attempt status',
    example: 'completed',
  })
  status!: string;

  @ApiProperty({
    description: 'Score percent (null if not yet complete)',
    type: String,
    nullable: true,
  })
  scorePercent!: string | null;

  @ApiProperty({
    description: 'Correct answer count (null if not yet complete)',
    type: Number,
    nullable: true,
  })
  correctCount!: number | null;

  @ApiProperty({
    description: 'Start timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  startedAt!: string;

  @ApiProperty({
    description: 'Completion timestamp (ISO 8601)',
    type: String,
    nullable: true,
  })
  finishedAt!: string | null;

  @ApiProperty({
    description: 'XP earned',
    example: 100,
  })
  xpEarned!: number;
}

// ─── Meta types ────────────────────────────────────────────────────────────────

class MetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;
}

class PaginationMetaDataDto {
  @ApiProperty({
    description: 'Number of items returned in this page',
    example: 20,
  })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for fetching the next page. `null` when there is no next page.',
    type: String,
    nullable: true,
  })
  nextCursor!: string | null;

  @ApiProperty({
    description: 'Whether more items exist after this page',
    example: true,
  })
  hasNextPage!: boolean;
}

class PaginatedMetaDto {
  @ApiProperty({
    description: 'ISO 8601 timestamp of when the response was generated',
    example: '2026-06-25T10:30:00.000Z',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Cursor-based pagination metadata',
    type: () => PaginationMetaDataDto,
  })
  pagination!: PaginationMetaDataDto;
}

// ─── Wrapper DTOs (top-level envelope) ────────────────────────────────────────

export class AttemptWrappedAttemptDto {
  @ApiProperty({
    description: 'Wrapped attempt details',
    type: AttemptDataDto,
  })
  data!: AttemptDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedSubmitAnswerDto {
  @ApiProperty({
    description: 'Wrapped answer submission details',
    type: SubmitAnswerDataDto,
  })
  data!: SubmitAnswerDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedWithdrawAnswerDto {
  @ApiProperty({
    description: 'Wrapped withdrawal details',
    type: WithdrawAnswerDataDto,
  })
  data!: WithdrawAnswerDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedAbandonAttemptDto {
  @ApiProperty({
    description: 'Wrapped abandon result',
    type: AbandonAttemptDataDto,
  })
  data!: AbandonAttemptDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedCompleteAttemptDto {
  @ApiProperty({
    description: 'Wrapped completion result',
    type: CompleteAttemptDataDto,
  })
  data!: CompleteAttemptDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedAnswersDto {
  @ApiProperty({
    description: 'Wrapped attempt answers',
    type: AttemptAnswersDataDto,
  })
  data!: AttemptAnswersDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedAnalyticsDto {
  @ApiProperty({
    description: 'Wrapped attempt analytics',
    type: AttemptAnalyticsDataDto,
  })
  data!: AttemptAnalyticsDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

export class AttemptWrappedUserStatsDto {
  @ApiProperty({
    description: 'Wrapped user attempt statistics',
    type: UserStatsDataDto,
  })
  data!: UserStatsDataDto;

  @ApiProperty({
    description: 'Response metadata',
    type: MetaDto,
  })
  meta!: MetaDto;
}

/**
 * Runtime shape for paginated attempt lists:
 * { data: AttemptSummaryDataDto[], meta: { timestamp, pagination: { limit, nextCursor, hasNextPage } } }
 */
export class AttemptWrappedListDto {
  @ApiProperty({
    description: 'Paginated attempt items',
    type: [AttemptSummaryDataDto],
  })
  data!: AttemptSummaryDataDto[];

  @ApiProperty({
    description: 'Response metadata with pagination',
    type: PaginatedMetaDto,
  })
  meta!: PaginatedMetaDto;
}
