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
  tags,
  quizTags,
} from '@/core/database/schema';
import { eq, sql, desc, and, isNull, gte, count, inArray } from 'drizzle-orm';
import type {
  AttemptAggregation,
  ReviewAggregation,
  TrendingQuiz,
  PopularQuiz,
  CategoryAnalytics,
  CreatorAnalytics,
  TagAnalytics,
  QuizStatsRow,
} from './types';
import type { QuizAnalyticsRepositoryPort } from './ports/quiz-analytics.repository-port';

@Injectable()
export class QuizAnalyticsRepository implements QuizAnalyticsRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ─── STATS ──────────────────────────────────────────────────────────────────

  async getQuizStats(quizId: string): Promise<QuizStatsRow | null> {
    const [stats] = await this.db.select().from(quizStats).where(eq(quizStats.quizId, quizId));
    return stats ?? null;
  }

  async upsertQuizStats(quizId: string, data: Partial<QuizStatsRow>): Promise<void> {
    // bigint { mode: 'number' } → number, numeric columns → string
    await this.db
      .insert(quizStats)
      .values({
        quizId,
        totalAttempts: data.totalAttempts ?? 0, // bigint mode:'number' → number
        totalPlayers: data.totalPlayers ?? 0, // bigint mode:'number' → number
        avgScorePercent: data.avgScorePercent ?? '0', // numeric → string
        avgRating: data.avgRating ?? '0', // numeric → string
        ratingCount: data.ratingCount ?? 0,
        bookmarkCount: data.bookmarkCount ?? 0,
        completionRate: data.completionRate ?? '0', // numeric → string
        popularityScore: data.popularityScore ?? '0', // numeric → string
        trendingScore: data.trendingScore ?? '0', // numeric → string
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

  async getAllQuizStats(): Promise<QuizStatsRow[]> {
    return this.db.select().from(quizStats);
  }

  // ─── AGGREGATIONS ───────────────────────────────────────────────────────────

  async aggregateAttemptsByQuiz(quizId: string): Promise<AttemptAggregation> {
    const versionIds = await this.db
      .select({ quizVersionId: quizVersions.quizVersionId })
      .from(quizVersions)
      .where(eq(quizVersions.quizId, quizId));

    const versionIdList = versionIds.map((v: { quizVersionId: string }) => v.quizVersionId);
    if (versionIdList.length === 0) {
      return { totalAttempts: 0, completedAttempts: 0, uniquePlayers: 0, averageScore: 0 };
    }

    const [stats] = await this.db
      .select({
        totalAttempts: count(),
        completedAttempts: sql<number>`SUM(CASE WHEN ${quizAttempts.status} = 'completed' THEN 1 ELSE 0 END)`,
        uniquePlayers: sql<number>`COUNT(DISTINCT ${quizAttempts.userId})`,
        averageScore: sql<number>`AVG(CASE WHEN ${quizAttempts.status} = 'completed' THEN ${quizAttempts.scorePercent}::numeric ELSE NULL END)`,
      })
      .from(quizAttempts)
      .where(inArray(quizAttempts.quizVersionId, versionIdList));

    return {
      totalAttempts: Number(stats?.totalAttempts ?? 0),
      completedAttempts: Number(stats?.completedAttempts ?? 0),
      uniquePlayers: Number(stats?.uniquePlayers ?? 0),
      averageScore: Number(stats?.averageScore ?? 0),
    };
  }

  async aggregateReviewsByQuiz(quizId: string): Promise<ReviewAggregation> {
    const [stats] = await this.db
      .select({
        averageRating: sql<number>`AVG(${quizReviews.rating}::numeric)`,
        ratingCount: count(),
      })
      .from(quizReviews)
      .where(eq(quizReviews.quizId, quizId));

    return {
      averageRating: Number(stats?.averageRating ?? 0),
      ratingCount: Number(stats?.ratingCount ?? 0),
    };
  }

  async aggregateBookmarksByQuiz(quizId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(bookmarkedQuizzes)
      .where(eq(bookmarkedQuizzes.quizId, quizId));

    return Number(result?.count ?? 0);
  }

  // ─── TRENDING & POPULAR ─────────────────────────────────────────────────────

  async getTrendingQuizzes(limit: number, categoryId?: string): Promise<TrendingQuiz[]> {
    const results = await this.db
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

    // Filter by category in application layer (avoids complex join + re-ranking)
    let filtered: Array<{
      quizId: string;
      title: string;
      slug: string;
      imageUrl: string | null;
      trendingScore: unknown;
      totalAttempts: unknown;
    }> = results;
    if (categoryId) {
      const categoryQuizIds = await this.db
        .select({ quizId: quizCategories.quizId })
        .from(quizCategories)
        .where(eq(quizCategories.categoryId, categoryId));

      const categoryQuizIdSet = new Set(categoryQuizIds.map((c) => c.quizId));
      filtered = results.filter((r) => categoryQuizIdSet.has(r.quizId)).slice(0, limit);
    }

    // Fetch recentAttempts sequentially to avoid N parallel DB hammers on large lists
    const trendingQuizzes: TrendingQuiz[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const row = filtered[i];
      const recentAttempts = await this.getRecentAttemptsByQuiz(row.quizId as string, 168);
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
    const results = await this.db
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

    let filtered: Array<{
      quizId: string;
      title: string;
      slug: string;
      imageUrl: string | null;
      popularityScore: unknown;
      totalAttempts: unknown;
      avgRating: unknown;
      bookmarkCount: unknown;
    }> = results;
    if (categoryId) {
      const categoryQuizIds = await this.db
        .select({ quizId: quizCategories.quizId })
        .from(quizCategories)
        .where(eq(quizCategories.categoryId, categoryId));

      const categoryQuizIdSet = new Set(categoryQuizIds.map((c) => c.quizId));
      filtered = results.filter((r) => categoryQuizIdSet.has(r.quizId)).slice(0, limit);
    }

    return filtered.map((row, i) => ({
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
  }

  // ─── ANALYTICS ──────────────────────────────────────────────────────────────

  async getCategoryAnalytics(categoryId: string): Promise<CategoryAnalytics | null> {
    const [category] = await this.db
      .select({ categoryId: categories.categoryId, name: categories.name })
      .from(categories)
      .where(eq(categories.categoryId, categoryId))
      .limit(1);

    if (!category) return null;

    const categoryQuizIds = await this.db
      .select({ quizId: quizCategories.quizId })
      .from(quizCategories)
      .where(eq(quizCategories.categoryId, categoryId));

    const quizIdList = categoryQuizIds.map((c) => c.quizId);

    if (quizIdList.length === 0) {
      return {
        categoryId,
        categoryName: category.name,
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

    // Compute cutoff once, not inside .filter() on every iteration
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
    const averageScore =
      totalAttempts > 0
        ? stats.reduce((sum, s) => sum + Number(s.avgScorePercent) * Number(s.totalAttempts), 0) /
          totalAttempts
        : 0;

    return {
      categoryId,
      categoryName: category.name,
      summary: {
        totalQuizzes: quizIdList.length,
        activeQuizzes,
        totalAttempts,
        totalPlayers,
        averageScore,
        averageRating: totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0,
      },
      topQuizzes: await this.getPopularQuizzes(5, categoryId),
      lastUpdated: new Date().toISOString(),
    };
  }

  async getCreatorAnalytics(userId: string): Promise<CreatorAnalytics | null> {
    // Fetch quizzes + stats in one join — phiên bản 2 approach, tránh 2 round-trips
    const creatorQuizzes: Array<{
      quizId: string;
      title: string;
      slug: string;
      imageUrl: string | null;
      totalAttempts: unknown;
      totalPlayers: unknown;
      avgRating: unknown;
      ratingCount: unknown;
      popularityScore: unknown;
      bookmarkCount: unknown;
      avgScorePercent: unknown;
    }> = await this.db
      .select({
        quizId: quizzes.quizId,
        title: quizzes.title,
        slug: quizzes.slug,
        imageUrl: quizzes.imageUrl,
        totalAttempts: quizStats.totalAttempts,
        totalPlayers: quizStats.totalPlayers,
        avgRating: quizStats.avgRating,
        ratingCount: quizStats.ratingCount,
        popularityScore: quizStats.popularityScore,
        bookmarkCount: quizStats.bookmarkCount,
        avgScorePercent: quizStats.avgScorePercent,
      })
      .from(quizzes)
      .leftJoin(quizStats, eq(quizStats.quizId, quizzes.quizId))
      .where(and(eq(quizzes.creatorId, userId), isNull(quizzes.deletedAt)));

    if (creatorQuizzes.length === 0) {
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

    const totalAttempts = creatorQuizzes.reduce((sum, q) => sum + Number(q.totalAttempts ?? 0), 0);
    const totalPlayers = creatorQuizzes.reduce((sum, q) => sum + Number(q.totalPlayers ?? 0), 0);
    const totalRatingSum = creatorQuizzes.reduce(
      (sum, q) => sum + Number(q.avgRating ?? 0) * Number(q.ratingCount ?? 0),
      0,
    );
    const totalRatingCount = creatorQuizzes.reduce((sum, q) => sum + Number(q.ratingCount ?? 0), 0);

    const sortedByPopularity = [...creatorQuizzes].sort(
      (a, b) => Number(b.popularityScore ?? 0) - Number(a.popularityScore ?? 0),
    );
    const sortedByScore = [...creatorQuizzes].sort(
      (a, b) => Number(a.avgScorePercent ?? 0) - Number(b.avgScorePercent ?? 0),
    );

    const top = sortedByPopularity[0];
    const worst = sortedByScore[0];

    return {
      userId,
      totalQuizzes: creatorQuizzes.length,
      publishedQuizzes: creatorQuizzes.length, // all non-deleted = published
      totalAttempts,
      totalPlayers,
      totalReviews: totalRatingCount,
      averageRating: totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0,
      topPerformingQuiz: top
        ? {
            rank: 1,
            quizId: top.quizId as string,
            title: top.title,
            slug: top.slug,
            imageUrl: top.imageUrl,
            popularityScore: Number(top.popularityScore ?? 0),
            totalAttempts: Number(top.totalAttempts ?? 0),
            averageRating: Number(top.avgRating ?? 0),
            bookmarkCount: Number(top.bookmarkCount ?? 0),
          }
        : null,
      worstPerformingQuiz: worst
        ? {
            quizId: worst.quizId as string,
            title: worst.title,
            averageScore: Number(worst.avgScorePercent ?? 0),
          }
        : null,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ─── TAG ANALYTICS ──────────────────────────────────────────────────────────

  async getTagAnalytics(tagId: string): Promise<TagAnalytics | null> {
    const [tag] = await this.db
      .select({ tagId: tags.tagId, name: tags.name })
      .from(tags)
      .where(eq(tags.tagId, tagId))
      .limit(1);

    if (!tag) return null;

    const tagQuizIds = await this.db
      .select({ quizId: quizTags.quizId })
      .from(quizTags)
      .where(eq(quizTags.tagId, tagId));

    const quizIdList = tagQuizIds.map((t) => t.quizId);

    if (quizIdList.length === 0) {
      return {
        tagId,
        tagName: tag.name,
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
    const averageScore =
      totalAttempts > 0
        ? stats.reduce((sum, s) => sum + Number(s.avgScorePercent) * Number(s.totalAttempts), 0) /
          totalAttempts
        : 0;

    return {
      tagId,
      tagName: tag.name,
      summary: {
        totalQuizzes: quizIdList.length,
        activeQuizzes,
        totalAttempts,
        totalPlayers,
        averageScore,
        averageRating: totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0,
      },
      topQuizzes: await this.getPopularQuizzesByTag(5, quizIdList),
      lastUpdated: new Date().toISOString(),
    };
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  async getPopularQuizzesByTag(
    limit: number,
    tagQuizIds: string[],
  ): Promise<TagAnalytics['topQuizzes']> {
    if (tagQuizIds.length === 0) return [];

    const results = await this.db
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
      .where(and(inArray(quizStats.quizId, tagQuizIds), isNull(quizzes.deletedAt)))
      .orderBy(desc(quizStats.popularityScore))
      .limit(limit);

    return results.map((row, i) => ({
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
  }

  async getRecentAttemptsByQuiz(quizId: string, hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const versionIds: Array<{ quizVersionId: string }> = await this.db
      .select({ quizVersionId: quizVersions.quizVersionId })
      .from(quizVersions)
      .where(eq(quizVersions.quizId, quizId));

    const versionIdList = versionIds.map((v) => v.quizVersionId);
    if (versionIdList.length === 0) return 0;

    const [result] = await this.db
      .select({ count: count() })
      .from(quizAttempts)
      .where(
        and(inArray(quizAttempts.quizVersionId, versionIdList), gte(quizAttempts.createdAt, since)),
      );

    return Number(result?.count ?? 0);
  }
}
