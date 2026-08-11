import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizQuestionPlayerDto } from './quiz-question-player.dto';

/**
 * Phase 2 (S-9): public preview endpoint response.
 *
 * `GET /quizzes/:id/preview` returns the first `previewSize`
 * questions of the published version with the `isCorrect` flag
 * stripped — players can scroll through a representative slice
 * before deciding whether to start an attempt. The auth check on
 * the route is `@Public()`; previews deliberately do not require a
 * session so deep-link previews work from social/share surfaces.
 *
 * `previewSize` is server-controlled; the DTO does not echo a
 * client-supplied value. Today the limit is hard-coded to 2 — the
 * audit's recommendation — and lives on the controller as
 * `PREVIEW_QUESTION_COUNT`.
 */
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
