import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { AbandonAttemptResponseDto } from '../../dto/response/abandon-attempt-response.dto';
import type { AttemptAnalyticsResponseDto } from '../../dto/response/attempt-analytics-response.dto';
import type { AttemptAnswersResponseDto } from '../../dto/response/attempt-answers-response.dto';
import type { AttemptListResponseDto } from '../../dto/response/attempt-list-response.dto';
import type { AttemptResponseDto } from '../../dto/response/attempt-response.dto';
import type { CompleteAttemptResponseDto } from '../../dto/response/complete-attempt-response.dto';
import type { SubmitAnswerResponseDto } from '../../dto/response/submit-answer-response.dto';
import type { UserAttemptStatsResponseDto } from '../../dto/response/user-attempt-stats-response.dto';
import type { WithdrawAnswerResponseDto } from '../../dto/response/withdraw-answer-response.dto';

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
  readonly listMyAttempts = AttemptPresenter.ok<AttemptListResponseDto>;
  readonly getMyAttemptStats = AttemptPresenter.ok<UserAttemptStatsResponseDto>;
  readonly getAttemptAnswers = AttemptPresenter.ok<AttemptAnswersResponseDto>;
  readonly getAttemptAnalytics = AttemptPresenter.ok<AttemptAnalyticsResponseDto>;
}
