import type {
  Friendship,
  BlockedUser,
  UserFollow,
  FriendRequest,
  Friend,
  Follower,
  Following,
  PaginatedFollowersResult,
  PaginatedFollowingResult,
  PaginatedSocialSuggestionsResult,
  PaginatedMutualFriendsResult,
  PaginatedMutualFollowersResult,
  PaginatedSocialFeedResult,
  PaginatedUserActivityResult,
  SocialCounts,
  UserSocialStats,
  MySocialAnalytics,
  TrendingUsersResult,
  RelationshipStatus,
  RespondToFriendRequestParams,
} from '../types/social.types';

export const SOCIAL_REPOSITORY_PORT = Symbol('SOCIAL_REPOSITORY_PORT');

export interface SocialRepositoryPort {
  // Friend Requests
  createFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship>;
  getFriendRequest(friendshipId: string): Promise<Friendship | null>;
  getPendingRequests(addresseeId: string): Promise<FriendRequest[]>;
  getSentRequests(requesterId: string): Promise<FriendRequest[]>;
  respondToFriendRequest(params: RespondToFriendRequestParams, requesterId: string): Promise<void>;

  // Friends
  getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]>;
  getFriendCount(userId: string): Promise<number>;
  removeFriend(userId: string, friendId: string): Promise<void>;

  // Blocking
  blockUser(blockerId: string, blockedId: string, reason?: string): Promise<BlockedUser>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  getBlockedUsers(blockerId: string): Promise<BlockedUser[]>;

  // Following
  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  getFollowers(userId: string, limit: number, cursor?: string | null): Promise<Follower[]>;
  getFollowersOfUser(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedFollowersResult>;
  getFollowing(userId: string, limit: number, cursor?: string | null): Promise<Following[]>;
  getFollowingOfUser(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedFollowingResult>;
  getMutualFriends(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFriendsResult>;
  getMutualFollowers(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFollowersResult>;
  getFeed(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedSocialFeedResult>;
  findActivitiesByUserId(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedUserActivityResult>;
  createFeedActivity(params: {
    userId: string;
    activityType: string;
    occurredAt: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  getUserSocialStats(userId: string): Promise<UserSocialStats>;
  getSocialAnalytics(userId: string): Promise<MySocialAnalytics>;
  getTrendingUsers(limit: number): Promise<TrendingUsersResult>;
  getSuggestions(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedSocialSuggestionsResult>;
  getFollowerCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;

  // Relationship
  getRelationshipStatus(userId: string, targetId: string): Promise<RelationshipStatus>;
  getRelationshipStatusesBatch(
    userId: string,
    targetIds: string[],
  ): Promise<Map<string, RelationshipStatus>>;
  getSocialCounts(userId: string): Promise<SocialCounts>;
  getUsernamesForUsers(
    followerId: string,
    followingId: string,
  ): Promise<{ followerUsername: string; followingUsername: string }>;
}
