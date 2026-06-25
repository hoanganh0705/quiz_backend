import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptSummaryResponseDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

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

  @ApiProperty({ description: 'Context type', example: 'solo' })
  contextType!: string;

  @ApiProperty({ description: 'Attempt status', example: 'completed' })
  status!: string;

  @ApiPropertyOptional({
    description: 'Score percent (null if not yet complete)',
    type: String,
    nullable: true,
  })
  scorePercent!: string | null;

  @ApiPropertyOptional({
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

  @ApiPropertyOptional({
    description: 'Completion timestamp (ISO 8601)',
    type: String,
    nullable: true,
  })
  finishedAt!: string | null;

  @ApiProperty({ description: 'XP earned', example: 100 })
  xpEarned!: number;
}
