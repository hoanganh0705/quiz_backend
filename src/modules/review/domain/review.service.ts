import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import { quizReviews } from '@/core/database/schema';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';
import {
  REVIEW_REPORT_REPOSITORY_PORT,
  type ReviewReportRepositoryPort,
} from './ports/review-report-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ReviewNotFoundError,
  ReviewForbiddenError,
  ReviewConflictError,
  ReviewAttemptRequiredError,
  ReviewAlreadyReportedError,
  ReviewValidationError,
} from './errors';
import {
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEW_FORBIDDEN_MESSAGE,
  REVIEW_QUIZ_USER_CONFLICT_MESSAGE,
  REVIEW_ATTEMPT_REQUIRED_MESSAGE,
} from '../review.constants';
import { REVIEW_ANALYTICS_PORT, type ReviewAnalyticsPort } from './events';
import {
  ReviewSubmittedEvent,
  ReviewDeletedEvent,
  REVIEW_DOMAIN_EVENT_BUS,
  type ReviewDomainEventBusPort,
} from './events';
import type { ReviewStatsRow } from './ports';
import type { ReviewDashboardResponseDto } from '../dto/response';
import {
  type ReviewActor,
  type ReviewTarget,
  type ReviewQuizTarget,
  ReviewAuthorizationPolicy,
} from './policies';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviewRepository: ReviewRepositoryPort,
    @Inject(REVIEW_REPORT_REPOSITORY_PORT)
    private readonly reportRepository: ReviewReportRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (
        quizId: string,
      ) => Promise<{ quizId: string; creatorId: string | null } | null>;
    },
    @Inject(QuizAnalyticsService)
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @Inject(REVIEW_ANALYTICS_PORT)
    private readonly reviewAnalytics: ReviewAnalyticsPort,
    @Inject(REVIEW_DOMAIN_EVENT_BUS)
    private readonly reviewEventBus: ReviewDomainEventBusPort,
    @InjectPinoLogger(ReviewService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createReview(
    quizId: string,
    rating: number,
    comment: string | null | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);
    if (!quiz) {
      throw new ReviewNotFoundError('Quiz not found');
    }

    const hasAttempt = await this.reviewRepository.hasCompletedAttempt(quizId, user.sub);
    if (!hasAttempt) {
      this.logger.warn({
        event: 'review_attempt_required',
        quizId,
        userId: user.sub,
      });
      throw new ReviewAttemptRequiredError(REVIEW_ATTEMPT_REQUIRED_MESSAGE);
    }

    const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
    if (existing) {
      this.logger.warn({
        event: 'review_duplicate',
        quizId,
        userId: user.sub,
      });
      throw new ReviewConflictError(REVIEW_QUIZ_USER_CONFLICT_MESSAGE);
    }

    try {
      const review = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(quizReviews)
          .values({
            quizId,
            userId: user.sub,
            rating,
            comment: comment ?? null,
            createdAt: nowIso,
            updatedAt: nowIso,
            helpfulCount: 0,
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
        return created;
      });

      this.logger.info({
        event: 'review_created',
        reviewId: review.reviewId,
        quizId,
        userId: user.sub,
        rating,
      });

      this.reviewEventBus.dispatchToSubscribers(
        new ReviewSubmittedEvent({ quizId, reviewId: review.reviewId, userId: user.sub, rating }),
      );

      return review;
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (pgError.code === '23505' && pgError.constraint === 'uq_quiz_reviews_quiz_user') {
        this.logger.warn({ event: 'review_create_conflict', quizId, userId: user.sub });
        throw new ReviewConflictError(REVIEW_QUIZ_USER_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  async listReviews(
    quizId: string,
    limit: number,
    cursor?: { createdAt: string; reviewId: string } | null,
    rating?: number,
    sort?: import('./ports').ReviewSort,
  ) {
    return this.reviewRepository.listReviewsByQuiz({ quizId, limit, cursor, rating, sort });
  }

  async listUserReviews(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reviewId: string } | null },
  ): Promise<{
    items: import('./ports').MyReviewRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reviewId: string } | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.reviewRepository.listUserReviews({
      userId,
      limit,
      cursor,
    });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, reviewId: lastItem.reviewId }
          : null,
    };
  }

  async listReviewsByUser(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reviewId: string } | null },
  ): Promise<{
    items: import('./ports').MyReviewRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reviewId: string } | null;
  }> {
    return this.listUserReviews(userId, query);
  }

  async getReviewById(reviewId: string): Promise<import('./ports').ReviewDetailByIdRow> {
    const review = await this.reviewRepository.findReviewById(reviewId);

    if (!review) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    return review;
  }

  async getMyQuizReview(
    quizId: string,
    userId: string,
  ): Promise<import('./ports').ReviewDetailByIdRow | null> {
    return await this.reviewRepository.getMyQuizReview(quizId, userId);
  }

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsRow | null> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new ReviewNotFoundError('Quiz not found');
    }

    return this.reviewRepository.getQuizReviewStats(quizId);
  }

  async getMyReviewDashboard(userId: string): Promise<ReviewDashboardResponseDto> {
    const dashboard = await this.reviewRepository.getUserReviewDashboard(userId);

    return {
      totalReviews: Number(dashboard.totalReviews ?? 0),
      averageRatingGiven: Number(dashboard.averageRatingGiven ?? 0),
      favoriteCategory: dashboard.favoriteCategory,
      favoriteTag: dashboard.favoriteTag,
      lastUpdated: dashboard.lastUpdated,
    };
  }

  /**
   * Load the review and assert that `userId` is allowed to vote on it.
   *
   * Throws `ReviewNotFoundError` if the review does not exist, and
   * `ReviewValidationError` if the actor is the review's author.
   *
   * Shared by `addHelpfulVote` and `removeHelpfulVote` so both endpoints
   * share one fetch and one self-vote rejection.
   */
  private async assertCanVote(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.getReviewById(reviewId);

    if (!review) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    if (review.userId === userId) {
      this.logger.warn({ event: 'review_self_helpful_vote', reviewId, userId });
      throw new ReviewValidationError('You cannot vote on your own review');
    }
  }

  async addHelpfulVote(reviewId: string, userId: string): Promise<boolean> {
    await this.assertCanVote(reviewId, userId);

    const inserted = await this.reviewRepository.addHelpfulVote({
      reviewId,
      userId,
      nowIso: new Date().toISOString(),
    });

    if (inserted) {
      this.logger.info({ event: 'review_helpful_voted', reviewId, userId, helpful: true });
    }

    return inserted;
  }

  async removeHelpfulVote(reviewId: string, userId: string): Promise<boolean> {
    await this.assertCanVote(reviewId, userId);

    const removed = await this.reviewRepository.removeHelpfulVote({
      reviewId,
      userId,
      nowIso: new Date().toISOString(),
    });

    if (removed) {
      this.logger.info({ event: 'review_helpful_vote_removed', reviewId, userId, helpful: false });
    }

    return removed;
  }

  async reportReview(
    reviewId: string,
    reporterId: string,
    reason: string,
    details: string | null,
  ): Promise<void> {
    const review = await this.reviewRepository.getReviewById(reviewId);

    if (!review) {
      this.logger.warn({ event: 'review_report_review_not_found', reviewId, reporterId });
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const hasReported = await this.reportRepository.hasUserReportedReview(reviewId, reporterId);

    if (hasReported) {
      this.logger.warn({ event: 'review_report_duplicate', reviewId, reporterId, reason });
      throw new ReviewAlreadyReportedError();
    }

    const report = await this.reportRepository.createReport({
      reviewId,
      reporterId,
      reason,
      details,
      nowIso: new Date().toISOString(),
    });

    this.logger.info({
      event: 'review_reported',
      reportId: report.reportId,
      reviewId,
      reporterId,
      reason,
      status: report.status,
    });
  }

  async updateReview(
    quizId: string,
    rating: number,
    comment: string | null | undefined,
    user: JwtPayload,
  ) {
    const nowIso = new Date().toISOString();

    const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const actor: ReviewActor = { sub: user.sub, role: user.role };
    const target: ReviewTarget = { reviewId: existing.reviewId, userId: existing.userId };

    if (!ReviewAuthorizationPolicy.canModify(actor, target)) {
      throw new ReviewForbiddenError(REVIEW_FORBIDDEN_MESSAGE);
    }

    const updated = await this.reviewRepository.updateReview({
      reviewId: existing.reviewId,
      rating,
      comment: comment ?? null,
      nowIso,
    });

    this.logger.info({
      event: 'review_updated',
      reviewId: existing.reviewId,
      userId: user.sub,
      rating,
    });

    this.reviewEventBus.dispatchToSubscribers(
      new ReviewSubmittedEvent({ quizId, reviewId: existing.reviewId, userId: user.sub, rating }),
    );

    return updated;
  }

  async deleteReview(quizId: string, user: JwtPayload) {
    const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    const actorDelete: ReviewActor = { sub: user.sub, role: user.role };
    const targetDelete: ReviewTarget = { reviewId: existing.reviewId, userId: existing.userId };

    if (!ReviewAuthorizationPolicy.canModify(actorDelete, targetDelete)) {
      throw new ReviewForbiddenError(REVIEW_FORBIDDEN_MESSAGE);
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(quizReviews).where(sql`${quizReviews.reviewId} = ${existing.reviewId}`);
    });

    this.logger.info({
      event: 'review_deleted',
      reviewId: existing.reviewId,
      userId: user.sub,
    });

    this.reviewEventBus.dispatchToSubscribers(
      new ReviewDeletedEvent({ quizId, reviewId: existing.reviewId }),
    );
  }

  async listReportedReviews(
    reporterId: string,
    query: { limit?: number; cursor?: { createdAt: string; reportId: string } | null },
  ): Promise<{
    items: import('./ports').ReportedReviewRow[];
    limit: number;
    hasNextPage: boolean;
    nextCursor: { createdAt: string; reportId: string } | null;
  }> {
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.reportRepository.listReportedReviews({ reporterId, limit, cursor });

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items,
      limit,
      hasNextPage,
      nextCursor:
        hasNextPage && lastItem
          ? { createdAt: lastItem.createdAt, reportId: lastItem.reportId }
          : null,
    };
  }

  async getCreatorQuizReviewAnalytics(
    quizId: string,
    user: JwtPayload,
  ): Promise<import('@/modules/quiz/domain/analytics/types').QuizAnalytics> {
    const actor: ReviewActor = { sub: user.sub, role: user.role };
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new ReviewNotFoundError('Quiz not found');
    }

    const analyticsTarget: ReviewQuizTarget = { quizId, creatorId: quiz.creatorId };

    if (!ReviewAuthorizationPolicy.canViewAnalytics(actor, analyticsTarget)) {
      throw new ReviewForbiddenError('You do not have permission to view analytics for this quiz');
    }

    return this.quizAnalyticsService.getQuizAnalytics(quizId);
  }
}
