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
import type { PublicTournamentHistoryResponseDto } from '../../dto/response/public-tournament-history.dto';
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
 * Wrap a single-resource payload as `{ data, meta.timestamp }`. Mirrors
 * the equivalent in `bookmark.presenter.ts` and `social.presenter.ts` —
 * all three modules expose the same shape so the response interceptor
 * never has to special-case per-module envelopes.
 */
const ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

/**
 * Per-endpoint typed factory functions (Phase 8 / F-22). The generic
 * `ok<T>` and `wrapPaginatedDto<T>` helpers above still do the heavy
 * lifting; these static methods exist purely so each presenter method
 * surfaces its concrete DTO type. The TS compiler can then infer
 * `data: UserMeResponseDto` rather than the looser `data: T`.
 *
 * No runtime cost: the static methods are identity functions that
 * forward to the generic helpers. The benefit is purely a typing
 * convenience — git grep `Presenter.me(` resolves to the concrete
 * factory at the call site.
 */
type EndpointFactory<D> = (data: D) => ApiResponseEnvelope<D>;
type PaginatedFactory<D> = (data: {
  items: readonly D[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}) => ApiResponseEnvelope<D[]>;

// Single-resource factories
const me: EndpointFactory<UserMeResponseDto> = ok;
const ranking: EndpointFactory<UserRankingResponseDto> = ok;
const analytics: EndpointFactory<UserAnalyticsResponseDto> = ok;
const myTournamentAnalytics: EndpointFactory<MyTournamentAnalyticsResponseDto> = ok;
const userQuizAnalytics: EndpointFactory<CreatorQuizAnalyticsDto> = ok;
const publicTournamentProfile: EndpointFactory<PublicTournamentProfileResponseDto> = ok;

// Cursor-paginated factories
const badges: PaginatedFactory<UserBadgesResponseDto['items'][number]> = wrapPaginatedDto;
const activity: PaginatedFactory<UserActivityResponseDto['items'][number]> = wrapPaginatedDto;
const tournaments: PaginatedFactory<MyTournamentsResponseDto['items'][number]> = wrapPaginatedDto;
const tournamentHistory: PaginatedFactory<MyTournamentHistoryResponseDto['items'][number]> =
  wrapPaginatedDto;
const publicTournamentHistory: PaginatedFactory<
  PublicTournamentHistoryResponseDto['items'][number]
> = wrapPaginatedDto;
const userQuizzes: PaginatedFactory<QuizListResponseDto['items'][number]> = wrapPaginatedDto;

/**
 * Presenter for the user module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * Cursor-paginated list endpoints use the `wrapPaginatedDto` helper to
 * project the `{ items, pagination }` class DTO into the standard
 * envelope. The recommended-quizzes endpoint unwraps `{ items }` to a
 * bare array (the service returns a `RelatedQuizzesResponseDto`
 * wrapper, but the wire shape is a flat list — see the quiz module for
 * the same convention).
 *
 * Phase 8 (F-21): both `ok` and `wrapPaginatedDto` are module-level
 * arrow functions. Previously `ok` was a `private static readonly`
 * while `wrapPaginatedDto` was module-level — that asymmetry is the
 * inconsistency the audit called out. Module-level makes both helpers
 * trivially testable in isolation and matches the bookmark/social
 * presenter style.
 *
 * Phase 8 (F-22): per-endpoint typed factories (`me`, `ranking`,
 * `badges`, …) give the TS compiler the concrete DTO type at each
 * call site instead of the looser `<T>`. No runtime cost — they're
 * identity functions that forward to the generic helpers.
 */
@Injectable()
export class UserPresenter {
  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getMe = me;
  readonly updateMe = me;
  readonly updateMeSettings = me;
  readonly getUserRanking = ranking;
  readonly getUserAnalytics = analytics;
  readonly getMyTournamentAnalytics = myTournamentAnalytics;
  readonly getUserQuizAnalytics = userQuizAnalytics;
  readonly getPublicTournamentProfile = publicTournamentProfile;

  // Cursor-paginated list endpoints — `{ items, pagination }` unwrapped.
  readonly listMyBadges = badges;
  readonly listBadgesByUserId = badges;
  /**
   * Phase 4 (F-29): Renamed from `listUserActivity` because the route is
   * mounted on `/users/me/activity` and never accepts a target `userId`.
   */
  readonly listMyActivity = activity;
  readonly listMyTournaments = tournaments;
  readonly listMyTournamentHistory = tournamentHistory;
  /**
   * Phase 4 (F-10): Cross-user (`GET /users/:userId/tournament-history`)
   * counterpart of `listMyTournamentHistory`. Projected from
   * `PublicTournamentHistoryResponseDto` so the two routes can drift
   * independently in the OpenAPI schema.
   */
  readonly getUserTournamentHistory = publicTournamentHistory;
  readonly listUserQuizzes = userQuizzes;

  // Bare-array endpoint — `{ items }` unwrapped to a flat list.
  readonly getRecommendedQuizzes = (dto: RelatedQuizzesResponseDto) =>
    ApiResponse.ok([...dto.items]);
}
