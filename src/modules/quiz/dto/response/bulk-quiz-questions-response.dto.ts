import { ApiProperty } from '@nestjs/swagger';
import { QuizQuestionAuthorDto } from './quiz-question-author.dto';

/**
 * Per-row result entry for the bulk-create endpoint.
 *
 * Phase 5 (S-28): one row per input question, in input order, so the
 * editor can render a per-row result list (`BulkResultList`) without
 * having to re-derive indices from the response shape.
 */
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

/**
 * Response shape for the `POST /quizzes/:id/versions/:versionId/questions/bulk`
 * endpoint.
 *
 * Wrapping the created question array in a named field (`questions`) gives the
 * envelope-wrapped response the same `{ data: <T>, meta }` shape every other
 * endpoint produces, instead of the un-paginated bare-array shape that made
 * the original endpoint inconsistent with its peers.
 *
 * Author view — the returned questions include the `isCorrect` flag on each
 * option so the quiz author can verify the created questions.
 *
 * Phase 5 (S-28): the `results` array exposes per-row status so the editor
 * can render partial-success UIs. `questions` only contains the rows that
 * succeeded; `results` is the canonical per-row outcome array.
 */
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
