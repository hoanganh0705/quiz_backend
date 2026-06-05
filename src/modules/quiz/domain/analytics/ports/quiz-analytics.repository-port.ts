import type {
  AttemptAggregation,
  ReviewAggregation,
  TrendingQuiz,
  PopularQuiz,
  CategoryAnalytics,
  CreatorAnalytics,
  TagAnalytics,
  QuizStatsRow,
} from '../types';

export const QUIZ_ANALYTICS_REPOSITORY_PORT = Symbol('QUIZ_ANALYTICS_REPOSITORY_PORT');

export interface QuizAnalyticsRepositoryPort {
  getQuizStats(quizId: string): Promise<QuizStatsRow | null>;
  upsertQuizStats(quizId: string, data: Partial<QuizStatsRow>): Promise<void>;

  aggregateAttemptsByQuiz(quizId: string): Promise<AttemptAggregation>;
  aggregateReviewsByQuiz(quizId: string): Promise<ReviewAggregation>;
  aggregateBookmarksByQuiz(quizId: string): Promise<number>;

  getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]>;
  getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuiz[]>;

  getAllQuizStats(): Promise<QuizStatsRow[]>;

  getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null>;

  getCreatorAnalytics(userId: string): Promise<CreatorAnalytics>;

  getTagAnalytics(tagId: string): Promise<TagAnalytics | null>;

  getRecentAttemptsByQuiz(quizId: string, hours: number): Promise<number>;
}
