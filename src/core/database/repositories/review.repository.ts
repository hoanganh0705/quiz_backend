import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.constants';
import type { DrizzleDB } from '../database.module';
import { quizReviews, users, quizzes, quizAttempts, quizVersions } from '../schema';
import type {
  ReviewRow,
  ReviewDetailRow,
  ReviewRepositoryPort,
} from '@/modules/review/domain/ports';

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
      .where(
        and(
          eq(quizReviews.quizId, quizId),
          eq(quizReviews.userId, userId),
        ),
      )
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
        userAvatarUrl: users.avatarUrl,
      })
      .from(quizReviews)
      .innerJoin(users, eq(quizReviews.userId, users.userId))
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
      .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.quizVersionId))
      .where(
        and(
          eq(quizVersions.quizId, quizId),
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.status, 'completed'),
        ),
      )
      .limit(1);

    return row !== undefined;
  }

  async getPublishedQuizVersionDifficulty(quizId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ difficulty: quizVersions.difficulty })
      .from(quizVersions)
      .innerJoin(quizzes, eq(quizVersions.quizId, quizzes.quizId))
      .where(
        and(
          eq(quizzes.quizId, quizId),
          eq(quizVersions.status, 'published'),
        ),
      )
      .limit(1);

    return (row?.difficulty as string | null) ?? null;
  }
}
