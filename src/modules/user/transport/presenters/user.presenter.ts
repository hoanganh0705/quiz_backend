import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { CreatorQuizAnalyticsDto } from '@/modules/quiz/dto/response/quiz-analytics.dto';
import type { QuizListResponseDto } from '@/modules/quiz/dto/response/quiz-list-response.dto';
import type { RelatedQuizzesResponseDto } from '@/modules/quiz/dto/response/related-quizzes-response.dto';
import type { UserLookupResponseDto } from '../../dto/response/user-lookup.dto';
import type { UserMeResponseDto } from '../../dto/response/user-me.dto';
import type { UserSummaryResponseDto } from '../../dto/response/user-summary.dto';
import type { UserAnalyticsResponseDto } from '../../dto/response/user-analytics.dto';
import type { UserBadgesResponseDto } from '../../dto/response/user-badges.dto';
import type { UserActivityResponseDto } from '../../dto/response/user-activity.dto';
import type { UserRankingResponseDto } from '../../dto/response/user-ranking.dto';
import type { MyTournamentAnalyticsResponseDto } from '../../dto/response/my-tournament-analytics.dto';
import type { MyTournamentHistoryResponseDto } from '../../dto/response/my-tournament-history.dto';
import type { PublicTournamentHistoryResponseDto } from '../../dto/response/public-tournament-history.dto';
import type { MyTournamentsResponseDto } from '../../dto/response/my-tournaments.dto';
import type { PublicTournamentProfileResponseDto } from '../../dto/response/public-tournament-profile.dto';
import type { RecentlyPlayedQuizzesResponseDto } from '../../dto/response/recently-played-quizzes.dto';
import type { UserProfileBundleResponseDto } from '../../dto/response/user-profile-bundle.dto';

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

const ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

type EndpointFactory<D> = (data: D) => ApiResponseEnvelope<D>;
type PaginatedFactory<D> = (data: {
  items: readonly D[];
  pagination: { limit: number; hasNextPage: boolean; nextCursor: string | null };
}) => ApiResponseEnvelope<D[]>;

const me: EndpointFactory<UserMeResponseDto> = ok;
const userLookup: EndpointFactory<UserLookupResponseDto> = ok;
const userSummary: EndpointFactory<UserSummaryResponseDto> = ok;
const ranking: EndpointFactory<UserRankingResponseDto> = ok;
const analytics: EndpointFactory<UserAnalyticsResponseDto> = ok;
const myTournamentAnalytics: EndpointFactory<MyTournamentAnalyticsResponseDto> = ok;
const userQuizAnalytics: EndpointFactory<CreatorQuizAnalyticsDto> = ok;
const publicTournamentProfile: EndpointFactory<PublicTournamentProfileResponseDto> = ok;
const profileBundle: EndpointFactory<UserProfileBundleResponseDto> = ok;

const badges: PaginatedFactory<UserBadgesResponseDto['items'][number]> = wrapPaginatedDto;
const activity: PaginatedFactory<UserActivityResponseDto['items'][number]> = wrapPaginatedDto;
const tournaments: PaginatedFactory<MyTournamentsResponseDto['items'][number]> = wrapPaginatedDto;
const tournamentHistory: PaginatedFactory<MyTournamentHistoryResponseDto['items'][number]> =
  wrapPaginatedDto;
const publicTournamentHistory: PaginatedFactory<
  PublicTournamentHistoryResponseDto['items'][number]
> = wrapPaginatedDto;
const userQuizzes: PaginatedFactory<QuizListResponseDto['items'][number]> = wrapPaginatedDto;
@Injectable()
export class UserPresenter {
  // Single-resource endpoints — wrap whole DTO as `data`.
  readonly getMe = me;
  readonly updateMe = me;
  readonly updateMeSettings = me;
  readonly getUserByUsername = userLookup;
  readonly getMySummary = userSummary;
  readonly getUserRanking = ranking;
  readonly getUserAnalytics = analytics;
  readonly getMyTournamentAnalytics = myTournamentAnalytics;
  readonly getUserQuizAnalytics = userQuizAnalytics;
  readonly getPublicTournamentProfile = publicTournamentProfile;

  // Cursor-paginated list endpoints — `{ items, pagination }` unwrapped.
  readonly listMyBadges = badges;
  readonly listBadgesByUserId = badges;
  readonly listMyActivity = activity;
  readonly listMyTournaments = tournaments;
  readonly listMyTournamentHistory = tournamentHistory;
  readonly getUserTournamentHistory = publicTournamentHistory;
  readonly listUserQuizzes = userQuizzes;

  // Bare-array endpoint — `{ items }` unwrapped to a flat list.
  readonly getRecommendedQuizzes = (dto: RelatedQuizzesResponseDto) =>
    ApiResponse.ok([...dto.items]);

  readonly getRecentlyPlayedQuizzes = (payload: RecentlyPlayedQuizzesResponseDto) =>
    ApiResponse.page(payload.items, payload.pagination);

  readonly getMyProfileBundle = profileBundle;
  readonly getUserProfileBundle = profileBundle;
}
