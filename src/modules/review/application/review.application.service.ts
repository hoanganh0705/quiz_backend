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

type IdempotentOp = 'createReview' | 'markReviewHelpful' | 'reportReview';

@Injectable()
export class ReviewApplicationService {
  constructor(
    private readonly reviewService: ReviewService,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IdempotencyService,
    private readonly reviewResponseMapper: ReviewResponseMapper,
    private readonly reviewAdminService: ReviewAdminService,
  ) {}

  private async withIdempotency<T>(
    key: string | undefined,
    user: JwtPayload,
    op: IdempotentOp,
    compute: () => Promise<T>,
  ): Promise<T> {
    if (!key) {
      return compute();
    }
    const { response } = await this.idempotencyService.checkAndSet(key, user.sub, op, compute);
    return response!;
  }

  private static selectHelpfulMessage(helpful: boolean): string {
    return helpful ? 'Helpful vote recorded' : 'Helpful vote removed';
  }

  async createReview(
    quizId: string,
    payload: CreateReviewDto,
    user: JwtPayload,
  ): Promise<CreateReviewResponseDto> {
    return this.withIdempotency(payload.idempotencyKey, user, 'createReview', async () => {
      const review = await this.reviewService.createReview(
        quizId,
        payload.rating,
        payload.comment,
        user,
      );
      return this.reviewResponseMapper.toCreateReviewResponse(review);
    });
  }

  async listReviews(
    quizId: string,
    limit: number,
    cursor?: import('../domain/ports').ReviewListCursor | null,
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
        nextCursor:
          lastItem && hasNextPage
            ? sort === 'helpful'
              ? CursorMapper.serializeHelpful({
                  helpfulCount: lastItem.helpfulCount ?? 0,
                  reviewId: lastItem.reviewId,
                })
              : CursorMapper.serializeReview({
                  createdAt: lastItem.createdAt,
                  reviewId: lastItem.reviewId,
                })
            : null,
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
    return this.withIdempotency(payload.idempotencyKey, user, 'markReviewHelpful', async () => {
      if (payload.helpful) {
        await this.reviewService.addHelpfulVote(reviewId, user.sub);
      } else {
        await this.reviewService.removeHelpfulVote(reviewId, user.sub);
      }
      return { message: ReviewApplicationService.selectHelpfulMessage(payload.helpful) };
    });
  }

  async removeHelpfulVote(reviewId: string, user: JwtPayload): Promise<void> {
    await this.reviewService.removeHelpfulVote(reviewId, user.sub);
  }

  async reportReview(
    reviewId: string,
    user: JwtPayload,
    payload: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    return this.withIdempotency(payload.idempotencyKey, user, 'reportReview', async () => {
      await this.reviewService.reportReview(
        reviewId,
        user.sub,
        payload.reason,
        payload.details ?? null,
      );
      return { message: 'Review reported successfully' };
    });
  }

  async listReportedReviews(
    userId: string,
    query: {
      limit?: number;
      cursor?: { createdAt: string; reportId: string } | null;
      status?: import('../domain/policies/review-report-status.policy').ReviewReportStatus | null;
    },
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
    const commentCarrier =
      'comment' in payload && payload.comment !== undefined ? { set: payload.comment } : undefined;

    const review = await this.reviewService.updateReview(
      quizId,
      payload.rating,
      commentCarrier,
      user,
    );

    return this.reviewResponseMapper.toUpdateReviewResponse(review);
  }

  async deleteReview(quizId: string, user: JwtPayload): Promise<void> {
    await this.reviewService.deleteReview(quizId, user);
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

  async adminDeleteReview(reviewId: string, actor: JwtPayload): Promise<void> {
    await this.reviewAdminService.adminDeleteReview(reviewId, actor.sub);
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
