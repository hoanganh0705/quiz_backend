import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { AttemptSummaryResponseDto } from '../../dto/response/attempt-summary-response.dto';
import type { AbandonAttemptResponseDto } from '../../dto/response/abandon-attempt-response.dto';
import type { AttemptAnalyticsResponseDto } from '../../dto/response/attempt-analytics-response.dto';
import type { AttemptAnswersResponseDto } from '../../dto/response/attempt-answers-response.dto';
import type { AttemptResponseDto } from '../../dto/response/attempt-response.dto';
import type { AttemptReviewResponseDto } from '../../dto/response/attempt-review-response.dto';
import type { CompleteAttemptResponseDto } from '../../dto/response/complete-attempt-response.dto';
import type { SubmitAnswerResponseDto } from '../../dto/response/submit-answer-response.dto';
import type { UserAttemptStatsResponseDto } from '../../dto/response/user-attempt-stats-response.dto';
import type { WithdrawAnswerResponseDto } from '../../dto/response/withdraw-answer-response.dto';

/**
 * Wrap a `{ items: T[], pagination: { limit, hasNextPage, nextCursor } }`
 * payload as `{ data: T[], meta: { timestamp, pagination } }`.
 *
 * Used for paginated list endpoints whose application-service return is a
 * class-instance `{ items, pagination }` DTO. The canonical envelope has to
 * be a plain object (the interceptor's `isFormattedResponse()` guards on
 * `Object` prototype), so we deliberately project out the DTO fields here
 * instead of forwarding the class instance for the interceptor to re-wrap.
 *
 * The `AttemptListResponseDto` pagination fields (`limit`, `hasNextPage`,
 * `nextCursor`) match this shape exactly.
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
 * Presenter for the attempt module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * Currently a thin pass-through to {@link ApiResponse.ok}. The layer exists
 * separately from the controller so future module-specific shaping (sensitive
 * field redaction, conditional fields, additional meta) has a stable seam.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 */
@Injectable()
export class AttemptPresenter {
  // Free-standing arrow function (not a class method) so we don't trip the
  // `@typescript-eslint/unbound-method` rule when stored as class fields.
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly startAttempt = AttemptPresenter.ok<AttemptResponseDto>;
  readonly getAttemptById = AttemptPresenter.ok<AttemptResponseDto>;
  readonly submitAnswer = AttemptPresenter.ok<SubmitAnswerResponseDto>;
  readonly withdrawAnswer = AttemptPresenter.ok<WithdrawAnswerResponseDto>;
  readonly abandonAttempt = AttemptPresenter.ok<AbandonAttemptResponseDto>;
  readonly completeAttempt = AttemptPresenter.ok<CompleteAttemptResponseDto>;
  readonly listMyAttempts = wrapPaginatedDto<AttemptSummaryResponseDto>;
  readonly getMyAttemptStats = AttemptPresenter.ok<UserAttemptStatsResponseDto>;
  readonly getAttemptAnswers = AttemptPresenter.ok<AttemptAnswersResponseDto>;
  readonly getAttemptAnalytics = AttemptPresenter.ok<AttemptAnalyticsResponseDto>;
  readonly getAttemptReview = AttemptPresenter.ok<AttemptReviewResponseDto>;
}
