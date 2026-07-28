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
    // Phase 5 / Issue #11 — `cursor` is now a union shape. The
    // service passes it through to the repository, which branches
    // on `sort` to validate the cursor shape.
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
        // Phase 5 / Issue #11 — serialize the cursor in the
        // shape the next-page client will need. For the
        // `helpful` sort the next-cursor carries the
        // `(helpfulCount, reviewId)` pair; for every other sort
        // it carries the original `(createdAt, reviewId)`.
        nextCursor:
          lastItem && hasNextPage
            ? sort === 'helpful'
              ? CursorMapper.serializeHelpful({
                  // The repository always selects `helpfulCount`
                  // in the helpful-sort branch; the optional
                  // marker on the row type reflects the broader
                  // row contract.
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

  async removeHelpfulVote(reviewId: string, user: JwtPayload): Promise<void> {
    await this.reviewService.removeHelpfulVote(reviewId, user.sub);
  }

  async reportReview(
    reviewId: string,
    user: JwtPayload,
    payload: ReportReviewDto,
  ): Promise<ReportReviewResponseDto> {
    if (payload.idempotencyKey) {
      // Phase 2 / Issue #13 — return the cached response on replay
      // instead of building a fresh one. Without this, the cached
      // idempotency row bypasses the duplicate-report pre-check, the
      // service throws `ReviewAlreadyReportedError`, and the user sees
      // a 409 on a retry of a *successful* request. The other two
      // idempotency wrappers in this file already return `response!`;
      // this one was the outlier.
      const { response } = await this.idempotencyService.checkAndSet(
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
      return response!;
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
    // Phase 5 / Issue #24 — translate the DTO's `comment?: string | null`
    // into the service's `{ set } | undefined` carrier. The carrier
    // is `undefined` when the client omitted `comment` in the
    // PATCH body, and `{ set: <value> }` when the client explicitly
    // sent the field (including `null`).
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

  /**
   * Phase 1 / Issue #22 — moderator-initiated delete of any review by id.
   * Authorization is enforced by the `REVIEW_MODERATE` route guard;
   * the actor is captured into the audit log by `ReviewAdminService`.
   */
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

/**
 * Map `(helpful, repositoryResult)` to the user-visible message.
 *
 * Lives at module scope (not on the class) because it has no dependency on
 * instance state — keeping it here makes it trivial to unit-test in isolation
 * and keeps `ReviewApplicationService` focused on orchestration.
 */
function selectHelpfulMessage(helpful: boolean, _result: boolean): string {
  // Phase 5 / Issue #5 — make the helpful-vote endpoint
  // idempotent at the response surface. The previous shape
  // returned two different messages depending on whether a row
  // was actually inserted/deleted. POST/DELETE with `helpful:true`
  // is now "Helpful vote recorded" regardless of whether the
  // underlying row was new or already existed; the same with
  // `helpful:false`. A retrying client (network hiccup, idempotency
  // cache replay) sees an identical payload each time.
  //
  // `_result` is intentionally unused — the function collapses
  // both the "row inserted" and "row already existed" outcomes to
  // one message. Keeping the parameter preserves the call site so
  // a future change can re-introduce the distinction.
  if (helpful) {
    return 'Helpful vote recorded';
  }
  return 'Helpful vote removed';
}
