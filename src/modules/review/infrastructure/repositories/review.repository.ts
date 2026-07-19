import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  TransactionalContext,
  TRANSACTIONAL_CONTEXT,
} from '@/common/interceptors/transactional-context';
import {
  quizReviews,
  users,
  quizzes,
  quizAttempts,
  quizVersions,
  userProfiles,
  categories,
  quizTags,
  tags,
  reviewHelpfulVotes,
} from '@/core/database/schema';
import type {
  ReviewRow,
  ReviewDetailRow,
  MyReviewRow,
  ReviewRepositoryPort,
  ReviewStatsRow,
  ReviewDashboardRow,
  ReviewDetailByIdRow,
} from '@/modules/review/domain/ports';
import type { ReviewSort } from '@/modules/review/domain/ports';

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
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional()
    @Inject(TRANSACTIONAL_CONTEXT)
    private readonly transactionalContext?: TransactionalContext,
  ) {}

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

  async getMyQuizReview(quizId: string, userId: string): Promise<ReviewDetailByIdRow | null> {
    const [row] = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        quizTitle: quizzes.title,
        userId: quizReviews.userId,
        username: users.username,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      })
      .from(quizReviews)
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .where(and(eq(quizReviews.quizId, quizId), eq(quizReviews.userId, userId)))
      .limit(1);

    return (row as ReviewDetailByIdRow | undefined) ?? null;
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

  async findReviewById(reviewId: string): Promise<ReviewDetailByIdRow | null> {
    const [row] = await this.db
      .select({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        quizTitle: quizzes.title,
        userId: quizReviews.userId,
        username: users.username,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
        helpfulCount: quizReviews.helpfulCount,
      })
      .from(quizReviews)
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return (row as ReviewDetailByIdRow | undefined) ?? null;
  }

  async listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: { createdAt: string; reviewId: string } | null;
    rating?: number;
    sort?: ReviewSort;
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

    const baseWhere =
      params.rating !== undefined
        ? and(eq(quizReviews.quizId, params.quizId), eq(quizReviews.rating, params.rating))
        : eq(quizReviews.quizId, params.quizId);

    const baseSelect = {
      reviewId: quizReviews.reviewId,
      quizId: quizReviews.quizId,
      userId: quizReviews.userId,
      rating: quizReviews.rating,
      comment: quizReviews.comment,
      createdAt: quizReviews.createdAt,
      updatedAt: quizReviews.updatedAt,
      helpfulCount: quizReviews.helpfulCount,
      username: users.username,
      userAvatarUrl: userProfiles.avatarUrl,
    };

    if (params.sort === 'helpful') {
      const rows = await this.db
        .select(baseSelect)
        .from(quizReviews)
        .innerJoin(users, eq(quizReviews.userId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(params.cursor ? and(baseWhere, cursorCondition) : baseWhere)
        .orderBy(desc(quizReviews.helpfulCount), desc(quizReviews.reviewId))
        .limit(params.limit + 1);

      return rows as unknown as ReviewDetailRow[];
    }

    if (params.sort === 'highest_rating') {
      const rows = await this.db
        .select(baseSelect)
        .from(quizReviews)
        .innerJoin(users, eq(quizReviews.userId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(params.cursor ? and(baseWhere, cursorCondition) : baseWhere)
        .orderBy(desc(quizReviews.rating), desc(quizReviews.reviewId))
        .limit(params.limit + 1);

      return rows as ReviewDetailRow[];
    }

    if (params.sort === 'lowest_rating') {
      const rows = await this.db
        .select(baseSelect)
        .from(quizReviews)
        .innerJoin(users, eq(quizReviews.userId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(params.cursor ? and(baseWhere, cursorCondition) : baseWhere)
        .orderBy(asc(quizReviews.rating), desc(quizReviews.reviewId))
        .limit(params.limit + 1);

      return rows as ReviewDetailRow[];
    }

    const rows = await this.db
      .select(baseSelect)
      .from(quizReviews)
      .innerJoin(users, eq(quizReviews.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(params.cursor ? and(baseWhere, cursorCondition) : baseWhere)
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
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
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

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsRow | null> {
    const [row] = await this.db
      .select({
        averageRating: sql<number>`COALESCE(ROUND(AVG(${quizReviews.rating})::numeric, 1), 0)`.as(
          'average_rating',
        ),
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
        lastUpdated: sql<string>`COALESCE(MAX(${quizReviews.updatedAt})::text, NOW()::text)`.as(
          'last_updated',
        ),
      })
      .from(quizReviews)
      .where(eq(quizReviews.userId, userId));

    const [favoriteCategory] = await this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
      })
      .from(quizReviews)
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(categories, eq(quizzes.categoryId, categories.categoryId))
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

  /**
   * Atomically insert a helpful vote for `(reviewId, userId)` and bump
   * `quiz_reviews.helpful_count` by 1 in the same transaction.
   *
   * Idempotent at the database level: the unique constraint on
   * `review_helpful_votes (review_id, user_id)` makes a duplicate insert a
   * no-op (no row returned from the `ON CONFLICT DO NOTHING RETURNING`),
   * and the counter is left untouched in that case.
   *
   * Returns `true` when the vote was actually inserted, `false` when the
   * vote already existed.
   *
   * Joins the active outer transaction if one is open (via the shared
   * `TransactionalContext`); otherwise opens its own transaction so the
   * insert and the counter bump commit or roll back together.
   */
  async addHelpfulVote(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<boolean> {
    const { reviewId, userId, nowIso } = params;

    const executeAdd = async (tx: unknown): Promise<boolean> => {
      const db = tx as DrizzleDB;

      const inserted = await db
        .insert(reviewHelpfulVotes)
        .values({ reviewId, userId, createdAt: nowIso })
        .onConflictDoNothing({
          target: [reviewHelpfulVotes.reviewId, reviewHelpfulVotes.userId],
        })
        .returning({ voteId: reviewHelpfulVotes.voteId });

      if (inserted.length === 0) {
        return false;
      }

      await db
        .update(quizReviews)
        .set({ helpfulCount: sql`helpful_count + 1` })
        .where(eq(quizReviews.reviewId, reviewId));

      return true;
    };

    const existingTx = this.transactionalContext?.getDbClient() as DrizzleDB | null;
    if (existingTx) {
      return executeAdd(existingTx);
    }

    return this.db.transaction(async (tx) => executeAdd(tx));
  }

  /**
   * Atomically delete a helpful vote for `(reviewId, userId)` and decrement
   * `quiz_reviews.helpful_count` by 1 in the same transaction.
   *
   * Returns `true` when a row was actually deleted, `false` when there was
   * no vote to remove.
   *
   * Joins the active outer transaction if one is open; otherwise opens
   * its own transaction.
   */
  async removeHelpfulVote(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<boolean> {
    const { reviewId, userId } = params;

    const executeRemove = async (tx: unknown): Promise<boolean> => {
      const db = tx as DrizzleDB;

      const deleted = await db
        .delete(reviewHelpfulVotes)
        .where(
          and(eq(reviewHelpfulVotes.reviewId, reviewId), eq(reviewHelpfulVotes.userId, userId)),
        )
        .returning({ voteId: reviewHelpfulVotes.voteId });

      if (deleted.length === 0) {
        return false;
      }

      await db
        .update(quizReviews)
        .set({ helpfulCount: sql`helpful_count - 1` })
        .where(eq(quizReviews.reviewId, reviewId));

      return true;
    };

    const existingTx = this.transactionalContext?.getDbClient() as DrizzleDB | null;
    if (existingTx) {
      return executeRemove(existingTx);
    }

    return this.db.transaction(async (tx) => executeRemove(tx));
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
}
