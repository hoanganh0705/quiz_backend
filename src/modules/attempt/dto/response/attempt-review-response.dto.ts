import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Answer option as it appears in the post-attempt review. Uses the author
 * DTO shape (with `isCorrect` populated) because the review endpoint is
 * the explicit "reveal correct answers" surface — only the attempt's owner
 * (or admin) sees it, only after the attempt is completed.
 *
 * For player-facing question surfaces, the quiz module exposes
 * `QuizAnswerOptionPlayerDto` (no `isCorrect`).
 */
export class AttemptReviewAnswerOptionDto {
  @ApiProperty({
    description: 'Unique answer option identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  optionId!: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  position!: number;

  @ApiProperty({ description: 'Answer text', example: 'console.log' })
  value!: string;

  @ApiProperty({ description: 'Whether this is the correct answer', example: true })
  isCorrect!: boolean;
}

/**
 * Per-question debrief for a completed attempt.
 *
 * Extensibility:
 *   - `explanation`  → reserved for future per-question rationale text (null today).
 *   - `topicTags`    → reserved for future per-question topic tags (null today).
 *   - `difficulty`   → reserved for future per-question difficulty (null today).
 *   These are nullable and additive — populating them later is non-breaking.
 */
export class AttemptReviewQuestionDto {
  @ApiProperty({
    description: 'Question identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440001',
  })
  questionId!: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  position!: number;

  @ApiProperty({
    description: 'Question text',
    example: 'What does `console.log` do in JavaScript?',
  })
  questionText!: string;

  @ApiPropertyOptional({
    description: 'Optional image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description:
      'Identifier of the option the user selected, or null if the user skipped the question',
    type: String,
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-71d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Whether the user answered this question correctly',
    nullable: true,
    example: true,
  })
  isCorrect!: boolean | null;

  @ApiPropertyOptional({
    description: 'Time taken to answer this question in milliseconds',
    type: Number,
    nullable: true,
    example: 15000,
  })
  timeTakenMs!: number | null;

  @ApiProperty({
    description: 'Submission timestamp for this question (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  answeredAt!: string;

  @ApiProperty({
    description:
      'All answer options for this question, each with an `isCorrect` flag. ' +
      'This is the post-completion answer-key reveal — the only place a player ' +
      'sees `isCorrect: true` for an option they did not select.',
    type: [AttemptReviewAnswerOptionDto],
  })
  answerOptions!: AttemptReviewAnswerOptionDto[];

  @ApiPropertyOptional({
    description:
      'Optional explanation/rationale for the correct answer (reserved for future use; null today)',
    type: String,
    nullable: true,
    example: null,
  })
  explanation!: string | null;

  @ApiPropertyOptional({
    description: 'Optional topic tags for this question (reserved for future use; null today)',
    type: [String],
    nullable: true,
    example: null,
  })
  topicTags!: string[] | null;

  @ApiPropertyOptional({
    description: 'Optional per-question difficulty (reserved for future use; null today)',
    type: Number,
    nullable: true,
    example: null,
  })
  difficulty!: number | null;
}

export class AttemptReviewResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'Attempt status (always "completed" for this endpoint)',
    example: 'completed',
    enum: ['completed'],
  })
  status!: 'completed';

  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'JavaScript Fundamentals' })
  quizTitle!: string;

  @ApiProperty({ description: 'Quiz slug', example: 'javascript-fundamentals' })
  quizSlug!: string;

  @ApiProperty({ description: 'Quiz version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({ description: 'Difficulty level', example: 'medium' })
  difficulty!: string;

  @ApiProperty({ description: 'Passing score percent', example: 70 })
  passingScorePercent!: number;

  @ApiPropertyOptional({
    description: 'Final score as a percentage (0–100). Null if not yet scored.',
    type: Number,
    nullable: true,
    example: 82.5,
  })
  scorePercent!: number | null;

  @ApiPropertyOptional({
    description: 'Number of questions answered correctly.',
    type: Number,
    nullable: true,
    example: 16,
  })
  correctCount!: number | null;

  @ApiProperty({
    description: 'Total number of questions in this quiz version',
    example: 20,
  })
  totalQuestions!: number;

  @ApiPropertyOptional({
    description: 'Total time spent on the attempt in milliseconds',
    type: Number,
    nullable: true,
    example: 2700000,
  })
  timeTakenMs!: number | null;

  @ApiProperty({ description: 'Total XP earned from this attempt', example: 100 })
  xpEarned!: number;

  @ApiProperty({
    description: 'Attempt completion timestamp (ISO 8601)',
    example: '2025-06-01T12:45:00.000Z',
  })
  finishedAt!: string;

  @ApiProperty({
    description:
      "Per-question debrief. Each item includes the user's answer, correctness, " +
      'all options with the correct one flagged, and extensibility hooks for ' +
      'future per-question metadata (explanation, topic tags, difficulty).',
    type: [AttemptReviewQuestionDto],
  })
  questions!: AttemptReviewQuestionDto[];
}
