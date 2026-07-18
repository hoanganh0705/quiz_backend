import type { QuizQuestionJoinRow } from '../domain/ports/quiz-question-repository.port';
import type { QuizQuestionAuthorDto } from '../dto/response/quiz-question-author.dto';
import {
  hydrateQuestions,
  type HydratedQuizQuestion,
} from '../infrastructure/repositories/hydrators/quiz-question.hydrator';

/**
 * Pure stateless mapper — no DI needed.
 * Translates flat QuizQuestionJoinRow join results into structured
 * QuizQuestionAuthorDto[] (author view — includes the `isCorrect` flag on
 * each option).
 *
 * Use this mapper only for author-only endpoints. For player-facing
 * surfaces, use {@link QuizQuestionPlayerResponseMapper} instead, which
 * strips `isCorrect`.
 *
 * Delegates row-to-aggregate hydration to quiz-question.hydrator.
 */
export class QuizQuestionAuthorResponseMapper {
  static toAuthorQuestionResponses(rows: QuizQuestionJoinRow[]): QuizQuestionAuthorDto[] {
    if (rows.length === 0) {
      return [];
    }

    const questions = hydrateQuestions(rows);
    return questions.map((q) => QuizQuestionAuthorResponseMapper.toAuthorQuestionResponse(q));
  }

  private static toAuthorQuestionResponse(question: HydratedQuizQuestion): QuizQuestionAuthorDto {
    return {
      questionId: question.questionId,
      quizVersionId: question.quizVersionId,
      position: question.position,
      questionText: question.questionText,
      imageUrl: question.imageUrl,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      answerOptions: question.answerOptions.map((option) => ({
        optionId: option.optionId,
        position: option.position,
        value: option.value,
        isCorrect: option.isCorrect,
        createdAt: option.createdAt,
      })),
    };
  }
}
