import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type {
  LeaderboardResponseDto,
  UserRankResponseDto,
} from '../../dto/response/leaderboard-response.dto';
import type {
  LeaderboardDistributionResponseDto,
  UserPercentileResponseDto,
  UserRankSummaryDto,
} from '../../dto/response/leaderboard-stats.dto';
import type { NearbyRanksResponseDto } from '../../dto/response/leaderboard-nearby.dto';
import type {
  RankingHistoryItemDto,
  PeakRanksResponseDto,
  RankMovementResponseDto,
  PublicRankingHistoryResponseDto,
  RankingMilestoneDto,
} from '../../dto/response/leaderboard-history.dto';
import type { TopMoverDto } from '../../dto/response/leaderboard-top-movers.dto';
import type { RecentWinnersResponseDto } from '../../dto/response/recent-winners-response.dto';
import type {
  RankingStatusResponseDto,
  RecalculateResponseDto,
  PeriodResetResponseDto,
  ConsistencyReportResponseDto,
} from '../../dto/response/ranking-admin-response.dto';

/**
 * Presenter for the ranking module. Wraps every application-service response
 * in the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated. Endpoints that
 * return 204 No Content or use `@Res({ passthrough: true })` bypass the
 * presenter entirely.
 *
 * The `getGlobalLeaderboard` endpoint intentionally does NOT use a generic
 * pagination wrapper: `LeaderboardResponseDto` carries `entries`, plus
 * `totalParticipants`, `userPosition`, and `period` — it is a complex
 * resource, not a flat list, and the legacy custom `pagination: { limit,
 * offset, hasMore }` field is internal to the DTO. Treating it as a
 * single-resource keeps the wire shape stable while still adopting the new
 * envelope.
 */
@Injectable()
export class RankingPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // /leaderboard endpoints — wrap whole DTO as data (the response is a
  // complex resource, not a flat list).
  readonly getGlobalLeaderboard = RankingPresenter.ok<LeaderboardResponseDto>;
  readonly getLeaderboardDistribution = RankingPresenter.ok<LeaderboardDistributionResponseDto>;

  // /leaderboard/top-movers — `{ items }` shape unwrapped to a bare array.
  readonly getTopMovers = (payload: { items: readonly TopMoverDto[] }) =>
    ApiResponse.ok([...payload.items]);

  // /leaderboard/me and /leaderboard/:userId
  readonly getMyRank = RankingPresenter.ok<UserRankResponseDto>;
  readonly getUserRank = RankingPresenter.ok<UserRankResponseDto>;
  readonly getMyRankForPeriod = (payload?: UserRankSummaryDto) =>
    payload === undefined ? ApiResponse.ok(null) : ApiResponse.ok(payload);
  readonly getUserRankForPeriod = (payload?: UserRankSummaryDto) =>
    payload === undefined ? ApiResponse.ok(null) : ApiResponse.ok(payload);

  // /leaderboard/me/percentile
  readonly getMyPercentile = RankingPresenter.ok<UserPercentileResponseDto>;

  // /leaderboard/me/milestones — `{ items }` shape unwrapped.
  readonly getMyRankingMilestones = (payload: { items: readonly RankingMilestoneDto[] }) =>
    ApiResponse.ok([...payload.items]);

  // /leaderboard/me/nearby
  readonly getNearbyRanks = RankingPresenter.ok<NearbyRanksResponseDto>;

  // /leaderboard/me/movement
  readonly getMyRankMovement = RankingPresenter.ok<RankMovementResponseDto>;

  // /leaderboard/me/peak-ranks
  readonly getMyPeakRanks = RankingPresenter.ok<PeakRanksResponseDto>;

  // /leaderboard/me/history — `{ items }` shape unwrapped.
  readonly getMyRankingHistory = (payload: { items: readonly RankingHistoryItemDto[] }) =>
    ApiResponse.ok([...payload.items]);

  // /leaderboard/:userId/history
  readonly getUserRankingHistory = RankingPresenter.ok<PublicRankingHistoryResponseDto>;

  // /admin/ranking/* endpoints
  readonly getStatus = RankingPresenter.ok<RankingStatusResponseDto>;
  readonly triggerRecalculation = RankingPresenter.ok<RecalculateResponseDto>;
  readonly triggerPeriodReset = RankingPresenter.ok<PeriodResetResponseDto>;
  readonly triggerConsistencyCheck = RankingPresenter.ok<ConsistencyReportResponseDto>;

  // Phase 3 (S-15): live-winners carousel.
  readonly getRecentWinners = RankingPresenter.ok<RecentWinnersResponseDto>;
}
