import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttemptAnswerResponseDto {
  @ApiProperty({
    description: 'Unique answer record identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  attemptAnswerId!: string;

  @ApiProperty({
    description: 'Question identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiPropertyOptional({
    description: 'Selected option identifier',
    type: String,
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  selectedOptionId!: string | null;

  @ApiProperty({
    description: 'Answer submission timestamp (ISO 8601)',
    example: '2025-06-01T12:05:00.000Z',
  })
  answeredAt!: string;

  @ApiPropertyOptional({
    description: 'Time taken in milliseconds',
    type: Number,
    nullable: true,
    example: 15000,
  })
  timeTakenMs!: number | null;

  @ApiPropertyOptional({
    description: 'Whether the answer was correct (null if attempt is not yet complete)',
    type: Boolean,
    nullable: true,
    example: true,
  })
  isCorrect!: boolean | null;
}
