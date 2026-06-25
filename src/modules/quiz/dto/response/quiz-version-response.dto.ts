import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { QuizDifficulty, QuizVersionStatus } from '@/modules/quiz/types/quiz.types';
import { QuizQuestionResponseDto } from './quiz-question-response.dto';

export class QuizVersionDetailResponseDto {
  @ApiProperty({
    description: 'Quiz version identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  versionId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Sequential version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({
    description: 'Version lifecycle status',
    enum: ['draft', 'published', 'archived'],
    example: 'draft',
  })
  status!: QuizVersionStatus;

  @ApiProperty({ description: 'Version title', example: 'JavaScript Fundamentals v2' })
  title!: string;

  @ApiPropertyOptional({
    description: 'Version description',
    type: String,
    example: 'Updated draft with additional DOM questions',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ description: 'Passing score percent required to pass', example: 70 })
  passingScore!: number;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600000 })
  timeLimit!: number;

  @ApiProperty({
    description: 'Questions included in this version',
    type: () => [QuizQuestionResponseDto],
  })
  questions!: QuizQuestionResponseDto[];

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;
}

export class QuizVersionResponseDto {
  @ApiProperty({
    description: 'Unique quiz version identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({
    description: 'Parent quiz identifier',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  quizId!: string;

  @ApiProperty({ description: 'Sequential version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({
    description: 'Version lifecycle status',
    enum: ['draft', 'published', 'archived'],
    example: 'draft',
  })
  status!: QuizVersionStatus;

  @ApiProperty({
    description: 'Difficulty level',
    enum: ['easy', 'medium', 'hard'],
    example: 'medium',
  })
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', example: 600000 })
  durationMs!: number;

  @ApiProperty({ description: 'Minimum score percent to pass', example: 70 })
  passingScorePercent!: number;

  @ApiProperty({ description: 'XP reward for passing', example: 100 })
  rewardXp!: number;

  @ApiPropertyOptional({ description: 'Creator user identifier', type: String, nullable: true })
  createdByUserId!: string | null;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Timestamp when version was published (ISO 8601)',
    type: String,
    nullable: true,
  })
  publishedAt!: string | null;

  @ApiPropertyOptional({
    description: 'Timestamp when version was archived (ISO 8601)',
    type: String,
    nullable: true,
  })
  archivedAt!: string | null;

  @ApiProperty({
    description: 'Last update timestamp (ISO 8601)',
    example: '2025-06-01T12:00:00.000Z',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description:
      'Questions included in this version (only populated when version detail is requested)',
    type: () => [QuizQuestionResponseDto],
    nullable: true,
  })
  questions?: QuizQuestionResponseDto[];
}
