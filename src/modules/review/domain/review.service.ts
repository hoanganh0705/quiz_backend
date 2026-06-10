import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import { QuizAnalyticsService } from '@/modules/quiz/domain/analytics';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ReviewNotFoundError,
  ReviewForbiddenError,
  ReviewConflictError,
  ReviewAttemptRequiredError,
  ReviewAlreadyReportedError,
} from './errors';
import {
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEW_FORBIDDEN_MESSAGE,
  REVIEW_QUIZ_USER_CONFLICT_MESSAGE,
  REVIEW_ATTEMPT_REQUIRED_MESSAGE,
} from '../review.constants';
import { AnalyticsEventHandler } from '@/modules/quiz/domain/analytics/analytics-event-handler';
import type { ReviewStatsResponseDto, ReviewDashboardResponseDto } from '../dto/response';
import { QuizNotFoundError } from '@/modules/quiz/domain/errors';
import { ReviewValidationError } from './errors';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviewRepository: ReviewRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (
        quizId: string,
      ) => Promise<{ quizId: string; creatorId: string | null } | null>;
    },
    @Inject(QuizAnalyticsService)
    private readonly quizAnalyticsService: QuizAnalyticsService,
    @Inject(forwardRef(() => AnalyticsEventHandler))
    private readonly analyticsEventHandler: AnalyticsEventHandler,
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
      const review = await this.reviewRepository.createReview({
        quizId,
        userId: user.sub,
        rating,
        comment: comment ?? null,
        nowIso,
      });

      this.logger.info({
        event: 'review_created',
        reviewId: review.reviewId,
        quizId,
        userId: user.sub,
        rating,
      });

      // Refresh quiz analytics
      await this.analyticsEventHandler.onReviewSubmitted(quizId);

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
    const limit = query.limit ?? 10;
    const cursor = query.cursor ?? null;

    const rows = await this.reviewRepository.listReviewsByUser({
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

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsResponseDto> {
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new QuizNotFoundError();
    }

    const stats = await this.reviewRepository.getQuizReviewStats(quizId);

    return {
      averageRating: Number(stats?.averageRating ?? 0),
      totalReviews: Number(stats?.totalReviews ?? 0),
      ratingDistribution: {
        '1': Number(stats?.rating1 ?? 0),
        '2': Number(stats?.rating2 ?? 0),
        '3': Number(stats?.rating3 ?? 0),
        '4': Number(stats?.rating4 ?? 0),
        '5': Number(stats?.rating5 ?? 0),
      },
    };
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

  async markReviewHelpful(reviewId: string, helpful: boolean, userId: string): Promise<void> {
    const review = await this.reviewRepository.getReviewById(reviewId);

    if (!review) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    if (review.userId === userId) {
      throw new ReviewValidationError('You cannot vote on your own review');
    }

    if (!helpful) {
      await this.reviewRepository.removeReviewHelpfulVote({
        reviewId,
        userId,
        nowIso: new Date().toISOString(),
      });

      this.logger.info({ event: 'review_helpful_vote_removed', reviewId, userId });
      return;
    }

    const vote = await this.reviewRepository.markReviewHelpful({
      reviewId,
      userId,
      nowIso: new Date().toISOString(),
    });

    this.logger.info({
      event: 'review_marked_helpful',
      reviewId,
      userId,
      voteId: vote.voteId,
    });
  }

  async removeHelpfulVote(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.getReviewById(reviewId);

    if (!review) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    await this.reviewRepository.removeReviewHelpfulVote({
      reviewId,
      userId,
      nowIso: new Date().toISOString(),
    });

    this.logger.info({ event: 'review_helpful_vote_removed', reviewId, userId });
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

    const hasReported = await this.reviewRepository.hasUserReportedReview(reviewId, reporterId);

    if (hasReported) {
      this.logger.warn({ event: 'review_report_duplicate', reviewId, reporterId });
      throw new ReviewAlreadyReportedError();
    }

    const report = await this.reviewRepository.createReport({
      reviewId,
      reporterId,
      reason,
      details,
      nowIso: new Date().toISOString(),
    });

    this.logger.info({
      event: 'review_report_created',
      reportId: report.reportId,
      reviewId,
      reporterId,
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

    if (existing.userId !== user.sub && user.role !== 'admin') {
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

    // Refresh quiz analytics
    await this.analyticsEventHandler.onReviewSubmitted(quizId);

    return updated;
  }

  async deleteReview(quizId: string, user: JwtPayload) {
    const existing = await this.reviewRepository.getReviewByQuizAndUser(quizId, user.sub);
    if (!existing) {
      throw new ReviewNotFoundError(REVIEW_NOT_FOUND_MESSAGE);
    }

    if (existing.userId !== user.sub && user.role !== 'admin') {
      throw new ReviewForbiddenError(REVIEW_FORBIDDEN_MESSAGE);
    }

    await this.reviewRepository.deleteReview(existing.reviewId);

    this.logger.info({
      event: 'review_deleted',
      reviewId: existing.reviewId,
      userId: user.sub,
    });

    // Refresh quiz analytics
    await this.analyticsEventHandler.onReviewDeleted(quizId);
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

    const rows = await this.reviewRepository.listReportedReviews({ reporterId, limit, cursor });

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
    const quiz = await this.quizRepository.getActiveQuizRecordById(quizId);

    if (!quiz) {
      throw new QuizNotFoundError();
    }

    if (quiz.creatorId !== user.sub && user.role !== 'admin') {
      throw new ReviewForbiddenError('You do not have permission to view analytics for this quiz');
    }

    return this.quizAnalyticsService.getQuizAnalytics(quizId);
  }
}
