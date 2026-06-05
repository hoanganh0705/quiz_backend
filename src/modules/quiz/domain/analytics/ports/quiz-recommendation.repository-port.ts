import type { QuizWithPublishedVersionRow } from '../../ports';

export type ScoredQuizRow = QuizWithPublishedVersionRow & {
  categoryMatchCount: number;
  tagMatchCount: number;
  popularityScore: number;
  trendingScore: number;
};

export type FindRecommendedQuizzesParams = {
  userId: string;
  limit: number;
};

export interface QuizRecommendationRepositoryPort {
  findRecommendedQuizzes(params: FindRecommendedQuizzesParams): Promise<ScoredQuizRow[]>;
}

export const QUIZ_RECOMMENDATION_REPOSITORY_PORT = Symbol('QUIZ_RECOMMENDATION_REPOSITORY_PORT');
