import { ApiProperty } from '@nestjs/swagger';

/**
 * Per-attempt row shape used by `GET /users/me/quiz-history` and
 * `GET /users/me/quiz-history/export`.
 *
 * Phase 5 (S-29): friendly alias over the raw `AttemptSummaryResponseDto`
 * with a `status` value that matches the frontend `QuizHistoryEntry`
 * shape (`passed | failed | abandoned | in_progress`). The mapping is
 * intentionally simple — score < 60 = failed, score >= 60 = passed,
 * status=abandoned → abandoned, status=started → in_progress — and the
 * editor treats `status` as a presentation enum.
 */
export class QuizHistoryEntryDto {
  @ApiProperty({
    description: 'Attempt identifier (UUID)',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  id!: string;

  @ApiProperty({
    description: 'Quiz identifier (UUID)',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({
    description:
      'Presentation-friendly status. Maps raw attempt status + score into ' + 'the editor UI enum.',
    enum: ['passed', 'failed', 'abandoned', 'in_progress'],
    example: 'passed',
  })
  status!: 'passed' | 'failed' | 'abandoned' | 'in_progress';

  @ApiProperty({
    description: 'Score percent (0–100). Null when the attempt has not been completed.',
    type: Number,
    nullable: true,
    example: 85,
  })
  score!: number | null;

  @ApiProperty({
    description: 'Number of correctly answered questions. Null while in progress.',
    type: Number,
    nullable: true,
    example: 17,
  })
  correctAnswers!: number | null;

  @ApiProperty({
    description: 'Total number of questions in the quiz version',
    example: 20,
  })
  totalQuestions!: number;

  @ApiProperty({
    description: 'Total time taken in seconds (rounded). Null while in progress.',
    type: Number,
    nullable: true,
    example: 540,
  })
  timeTaken!: number | null;

  @ApiProperty({
    description: 'XP earned for this attempt',
    example: 100,
  })
  xpEarned!: number;

  @ApiProperty({
    description:
      'Completion timestamp (ISO 8601). Falls back to start timestamp when ' +
      'the attempt is still in progress.',
    example: '2025-06-01T12:45:00.000Z',
  })
  completedAt!: string;

  @ApiProperty({
    description: 'Difficulty bucket (Easy / Medium / Hard) when known',
    example: 'medium',
    nullable: true,
  })
  difficulty!: string | null;
}

export class QuizHistoryPaginationDto {
  @ApiProperty({ description: 'Items per page', example: 20 })
  limit!: number;

  @ApiProperty({
    description: 'Cursor for the next page',
    type: String,
    nullable: true,
    example:
      'eyJzb3J0VmFsdWUiOiIyMDI1LTA2LTAxVDEyOjQ1OjAwLjAwMFoiLCJhdHRlbXB0SWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwOTkifQ==',
  })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more pages exist', example: true })
  hasNextPage!: boolean;
}

export class QuizHistoryResponseDto {
  @ApiProperty({
    description: 'Quiz history entries (newest first)',
    type: () => [QuizHistoryEntryDto],
  })
  entries!: QuizHistoryEntryDto[];

  @ApiProperty({
    description: 'Cursor pagination metadata',
    type: () => QuizHistoryPaginationDto,
  })
  pagination!: QuizHistoryPaginationDto;
}
