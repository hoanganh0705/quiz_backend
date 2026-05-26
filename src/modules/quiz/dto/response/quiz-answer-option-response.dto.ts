import { ApiProperty } from '@nestjs/swagger';

export class QuizAnswerOptionResponseDto {
  @ApiProperty({
    description: 'Unique answer option identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  optionId!: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  position!: number;

  @ApiProperty({ description: 'Answer text', example: 'console.log' })
  value!: string;

  @ApiProperty({ description: 'Whether this is the correct answer', example: true })
  isCorrect!: boolean;

  @ApiProperty({
    description: 'Creation timestamp (ISO 8601)',
    example: '2025-01-15T08:30:00.000Z',
  })
  createdAt!: string;
}
