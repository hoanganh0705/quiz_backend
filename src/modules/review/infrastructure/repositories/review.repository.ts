import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  quizReviews,
  users,
  quizzes,
  quizAttempts,
  quizVersions,
  userProfiles,
  quizCategories,
  categories,
  quizTags,
  tags,
  reviewHelpfulVotes,
  reviewReports,
} from '@/core/database/schema';
import type {
  ReviewRow,
  ReviewDetailRow,
  MyReviewRow,
  ReviewRepositoryPort,
  ReviewStatsRow,
  ReviewDashboardRow,
  ReviewHelpfulVoteRow,
  ReviewReportRow,
} from '@/modules/review/domain/ports';

const QUIZ_COLUMNS = quizzes as unknown as {
  quizId: AnyPgColumn;
};

const QUIZ_VERSION_COLUMNS = quizVersions as unknown as {
  quizVersionId: AnyPgColumn;
  quizId: AnyPgColumn;
  difficulty: AnyPgColumn;
  status: AnyPgColumn;
};

const QUIZ_ATTEMPT_COLUMNS = quizAttempts as unknown as {
  quizVersionId: AnyPgColumn;
  userId: AnyPgColumn;
  status: AnyPgColumn;
};

@Injectable()
export class ReviewRepository implements ReviewRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getReviewByQuizAndUser(quizId: string, userId: string): Promise<ReviewRow | null> {
    const [row] = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        userId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      })
      .from(quizReviews)
      .where(and(eq(quizReviews.quizId, quizId), eq(quizReviews.userId, userId)))
      .limit(1);

    return (row as ReviewRow | undefined) ?? null;
  }

  async getReviewById(reviewId: string): Promise<ReviewRow | null> {
    const [row] = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        userId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      })
      .from(quizReviews)
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return (row as ReviewRow | undefined) ?? null;
  }

  async findReviewById(reviewId: string): Promise<import('@/modules/review/domain/ports').ReviewDetailByIdRow | null> {
    const [row] = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        quizTitle: quizzes.title,
        userId: quizReviews.userId,
        username: users.username,
        rating: quizReviews.rating,
        content: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      })
      .from(quizReviews)
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return (row as import('@/modules/review/domain/ports').ReviewDetailByIdRow | undefined) ?? null;
  }

  async listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: { createdAt: string; reviewId: string } | null;
    rating?: number;
  }): Promise<ReviewDetailRow[]> {
    const cursorCondition = params.cursor
      ? or(
          sql`${quizReviews.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(quizReviews.createdAt, params.cursor.createdAt),
            sql`${quizReviews.reviewId} < ${params.cursor.reviewId}`,
          ),
        )
      : undefined;

    const rows = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        userId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
        username: users.username,
        userAvatarUrl: userProfiles.avatarUrl,
      })
      .from(quizReviews)
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        params.cursor
          ? and(
              eq(quizReviews.quizId, params.quizId),
              params.rating !== undefined ? eq(quizReviews.rating, params.rating) : undefined,
              cursorCondition,
            )
          : and(
              eq(quizReviews.quizId, params.quizId),
              params.rating !== undefined ? eq(quizReviews.rating, params.rating) : undefined,
            ),
      )
      .orderBy(desc(quizReviews.createdAt), desc(quizReviews.reviewId))
      .limit(params.limit + 1);

    return rows as ReviewDetailRow[];
  }

  async listUserReviews(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; reviewId: string } | null;
  }): Promise<MyReviewRow[]> {
    const cursorCondition = params.cursor
      ? or(
          sql`${quizReviews.createdAt} < ${params.cursor.createdAt}`,
          and(
            eq(quizReviews.createdAt, params.cursor.createdAt),
            sql`${quizReviews.reviewId} < ${params.cursor.reviewId}`,
          ),
        )
      : undefined;

    const rows = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        quizTitle: quizzes.title,
        rating: quizReviews.rating,
        content: quizReviews.comment,
        createdAt: quizReviews.createdAt,
      })
      .from(quizReviews)
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .where(
        params.cursor
          ? and(eq(quizReviews.userId, params.userId), cursorCondition)
          : eq(quizReviews.userId, params.userId),
      )
      .orderBy(desc(quizReviews.createdAt), desc(quizReviews.reviewId))
      .limit(params.limit + 1);

    return rows as MyReviewRow[];
  }

  async listReviewsByUser(params: {
    userId: string;
    limit: number;
    cursor?: { createdAt: string; reviewId: string } | null;
  }): Promise<MyReviewRow[]> {
    return this.listUserReviews(params);
  }

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsRow | null> {
    const [row] = await this.db
      .select({
        averageRating: sql<number>`COALESCE(ROUND(AVG(${quizReviews.rating})::numeric, 1), 0)`.as('average_rating'),
        totalReviews: sql<number>`COUNT(${quizReviews.reviewId})`.as('total_reviews'),
        rating1: sql<number>`COUNT(CASE WHEN ${quizReviews.rating} = 1 THEN 1 END)`.as('rating_1'),
        rating2: sql<number>`COUNT(CASE WHEN ${quizReviews.rating} = 2 THEN 1 END)`.as('rating_2'),
        rating3: sql<number>`COUNT(CASE WHEN ${quizReviews.rating} = 3 THEN 1 END)`.as('rating_3'),
        rating4: sql<number>`COUNT(CASE WHEN ${quizReviews.rating} = 4 THEN 1 END)`.as('rating_4'),
        rating5: sql<number>`COUNT(CASE WHEN ${quizReviews.rating} = 5 THEN 1 END)`.as('rating_5'),
      })
      .from(quizReviews)
      .where(eq(quizReviews.quizId, quizId));

    return (row as ReviewStatsRow | undefined) ?? null;
  }

  async getUserReviewDashboard(userId: string): Promise<ReviewDashboardRow> {
    const [summaryRow] = await this.db
      .select({
        totalReviews: sql<number>`COUNT(${quizReviews.reviewId})`.as('total_reviews'),
        averageRatingGiven:
          sql<number>`COALESCE(ROUND(AVG(${quizReviews.rating})::numeric, 1), 0)`.as(
            'average_rating_given',
          ),
        lastUpdated:
          sql<string>`COALESCE(MAX(${quizReviews.updatedAt}), NOW()::text)`.as('last_updated'),
      })
      .from(quizReviews)
      .where(eq(quizReviews.userId, userId));

    const [favoriteCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
      })
      .from(quizReviews)
      .innerJoin(quizCategories, eq(quizReviews.quizId, quizCategories.quizId))
      .innerJoin(categories, eq(quizCategories.categoryId, categories.categoryId))
      .where(eq(quizReviews.userId, userId))
      .groupBy(categories.categoryId, categories.name)
      .orderBy(sql`COUNT(*) DESC`, categories.name)
      .limit(1);

    const [favoriteTag] = await this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
      })
      .from(quizReviews)
      .innerJoin(quizTags, eq(quizReviews.quizId, quizTags.quizId))
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .where(eq(quizReviews.userId, userId))
      .groupBy(tags.tagId, tags.name)
      .orderBy(sql`COUNT(*) DESC`, tags.name)
      .limit(1);

    return {
      totalReviews: Number(summaryRow?.totalReviews ?? 0),
      averageRatingGiven: Number(summaryRow?.averageRatingGiven ?? 0),
      favoriteCategory: favoriteCategory ?? null,
      favoriteTag: favoriteTag ?? null,
      lastUpdated: summaryRow?.lastUpdated ?? new Date().toISOString(),
    };
  }

  async markReviewHelpful(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<ReviewHelpfulVoteRow> {
    const { reviewId, userId, nowIso } = params;

    const [existingVote] = await this.db
      .select({
        voteId: reviewHelpfulVotes.voteId,
        reviewId: reviewHelpfulVotes.reviewId,
        userId: reviewHelpfulVotes.userId,
        createdAt: reviewHelpfulVotes.createdAt,
      })
      .from(reviewHelpfulVotes)
      .where(
        and(eq(reviewHelpfulVotes.reviewId, reviewId), eq(reviewHelpfulVotes.userId, userId)),
      )
      .limit(1);

    if (existingVote) {
      return existingVote as ReviewHelpfulVoteRow;
    }

    const [createdVote] = await this.db
      .insert(reviewHelpfulVotes)
      .values({ reviewId, userId, createdAt: nowIso })
      .returning({
        voteId: reviewHelpfulVotes.voteId,
        reviewId: reviewHelpfulVotes.reviewId,
        userId: reviewHelpfulVotes.userId,
        createdAt: reviewHelpfulVotes.createdAt,
      });

    return createdVote as ReviewHelpfulVoteRow;
  }

  async hasUserReportedReview(reviewId: string, reporterId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ reportId: reviewReports.reportId })
      .from(reviewReports)
      .where(and(eq(reviewReports.reviewId, reviewId), eq(reviewReports.reporterId, reporterId)))
      .limit(1);

    return row !== undefined;
  }

  async createReport(params: {
    reviewId: string;
    reporterId: string;
    reason: string;
    details: string | null;
    nowIso: string;
  }): Promise<ReviewReportRow> {
    const [report] = await this.db
      .insert(reviewReports)
      .values({
        reviewId: params.reviewId,
        reporterId: params.reporterId,
        reason: params.reason,
        details: params.details,
        status: 'open',
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        reportId: reviewReports.reportId,
        reviewId: reviewReports.reviewId,
        reporterId: reviewReports.reporterId,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        createdAt: reviewReports.createdAt,
        updatedAt: reviewReports.updatedAt,
      });

    return report as ReviewReportRow;
  }

  async removeReviewHelpfulVote(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<void> {
    const { reviewId, userId } = params;

    await this.db
      .delete(reviewHelpfulVotes)
      .where(and(eq(reviewHelpfulVotes.reviewId, reviewId), eq(reviewHelpfulVotes.userId, userId)));
  }

  async createReview(params: {
    quizId: string;
    userId: string;
    rating: number;
    comment: string | null;
    nowIso: string;
  }): Promise<ReviewRow> {
    const [created] = await this.db
      .insert(quizReviews)
      .values({
        quizId: params.quizId,
        userId: params.userId,
        rating: params.rating,
        comment: params.comment,
        createdAt: params.nowIso,
        updatedAt: params.nowIso,
      })
      .returning({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        userId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      });

    return created as ReviewRow;
  }

  async updateReview(params: {
    reviewId: string;
    rating: number;
    comment: string | null;
    nowIso: string;
  }): Promise<ReviewRow> {
    const [updated] = await this.db
      .update(quizReviews)
      .set({
        rating: params.rating,
        comment: params.comment,
        updatedAt: params.nowIso,
      })
      .where(eq(quizReviews.reviewId, params.reviewId))
      .returning({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        userId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      });

    return updated as ReviewRow;
  }

  async deleteReview(reviewId: string): Promise<void> {
    await this.db.delete(quizReviews).where(eq(quizReviews.reviewId, reviewId));
  }

  async hasCompletedAttempt(quizId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ attemptId: quizAttempts.attemptId })
      .from(quizAttempts)
      .innerJoin(
        quizVersions,
        eq(QUIZ_ATTEMPT_COLUMNS.quizVersionId, QUIZ_VERSION_COLUMNS.quizVersionId),
      )
      .where(
        and(
          eq(QUIZ_VERSION_COLUMNS.quizId, quizId),
          eq(QUIZ_ATTEMPT_COLUMNS.userId, userId),
          eq(QUIZ_ATTEMPT_COLUMNS.status, 'completed'),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async getPublishedQuizVersionDifficulty(quizId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ difficulty: QUIZ_VERSION_COLUMNS.difficulty })
      .from(quizVersions)
      .innerJoin(quizzes, eq(QUIZ_VERSION_COLUMNS.quizId, QUIZ_COLUMNS.quizId))
      .where(and(eq(QUIZ_COLUMNS.quizId, quizId), eq(QUIZ_VERSION_COLUMNS.status, 'published')))
      .limit(1);

    return (row?.difficulty as string | null) ?? null;
  }
}
