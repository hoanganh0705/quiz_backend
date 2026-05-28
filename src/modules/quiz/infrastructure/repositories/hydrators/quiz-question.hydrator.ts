import type { QuizQuestionJoinRow } from '../../../domain/ports/quiz-question-repository.port';

export type QuizQuestionAggregate = {
  questionId: string;
  quizVersionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  answerOptions: {
    optionId: string;
    position: number;
    value: string;
    isCorrect: boolean;
    createdAt: string;
  }[];
};

export function hydrateQuestions(rows: QuizQuestionJoinRow[]): QuizQuestionAggregate[] {
  const questionMap = new Map<string, QuizQuestionAggregate>();

  for (const row of rows) {
    if (!questionMap.has(row.questionId)) {
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

    if (row.optionId !== null) {
      const question = questionMap.get(row.questionId)!;
      question.answerOptions.push({
        optionId: row.optionId,
        position: row.optionPosition!,
        value: row.optionValue!,
        isCorrect: row.optionIsCorrect!,
        createdAt: row.optionCreatedAt!,
      });
    }
  }

  const questions = Array.from(questionMap.values());

  for (const question of questions) {
    question.answerOptions.sort((a, b) => a.position - b.position);
  }

  return questions;
}
