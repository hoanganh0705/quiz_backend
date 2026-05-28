import type { QuizQuestionJoinRow } from '../domain/ports/quiz-question-repository.port';
import type { QuizQuestionResponseDto } from '../dto/response/quiz-question-response.dto';
import {
  hydrateQuestions,
  type QuizQuestionAggregate,
} from '../infrastructure/repositories/hydrators/quiz-question.hydrator';

/**
 * Pure stateless mapper — no DI needed.
 * Translates flat QuizQuestionJoinRow join results into structured QuizQuestionResponseDto[].
 * Delegates row-to-aggregate hydration to quiz-question.hydrator.
 */
export class QuizQuestionResponseMapper {
  static toQuestionResponses(rows: QuizQuestionJoinRow[]): QuizQuestionResponseDto[] {
    if (rows.length === 0) {
      return [];
    }

    const questions = hydrateQuestions(rows);
    return questions.map((q) => QuizQuestionResponseMapper.toQuestionResponse(q));
  }

  private static toQuestionResponse(question: QuizQuestionAggregate): QuizQuestionResponseDto {
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
