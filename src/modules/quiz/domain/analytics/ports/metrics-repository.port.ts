/**
 * MetricsRepositoryPort — Port for quiz metrics calculations.
 *
 * Encapsulates all raw aggregation queries (attempts, reviews, bookmarks, trending)
 * so the domain analytics services remain free of infrastructure concerns.
 */
export const METRICS_REPOSITORY_PORT = Symbol('METRICS_REPOSITORY_PORT');

export interface MetricsRepositoryPort {
  calculateTotalAttempts(quizId: string): Promise<number>;
  calculateUniquePlayers(quizId: string): Promise<number>;
  calculateAverageScore(quizId: string): Promise<number>;
  calculateCompletionRate(quizId: string): Promise<number>;
  calculateAverageRating(quizId: string): Promise<number>;
  calculateRatingCount(quizId: string): Promise<number>;
  calculateBookmarkCount(quizId: string): Promise<number>;
  calculateTrendingScore(quizId: string): Promise<number>;
  calculatePopularityScore(
    quizId: string,
    maxAttempts: number,
    maxBookmarks: number,
    maxRatings: number,
  ): Promise<number>;
}
