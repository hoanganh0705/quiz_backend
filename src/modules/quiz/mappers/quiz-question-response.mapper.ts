import { Injectable } from '@nestjs/common';
import { QuizQuestionResponseDto } from '../dto/response/quiz-question-response.dto';
import type { QuizQuestionJoinRow } from '../domain/ports/quiz-question-repository.port';

@Injectable()
export class QuizQuestionResponseMapper {
  toQuestionResponses(rows: QuizQuestionJoinRow[]): QuizQuestionResponseDto[] {
    if (rows.length === 0) {
      return [];
    }

    const questionMap = new Map<string, QuizQuestionResponseDto>();

    for (const row of rows) {
      const existing = questionMap.get(row.questionId);

      if (!existing) {
        questionMap.set(row.questionId, {
          questionId: row.questionId,
          quizVersionId: row.quizVersionId,
          position: row.position,
          questionText: row.questionText,
          imageUrl: row.imageUrl,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          answerOptions: [],
        });
      }

      if (row.optionId) {
        const question = questionMap.get(row.questionId)!;
        question.answerOptions.push({
          optionId: row.optionId,
          position: row.optionPosition ?? 0,
          value: row.optionValue ?? '',
          isCorrect: row.optionIsCorrect ?? false,
          createdAt: row.optionCreatedAt ?? '',
        });
      }
    }

    const questions = Array.from(questionMap.values());

    questions.sort((a, b) => a.position - b.position);
    for (const question of questions) {
      question.answerOptions.sort((a, b) => a.position - b.position);
    }

    return questions;
  }
}
