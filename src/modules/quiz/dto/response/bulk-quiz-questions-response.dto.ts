import { ApiProperty } from '@nestjs/swagger';
import { QuizQuestionAuthorDto } from './quiz-question-author.dto';

export class BulkQuizQuestionResultItemDto {
  @ApiProperty({
    description: '0-based index of the input question this row refers to',
    example: 0,
  })
  index!: number;

  @ApiProperty({
    description:
      'HTTP-style status code. `201` = created, anything else = failed ' +
      '(see `code` + `message` for the reason).',
    example: 201,
  })
  status!: number;

  @ApiProperty({
    description: 'Application error code on failure. Empty string on success.',
    example: 'QUIZ_VALIDATION_FAILED',
  })
  code!: string;

  @ApiProperty({
    description: 'Human-readable failure message. Empty string on success.',
    example: 'Duplicate question position 5',
  })
  message!: string;

  @ApiProperty({
    description: 'Created question identifier on success. Null on failure.',
    format: 'uuid',
    nullable: true,
    example: '550e8400-e29b-71d4-a716-446655440099',
  })
  questionId!: string | null;
}

export class BulkQuizQuestionsResponseDto {
  @ApiProperty({
    description: 'Successfully created question items (subset of input)',
    type: () => [QuizQuestionAuthorDto],
  })
  questions!: QuizQuestionAuthorDto[];

  @ApiProperty({
    description:
      'Per-row outcome, in the same order as the input `questions[]`. ' +
      'Use this to render inline per-row success / failure indicators.',
    type: () => [BulkQuizQuestionResultItemDto],
  })
  results!: BulkQuizQuestionResultItemDto[];
}
