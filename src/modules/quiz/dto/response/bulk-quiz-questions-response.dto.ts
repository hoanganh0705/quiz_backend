import { ApiProperty } from '@nestjs/swagger';
import { QuizQuestionResponseDto } from './quiz-question-response.dto';

/**
 * Response shape for the `POST /quizzes/:id/versions/:versionId/questions/bulk`
 * endpoint.
 *
 * Wrapping the created question array in a named field (`questions`) gives the
 * envelope-wrapped response the same `{ data: <T>, meta }` shape every other
 * endpoint produces, instead of the un-paginated bare-array shape that made
 * the original endpoint inconsistent with its peers.
 */
export class BulkQuizQuestionsResponseDto {
  @ApiProperty({
    description: 'Created question items',
    type: () => [QuizQuestionResponseDto],
  })
  questions!: QuizQuestionResponseDto[];
}
