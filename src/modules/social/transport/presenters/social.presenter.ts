import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { BlockedUserDto } from '../../dto/response/blocked.dto';
import type { FriendRequestDto } from '../../dto/response/friend.dto';
import type {
  MutualFriendsResponseDto,
  MutualFollowersResponseDto,
} from '../../dto/response/mutual.dto';
import type { SocialFeedResponseDto, UserActivityResponseDto } from '../../dto/response/feed.dto';
import type { SocialSuggestionsResponseDto } from '../../dto/response/suggestion.dto';
import type {
  UserFollowersResponseDto,
  UserFollowingResponseDto,
} from '../../dto/response/paginated.dto';
import type { TrendingUsersListResponseDto } from '../../dto/response/trending.dto';
import type {
  SocialCountsDto,
  UserSocialStatsResponseDto,
  MySocialAnalyticsResponseDto,
} from '../../dto/response/stats.dto';
import type { RelationshipStatusDto } from '../../dto/response/relationship.dto';
import type { FriendLeaderboardDto } from '../../dto/response/leaderboard.dto';
import type { SearchableUserDto } from '../../dto/response/search.dto';
import type {
  Friend,
  Follower,
  Following,
  SearchableUser,
  FriendRequest,
} from '../../domain/types/social.types';

/**
 * Wrap a `{ items: T[], pagination: { page, limit, total } }`
 * payload as `{ data: T[], meta: { timestamp, pagination: { kind: "offset", ... } } }`.
 *
 * Used for offset-paginated list endpoints whose application-service return is a
 * class-instance `{ items, pagination }` DTO. The canonical envelope has to be
 * a plain object (the interceptor's `isFormattedResponse()` guards on `Object`
 * prototype), so we deliberately project out the DTO fields here instead of
 * forwarding the class instance for the interceptor to re-wrap.
 */
const wrapOffsetPaginatedDto = <T>(payload: {
  items: readonly T[];
  pagination: { page: number; limit: number; total: number };
}): ApiResponseEnvelope<T[]> => {
  const totalPages = Math.max(1, Math.ceil(payload.pagination.total / payload.pagination.limit));
  const hasMore = payload.pagination.page < totalPages;
  return {
    data: [...payload.items],
    meta: {
      timestamp: new Date().toISOString(),
      pagination: {
        kind: 'offset' as const,
        page: payload.pagination.page,
        limit: payload.pagination.limit,
        total: payload.pagination.total,
        hasMore,
      },
    },
  };
};

/**
 * Presenter for the social module. Wraps every application-service response in
 * the canonical `{ data, meta.timestamp }` envelope.
 *
 * One presenter method per endpoint keeps `git grep presenter.<name>` a
 * reliable index of which controllers have been migrated.
 *
 * Endpoints that return 204 No Content (respond / cancel friend request /
 * remove friend / unblock / follow / unfollow) bypass the presenter entirely.
 */
@Injectable()
export class SocialPresenter {
  private static readonly ok = <T>(payload: T): ApiResponseEnvelope<T> => ApiResponse.ok(payload);

  // Search
  readonly searchUsernameSuggestions = (payload: string[]) => ApiResponse.ok(payload);
  readonly searchUsers = (payload: SearchableUser[]) =>
    ApiResponse.ok(payload as SearchableUserDto[]);

  // Suggestions & feed (offset paginated DTOs)
  readonly getSuggestions = wrapOffsetPaginatedDto<SocialSuggestionsResponseDto['items'][number]>;
  readonly getFeed = wrapOffsetPaginatedDto<SocialFeedResponseDto['items'][number]>;

  // Analytics & stats
  readonly getMySocialAnalytics = SocialPresenter.ok<MySocialAnalyticsResponseDto>;
  readonly getUserSocialStats = SocialPresenter.ok<UserSocialStatsResponseDto>;

  // Trending (no pagination meta — items-only DTO unwrapped to bare array)
  readonly getTrendingUsers = (dto: TrendingUsersListResponseDto) => ApiResponse.ok([...dto.items]);

  // User activity (offset paginated DTO)
  readonly getUserActivity = wrapOffsetPaginatedDto<UserActivityResponseDto['items'][number]>;

  // Friend leaderboard
  readonly getFriendLeaderboard = SocialPresenter.ok<FriendLeaderboardDto>;

  // Friend requests
  readonly sendFriendRequest = SocialPresenter.ok<FriendRequestDto>;
  readonly getPendingRequests = (payload: FriendRequest[]) =>
    ApiResponse.ok(payload as FriendRequestDto[]);
  readonly getSentRequests = (payload: FriendRequest[]) =>
    ApiResponse.ok(payload as FriendRequestDto[]);

  // Friends (cursor paginated)
  readonly getFriends = (payload: PaginatedResult<Friend>) =>
    ApiResponse.page(payload.items, payload.pagination);
  readonly getFriendsOfUser = (payload: PaginatedResult<Friend>) =>
    ApiResponse.page(payload.items, payload.pagination);

  // Block user action returns a confirmation message
  readonly blockUser = (payload: { message: string }) => ApiResponse.ok(payload);

  // Blocked users (bare array)
  readonly getBlockedUsers = (payload: BlockedUserDto[]) => ApiResponse.ok(payload);

  // Followers / following (cursor paginated)
  readonly getFollowers = (payload: PaginatedResult<Follower>) =>
    ApiResponse.page(payload.items, payload.pagination);

  // Offset paginated DTOs (anchored to a target user)
  readonly getFollowersOfUser = wrapOffsetPaginatedDto<UserFollowersResponseDto['items'][number]>;
  readonly getMutualFriends = wrapOffsetPaginatedDto<MutualFriendsResponseDto['items'][number]>;
  readonly getMutualFollowers = wrapOffsetPaginatedDto<MutualFollowersResponseDto['items'][number]>;

  readonly getFollowing = (payload: PaginatedResult<Following>) =>
    ApiResponse.page(payload.items, payload.pagination);
  readonly getFollowingOfUser = wrapOffsetPaginatedDto<UserFollowingResponseDto['items'][number]>;

  // Relationship & counts
  readonly getRelationshipStatus = SocialPresenter.ok<RelationshipStatusDto>;
  readonly getSocialCounts = SocialPresenter.ok<SocialCountsDto>;
}
