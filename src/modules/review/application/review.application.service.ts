import { Inject, Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { ReviewService } from '../domain/review.service';
import { ReviewAdminService, type PlatformReportItem } from '../domain/review-admin.service';
import { IdempotencyService, IDEMPOTENCY_SERVICE } from '../domain/idempotency.service';
import { ReviewResponseMapper } from '../mappers/review-response.mapper';
import { CursorMapper } from '../mappers/review-cursor.mapper';
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
  ReportedReviewsResponseDto,
  PlatformReportsResponseDto,
  PlatformReportItemDto,
} from '../dto/response';

@Injectable()
export class ReviewApplicationService {
  constructor(
    private readonly reviewService: ReviewService,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IdempotencyService,
    private readonly reviewResponseMapper: ReviewResponseMapper,
    private readonly reviewAdminService: ReviewAdminService,
  ) {}

  async createReview(
    quizId: string,
    payload: CreateReviewDto,
    user: JwtPayload,
  ): Promise<CreateReviewResponseDto> {
    if (payload.idempotencyKey) {
      const { response } = await this.idempotencyService.checkAndSet(
        payload.idempotencyKey,
        user.sub,
        'createReview',
        async () => {
          const review = await this.reviewService.createReview(
            quizId,
            payload.rating,
            payload.comment,
            user,
          );
          return this.reviewResponseMapper.toCreateReviewResponse(review);
        },
      );
      return response!;
    }

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
        nextCursor: lastItem && hasNextPage ? CursorMapper.serializeReview(lastItem) : null,
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
        nextCursor: nextCursor ? CursorMapper.serializeReview(nextCursor) : null,
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
        nextCursor: nextCursor ? CursorMapper.serializeReview(nextCursor) : null,
      },
    };
  }

  async getReviewById(reviewId: string): Promise<ReviewDetailResponseDto> {
    const review = await this.reviewService.getReviewById(reviewId);
    return this.reviewResponseMapper.toReviewDetailResponse(review);
  }

  async getMyQuizReview(quizId: string, userId: string): Promise<ReviewDetailResponseDto | null> {
    const review = await this.reviewService.getMyQuizReview(quizId, userId);
    if (!review) {
      return null;
    }
    return this.reviewResponseMapper.toReviewDetailResponse(review);
  }

  async getQuizReviewStats(quizId: string): Promise<ReviewStatsResponseDto> {
    const stats = await this.reviewService.getQuizReviewStats(quizId);

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
    if (payload.idempotencyKey) {
      const { response } = await this.idempotencyService.checkAndSet(
        payload.idempotencyKey,
        user.sub,
        'markReviewHelpful',
        async () => {
          const result = payload.helpful
            ? await this.reviewService.addHelpfulVote(reviewId, user.sub)
            : await this.reviewService.removeHelpfulVote(reviewId, user.sub);
          return { message: selectHelpfulMessage(payload.helpful, result) };
        },
      );
      return response!;
    }

    const result = payload.helpful
      ? await this.reviewService.addHelpfulVote(reviewId, user.sub)
      : await this.reviewService.removeHelpfulVote(reviewId, user.sub);

    return { message: selectHelpfulMessage(payload.helpful, result) };
  }

  async removeHelpfulVote(reviewId: string, user: JwtPayload): Promise<HelpfulReviewResponseDto> {
    const result = await this.reviewService.removeHelpfulVote(reviewId, user.sub);
    return { message: result ? 'Helpful vote removed' : 'No helpful vote to remove' };
  }

  async reportReview(
    reviewId: string,
    user: JwtPayload,
    payload: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    if (payload.idempotencyKey) {
      await this.idempotencyService.checkAndSet(
        payload.idempotencyKey,
        user.sub,
        'reportReview',
        async () => {
          await this.reviewService.reportReview(
            reviewId,
            user.sub,
            payload.reason,
            payload.details ?? null,
          );
          return { message: 'Review reported successfully' };
        },
      );
      return { message: 'Review reported successfully' };
    }

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
        nextCursor: nextCursor ? CursorMapper.serializeReport(nextCursor) : null,
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

  async listPlatformReports(params: {
    limit: number;
    cursor?: { createdAt: string; reportId: string } | null;
    status?: 'open' | 'reviewed' | 'dismissed' | 'actioned' | null;
  }): Promise<PlatformReportsResponseDto> {
    const { items, limit, hasNextPage, nextCursor } =
      await this.reviewAdminService.listPlatformReports(params);

    return {
      items: items.map((row: PlatformReportItem) => this.toPlatformReportItem(row)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? CursorMapper.serializeReport(nextCursor) : null,
      },
    };
  }

  async updateReportStatus(
    reportId: string,
    status: 'reviewed' | 'dismissed' | 'actioned',
    actor: JwtPayload,
  ): Promise<{ message: string }> {
    await this.reviewAdminService.updateReportStatus(reportId, status, actor.sub);
    return { message: 'Report status updated successfully' };
  }

  private toPlatformReportItem(row: PlatformReportItem): PlatformReportItemDto {
    return {
      reportId: row.reportId,
      reviewId: row.reviewId,
      quizId: row.quizId,
      quizTitle: row.quizTitle,
      reviewerUsername: row.reviewerUsername,
      reportedUserId: row.reportedUserId,
      rating: row.rating,
      comment: row.comment,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

/**
 * Map `(helpful, repositoryResult)` to the user-visible message.
 *
 * Lives at module scope (not on the class) because it has no dependency on
 * instance state — keeping it here makes it trivial to unit-test in isolation
 * and keeps `ReviewApplicationService` focused on orchestration.
 */
function selectHelpfulMessage(helpful: boolean, result: boolean): string {
  if (helpful) {
    return result ? 'Review marked as helpful' : 'Review was already marked as helpful';
  }
  return result ? 'Helpful vote removed' : 'No helpful vote to remove';
}
