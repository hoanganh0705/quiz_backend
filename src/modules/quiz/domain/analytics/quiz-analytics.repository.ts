import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  quizStats,
  quizzes,
  quizVersions,
  quizAttempts,
  quizReviews,
  bookmarkedQuizzes,
  quizCategories,
  categories,
} from '@/core/database/schema';

import { eq, sql, desc, and, isNull, gte, count, inArray } from 'drizzle-orm';
import { QuizAnalyticsRepositoryPort } from './ports';
import { AttemptAggregation, QuizStatsRow } from './types';

@Injectable()
export class QuizAnalyticsRepository implements QuizAnalyticsRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getQuizStats(quizId: string): Promise<QuizStatsRow | null> {
    const [stats] = await this.db.select().from(quizStats).where(eq(quizStats.quizId, quizId));

    return stats ?? null;
  }

  async upsertQuizStats(quizId: string, data: Partial<QuizStatsRow>): Promise<void> {
    await this.db
      .insert(quizStats)
      .values({
        quizId,
        totalAttempts: data.totalAttempts ?? '0',
        totalPlayers: data.totalPlayers ?? '0',
        avgScorePercent: data.avgScorePercent ?? '0',
        avgRating: data.avgRating ?? '0',
        ratingCount: data.ratingCount ?? 0,
        bookmarkCount: data.bookmarkCount ?? 0,
        completionRate: data.completionRate ?? '0',
        popularityScore: data.popularityScore ?? '0',
        trendingScore: data.trendingScore ?? '0',
        lastAttemptAt: data.lastAttemptAt ?? null,
        lastCalculatedAt: data.lastCalculatedAt ?? null,
      })
      .onConflictDoUpdate({
        target: quizStats.quizId,
        set: {
          totalAttempts: data.totalAttempts ?? sql`${quizStats.totalAttempts}`,
          totalPlayers: data.totalPlayers ?? sql`${quizStats.totalPlayers}`,
          avgScorePercent: data.avgScorePercent ?? sql`${quizStats.avgScorePercent}`,
          avgRating: data.avgRating ?? sql`${quizStats.avgRating}`,
          ratingCount: data.ratingCount ?? sql`${quizStats.ratingCount}`,
          bookmarkCount: data.bookmarkCount ?? sql`${quizStats.bookmarkCount}`,
          completionRate: data.completionRate ?? sql`${quizStats.completionRate}`,
          popularityScore: data.popularityScore ?? sql`${quizStats.popularityScore}`,
          trendingScore: data.trendingScore ?? sql`${quizStats.trendingScore}`,
          lastAttemptAt: data.lastAttemptAt ?? sql`${quizStats.lastAttemptAt}`,
          lastCalculatedAt: data.lastCalculatedAt ?? sql`${quizStats.lastCalculatedAt}`,
          updatedAt: new Date().toISOString(),
        },
      });
  }

  async aggregateAttemptsByQuiz(quizId: string): Promise<AttemptAggregation> {
    const versionIds = await this.db
      .select({ quizVersionId: quizVersions.quizVersionId })
      .from(quizVersions)
      .where(eq(quizVersions.quizId, quizId));

    const versionIdList = versionIds.map((v) => v.quizVersionId);

    if (versionIdList.length === 0) {
      return {
        totalAttempts: 0,
        completedAttempts: 0,
        uniquePlayers: 0,
        averageScore: 0,
      };
    }

    const stats = await this.db
      .select({
        totalAttempts: count(),
        completedAttempts: sql<number>`SUM(CASE WHEN ${quizAttempts.status} = 'completed' THEN 1 ELSE 0 END)`,
        uniquePlayers: sql<number>`COUNT(DISTINCT ${quizAttempts.userId})`,
        averageScore: sql<number>`AVG(CASE WHEN ${quizAttempts.status} = 'completed' THEN ${quizAttempts.scorePercent}::numeric ELSE NULL END)`,
      })
      .from(quizAttempts)
      .where(inArray(quizAttempts.quizVersionId, versionIdList));

    return {
      totalAttempts: Number(stats[0]?.totalAttempts ?? 0),
      completedAttempts: Number(stats[0]?.completedAttempts ?? 0),
      uniquePlayers: Number(stats[0]?.uniquePlayers ?? 0),
      averageScore: Number(stats[0]?.averageScore ?? 0),
    };
  }

  async aggregateReviewsByQuiz(quizId: string): Promise<ReviewAggregation> {
    const stats = await this.db
      .select({
        averageRating: sql<number>`AVG(${quizReviews.rating}::numeric)`,
        ratingCount: count(),
      })
      .from(quizReviews)
      .where(eq(quizReviews.quizId, quizId));

    return {
      averageRating: Number(stats[0]?.averageRating ?? 0),
      ratingCount: Number(stats[0]?.ratingCount ?? 0),
    };
  }

  async aggregateBookmarksByQuiz(quizId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(bookmarkedQuizzes)
      .where(eq(bookmarkedQuizzes.quizId, quizId));

    return Number(result[0]?.count ?? 0);
  }

  async getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]> {
    let query = this.db
      .select({
        quizId: quizStats.quizId,
        title: quizzes.title,
        slug: quizzes.slug,
        imageUrl: quizzes.imageUrl,
        trendingScore: quizStats.trendingScore,
        totalAttempts: quizStats.totalAttempts,
      })
      .from(quizStats)
      .innerJoin(quizzes, eq(quizStats.quizId, quizzes.quizId))
      .where(isNull(quizzes.deletedAt))
      .orderBy(desc(quizStats.trendingScore))
      .limit(limit);

    const results = await query;

    let filtered = results;
    if (categoryId) {
      const categoryQuizIds = await this.db
        .select({ quizId: quizCategories.quizId })
        .from(quizCategories)
        .where(eq(quizCategories.categoryId, categoryId));

      const categoryQuizIdSet = new Set(categoryQuizIds.map((c) => c.quizId));
      filtered = results.filter((r) => categoryQuizIdSet.has(r.quizId)).slice(0, limit);
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const trendingQuizzes: TrendingQuiz[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const row = filtered[i];
      const recentAttempts = await this.getRecentAttemptsByQuiz(row.quizId, 168);

      trendingQuizzes.push({
        rank: i + 1,
        quizId: row.quizId as string,
        title: row.title,
        slug: row.slug,
        imageUrl: row.imageUrl,
        trendingScore: Number(row.trendingScore),
        totalAttempts: Number(row.totalAttempts),
        recentAttempts,
      });
    }

    return trendingQuizzes;
  }

  async getPopularQuizzes(limit: number, categoryId?: string): Promise<PopularQuiz[]> {
    let query = this.db
      .select({
        quizId: quizStats.quizId,
        title: quizzes.title,
        slug: quizzes.slug,
        imageUrl: quizzes.imageUrl,
        popularityScore: quizStats.popularityScore,
        totalAttempts: quizStats.totalAttempts,
        avgRating: quizStats.avgRating,
        bookmarkCount: quizStats.bookmarkCount,
      })
      .from(quizStats)
      .innerJoin(quizzes, eq(quizStats.quizId, quizzes.quizId))
      .where(isNull(quizzes.deletedAt))
      .orderBy(desc(quizStats.popularityScore))
      .limit(limit);

    const results = await query;

    let filtered = results;
    if (categoryId) {
      const categoryQuizIds = await this.db
        .select({ quizId: quizCategories.quizId })
        .from(quizCategories)
        .where(eq(quizCategories.categoryId, categoryId));

      const categoryQuizIdSet = new Set(categoryQuizIds.map((c) => c.quizId));
      filtered = results.filter((r) => categoryQuizIdSet.has(r.quizId)).slice(0, limit);
    }

    const popularQuizzes: PopularQuiz[] = filtered.map((row, i) => ({
      rank: i + 1,
      quizId: row.quizId as string,
      title: row.title,
      slug: row.slug,
      imageUrl: row.imageUrl,
      popularityScore: Number(row.popularityScore),
      totalAttempts: Number(row.totalAttempts),
      averageRating: Number(row.avgRating),
      bookmarkCount: Number(row.bookmarkCount),
    }));

    return popularQuizzes;
  }

  async getAllQuizStats(): Promise<QuizStatsRow[]> {
    return this.db.select().from(quizStats);
  }

  async getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null> {
    const category = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
      .limit(1);

    if (!category[0]) {
      return null;
    }

    const categoryQuizIds = await this.db
      .select({ quizId: quizCategories.quizId })
      .from(quizCategories)
      .where(eq(quizCategories.categoryId, categoryId));

    const quizIdList = categoryQuizIds.map((c) => c.quizId);

    if (quizIdList.length === 0) {
      return {
        categoryId,
        categoryName: category[0].name,
        summary: {
          totalQuizzes: 0,
          activeQuizzes: 0,
          totalAttempts: 0,
          totalPlayers: 0,
          averageScore: 0,
          averageRating: 0,
        },
        topQuizzes: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    const stats = await this.db
      .select()
      .from(quizStats)
      .where(inArray(quizStats.quizId, quizIdList));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const totalAttempts = stats.reduce((sum, s) => sum + Number(s.totalAttempts), 0);
    const totalPlayers = stats.reduce((sum, s) => sum + Number(s.totalPlayers), 0);
    const activeQuizzes = stats.filter(
      (s) => s.lastAttemptAt && s.lastAttemptAt >= thirtyDaysAgo,
    ).length;

    const totalRatingSum = stats.reduce(
      (sum, s) => sum + Number(s.avgRating) * Number(s.ratingCount),
      0,
    );
    const totalRatingCount = stats.reduce((sum, s) => sum + Number(s.ratingCount), 0);

    const topQuizzes = await this.getPopularQuizzes(5, categoryId);

    return {
      categoryId,
      categoryName: category[0].name,
      summary: {
        totalQuizzes: quizIdList.length,
        activeQuizzes,
        totalAttempts,
        totalPlayers,
        averageScore:
          totalAttempts > 0
            ? stats.reduce(
                (sum, s) => sum + Number(s.avgScorePercent) * Number(s.totalAttempts),
                0,
              ) / totalAttempts
            : 0,
        averageRating: totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0,
      },
      topQuizzes,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCreatorAnalytics(userId: string): Promise<CreatorAnalytics | null> {
    const creatorQuizzes = await this.db
      .select({ quizId: quizzes.quizId, title: quizzes.title })
      .from(quizzes)
      .where(and(eq(quizzes.creatorId, userId), isNull(quizzes.deletedAt)));

    const quizIdList = creatorQuizzes.map((q) => q.quizId);
    const publishedQuizIds = creatorQuizzes.filter(() => true).map((q) => q.quizId);

    if (quizIdList.length === 0) {
      return {
        userId,
        totalQuizzes: 0,
        publishedQuizzes: 0,
        totalAttempts: 0,
        totalPlayers: 0,
        totalReviews: 0,
        averageRating: 0,
        topPerformingQuiz: null,
        worstPerformingQuiz: null,
        lastUpdated: new Date().toISOString(),
      };
    }

    const stats =
      quizIdList.length > 0
        ? await this.db.select().from(quizStats).where(inArray(quizStats.quizId, quizIdList))
        : [];

    const totalAttempts = stats.reduce((sum, s) => sum + Number(s.totalAttempts), 0);
    const totalPlayers = stats.reduce((sum, s) => sum + Number(s.totalPlayers), 0);

    const totalRatingSum = stats.reduce(
      (sum, s) => sum + Number(s.avgRating) * Number(s.ratingCount),
      0,
    );
    const totalRatingCount = stats.reduce((sum, s) => sum + Number(s.ratingCount), 0);

    const quizMap = new Map(creatorQuizzes.map((q) => [q.quizId, q.title]));

    const sortedByPopularity = [...stats].sort(
      (a, b) => Number(b.popularityScore) - Number(a.popularityScore),
    );

    const topPerformingQuiz = sortedByPopularity[0]
      ? {
          rank: 1,
          quizId: sortedByPopularity[0].quizId as string,
          title: quizMap.get(sortedByPopularity[0].quizId as string) ?? '',
          slug: '',
          imageUrl: null,
          popularityScore: Number(sortedByPopularity[0].popularityScore),
          totalAttempts: Number(sortedByPopularity[0].totalAttempts),
          averageRating: Number(sortedByPopularity[0].avgRating),
          bookmarkCount: Number(sortedByPopularity[0].bookmarkCount),
        }
      : null;

    const sortedByScore = [...stats].sort(
      (a, b) => Number(a.avgScorePercent) - Number(b.avgScorePercent),
    );

    const worstPerformingQuiz = sortedByScore[0]
      ? {
          quizId: sortedByScore[0].quizId as string,
          title: quizMap.get(sortedByScore[0].quizId as string) ?? '',
          averageScore: Number(sortedByScore[0].avgScorePercent),
        }
      : null;

    return {
      userId,
      totalQuizzes: creatorQuizzes.length,
      publishedQuizzes: publishedQuizIds.length,
      totalAttempts,
      totalPlayers,
      totalReviews: totalRatingCount,
      averageRating: totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0,
      topPerformingQuiz,
      worstPerformingQuiz,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getRecentAttemptsByQuiz(quizId: string, hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const versionIds = await this.db
      .select({ quizVersionId: quizVersions.quizVersionId })
      .from(quizVersions)
      .where(eq(quizVersions.quizId, quizId));

    const versionIdList = versionIds.map((v) => v.quizVersionId);

    if (versionIdList.length === 0) {
      return 0;
    }

    const result = await this.db
      .select({ count: count() })
      .from(quizAttempts)
      .where(
        and(inArray(quizAttempts.quizVersionId, versionIdList), gte(quizAttempts.createdAt, since)),
      );

    return Number(result[0]?.count ?? 0);
  }
}
