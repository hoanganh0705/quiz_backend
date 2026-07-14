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

  @ApiPropertyOptional({
    description: 'Optional image URL',
    type: String,
    format: 'uri',
    nullable: true,
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-07-13 09:11:05.026+00',
  })
  updatedAt!: string;

  @ApiProperty({ description: 'Answer options', type: () => [QuizAnswerOptionResponseDto] })
  answerOptions!: QuizAnswerOptionResponseDto[];
}
