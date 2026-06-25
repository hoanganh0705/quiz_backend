import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizAnswerOptionResponseDto } from './quiz-answer-option-response.dto';

export class QuizQuestionResponseDto {
  @ApiProperty({
    description: 'Unique question identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  questionId!: string;

  @ApiProperty({
    description: 'Parent quiz version identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  quizVersionId!: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  position!: number;

  @ApiProperty({
    description: 'Question text',
    example: 'What does `console.log` do in JavaScript?',
  })
  questionText!: string;

  @ApiPropertyOptional({ description: 'Optional image URL', type: String, format: 'uri', nullable: true })
  imageUrl!: string | null;

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

  @ApiProperty({ description: 'Answer options', type: () => [QuizAnswerOptionResponseDto] })
  answerOptions!: QuizAnswerOptionResponseDto[];
}
