import type { QuizCursor } from '../ports/quiz-repository.port';

export type ListQuizzesQuery = {
  limit: number;
  cursor?: QuizCursor | null;
  filters?: {
    difficulty?: string;
    categoryId?: string;
    tagId?: string;
    creatorId?: string;
  };
};
