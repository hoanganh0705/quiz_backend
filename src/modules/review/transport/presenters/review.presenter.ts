import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { QuizAnalyticsResponseDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import type { CreateReviewResponseDto } from '../../dto/response/create-review-response.dto';
import type { HelpfulReviewResponseDto } from '../../dto/response/helpful-review-response.dto';
import type { MyReviewsResponseDto } from '../../dto/response/my-review-response.dto';
import type { PlatformReportsResponseDto } from '../../dto/response/admin-review.dto';
import type { ReportReviewResponseDto } from '../../dto/response/report-review-response.dto';
import type { ReportedReviewsResponseDto } from '../../dto/response/reported-review-response.dto';
import type { ReviewDashboardResponseDto } from '../../dto/response/review-dashboard-response.dto';
import type { ReviewDetailResponseDto } from '../../dto/response/review-detail-response.dto';
import type { ReviewListResponseDto } from '../../dto/response/review-list-response.dto';
import type { ReviewStatsResponseDto } from '../../dto/response/review-stats-response.dto';
import type { UpdateReviewResponseDto } from '../../dto/response/update-review-response.dto';

/**
 * Wrap a `{ items: T[], pagination: { limit, hasNextPage, nextCursor } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Used for paginated list endpoints whose application-service return is a
 * class-instance `{ items, pagination }` DTO. The canonical envelope has to
 * be a plain object (the interceptor's `isFormattedResponse()` guards on
 * `Object` prototype), so we deliberately project out the DTO fields here
 * instead of forwarding the class instance for the interceptor to re-wrap.
 */
const wrapPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}): ApiResponseEnvelope<T[]> => ({
  data: [...payload.items],
  meta: {
    timestamp: new Date().toISOString(),
    pagination: {
      kind: 'cursor' as const,
      limit: payload.pagination.limit,
      hasNextPage: payload.pagination.hasNextPage,
      nextCursor: payload.pagination.nextCursor,
    },
  },
});

/**
 * Presenter for the review module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * The `getMyQuizReview` endpoint can legitimately return `null` when the
 * authenticated user has not reviewed the quiz; the presenter collapses
 * `undefined` into `ApiResponse.ok(null)` so the envelope stays well-formed.
 */
@Injectable()
export class ReviewPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // /reviews (top-level) — single-resource / message endpoints
  readonly getMyReviewDashboard = ReviewPresenter.ok<ReviewDashboardResponseDto>;
  readonly markReviewHelpful = ReviewPresenter.ok<HelpfulReviewResponseDto>;
  readonly reportReview = ReviewPresenter.ok<ReportReviewResponseDto>;
  readonly getReviewById = ReviewPresenter.ok<ReviewDetailResponseDto>;

  // /quizzes/:quizId/reviews — CRUD + analytics + my-review
  readonly createReview = ReviewPresenter.ok<CreateReviewResponseDto>;
  readonly listReviews = wrapPaginatedDto<ReviewListResponseDto['items'][number]>;
  readonly getQuizReviewStats = ReviewPresenter.ok<ReviewStatsResponseDto>;
  readonly getCreatorQuizReviewAnalytics = ReviewPresenter.ok<QuizAnalyticsResponseDto>;
  readonly updateReview = ReviewPresenter.ok<UpdateReviewResponseDto>;

  // /users/* reviews — paginated user-scoped reads + null-safe my-review
  readonly listMyReportedReviews = wrapPaginatedDto<ReportedReviewsResponseDto['items'][number]>;
  readonly listMyReviews = wrapPaginatedDto<MyReviewsResponseDto['items'][number]>;
  readonly listReviewsByUser = wrapPaginatedDto<MyReviewsResponseDto['items'][number]>;
  readonly getMyQuizReview = (payload?: ReviewDetailResponseDto | null) =>
    payload === undefined || payload === null ? ApiResponse.ok(null) : ApiResponse.ok(payload);

  // /admin/reviews/* — paginated platform reports + update confirmation
  readonly listPlatformReports = wrapPaginatedDto<PlatformReportsResponseDto['items'][number]>;
  readonly updateReportStatus = ReviewPresenter.ok<{ message: string }>;
}
