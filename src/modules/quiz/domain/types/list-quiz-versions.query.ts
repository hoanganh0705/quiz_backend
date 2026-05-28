import type { QuizVersionCursor } from '../ports/quiz-version-repository.port';

export type ListQuizVersionsQuery = {
  limit: number;
  cursor?: QuizVersionCursor | null;
};
