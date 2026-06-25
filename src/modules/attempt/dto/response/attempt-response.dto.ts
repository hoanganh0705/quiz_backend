import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptAnswerResponseDto } from './attempt-answer-response.dto';

export class AttemptResponseDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'User identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Quiz identifier',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
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

  @ApiPropertyOptional({
    description: 'Context reference ID',
    type: String,
    nullable: true,
  })
  contextRefId!: string | null;

  @ApiProperty({ description: 'Attempt status', example: 'started' })
  status!: string;

  @ApiPropertyOptional({
    description: 'Final score as a percentage string (null if not yet complete)',
    type: String,
    nullable: true,
  })
  scorePercent!: string | null;

  @ApiPropertyOptional({
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

  @ApiPropertyOptional({
    description: 'Completion timestamp (ISO 8601, null if not yet complete)',
    type: String,
    nullable: true,
  })
  finishedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Total time taken in milliseconds (null if not yet complete)',
    type: Number,
    nullable: true,
  })
  timeTakenMs!: number | null;

  @ApiProperty({ description: 'Total XP earned from this attempt', example: 100 })
  xpEarned!: number;

  @ApiProperty({
    description: 'Individual answer records',
    type: [AttemptAnswerResponseDto],
  })
  answers!: AttemptAnswerResponseDto[];
}
