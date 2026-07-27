import type {
  UserFollow,
  Follower,
  Following,
  PaginatedFollowersResult,
  PaginatedFollowingResult,
  PaginatedMutualFollowersResult,
} from '../../domain/types/social.types';

export const USER_FOLLOW_REPOSITORY_PORT = Symbol('USER_FOLLOW_REPOSITORY_PORT');

export interface UserFollowRepositoryPort {
  followUser(followerId: string, followingId: string): Promise<UserFollow>;

  unfollowUser(followerId: string, followingId: string): Promise<void>;

  /**
   * Find an active (non-soft-deleted) follow relationship.
   * Returns `null` when no such follow exists.
   *
   * Used by `SocialService.unfollowUser` to enforce the existence
   * precondition before mutating (audit issue: silent-success
   * DELETE). The match is direction-specific: `followerId` must
   * match the caller's id.
   */
  findActiveFollow(followerId: string, followingId: string): Promise<UserFollow | null>;

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

  getMutualFollowers(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFollowersResult>;

  getFollowerCount(userId: string): Promise<number>;

  getFollowingCount(userId: string): Promise<number>;

  isFollowing(followerId: string, followingId: string): Promise<boolean>;

  getUsernamesForUsers(
    followerId: string,
    followingId: string,
  ): Promise<{ followerUsername: string; followingUsername: string }>;
}
