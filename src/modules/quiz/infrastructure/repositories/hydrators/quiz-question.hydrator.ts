import type { QuizQuestionJoinRow } from '@/modules/quiz/domain/ports/quiz-question-repository.port';

export type HydratedQuizQuestion = {
  questionId: string;
  quizVersionId: string;
  position: number;
  questionText: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  answerOptions: Array<{
    optionId: string;
    position: number;
    value: string;
    isCorrect: boolean;
    createdAt: string;
  }>;
};

export function hydrateQuestions(rows: QuizQuestionJoinRow[]): HydratedQuizQuestion[] {
  const questions = new Map<string, HydratedQuizQuestion>();

  for (const row of rows) {
    let question = questions.get(row.questionId);

    if (!question) {
      question = {
        questionId: row.questionId,
        quizVersionId: row.quizVersionId,
        position: row.position,
        questionText: row.questionText,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        answerOptions: [],
      };
      questions.set(row.questionId, question);
    }

    if (row.optionId && row.optionPosition !== null && row.optionValue !== null && row.optionIsCorrect !== null && row.optionCreatedAt) {
      question.answerOptions.push({
        optionId: row.optionId,
        position: row.optionPosition,
        value: row.optionValue,
        isCorrect: row.optionIsCorrect,
        createdAt: row.optionCreatedAt,
      });
    }
  }

  return Array.from(questions.values()).map((question) => ({
    ...question,
    answerOptions: question.answerOptions.sort((left, right) => left.position - right.position),
  }));
}
