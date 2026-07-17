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

  getFollowers(userId: string, limit: number, cursor?: string | null): Promise<Follower[]>;

  getFollowersOfUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowersResult>;

  getFollowing(userId: string, limit: number, cursor?: string | null): Promise<Following[]>;

  getFollowingOfUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowingResult>;

  getMutualFollowers(
    userId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFollowersResult>;

  getFollowerCount(userId: string): Promise<number>;

  getFollowingCount(userId: string): Promise<number>;

  isFollowing(followerId: string, followingId: string): Promise<boolean>;

  getUsernamesForUsers(
    followerId: string,
    followingId: string,
  ): Promise<{ followerUsername: string; followingUsername: string }>;
}
