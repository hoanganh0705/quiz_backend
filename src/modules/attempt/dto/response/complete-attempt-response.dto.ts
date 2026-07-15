import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteAttemptResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
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

  @ApiProperty({
    description: 'Final status',
    example: 'completed',
    enum: ['started', 'completed', 'abandoned'],
  })
  status!: string;

  @ApiPropertyOptional({
    description: 'Final score percent',
    type: String,
    nullable: true,
    example: '85.00',
  })
  scorePercent!: string | null;

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
