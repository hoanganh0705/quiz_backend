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
    description: 'Creation timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  createdAt!: string;
}
