import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { SocialService } from '../domain/services/social.service';
import type {
  FriendRequest,
  Friend,
  Follower,
  Following,
  SocialCounts,
  RelationshipStatus,
  SearchableUser,
  FriendLeaderboard,
  PaginatedFollowersResult,
  PaginatedFollowingResult,
  PaginatedSocialSuggestionsResult,
  PaginatedMutualFriendsResult,
  PaginatedMutualFollowersResult,
  PaginatedSocialFeedResult,
  PaginatedUserActivityResult,
} from '../domain/types/social.types';

@Injectable()
export class SocialApplicationService {
  constructor(private readonly socialService: SocialService) {}

  async searchUsers(user: JwtPayload, query: string, limit: number): Promise<SearchableUser[]> {
    return this.socialService.searchUsers(user.sub, query, limit);
  }

  async getFriendLeaderboard(
    user: JwtPayload,
    period: 'weekly' | 'monthly' | 'all_time',
    limit: number = 20,
  ): Promise<FriendLeaderboard> {
    return this.socialService.getFriendLeaderboard(user.sub, period, limit);
  }

  async sendFriendRequest(user: JwtPayload, addresseeId: string): Promise<FriendRequest> {
    return this.socialService.sendFriendRequest(user.sub, { addresseeId });
  }

  async respondToFriendRequest(
    user: JwtPayload,
    friendshipId: string,
    accept: boolean,
  ): Promise<void> {
    return this.socialService.respondToFriendRequest(user.sub, friendshipId, accept);
  }

  async cancelFriendRequest(user: JwtPayload, friendshipId: string): Promise<void> {
    return this.socialService.cancelFriendRequest(user.sub, friendshipId);
  }

  async getPendingRequests(user: JwtPayload): Promise<FriendRequest[]> {
    return this.socialService.getPendingRequests(user.sub);
  }

  async getSentRequests(user: JwtPayload): Promise<FriendRequest[]> {
    return this.socialService.getSentRequests(user.sub);
  }

  async getFriends(
    user: JwtPayload,
    limit: number,
    cursor?: string | null,
  ): Promise<{ items: Friend[]; hasNextPage: boolean }> {
    const items = await this.socialService.getFriends(user.sub, limit + 1, cursor);
    const hasNextPage = items.length > limit;
    const result = hasNextPage ? items.slice(0, limit) : items;
    return { items: result, hasNextPage };
  }

  async getFriendCount(user: JwtPayload): Promise<number> {
    return this.socialService.getFriendCount(user.sub);
  }

  async removeFriend(user: JwtPayload, friendId: string): Promise<void> {
    return this.socialService.removeFriend(user.sub, friendId);
  }

  async blockUser(user: JwtPayload, blockedId: string, reason?: string): Promise<void> {
    return this.socialService.blockUser(user.sub, blockedId, reason);
  }

  async unblockUser(user: JwtPayload, blockedId: string): Promise<void> {
    return this.socialService.unblockUser(user.sub, blockedId);
  }

  async getBlockedUsers(user: JwtPayload): Promise<{ blockedId: string; reason: string | null }[]> {
    return this.socialService.getBlockedUsers(user.sub);
  }

  async followUser(user: JwtPayload, followingId: string): Promise<void> {
    return this.socialService.followUser(user.sub, followingId);
  }

  async unfollowUser(user: JwtPayload, followingId: string): Promise<void> {
    return this.socialService.unfollowUser(user.sub, followingId);
  }

  async getFollowers(
    user: JwtPayload,
    limit: number,
    cursor?: string | null,
  ): Promise<{ items: Follower[]; hasNextPage: boolean }> {
    const items = await this.socialService.getFollowers(user.sub, limit + 1, cursor);
    const hasNextPage = items.length > limit;
    const result = hasNextPage ? items.slice(0, limit) : items;
    return { items: result, hasNextPage };
  }

  async getFollowersOfUser(
    user: JwtPayload,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowersResult> {
    return this.socialService.getFollowersOfUser(user.sub, targetUserId, page, limit);
  }

  async getFollowing(
    user: JwtPayload,
    limit: number,
    cursor?: string | null,
  ): Promise<{ items: Following[]; hasNextPage: boolean }> {
    const items = await this.socialService.getFollowing(user.sub, limit + 1, cursor);
    const hasNextPage = items.length > limit;
    const result = hasNextPage ? items.slice(0, limit) : items;
    return { items: result, hasNextPage };
  }

  async getFollowingOfUser(
    user: JwtPayload,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowingResult> {
    return this.socialService.getFollowingOfUser(user.sub, targetUserId, page, limit);
  }

  async getMutualFriends(
    user: JwtPayload,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFriendsResult> {
    return this.socialService.getMutualFriends(user.sub, targetUserId, page, limit);
  }

  async getMutualFollowers(
    user: JwtPayload,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFollowersResult> {
    return this.socialService.getMutualFollowers(user.sub, targetUserId, page, limit);
  }

  async getFeed(user: JwtPayload, page: number, limit: number): Promise<PaginatedSocialFeedResult> {
    return this.socialService.getFeed(user.sub, page, limit);
  }

  async getUserActivity(
    user: JwtPayload,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedUserActivityResult> {
    return this.socialService.getUserActivity(user.sub, targetUserId, page, limit);
  }

  async getSuggestions(
    user: JwtPayload,
    page: number,
    limit: number,
  ): Promise<PaginatedSocialSuggestionsResult> {
    return this.socialService.getSuggestions(user.sub, page, limit);
  }

  async getRelationshipStatus(user: JwtPayload, targetId: string): Promise<RelationshipStatus> {
    return this.socialService.getRelationshipStatus(user.sub, targetId);
  }

  async getSocialCounts(user: JwtPayload): Promise<SocialCounts> {
    return this.socialService.getSocialCounts(user.sub);
  }
}
