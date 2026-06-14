import type {
  CategoryAnalytics,
  CreatorAnalytics,
  PopularQuiz,
  TagAnalytics,
  TrendingQuiz,
} from '../types';

export const QUIZ_ANALYTICS_PORT = Symbol('QUIZ_ANALYTICS_PORT');

export interface QuizAnalyticsPort {
  getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]>;
  getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuiz[]>;
  getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null>;
  getCreatorAnalytics(userId: string): Promise<CreatorAnalytics | null>;
  getTagAnalytics(tagId: string): Promise<TagAnalytics | null>;
  invalidateQuizMetrics(quizId: string): Promise<void>;
  invalidateCategoryAnalytics(categoryId: string): Promise<void>;
  onReviewSubmitted(quizId: string): Promise<void>;
  onReviewDeleted(quizId: string): Promise<void>;
}
