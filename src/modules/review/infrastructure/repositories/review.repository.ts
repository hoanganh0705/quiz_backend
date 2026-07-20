import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
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

  /**
   * Phase 5 / Issue #17 — "active review" predicate. Every
   * public read path appends `quiz_reviews.deleted_at IS NULL`
   * so soft-deleted reviews stay invisible to clients while
   * remaining in the table for vote-history preservation,
   * moderation audit, and reconciliation jobs.
   */
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
    // Phase 5 / Issue #11 — the cursor type now depends on the
    // sort. The repository branches on `params.sort` and validates
    // the cursor shape implicitly. The controller-layer mapper
    // serializes/deserializes the right shape per sort.
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
      // Phase 5 / Issue #11 — the helpful-sort cursor carries
      // `{ helpfulCount, reviewId }` so the predicate matches
      // the ORDER BY columns exactly. The previous shape
      // reused the `createdAt` cursor and let pages skip /
      // duplicate rows because the cursor predicate and the
      // sort key were on different columns.
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

    // For the other sorts, the cursor is the original
    // `{ createdAt, reviewId }` shape.
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

    // Phase 5 / Issue #15 — visibility predicate for the
    // `listUserReviews` query. The query joins `quizzes` and
    // exposes `quizzes.title` to the response. The previous shape
    // INNER-JOINed every row regardless of the parent quiz's
    // visibility, so:
    //
    //   - `GET /users/me/reviews` (authenticated, self-only)
    //     leaked the title of a quiz the author later hid.
    //   - `GET /users/:userId/reviews` (public!) leaked hidden
    //     quiz titles to any attacker guessing reviewer UUIDs —
    //     the canonical "hidden quiz IDOR" pattern.
    //
    // The predicate mirrors `isVisibleToReviewers`:
    // `is_hidden = false AND published_version_id IS NOT NULL`.
    const visibilityPredicate = and(
      eq(quizzes.isHidden, false),
      isNotNull(quizzes.publishedVersionId),
    );

    // Phase 5 / Issue #17 — exclude soft-deleted reviews from
    // the user's review history. A review the author (or a
    // moderator) soft-deleted should not appear on
    // `GET /users/me/reviews` or the public
    // `GET /users/:userId/reviews` listing.
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
    const [summaryRow] = await this.db
      .select({
        totalReviews: sql<number>`COUNT(${quizReviews.reviewId})`.as('total_reviews'),
        averageRatingGiven:
          sql<number>`COALESCE(ROUND(AVG(${quizReviews.rating})::numeric, 1), 0)`.as(
            'average_rating_given',
          ),
        // Phase 5 / Issue #30 — when a user has no reviews, the
        // previous `COALESCE(MAX(updated_at)::text, NOW()::text)`
        // surfaced the wall-clock DB time as "dashboard last
        // updated at <now>", which is misleading. Return `null`
        // when there are no rows; the service layer translates
        // that to `null` in the response.
        lastUpdated: sql<string | null>`MAX(${quizReviews.updatedAt})::text`.as('last_updated'),
      })
      .from(quizReviews)
      .where(and(eq(quizReviews.userId, userId), ReviewRepository.ACTIVE_REVIEW_PREDICATE));

    // Phase 3 / Issue #26 — exclude reviews on hidden or
    // unpublished quizzes from the `favoriteCategory` /
    // `favoriteTag` aggregates. Otherwise a user whose activity
    // includes test quizzes that were later hidden still surfaces
    // those categories/tags in their dashboard, which leaks
    // categories the user has nominally interacted with but which
    // are no longer canonical. The same predicate is used in the
    // review-visibility policy (`isVisibleToReviewers`) and the
    // public listing paths.
    //
    // Phase 5 / Issue #17 — also exclude soft-deleted reviews.
    const visibleQuizWhere = and(
      eq(quizReviews.userId, userId),
      eq(quizzes.isHidden, false),
      isNotNull(quizzes.publishedVersionId),
      ReviewRepository.ACTIVE_REVIEW_PREDICATE,
    );

    const [favoriteCategory] = await this.db
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

    const [favoriteTag] = await this.db
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

    return {
      totalReviews: Number(summaryRow?.totalReviews ?? 0),
      averageRatingGiven: Number(summaryRow?.averageRatingGiven ?? 0),
      favoriteCategory: favoriteCategory ?? null,
      favoriteTag: favoriteTag ?? null,
      // Phase 5 / Issue #30 — propagate the repository's `null`
      // (no reviews) through to the response. The service layer
      // must no longer fall back to `new Date().toISOString()`,
      // which is what produced the misleading "dashboard last
      // updated at <now>" output for users with no reviews.
      lastUpdated: summaryRow?.lastUpdated ?? null,
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
    // Phase 5 / Issue #24 — `comment` is an explicit
    // `{ set: string | null }` carrier so the repository can
    // distinguish "field absent in the PATCH payload" (no write)
    // from "field present and set to null" (clear the comment).
    // The previous `comment: string | null` parameter silently
    // nulled the comment whenever the client omitted the field.
    comment?: { set: string | null };
    nowIso: string;
  }): Promise<ReviewRow> {
    // Build the SET clause incrementally. Rating is always
    // required (the DTO enforces it), so it is always present.
    // `comment` is the only optional PATCH field today.
    const setClause: { rating: number; updatedAt: string; comment?: string | null } = {
      rating: params.rating,
      updatedAt: params.nowIso,
    };
    if (params.comment !== undefined) {
      setClause.comment = params.comment.set;
    }

    const [updated] = await this.db
      .update(quizReviews)
      .set(setClause)
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

  /**
   * Phase 5 / Issue #17 — slim existence check that ignores the
   * `deleted_at` filter. Used by the helpful-vote withdrawal
   * path: a user with an existing vote on a now-soft-deleted
   * review should still be able to withdraw that vote
   * (otherwise their vote row would survive forever). The
   * `addHelpfulVote` path does NOT use this helper — adding a
   * fresh vote on a soft-deleted review still surfaces a 404.
   */
  async reviewExistsIncludingDeleted(reviewId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ reviewId: quizReviews.reviewId })
      .from(quizReviews)
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return row !== undefined;
  }

  /**
   * Phase 5 / Issue #39 — fetch the `quiz_id` for a review
   * (active OR soft-deleted) inside the caller's transaction.
   * Used by the admin actioned-status transition to populate
   * the analytics-refresh outbox event payload. Returns `null`
   * when the review id does not exist at all.
   */
  async getQuizIdByReviewIdInTx(reviewId: string, tx: unknown): Promise<string | null> {
    const executor = tx as DrizzleDB;
    const [row] = await executor
      .select({ quizId: quizReviews.quizId })
      .from(quizReviews)
      .where(eq(quizReviews.reviewId, reviewId))
      .limit(1);

    return row?.quizId ?? null;
  }

  /**
   * Phase 5 / Issue #39 — tx-aware soft-delete. The admin service
   * uses this inside the actioned-status transition so the
   * soft-delete, status UPDATE, audit row, and analytics outbox
   * event all commit atomically. The non-tx `softDeleteReview`
   * variant remains for the public self-delete path.
   *
   * Returns `true` when a row was updated (i.e. the review
   * existed and was not already soft-deleted), `false`
   * otherwise. The actioned-status path treats `false` as a
   * no-op (the review was already taken down).
   */
  async softDeleteReviewInTx(reviewId: string, nowIso: string, tx: unknown): Promise<boolean> {
    const executor = tx as DrizzleDB;
    const updated = await executor
      .update(quizReviews)
      .set({ deletedAt: nowIso })
      .where(and(eq(quizReviews.reviewId, reviewId), ReviewRepository.ACTIVE_REVIEW_PREDICATE))
      .returning({ reviewId: quizReviews.reviewId });

    return updated.length > 0;
  }

  /**
   * Phase 5 / Issue #17 — soft-delete a review. The previous
   * shape issued `DELETE FROM quiz_reviews` and let the FK
   * `ON DELETE CASCADE` on `review_helpful_votes` erase every
   * vote against this review, with no UI signal for the
   * voters. Soft-delete writes `deleted_at = now` instead, the
   * repository filters every public read by `deleted_at IS NULL`
   * so the row is invisible everywhere, and the helpful-vote
   * rows survive the soft-delete so the voter can withdraw
   * their vote through `removeHelpfulVote`.
   *
   * Returns `true` when a row was updated (i.e. the review
   * existed and was not already soft-deleted), `false`
   * otherwise. The service layer is responsible for acting on
   * the boolean and emitting analytics / events accordingly.
   */
  async softDeleteReview(reviewId: string, nowIso: string): Promise<boolean> {
    return this.softDeleteReviewInTx(reviewId, nowIso, this.db);
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
