import { ApiProperty } from '@nestjs/swagger';
import { QuizQuestionAuthorDto } from './quiz-question-author.dto';

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
 */
export class BulkQuizQuestionsResponseDto {
  @ApiProperty({
    description: 'Created question items',
    type: () => [QuizQuestionAuthorDto],
  })
  questions!: QuizQuestionAuthorDto[];
}
