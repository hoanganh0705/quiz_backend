import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { quizAttempts, quizVersions, quizReviews, bookmarkedQuizzes, quizzes } from '@/core/database/schema';
import { count, eq, and, sql, isNull, gte, inArray } from 'drizzle-orm';

@Injectable()
export class MetricsCalculatorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectPinoLogger(MetricsCalculatorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async calculateTotalAttempts(quizId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          eq(quizAttempts.status, 'completed'),
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  async calculateUniquePlayers(quizId: string): Promise<number> {
    const result = await this.db
      .select({ count: count(sql`DISTINCT ${quizAttempts.userId}`) })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          eq(quizAttempts.status, 'completed'),
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  async calculateAverageScore(quizId: string): Promise<number> {
    const result = await this.db
      .select({
        avg: sql<number>`COALESCE(AVG(${quizAttempts.scorePercent}::numeric), 0)`,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          eq(quizAttempts.status, 'completed'),
          isNull(quizAttempts.scorePercent),
        ),
      );

    const withScore = await this.db
      .select({
        avg: sql<number>`COALESCE(AVG(${quizAttempts.scorePercent}::numeric), 0)`,
      })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          eq(quizAttempts.status, 'completed'),
        ),
      );

    return Number(withScore[0]?.avg ?? 0);
  }

  async calculateCompletionRate(quizId: string): Promise<number> {
    const totalResult = await this.db
      .select({ count: count() })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          sql`${quizAttempts.status} IN ('started', 'completed')`,
        ),
      );

    const total = Number(totalResult[0]?.count ?? 0);

    if (total === 0) {
      return 0;
    }

    const completedResult = await this.db
      .select({ count: count() })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          eq(quizAttempts.status, 'completed'),
        ),
      );

    const completed = Number(completedResult[0]?.count ?? 0);

    return (completed / total) * 100;
  }

  async calculateAverageRating(quizId: string): Promise<number> {
    const result = await this.db
      .select({
        avg: sql<number>`COALESCE(AVG(${quizReviews.rating}::numeric), 0)`,
      })
      .from(quizReviews)
      .where(eq(quizReviews.quizId, quizId));

    return Number(result[0]?.avg ?? 0);
  }

  async calculateRatingCount(quizId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(quizReviews)
      .where(eq(quizReviews.quizId, quizId));

    return Number(result[0]?.count ?? 0);
  }

  async calculateBookmarkCount(quizId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(bookmarkedQuizzes)
      .where(eq(bookmarkedQuizzes.quizId, quizId));

    return Number(result[0]?.count ?? 0);
  }

  async calculateTrendingScore(quizId: string): Promise<number> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const attemptWeight = 1;
    const bookmarkWeight = 2;
    const reviewWeight = 3;

    const attemptScore = await this.calculateRecentAttemptsScore(quizId, sevenDaysAgo, attemptWeight);
    const bookmarkScore = await this.calculateRecentBookmarksScore(quizId, sevenDaysAgo, bookmarkWeight);
    const reviewScore = await this.calculateRecentReviewsScore(quizId, sevenDaysAgo, reviewWeight);

    return attemptScore + bookmarkScore + reviewScore;
  }

  private async calculateRecentAttemptsScore(quizId: string, since: Date, weight: number): Promise<number> {
    const attempts = await this.db
      .select({ createdAt: quizAttempts.createdAt })
      .from(quizAttempts)
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          gte(quizAttempts.createdAt, since.toISOString()),
        ),
      );

    return this.applyTimeDecay(attempts.map(a => a.createdAt), weight);
  }

  private async calculateRecentBookmarksScore(quizId: string, since: Date, weight: number): Promise<number> {
    const bookmarks = await this.db
      .select({ bookmarkedAt: bookmarkedQuizzes.bookmarkedAt })
      .from(bookmarkedQuizzes)
      .where(
        and(
          eq(bookmarkedQuizzes.quizId, quizId),
          gte(bookmarkedQuizzes.bookmarkedAt, since.toISOString()),
        ),
      );

    return this.applyTimeDecay(bookmarks.map(b => b.bookmarkedAt), weight);
  }

  private async calculateRecentReviewsScore(quizId: string, since: Date, weight: number): Promise<number> {
    const reviews = await this.db
      .select({ createdAt: quizReviews.createdAt })
      .from(quizReviews)
      .where(
        and(
          eq(quizReviews.quizId, quizId),
          gte(quizReviews.createdAt, since.toISOString()),
        ),
      );

    return this.applyTimeDecay(reviews.map(r => r.createdAt), weight);
  }

  private applyTimeDecay(timestamps: (string | null)[], baseWeight: number): number {
    const now = Date.now();
    let totalScore = 0;

    for (const timestamp of timestamps) {
      if (!timestamp) continue;

      const ageMs = now - new Date(timestamp).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);

      let multiplier = 1.0;
      if (ageHours > 72) {
        multiplier = 0.1;
      } else if (ageHours > 48) {
        multiplier = 0.25;
      } else if (ageHours > 24) {
        multiplier = 0.5;
      }

      totalScore += baseWeight * multiplier;
    }

    return totalScore;
  }

  async calculatePopularityScore(
    quizId: string,
    maxAttempts: number,
    maxBookmarks: number,
    maxRatings: number,
  ): Promise<number> {
    const attemptsWeight = 0.5;
    const bookmarksWeight = 0.3;
    const ratingsWeight = 0.2;

    const totalAttempts = await this.calculateTotalAttempts(quizId);
    const bookmarkCount = await this.calculateBookmarkCount(quizId);
    const ratingCount = await this.calculateRatingCount(quizId);

    const normalizedAttempts = maxAttempts > 0 ? totalAttempts / maxAttempts : 0;
    const normalizedBookmarks = maxBookmarks > 0 ? bookmarkCount / maxBookmarks : 0;
    const normalizedRatings = maxRatings > 0 ? ratingCount / maxRatings : 0;

    const score =
      attemptsWeight * Math.min(normalizedAttempts, 1) +
      bookmarksWeight * Math.min(normalizedBookmarks, 1) +
      ratingsWeight * Math.min(normalizedRatings, 1);

    return score * 10000;
  }
}
