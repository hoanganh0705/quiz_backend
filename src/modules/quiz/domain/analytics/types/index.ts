export interface QuizMetrics {
  totalAttempts: number;
  uniquePlayers: number;
  averageScore: number;
  completionRate: number;
}

export interface ReviewMetrics {
  averageRating: number;
  ratingCount: number;
}

export interface EngagementMetrics {
  bookmarkCount: number;
}

export interface PopularityMetrics {
  popularityScore: number;
  trendingScore: number;
  rank?: number;
}

export interface QuizAnalytics {
  quizId: string;
  metrics: QuizMetrics;
  reviewMetrics: ReviewMetrics;
  engagementMetrics: EngagementMetrics;
  popularity: PopularityMetrics;
  lastUpdated: string;
}

export interface TrendingQuiz {
  rank: number;
  quizId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  trendingScore: number;
  totalAttempts: number;
  recentAttempts: number;
}

export interface PopularQuiz {
  rank: number;
  quizId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  popularityScore: number;
  totalAttempts: number;
  averageRating: number;
  bookmarkCount: number;
}

export interface CategorySummary {
  totalQuizzes: number;
  activeQuizzes: number;
  totalAttempts: number;
  totalPlayers: number;
  averageScore: number;
  averageRating: number;
}

export interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  summary: CategorySummary;
  topQuizzes: PopularQuiz[];
  lastUpdated: string;
}

export interface CreatorAnalytics {
  userId: string;
  totalQuizzes: number;
  publishedQuizzes: number;
  totalAttempts: number;
  totalPlayers: number;
  totalReviews: number;
  averageRating: number;
  topPerformingQuiz: PopularQuiz | null;
  worstPerformingQuiz: {
    quizId: string;
    title: string;
    averageScore: number;
  } | null;
  lastUpdated: string;
}

export interface AttemptAggregation {
  totalAttempts: number;
  completedAttempts: number;
  uniquePlayers: number;
  averageScore: number;
}

export interface ReviewAggregation {
  averageRating: number;
  ratingCount: number;
}

export type QuizStatsRow = (typeof import('@/core/database/schema').quizStats)['$inferSelect'];

export interface QuizStatsWithQuiz extends QuizStatsRow {
  title: string;
  slug: string;
  imageUrl: string | null;
}
