import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginationMeta } from '@/common/responses/pagination';
import type { DailyChallengeResponseDto } from '../../dto/response/daily-challenge-response.dto';
import type {
  DailyChallengeAnswerResponseDto,
  DailyChallengeHistoryResponseDto,
  DailyChallengeLeaderboardResponseDto,
} from '../../dto/response/daily-challenge-history-response.dto';

/**
 * Phase 3 (S-14): presenter for the daily-challenge module.
 * Mirrors the pattern of `TagPresenter` — every controller
 * method calls exactly one presenter method, and the only thing
 * the presenter does is wrap the application-service payload in
 * the canonical `{ data, meta.timestamp }` envelope.
 */
@Injectable()
export class DailyChallengePresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  readonly getToday = DailyChallengePresenter.ok<DailyChallengeResponseDto>;
  readonly getHistory = (payload: DailyChallengeHistoryResponseDto) =>
    ApiResponse.page(payload.items, payload.pagination as PaginationMeta);
  readonly getLeaderboard = DailyChallengePresenter.ok<DailyChallengeLeaderboardResponseDto>;
  readonly submitAnswer = DailyChallengePresenter.ok<DailyChallengeAnswerResponseDto>;
}
