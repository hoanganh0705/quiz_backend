export class QuizMetricsDto {
  totalAttempts: number;
  uniquePlayers: number;
  averageScore: number;
  completionRate: number;
}

export class ReviewMetricsDto {
  averageRating: number;
  ratingCount: number;
}

export class EngagementMetricsDto {
  bookmarkCount: number;
}

export class PopularityDto {
  popularityScore: number;
  trendingScore: number;
  rank?: number;
}

export class QuizAnalyticsResponseDto {
  quizId: string;
  metrics: QuizMetricsDto;
  reviewMetrics: ReviewMetricsDto;
  engagementMetrics: EngagementMetricsDto;
  popularity: PopularityDto;
  lastUpdated: string;
}

export class TrendingQuizItemDto {
  rank: number;
  quizId: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  trendingScore: number;
  totalAttempts: number;
  recentAttempts: number;
}

export class TrendingQuizzesResponseDto {
  period: 'daily' | 'weekly';
  quizzes: TrendingQuizItemDto[];
  lastUpdated: string;
}

export class PopularQuizItemDto {
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

export class PopularQuizzesResponseDto {
  quizzes: PopularQuizItemDto[];
  lastUpdated: string;
}

export class CategorySummaryDto {
  totalQuizzes: number;
  activeQuizzes: number;
  totalAttempts: number;
  totalPlayers: number;
  averageScore: number;
  averageRating: number;
}

export class CategoryAnalyticsResponseDto {
  categoryId: string;
  categoryName: string;
  summary: CategorySummaryDto;
  topQuizzes: PopularQuizItemDto[];
  lastUpdated: string;
}

export class CreatorAnalyticsResponseDto {
  userId: string;
  totalQuizzes: number;
  publishedQuizzes: number;
  totalAttempts: number;
  totalPlayers: number;
  totalReviews: number;
  averageRating: number;
  topPerformingQuiz: PopularQuizItemDto | null;
  worstPerformingQuiz: {
    quizId: string;
    title: string;
    averageScore: number;
  } | null;
  lastUpdated: string;
}
