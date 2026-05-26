import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REVIEW_REPOSITORY_PORT, type ReviewRepositoryPort } from './ports/review-repository.port';
import { QUIZ_REPOSITORY_PORT } from '@/modules/quiz/domain/ports';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import {
  ReviewNotFoundError,
  ReviewForbiddenError,
  ReviewConflictError,
  ReviewAttemptRequiredError,
} from './errors';
import {
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEW_FORBIDDEN_MESSAGE,
  REVIEW_QUIZ_USER_CONFLICT_MESSAGE,
  REVIEW_ATTEMPT_REQUIRED_MESSAGE,
} from '../review.constants';

@Injectable()
export class ReviewService {
  constructor(
    @Inject(REVIEW_REPOSITORY_PORT)
    private readonly reviewRepository: ReviewRepositoryPort,
    @Inject(QUIZ_REPOSITORY_PORT)
    private readonly quizRepository: {
      getActiveQuizRecordById: (quizId: string) => Promise<{ quizId: string } | null>;
    },
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
  ) {
    return this.reviewRepository.listReviewsByQuiz({ quizId, limit, cursor });
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
  }
}
