import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
