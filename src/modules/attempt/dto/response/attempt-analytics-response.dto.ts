import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptAnalyticsResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiPropertyOptional({
    description: 'Final score as a percentage (0–100). Null if not yet scored.',
    type: Number,
    nullable: true,
    example: 82.5,
  })
  score!: number | null;

  @ApiPropertyOptional({
    description:
      'Accuracy: ratio of correct answers to total questions (0–100). Null when totalQuestions is 0.',
    type: Number,
    nullable: true,
    example: 80.0,
  })
  accuracy!: number | null;

  @ApiPropertyOptional({
    description: 'Number of questions answered correctly.',
    type: Number,
    nullable: true,
    example: 16,
  })
  correctAnswers!: number | null;

  @ApiPropertyOptional({
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

  @ApiPropertyOptional({
    description: 'Total time spent on the attempt in seconds. Null if not recorded.',
    type: Number,
    nullable: true,
    example: 345,
  })
  timeSpentSeconds!: number | null;

  @ApiProperty({
    description:
      'Percentile rank among all completed attempts for the same quiz version (0–100). ' +
      'A value of 75 means this attempt scored better than 75% of peers.',
    example: 75.0,
  })
  percentileRank!: number;

  @ApiPropertyOptional({
    description: 'Attempt completion timestamp (ISO 8601). Null if not yet completed.',
    type: String,
    nullable: true,
    example: '2025-06-01T12:45:00.000Z',
  })
  completedAt!: string | null;
}
