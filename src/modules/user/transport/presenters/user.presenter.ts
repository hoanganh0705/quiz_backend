import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { RelatedQuizzesResponseDto } from '@/modules/quiz/dto/response/related-quizzes-response.dto';
import type { UserMeResponseDto } from '../../dto/response/user-me.dto';
import type { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import type { UserBadgesResponseDto } from '../../dto/response/user-badges.dto';
import type { UserActivityResponseDto } from '../../dto/response/user-activity.dto';
import type { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import type { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import type { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history.dto';
import type { MyTournamentsResponseDto } from '../../dto/response/my-tournaments.dto';
import type { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';

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
 * Presenter for the user module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * Cursor-paginated list endpoints use `wrapPaginatedDto` to project the
 * `{ items, pagination }` class DTO into the standard envelope. The
 * recommended-quizzes endpoint unwraps `{ items }` to a bare array (the
 * service returns a `RelatedQuizzesResponseDto` wrapper, but the wire shape
 * is a flat list — see the quiz module for the same convention).
 */
@Injectable()
export class UserPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getMe = UserPresenter.ok<UserMeResponseDto>;
  readonly updateMe = UserPresenter.ok<UserMeResponseDto>;
  readonly updateMeSettings = UserPresenter.ok<UserMeResponseDto>;
  readonly getUserRanking = UserPresenter.ok<UserRankingResponseDto>;
  readonly getUserAnalytics = UserPresenter.ok<UserAnalyticsResponseDto>;
  readonly getMyTournamentAnalytics = UserPresenter.ok<MyTournamentAnalyticsResponseDto>;
  readonly getUserQuizAnalytics = UserPresenter.ok<CreatorQuizAnalyticsDto>;
  readonly getPublicTournamentProfile = UserPresenter.ok<PublicTournamentProfileResponseDto>;

  // Cursor-paginated list endpoints — `{ items, pagination }` unwrapped.
  readonly listMyBadges = wrapPaginatedDto<UserBadgesResponseDto['items'][number]>;
  readonly listBadgesByUserId = wrapPaginatedDto<UserBadgesResponseDto['items'][number]>;
  readonly listUserActivity = wrapPaginatedDto<UserActivityResponseDto['items'][number]>;
  readonly listMyTournaments = wrapPaginatedDto<MyTournamentsResponseDto['items'][number]>;
  readonly listMyTournamentHistory = wrapPaginatedDto<
    MyTournamentHistoryResponseDto['items'][number]
  >;
  readonly getUserTournamentHistory = wrapPaginatedDto<
    MyTournamentHistoryResponseDto['items'][number]
  >;
  readonly listUserQuizzes = wrapPaginatedDto<QuizListResponseDto['items'][number]>;

  // Bare-array endpoint — `{ items }` unwrapped to a flat list.
  readonly getRecommendedQuizzes = (dto: RelatedQuizzesResponseDto) =>
    ApiResponse.ok([...dto.items]);
}
