import type {
  CreatorAnalytics,
  PopularQuiz,
  TagAnalytics,
  TrendingQuiz,
} from '../types';

export const QUIZ_ANALYTICS_PORT = Symbol('QUIZ_ANALYTICS_PORT');

export interface QuizAnalyticsPort {
  getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]>;
  getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuiz[]>;
  getCreatorAnalytics(userId: string): Promise<CreatorAnalytics | null>;
  getTagAnalytics(tagId: string): Promise<TagAnalytics | null>;
}
