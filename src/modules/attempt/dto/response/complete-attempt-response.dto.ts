import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptStatusEnum } from '../../types/attempt.types';

export class CompleteAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
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

  @ApiProperty({
    description: 'Final status',
    enum: AttemptStatusEnum,
    example: AttemptStatusEnum.Completed,
  })
  status!: AttemptStatusEnum;

  @ApiPropertyOptional({
    description: 'Final score percent (null if not yet complete)',
    type: Number,
    nullable: true,
    example: 85.0,
  })
  scorePercent!: number | null;

  @ApiPropertyOptional({
    description: 'Correct answer count',
    type: Number,
    nullable: true,
    example: 17,
  })
  correctCount!: number | null;

  @ApiPropertyOptional({
    description: 'Total time taken in milliseconds',
    type: Number,
    nullable: true,
    example: 2700000,
  })
  timeTakenMs!: number | null;

  @ApiProperty({ description: 'Total XP earned', example: 100 })
  xpEarned!: number;

  @ApiProperty({
    description: 'Completion timestamp (ISO 8601)',
    example: '2025-06-01T12:45:00.000Z',
  })
  finishedAt!: string;
}
