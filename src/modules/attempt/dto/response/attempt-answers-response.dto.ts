import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptAnswerItemDto {
  @ApiProperty({
    description: 'Question identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Selected option identifier (null if the question was skipped)',
    type: String,
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiPropertyOptional({
    description: 'Whether the answer was correct (null until the attempt is completed)',
    type: Boolean,
    nullable: true,
    example: true,
  })
  isCorrect!: boolean | null;

  @ApiProperty({
    description: 'Answer submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  submittedAt!: string;
}

export class AttemptAnswersResponseDto {
  @ApiProperty({
    description: 'Attempt identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  attemptId!: string;

  @ApiProperty({
    description: 'All answers submitted within this attempt',
    type: [AttemptAnswerItemDto],
  })
  answers!: AttemptAnswerItemDto[];
}
