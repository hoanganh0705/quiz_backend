import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, asc, desc, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
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
  ReviewCursor,
  ReviewHelpfulCursor,
  ReviewListCursor,
  ReviewSort,
} from '@/modules/review/domain/ports';

type DbClient = DrizzleDB;

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

  private static readonly ACTIVE_REVIEW_PREDICATE = isNull(quizReviews.deletedAt);

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
      .where(
        and(
          eq(quizReviews.quizId, quizId),
          eq(quizReviews.userId, userId),
          ReviewRepository.ACTIVE_REVIEW_PREDICATE,
        ),
      )
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
      .where(
        and(
          eq(quizReviews.quizId, quizId),
          eq(quizReviews.userId, userId),
          ReviewRepository.ACTIVE_REVIEW_PREDICATE,
        ),
      )
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
      .where(and(eq(quizReviews.reviewId, reviewId), ReviewRepository.ACTIVE_REVIEW_PREDICATE))
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
      .where(and(eq(quizReviews.reviewId, reviewId), ReviewRepository.ACTIVE_REVIEW_PREDICATE))
      .limit(1);

    return (row as ReviewDetailByIdRow | undefined) ?? null;
  }

  async listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: ReviewListCursor | null;
    rating?: number;
    sort?: ReviewSort;
  }): Promise<ReviewDetailRow[]> {
    const baseWhere =
      params.rating !== undefined
        ? and(
            eq(quizReviews.quizId, params.quizId),
            eq(quizReviews.rating, params.rating),
            ReviewRepository.ACTIVE_REVIEW_PREDICATE,
          )
        : and(eq(quizReviews.quizId, params.quizId), ReviewRepository.ACTIVE_REVIEW_PREDICATE);

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
      const cursor = params.cursor as ReviewHelpfulCursor | null | undefined;
      const cursorCondition = cursor
        ? or(
            sql`${quizReviews.helpfulCount} < ${cursor.helpfulCount}`,
            and(
              eq(quizReviews.helpfulCount, cursor.helpfulCount),
              sql`${quizReviews.reviewId} < ${cursor.reviewId}`,
            ),
          )
        : undefined;

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

    const cursor = params.cursor as ReviewCursor | null | undefined;
    const cursorCondition = cursor
      ? or(
          sql`${quizReviews.createdAt} < ${cursor.createdAt}`,
          and(
            eq(quizReviews.createdAt, cursor.createdAt),
            sql`${quizReviews.reviewId} < ${cursor.reviewId}`,
          ),
        )
      : undefined;

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

    const visibilityPredicate = and(
      eq(quizzes.isHidden, false),
      isNotNull(quizzes.publishedVersionId),
    );

    const visibilityAndActive = and(visibilityPredicate, ReviewRepository.ACTIVE_REVIEW_PREDICATE);

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
          ? and(eq(quizReviews.userId, params.userId), visibilityAndActive, cursorCondition)
          : and(eq(quizReviews.userId, params.userId), visibilityAndActive),
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
      .where(and(eq(quizReviews.quizId, quizId), ReviewRepository.ACTIVE_REVIEW_PREDICATE));

    return (row as ReviewStatsRow | undefined) ?? null;
  }

  async getUserReviewDashboard(userId: string): Promise<ReviewDashboardRow> {
    const summarySelect = {
      totalReviews: sql<number>`COUNT(${quizReviews.reviewId})`.as('total_reviews'),
      averageRatingGiven:
        sql<number>`COALESCE(ROUND(AVG(${quizReviews.rating})::numeric, 1), 0)`.as(
          'average_rating_given',
        ),
      lastUpdated: sql<string | null>`MAX(${quizReviews.updatedAt})::text`.as('last_updated'),
    };

    const visibleQuizWhere = and(
      eq(quizReviews.userId, userId),
      eq(quizzes.isHidden, false),
      isNotNull(quizzes.publishedVersionId),
      ReviewRepository.ACTIVE_REVIEW_PREDICATE,
    );

    const summaryQuery = this.db
      .select(summarySelect)
      .from(quizReviews)
      .where(and(eq(quizReviews.userId, userId), ReviewRepository.ACTIVE_REVIEW_PREDICATE));

    const favoriteCategoryQuery = this.db
      .select({
        categoryId: categories.categoryId,
        name: categories.name,
      })
      .from(quizReviews)
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .innerJoin(categories, eq(quizzes.categoryId, categories.categoryId))
      .where(visibleQuizWhere)
      .groupBy(categories.categoryId, categories.name)
      .orderBy(sql`COUNT(*) DESC`, categories.name)
      .limit(1);

    const favoriteTagQuery = this.db
      .select({
        tagId: tags.tagId,
        name: tags.name,
      })
      .from(quizReviews)
      .innerJoin(quizTags, eq(quizReviews.quizId, quizTags.quizId))
      .innerJoin(tags, eq(quizTags.tagId, tags.tagId))
      .innerJoin(quizzes, eq(quizReviews.quizId, quizzes.quizId))
      .where(visibleQuizWhere)
      .groupBy(tags.tagId, tags.name)
      .orderBy(sql`COUNT(*) DESC`, tags.name)
      .limit(1);

    const [summaryRow, favoriteCategory, favoriteTag] = await Promise.all([
      summaryQuery,
      favoriteCategoryQuery,
      favoriteTagQuery,
    ]);

    const [summaryFirst] = summaryRow;

    return {
      totalReviews: Number(summaryFirst?.totalReviews ?? 0),
      averageRatingGiven: Number(summaryFirst?.averageRatingGiven ?? 0),
      favoriteCategory: favoriteCategory[0] ?? null,
      favoriteTag: favoriteTag[0] ?? null,
      lastUpdated: summaryFirst?.lastUpdated ?? null,
    };
  }

  async addHelpfulVote(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<{ inserted: boolean; quizId: string | null }> {
    const { reviewId, userId, nowIso } = params;

    const executeAdd = async (
      db: DbClient,
    ): Promise<{ inserted: boolean; quizId: string | null }> => {
      const inserted = await db
        .insert(reviewHelpfulVotes)
        .values({ reviewId, userId, createdAt: nowIso })
        .onConflictDoNothing({
          target: [reviewHelpfulVotes.reviewId, reviewHelpfulVotes.userId],
        })
        .returning({ voteId: reviewHelpfulVotes.voteId });

      if (inserted.length === 0) {
        const [existing] = await db
          .select({ quizId: quizReviews.quizId })
          .from(quizReviews)
          .where(eq(quizReviews.reviewId, reviewId))
          .limit(1);
        return { inserted: false, quizId: existing?.quizId ?? null };
      }

      const [updated] = await db
        .update(quizReviews)
        .set({ helpfulCount: sql`helpful_count + 1` })
        .where(eq(quizReviews.reviewId, reviewId))
        .returning({ quizId: quizReviews.quizId });

      return { inserted: true, quizId: updated?.quizId ?? null };
    };

    const existingTx = this.transactionalContext?.getDbClient() as DbClient | null;
    if (existingTx) {
      return executeAdd(existingTx);
    }

    return this.db.transaction(async (tx) => executeAdd(tx as unknown as DbClient));
  }

  async removeHelpfulVote(params: {
    reviewId: string;
    userId: string;
    nowIso: string;
  }): Promise<{ removed: boolean; quizId: string | null }> {
    const { reviewId, userId } = params;

    const executeRemove = async (
      db: DbClient,
    ): Promise<{ removed: boolean; quizId: string | null }> => {
      const deleted = await db
        .delete(reviewHelpfulVotes)
        .where(
          and(eq(reviewHelpfulVotes.reviewId, reviewId), eq(reviewHelpfulVotes.userId, userId)),
        )
        .returning({ voteId: reviewHelpfulVotes.voteId });

      if (deleted.length === 0) {
        const [existing] = await db
          .select({ quizId: quizReviews.quizId })
          .from(quizReviews)
          .where(eq(quizReviews.reviewId, reviewId))
          .limit(1);
        return { removed: false, quizId: existing?.quizId ?? null };
      }

      const [updated] = await db
        .update(quizReviews)
        .set({ helpfulCount: sql`helpful_count - 1` })
        .where(and(eq(quizReviews.reviewId, reviewId), gt(quizReviews.helpfulCount, 0)))
        .returning({ quizId: quizReviews.quizId });

      return {
        removed: true,
        quizId: updated?.quizId ?? null,
      };
    };

    const existingTx = this.transactionalContext?.getDbClient() as DbClient | null;
    if (existingTx) {
      return executeRemove(existingTx);
    }

    return this.db.transaction(async (tx) => executeRemove(tx as unknown as DbClient));
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
    comment?: { set: string | null };
    expectedUpdatedAt?: string;
    nowIso: string;
  }): Promise<ReviewRow | null> {
    const setClause: { rating: number; updatedAt: string; comment?: string | null } = {
      rating: params.rating,
      updatedAt: params.nowIso,
    };
    if (params.comment !== undefined) {
      setClause.comment = params.comment.set;
    }

    const whereClauses = [eq(quizReviews.reviewId, params.reviewId)];
    if (params.expectedUpdatedAt !== undefined) {
      whereClauses.push(eq(quizReviews.updatedAt, params.expectedUpdatedAt));
    }

    const [updated] = await this.db
      .update(quizReviews)
      .set(setClause)
      .where(and(...whereClauses))
      .returning({
        reviewId: quizReviews.reviewId,
        quizId: quizReviews.quizId,
        userId: quizReviews.userId,
        rating: quizReviews.rating,
        comment: quizReviews.comment,
        createdAt: quizReviews.createdAt,
        updatedAt: quizReviews.updatedAt,
      });

    return (updated as ReviewRow | undefined) ?? null;
  }

  async reviewExistsIncludingDeleted(reviewId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ reviewId: quizReviews.reviewId })
      .from(quizReviews)
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return row !== undefined;
  }

  async getQuizIdByReviewIdInTx(reviewId: string, tx: DbClient): Promise<string | null> {
    const [row] = await tx
      .select({ quizId: quizReviews.quizId })
      .from(quizReviews)
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return row?.quizId ?? null;
  }

  async softDeleteReviewInTx(reviewId: string, nowIso: string, tx: DbClient): Promise<boolean> {
    const updated = await tx
      .update(quizReviews)
      .set({ deletedAt: nowIso })
      .where(and(eq(quizReviews.reviewId, reviewId), ReviewRepository.ACTIVE_REVIEW_PREDICATE))
      .returning({ reviewId: quizReviews.reviewId });

    return updated.length > 0;
  }

  async softDeleteReview(reviewId: string, nowIso: string): Promise<boolean> {
    return this.db.transaction(async (tx) =>
      this.softDeleteReviewInTx(reviewId, nowIso, tx as unknown as DbClient),
    );
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
