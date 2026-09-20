import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizQuestionPlayerDto } from './quiz-question-player.dto';

export class QuizPreviewResponseDto {
  @ApiProperty({
    description: 'Quiz identifier the preview belongs to',
    example: '660e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;

  @ApiPropertyOptional({
    description:
      'Published version identifier, or `null` when the quiz has no published version ' +
      '(in which case `questions` is `[]`)',
    type: String,
    nullable: true,
    example: '550e8400-e29b-71d4-a716-446655440000',
  })
  publishedVersionId!: string | null;

  @ApiProperty({
    description:
      'First `previewSize` questions of the published version, with `isCorrect` stripped ' +
      'from each answer option (player view — see `QuizQuestionPlayerDto`). Empty when ' +
      'the quiz has no published version.',
    type: () => [QuizQuestionPlayerDto],
  })
  questions!: QuizQuestionPlayerDto[];

  @ApiProperty({
    description:
      'Total question count for the published version. Useful for the preview UI to ' +
      'render "showing 2 of {total}" — the frontend does not have to fetch the full ' +
      'quiz detail to display the denominator.',
    example: 12,
  })
  totalQuestions!: number;
}
