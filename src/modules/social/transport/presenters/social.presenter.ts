import { Injectable } from '@nestjs/common';
import { ApiResponse } from '@/common/responses/api-response';
import type { ApiResponseEnvelope } from '@/common/responses/api-response';
import type { PaginatedResult } from '@/common/responses/paginated-result';
import type { CursorPagination } from '@/common/responses/pagination';
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
 * Wrap a paginated result with cursor pagination metadata.
 * Used for endpoints that return PaginatedResult<T> with cursor-based pagination.
 */
const wrapCursorPaginatedDto = <T>(
  items: readonly T[],
  pagination: CursorPagination,
): ApiResponseEnvelope<T[]> => {
  return {
    data: [...items],
    meta: {
      timestamp: new Date().toISOString(),
      pagination,
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

  // Suggestions & feed (cursor paginated)
  readonly getSuggestions = (
    payload: PaginatedResult<SocialSuggestionsResponseDto['items'][number]>,
  ) => wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);
  readonly getFeed = (payload: PaginatedResult<SocialFeedResponseDto['items'][number]>) =>
    wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);

  // Analytics & stats
  readonly getMySocialAnalytics = SocialPresenter.ok<MySocialAnalyticsResponseDto>;
  readonly getUserSocialStats = SocialPresenter.ok<UserSocialStatsResponseDto>;

  // Trending (no pagination meta — items-only DTO unwrapped to bare array)
  readonly getTrendingUsers = (dto: TrendingUsersListResponseDto) => ApiResponse.ok([...dto.items]);

  // User activity (cursor paginated)
  readonly getUserActivity = (payload: PaginatedResult<UserActivityResponseDto['items'][number]>) =>
    wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);

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

  // Cursor paginated DTOs (anchored to a target user)
  readonly getFollowersOfUser = (
    payload: PaginatedResult<UserFollowersResponseDto['items'][number]>,
  ) => wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);
  readonly getMutualFriends = (
    payload: PaginatedResult<MutualFriendsResponseDto['items'][number]>,
  ) => wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);
  readonly getMutualFollowers = (
    payload: PaginatedResult<MutualFollowersResponseDto['items'][number]>,
  ) => wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);

  readonly getFollowing = (payload: PaginatedResult<Following>) =>
    ApiResponse.page(payload.items, payload.pagination);
  readonly getFollowingOfUser = (
    payload: PaginatedResult<UserFollowingResponseDto['items'][number]>,
  ) => wrapCursorPaginatedDto(payload.items, payload.pagination as CursorPagination);

  // Relationship & counts
  readonly getRelationshipStatus = SocialPresenter.ok<RelationshipStatusDto>;
  readonly getSocialCounts = SocialPresenter.ok<SocialCountsDto>;
}
