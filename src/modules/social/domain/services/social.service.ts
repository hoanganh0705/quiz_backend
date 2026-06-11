import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SOCIAL_REPOSITORY_PORT, type SocialRepositoryPort } from '../ports/social-ports';
import { SOCIAL_DOMAIN_EVENT_BUS, type SocialDomainEventBusPort } from '../ports';
import {
  USER_SEARCH_PORT,
  type UserSearchPort,
} from '@/modules/user/domain/ports/user-search.port';
import { RANKING_PORT, type RankingPort } from '../ports/ranking.port';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '@/modules/user/domain/ports/user-repository.port';
import type { UsernameSuggestion } from '@/modules/user/domain/ports/user-search.port';
import type {
  FriendRequest,
  Friend,
  Follower,
  Following,
  SocialCounts,
  RelationshipStatus,
  CreateFriendRequestParams,
  SearchableUser,
  FriendLeaderboard,
  FriendRankingEntry,
  PaginatedFollowersResult,
  PaginatedFollowingResult,
  PaginatedSocialSuggestionsResult,
  PaginatedMutualFriendsResult,
  PaginatedMutualFollowersResult,
  PaginatedSocialFeedResult,
  PaginatedUserActivityResult,
  SocialFeedActivityType,
  UserSocialStats,
  MySocialAnalytics,
  TrendingUsersResult,
} from '../types/social.types';
import {
  SelfFriendRequestError,
  AlreadyFriendsError,
  BlockedUserError,
  UserBlockedError,
  PendingRequestExistsError,
  FriendRequestNotFoundError,
  FriendRequestForbiddenError,
} from '../errors/social.errors';
import { UserNotFoundError } from '@/modules/user/domain/errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';

@Injectable()
export class SocialService {
  constructor(
    @Inject(SOCIAL_REPOSITORY_PORT)
    private readonly socialRepository: SocialRepositoryPort,
    @Inject(SOCIAL_DOMAIN_EVENT_BUS)
    private readonly eventBus: SocialDomainEventBusPort,
    @Inject(USER_SEARCH_PORT)
    private readonly userSearch: UserSearchPort,
    @Inject(RANKING_PORT)
    private readonly ranking: RankingPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    @InjectPinoLogger(SocialService.name)
    private readonly logger: PinoLogger,
  ) {}

  async sendFriendRequest(
    requesterId: string,
    params: CreateFriendRequestParams,
  ): Promise<FriendRequest> {
    const { addresseeId } = params;

    if (requesterId === addresseeId) {
      throw new SelfFriendRequestError();
    }

    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      addresseeId,
    );

    if (relationship.isBlocked) {
      throw new BlockedUserError();
    }

    if (relationship.isBlockedBy) {
      throw new UserBlockedError();
    }

    if (relationship.isFriend) {
      throw new AlreadyFriendsError();
    }

    if (relationship.hasPendingRequest) {
      throw new PendingRequestExistsError();
    }

    try {
      const friendship = await this.socialRepository.createFriendRequest(requesterId, addresseeId);

      this.logger.info({
        event: 'friend_request_sent',
        friendshipId: friendship.friendshipId,
        requesterId,
        addresseeId,
      });

      // Emit domain event
      this.eventBus.emitFriendRequestSent({
        eventType: 'friend_request_sent',
        friendshipId: friendship.friendshipId,
        requesterId,
        requesterUsername: '', // Will be filled by event handler if needed
        addresseeId,
        addresseeUsername: '', // Will be filled by event handler if needed
        timestamp: new Date(),
      });

      const requests = await this.socialRepository.getSentRequests(requesterId);
      return requests[0];
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new PendingRequestExistsError();
      }
      throw error;
    }
  }

  async respondToFriendRequest(
    userId: string,
    friendshipId: string,
    accept: boolean,
  ): Promise<void> {
    const friendship = await this.socialRepository.getFriendRequest(friendshipId);

    if (!friendship) {
      throw new FriendRequestNotFoundError(friendshipId);
    }

    if (friendship.addresseeId !== userId) {
      throw new FriendRequestForbiddenError();
    }

    await this.socialRepository.respondToFriendRequest({ friendshipId, accept }, userId);

    this.logger.info({
      event: accept ? 'friend_request_accepted' : 'friend_request_rejected',
      friendshipId,
      userId,
    });

    // Emit domain event
    if (accept) {
      const { followerUsername } = await this.socialRepository.getUsernamesForUsers(
        friendship.requesterId,
        friendship.addresseeId,
      );

      this.eventBus.emitFriendRequestAccepted({
        eventType: 'friend_request_accepted',
        friendshipId,
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
        addresseeUsername: followerUsername,
        timestamp: new Date(),
      });
    } else {
      this.eventBus.emitFriendRequestRejected({
        eventType: 'friend_request_rejected',
        friendshipId,
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
        timestamp: new Date(),
      });
    }
  }

  async cancelFriendRequest(requesterId: string, friendshipId: string): Promise<void> {
    const friendship = await this.socialRepository.getFriendRequest(friendshipId);

    if (!friendship) {
      throw new FriendRequestNotFoundError(friendshipId);
    }

    if (friendship.requesterId !== requesterId) {
      throw new FriendRequestForbiddenError();
    }

    const addresseeId = friendship.addresseeId;
    await this.socialRepository.removeFriend(requesterId, addresseeId);

    this.logger.info({
      event: 'friend_request_cancelled',
      friendshipId,
      requesterId,
    });

    // Emit domain event
    this.eventBus.emitFriendRequestCancelled({
      eventType: 'friend_request_cancelled',
      friendshipId,
      requesterId,
      addresseeId,
      timestamp: new Date(),
    });
  }

  async getPendingRequests(userId: string): Promise<FriendRequest[]> {
    return this.socialRepository.getPendingRequests(userId);
  }

  async getSentRequests(userId: string): Promise<FriendRequest[]> {
    return this.socialRepository.getSentRequests(userId);
  }

  async getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]> {
    return this.socialRepository.getFriends(userId, limit, cursor);
  }

  async getFriendCount(userId: string): Promise<number> {
    return this.socialRepository.getFriendCount(userId);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.socialRepository.removeFriend(userId, friendId);

    this.logger.info({
      event: 'friend_removed',
      userId,
      friendId,
    });

    // Emit domain event
    this.eventBus.emitFriendRemoved({
      eventType: 'friend_removed',
      userId,
      friendId,
      timestamp: new Date(),
    });
  }

  async blockUser(blockerId: string, blockedId: string, reason?: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new SelfFriendRequestError();
    }

    await this.socialRepository.blockUser(blockerId, blockedId, reason);

    this.logger.info({
      event: 'user_blocked',
      blockerId,
      blockedId,
      reason,
    });

    // Emit domain event
    this.eventBus.emitUserBlocked({
      eventType: 'user_blocked',
      blockerId,
      blockedId,
      reason: reason ?? null,
      timestamp: new Date(),
    });

    await this.socialRepository.removeFriend(blockerId, blockedId);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.socialRepository.unblockUser(blockerId, blockedId);

    this.logger.info({
      event: 'user_unblocked',
      blockerId,
      blockedId,
    });

    // Emit domain event
    this.eventBus.emitUserUnblocked({
      eventType: 'user_unblocked',
      blockerId,
      blockedId,
      timestamp: new Date(),
    });
  }

  async getBlockedUsers(
    blockerId: string,
  ): Promise<{ blockedId: string; reason: string | null }[]> {
    const blocked = await this.socialRepository.getBlockedUsers(blockerId);
    return blocked.map((b) => ({ blockedId: b.blockedId, reason: b.reason }));
  }

  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new SelfFriendRequestError();
    }

    const relationship = await this.socialRepository.getRelationshipStatus(followerId, followingId);

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    try {
      const follow = await this.socialRepository.followUser(followerId, followingId);

      this.logger.info({
        event: 'user_followed',
        followerId,
        followingId,
      });

      // Emit domain event
      this.eventBus.emitUserFollowed({
        eventType: 'user_followed',
        followId: follow.followId,
        followerId,
        followerUsername: follow.followerUsername,
        followingId,
        followingUsername: follow.followingUsername,
        timestamp: new Date(),
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        return;
      }
      throw error;
    }
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await this.socialRepository.unfollowUser(followerId, followingId);

    const { followerUsername, followingUsername } = await this.socialRepository.getUsernamesForUsers(
      followerId,
      followingId,
    );

    this.logger.info({
      event: 'user_unfollowed',
      followerId,
      followingId,
    });

    // Emit domain event
    this.eventBus.emitUserUnfollowed({
      eventType: 'user_unfollowed',
      followerId,
      followerUsername,
      followingId,
      followingUsername,
      timestamp: new Date(),
    });
  }

  async getFollowers(userId: string, limit: number, cursor?: string | null): Promise<Follower[]> {
    return this.socialRepository.getFollowers(userId, limit, cursor);
  }

  async getFollowersOfUser(
    requesterId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowersResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    this.logger.debug({
      event: 'user_followers_requested',
      requesterId,
      targetUserId,
      page,
      limit,
    });

    return this.socialRepository.getFollowersOfUser(targetUserId, page, limit);
  }

  async getFollowing(userId: string, limit: number, cursor?: string | null): Promise<Following[]> {
    return this.socialRepository.getFollowing(userId, limit, cursor);
  }

  async getFollowingOfUser(
    requesterId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowingResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    this.logger.debug({
      event: 'user_following_requested',
      requesterId,
      targetUserId,
      page,
      limit,
    });

    return this.socialRepository.getFollowingOfUser(targetUserId, page, limit);
  }

  async getMutualFriends(
    requesterId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFriendsResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    this.logger.debug({
      event: 'mutual_friends_requested',
      requesterId,
      targetUserId,
      page,
      limit,
    });

    return this.socialRepository.getMutualFriends(requesterId, targetUserId, page, limit);
  }

  async getMutualFollowers(
    requesterId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFollowersResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    this.logger.debug({
      event: 'mutual_followers_requested',
      requesterId,
      targetUserId,
      page,
      limit,
    });

    return this.socialRepository.getMutualFollowers(requesterId, targetUserId, page, limit);
  }

  async getFeed(userId: string, page: number, limit: number): Promise<PaginatedSocialFeedResult> {
    this.logger.debug({
      event: 'social_feed_requested',
      userId,
      page,
      limit,
    });

    return await this.socialRepository.getFeed(page, limit);
  }

  async getUserActivity(
    requesterId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedUserActivityResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    this.logger.debug({
      event: 'social_user_activity_requested',
      requesterId,
      targetUserId,
      page,
      limit,
    });

    return this.socialRepository.findActivitiesByUserId(targetUserId, page, limit);
  }

  async recordFeedActivity(params: {
    userId: string;
    activityType: SocialFeedActivityType;
    occurredAt: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    this.logger.debug({
      event: 'social_feed_activity_recorded',
      userId: params.userId,
      activityType: params.activityType,
      occurredAt: params.occurredAt,
    });

    await this.socialRepository.createFeedActivity(params);
  }

  async getSuggestions(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedSocialSuggestionsResult> {
    this.logger.debug({
      event: 'social_suggestions_requested',
      userId,
      page,
      limit,
    });

    return await this.socialRepository.getSuggestions(userId, page, limit);
  }

  async getRelationshipStatus(userId: string, targetId: string): Promise<RelationshipStatus> {
    return await this.socialRepository.getRelationshipStatus(userId, targetId);
  }

  async getSocialCounts(userId: string): Promise<SocialCounts> {
    return await this.socialRepository.getSocialCounts(userId);
  }

  async getUserSocialStats(userId: string): Promise<UserSocialStats> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'social_user_stats_user_not_found', userId });
      throw new UserNotFoundError();
    }

    return await this.socialRepository.getUserSocialStats(userId);
  }

  async getMySocialAnalytics(userId: string): Promise<MySocialAnalytics> {
    const user = await this.userRepository.findMeById(userId);

    if (!user) {
      this.logger.warn({ event: 'social_my_analytics_user_not_found', userId });
      throw new UserNotFoundError();
    }

    this.logger.debug({ event: 'social_my_analytics_requested', userId });

    return await this.socialRepository.getSocialAnalytics(userId);
  }

  async getTrendingUsers(limit: number): Promise<TrendingUsersResult> {
    this.logger.debug({
      event: 'social_trending_users_requested',
      limit,
    });

    return await this.socialRepository.getTrendingUsers(limit);
  }

  async searchUsernameSuggestions(query: string, limit: number): Promise<UsernameSuggestion[]> {
    this.logger.debug({
      event: 'social_username_suggestions_requested',
      query,
      limit,
    });

    return await this.userSearch.searchUsernameSuggestions(query, limit);
  }

  /**
   * Search users for adding as friends.
   * Excludes blocked users and the current user.
   * Returns users with their relationship status to the searcher.
   */
  async searchUsers(
    searcherId: string,
    query: string,
    limit: number = 20,
  ): Promise<SearchableUser[]> {
    if (query.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    this.logger.debug({
      event: 'user_search_initiated',
      searcherId,
      query,
      limit,
    });

    // Search users (excludes the searcher by default)
    const users = await this.userSearch.searchUsers(query.trim(), limit, searcherId);

    if (users.length === 0) {
      return [];
    }

    // Get relationship status for each user
    const searchableUsers: SearchableUser[] = await Promise.all(
      users.map(async (user) => {
        const status = await this.socialRepository.getRelationshipStatus(searcherId, user.userId);
        return {
          userId: user.userId,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isFriend: status.isFriend,
          hasPendingRequest: status.hasPendingRequest,
          isBlocked: status.isBlocked,
        };
      }),
    );

    // Filter out blocked users
    const filteredUsers = searchableUsers.filter((u) => !u.isBlocked);

    this.logger.debug({
      event: 'user_search_completed',
      searcherId,
      query,
      resultsCount: filteredUsers.length,
    });

    return filteredUsers;
  }

  /**
   * Get leaderboard of friends sorted by XP.
   * Supports weekly, monthly, and all-time rankings.
   */
  async getFriendLeaderboard(
    userId: string,
    period: 'weekly' | 'monthly' | 'all_time',
    limit: number = 20,
  ): Promise<FriendLeaderboard> {
    this.logger.debug({
      event: 'friend_leaderboard_requested',
      userId,
      period,
      limit,
    });

    // Get all friends
    const friends = await this.socialRepository.getFriends(userId, 1000, null);

    if (friends.length === 0) {
      return {
        period,
        entries: [],
        currentUserRank: null,
        totalParticipants: 0,
      };
    }

    // Get friend IDs
    const friendIds = friends.map((f) => f.userId);

    // Get rankings for friends
    const rankings = await this.ranking.getRankingsForUsers(friendIds, period);

    // Build entries with rankings
    const entries: FriendRankingEntry[] = friends
      .map((friend) => {
        const ranking = rankings.get(friend.userId);
        return {
          rank: 0, // Will be calculated
          userId: friend.userId,
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
          xp: ranking?.xp ?? 0,
          friendSince: friend.friendSince,
        };
      })
      .filter((e) => e.xp > 0) // Only include friends with XP
      .sort((a, b) => b.xp - a.xp); // Sort by XP descending

    // Assign ranks (handle ties)
    let currentRank = 0;
    let currentXp = -1;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].xp !== currentXp) {
        currentRank = i + 1;
        currentXp = entries[i].xp;
      }
      entries[i].rank = currentRank;
    }

    // Get current user's rank in the friend leaderboard
    const currentUserEntry = entries.find((e) => e.userId === userId);
    const currentUserRank = currentUserEntry?.rank ?? null;

    // Apply limit
    const limitedEntries = entries.slice(0, limit);

    this.logger.debug({
      event: 'friend_leaderboard_completed',
      userId,
      period,
      totalFriends: friends.length,
      rankedFriends: entries.length,
    });

    return {
      period,
      entries: limitedEntries,
      currentUserRank,
      totalParticipants: entries.length,
    };
  }
}
