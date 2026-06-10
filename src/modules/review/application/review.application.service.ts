import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { ReviewService } from '../domain/review.service';
import { ReviewResponseMapper } from '../mappers/review-response.mapper';
import { ReviewCursorMapper, ReportCursorMapper } from '../mappers/review-cursor.mapper';
import {
  HelpfulReviewDto,
  ReportReviewDto,
  CreateReviewDto,
  UpdateReviewDto,
} from '../dto/request';
import {
  ReviewListResponseDto,
  CreateReviewResponseDto,
  UpdateReviewResponseDto,
  DeleteReviewResponseDto,
  MyReviewsResponseDto,
  ReviewDetailResponseDto,
  ReviewStatsResponseDto,
  ReviewDashboardResponseDto,
  HelpfulReviewResponseDto,
  ReportReviewResponseDto,
  MyQuizReviewResponseDto,
  ReportedReviewsResponseDto,
} from '../dto/response';

@Injectable()
export class ReviewApplicationService {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewResponseMapper: ReviewResponseMapper,
  ) {}

  async createReview(
    quizId: string,
    payload: CreateReviewDto,
    user: JwtPayload,
  ): Promise<CreateReviewResponseDto> {
    const review = await this.reviewService.createReview(
      quizId,
      payload.rating,
      payload.comment,
      user,
    );

    return this.reviewResponseMapper.toCreateReviewResponse(review);
  }

  async listReviews(
    quizId: string,
    limit: number,
    cursor?: { createdAt: string; reviewId: string } | null,
    rating?: number,
    sort?: import('../domain/ports').ReviewSort,
  ): Promise<ReviewListResponseDto> {
    const rows = await this.reviewService.listReviews(quizId, limit, cursor, rating, sort);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const lastItem = items.at(-1);

    return {
      items: this.reviewResponseMapper.toReviewResponses(items),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: lastItem && hasNextPage ? ReviewCursorMapper.serialize(lastItem) : null,
      },
    };
  }

  async listUserReviews(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reviewId: string } | null },
  ): Promise<MyReviewsResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.reviewService.listUserReviews(
      userId,
      query,
    );

    return {
      items: this.reviewResponseMapper.toMyReviewItems(items),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? ReviewCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async listReviewsByUser(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reviewId: string } | null },
  ): Promise<MyReviewsResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.reviewService.listReviewsByUser(
      userId,
      query,
    );

    return {
      items: this.reviewResponseMapper.toMyReviewItems(items),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? ReviewCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getReviewById(reviewId: string): Promise<ReviewDetailResponseDto> {
    const review = await this.reviewService.getReviewById(reviewId);
    return this.reviewResponseMapper.toReviewDetailResponse(review);
  }

  async getMyQuizReview(quizId: string, userId: string): Promise<MyQuizReviewResponseDto | null> {
    const review = await this.reviewService.getMyQuizReview(quizId, userId);
    if (!review) {
      return null;
    }
    return this.reviewResponseMapper.toMyQuizReviewResponse(review);
  }

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsResponseDto> {
    return this.reviewService.getQuizReviewStats(quizId);
  }

  async getMyReviewDashboard(user: JwtPayload): Promise<ReviewDashboardResponseDto> {
    return this.reviewService.getMyReviewDashboard(user.sub);
  }

  async getCreatorQuizReviewAnalytics(
    quizId: string,
    user: JwtPayload,
  ): Promise<QuizAnalyticsResponseDto> {
    return this.reviewService.getCreatorQuizReviewAnalytics(quizId, user);
  }

  async markReviewHelpful(
    reviewId: string,
    payload: HelpfulReviewDto,
    user: JwtPayload,
  ): Promise<HelpfulReviewResponseDto> {
    await this.reviewService.markReviewHelpful(reviewId, payload.helpful, user.sub);
    return { message: 'Review marked as helpful' };
  }

  async removeHelpfulVote(reviewId: string, user: JwtPayload): Promise<HelpfulReviewResponseDto> {
    await this.reviewService.removeHelpfulVote(reviewId, user.sub);
    return { message: 'Helpful vote removed' };
  }

  async reportReview(
    reviewId: string,
    user: JwtPayload,
    payload: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    await this.reviewService.reportReview(
      reviewId,
      user.sub,
      payload.reason,
      payload.details ?? null,
    );
    return { message: 'Review reported successfully' };
  }

  async listReportedReviews(
    userId: string,
    query: { limit?: number; cursor?: { createdAt: string; reportId: string } | null },
  ): Promise<ReportedReviewsResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.reviewService.listReportedReviews(
      userId,
      query,
    );

    return {
      items: this.reviewResponseMapper.toReportedReviewItems(items),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? ReportCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async updateReview(
    quizId: string,
    payload: UpdateReviewDto,
    user: JwtPayload,
  ): Promise<UpdateReviewResponseDto> {
    const review = await this.reviewService.updateReview(
      quizId,
      payload.rating,
      payload.comment,
      user,
    );

    return this.reviewResponseMapper.toUpdateReviewResponse(review);
  }

  async deleteReview(quizId: string, user: JwtPayload): Promise<DeleteReviewResponseDto> {
    await this.reviewService.deleteReview(quizId, user);

    return { message: 'Review deleted successfully' };
  }
}
