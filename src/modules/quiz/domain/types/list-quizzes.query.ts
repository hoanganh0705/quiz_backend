import type { QuizCursor } from '../ports/quiz-repository.port';

export type ListQuizzesSort = 'newest' | 'popular' | 'top_rated' | 'trending';

export type ListQuizzesQuery = {
  limit: number;
  cursor?: QuizCursor | null;
  filters?: {
    difficulty?: string;
    categoryId?: string;
    tagIds?: string[];
    creatorId?: string;
    q?: string;
    sort?: ListQuizzesSort;
    isHidden?: boolean;
    minRating?: number;
  };
};
