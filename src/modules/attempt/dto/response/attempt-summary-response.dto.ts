import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptStatusEnum, AttemptContextTypeEnum } from '../../types/attempt.types';

export class AttemptSummaryResponseDto {
  @ApiProperty({
    description: 'Unique attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  attemptId!: string;

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

  @ApiProperty({ description: 'Version number', example: 1 })
  versionNumber!: number;

  @ApiProperty({ description: 'Difficulty level', example: 'medium' })
  difficulty!: string;

  @ApiProperty({
    description: 'Context type',
    enum: AttemptContextTypeEnum,
    example: AttemptContextTypeEnum.Solo,
  })
  contextType!: AttemptContextTypeEnum;

  @ApiProperty({
    description: 'Attempt status',
    enum: AttemptStatusEnum,
    example: AttemptStatusEnum.Completed,
  })
  status!: AttemptStatusEnum;

  @ApiPropertyOptional({
    description: 'Score percent (null if not yet complete)',
    type: Number,
    nullable: true,
    example: 85.0,
  })
  scorePercent!: number | null;

  @ApiPropertyOptional({
    description: 'Correct answer count (null if not yet complete)',
    type: Number,
    nullable: true,
    example: 17,
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
    example: '2025-06-01T12:45:00.000Z',
  })
  finishedAt!: string | null;

  @ApiProperty({ description: 'XP earned', example: 100 })
  xpEarned!: number;
}
