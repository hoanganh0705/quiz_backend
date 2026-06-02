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
} from '@/core/database/schema';
import type {
  ReviewRow,
  ReviewDetailRow,
  ReviewRepositoryPort,
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

  async listReviewsByQuiz(params: {
    quizId: string;
    limit: number;
    cursor?: { createdAt: string; reviewId: string } | null;
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
          ? and(eq(quizReviews.quizId, params.quizId), cursorCondition)
          : eq(quizReviews.quizId, params.quizId),
      )
      .orderBy(desc(quizReviews.createdAt), desc(quizReviews.reviewId))
      .limit(params.limit + 1);

    return rows as ReviewDetailRow[];
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
