import type { QuizQuestionJoinRow } from '../domain/ports/quiz-question-repository.port';
import type { QuizQuestionPlayerDto } from '../dto/response/quiz-question-player.dto';
import {
  hydrateQuestions,
  type HydratedQuizQuestion,
} from '../infrastructure/repositories/hydrators/quiz-question.hydrator';

/**
 * Pure stateless mapper — no DI needed.
 * Translates flat QuizQuestionJoinRow join results into structured
 * QuizQuestionPlayerDto[] (player view — `isCorrect` is intentionally omitted
 * to prevent spoilers).
 *
 * Use this mapper for any player-facing surface (e.g. `GET /quizzes/:id`).
 * For author-only endpoints, use {@link QuizQuestionAuthorResponseMapper}.
 */
export class QuizQuestionPlayerResponseMapper {
  static toPlayerQuestionResponses(rows: QuizQuestionJoinRow[]): QuizQuestionPlayerDto[] {
    if (rows.length === 0) {
      return [];
    }

    const questions = hydrateQuestions(rows);
    return questions.map((q) => QuizQuestionPlayerResponseMapper.toPlayerQuestionResponse(q));
  }

  private static toPlayerQuestionResponse(question: HydratedQuizQuestion): QuizQuestionPlayerDto {
    return {
      questionId: question.questionId,
      quizVersionId: question.quizVersionId,
      position: question.position,
      questionText: question.questionText,
      imageUrl: question.imageUrl,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      // Note: `isCorrect` is intentionally NOT copied into the player view.
      answerOptions: question.answerOptions.map((option) => ({
        optionId: option.optionId,
        position: option.position,
        value: option.value,
        createdAt: option.createdAt,
      })),
    };
  }
}
