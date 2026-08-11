import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SOCIAL_REPOSITORY_PORT,
  FRIENDSHIP_REPOSITORY_PORT,
  USER_FOLLOW_REPOSITORY_PORT,
  BLOCK_REPOSITORY_PORT,
  type SocialRepositoryPort,
  type FriendshipRepositoryPort,
  type UserFollowRepositoryPort,
  type BlockRepositoryPort,
} from '../ports';
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
import { USER_DOMAIN_SERVICE, type UserDomainService } from '@/modules/user/domain/user.service';
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
  FriendListForbiddenError,
  FriendshipNotFoundError,
  UserNotBlockedError,
  FollowNotFoundError,
} from '../errors/social.errors';
import { UserNotFoundError } from '@/modules/user/domain/errors';
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';
import { AuditLogService } from '@/common/audit/audit-log.service';
import { SocialCacheService } from '../../infrastructure/cache/social-cache.service';

@Injectable()
export class SocialService {
  constructor(
    @Inject(FRIENDSHIP_REPOSITORY_PORT)
    private readonly friendshipRepository: FriendshipRepositoryPort,
    @Inject(USER_FOLLOW_REPOSITORY_PORT)
    private readonly userFollowRepository: UserFollowRepositoryPort,
    @Inject(BLOCK_REPOSITORY_PORT)
    private readonly blockRepository: BlockRepositoryPort,
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
    @Inject(USER_DOMAIN_SERVICE)
    private readonly userDomainService: UserDomainService,
    private readonly auditLogService: AuditLogService,
    private readonly socialCacheService: SocialCacheService,
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
      const friendship = await this.friendshipRepository.createFriendRequest(
        requesterId,
        addresseeId,
      );

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

      // Invalidate social counts cache for both users
      await this.socialCacheService.invalidateCountsBatch([requesterId, addresseeId]);

      const requests = await this.friendshipRepository.getSentRequests(requesterId);
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
    const friendship = await this.friendshipRepository.getFriendRequest(friendshipId);

    if (!friendship) {
      throw new FriendRequestNotFoundError(friendshipId);
    }

    if (friendship.addresseeId !== userId) {
      throw new FriendRequestForbiddenError();
    }

    await this.friendshipRepository.respondToFriendRequest({ friendshipId, accept }, userId);

    // Invalidate social counts cache for both users
    await this.socialCacheService.invalidateCountsBatch([userId, friendship.requesterId]);

    this.logger.info({
      event: accept ? 'friend_request_accepted' : 'friend_request_rejected',
      friendshipId,
      userId,
    });

    // Emit domain event
    if (accept) {
      const { followerUsername } = await this.userFollowRepository.getUsernamesForUsers(
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
    const friendship = await this.friendshipRepository.getFriendRequest(friendshipId);

    if (!friendship) {
      throw new FriendRequestNotFoundError(friendshipId);
    }

    if (friendship.requesterId !== requesterId) {
      throw new FriendRequestForbiddenError();
    }

    const addresseeId = friendship.addresseeId;
    await this.friendshipRepository.removeFriend(requesterId, addresseeId);

    // Invalidate social counts cache for both users
    await this.socialCacheService.invalidateCountsBatch([requesterId, addresseeId]);

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
    return this.friendshipRepository.getPendingRequests(userId);
  }

  async getSentRequests(userId: string): Promise<FriendRequest[]> {
    return this.friendshipRepository.getSentRequests(userId);
  }

  async getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]> {
    return this.friendshipRepository.getFriends(userId, limit, cursor ?? undefined);
  }

  /**
   * Read another user's friend list with explicit access control.
   *
   * Allowed when:
   *   - the requester is the target themselves (own data), or
   *   - the requester and the target are mutual friends and
   *     neither side has blocked the other.
   *
   * Otherwise throws `FriendListForbiddenError` (a 403). If
   * either side has blocked the other, throws `BlockedUserError`
   * regardless of the friendship status — blocks always win.
   */
  async getFriendsOfUser(
    requesterId: string,
    targetUserId: string,
    limit: number,
    cursor?: string | null,
  ): Promise<Friend[]> {
    if (requesterId === targetUserId) {
      return this.friendshipRepository.getFriends(targetUserId, limit, cursor ?? undefined);
    }

    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    if (!relationship.isFriend) {
      throw new FriendListForbiddenError();
    }

    return this.friendshipRepository.getFriends(targetUserId, limit, cursor ?? undefined);
  }

  async getFriendCount(userId: string): Promise<number> {
    return this.friendshipRepository.getFriendCount(userId);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
      throw new SelfFriendRequestError();
    }

    const friendship = await this.friendshipRepository.findAcceptedFriendship(userId, friendId);
    if (!friendship) {
      throw new FriendshipNotFoundError(friendId);
    }

    await this.friendshipRepository.removeFriend(userId, friendId);

    // Invalidate social counts cache for both users
    await this.socialCacheService.invalidateCountsBatch([userId, friendId]);

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

    await this.blockRepository.blockUser(blockerId, blockedId, reason);

    // Invalidate social counts cache for both users
    await this.socialCacheService.invalidateCountsBatch([blockerId, blockedId]);

    this.logger.info({
      event: 'user_blocked',
      blockerId,
      blockedId,
      reason,
    });

    // Audit: blocking is a sensitive action. The previous
    // implementation only logged the event, which is not a
    // durable record and cannot be queried later. The
    // cross-domain audit log captures who blocked whom so
    // the platform can answer "who has user X blocked?" and
    // the user can challenge an unjustified block.
    try {
      await this.auditLogService.record({
        eventType: 'social.user.blocked',
        domain: 'social',
        action: 'user.blocked',
        actorId: blockerId,
        subjectUserId: blockedId,
        metadata: {
          reason: reason ?? null,
        },
      });
    } catch (error) {
      this.logger.error({
        event: 'social_block_audit_write_failed',
        blockerId,
        blockedId,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    // Emit domain event
    this.eventBus.emitUserBlocked({
      eventType: 'user_blocked',
      blockerId,
      blockedId,
      reason: reason ?? null,
      timestamp: new Date(),
    });

    await this.friendshipRepository.removeFriend(blockerId, blockedId);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new SelfFriendRequestError();
    }

    const block = await this.blockRepository.findActiveBlock(blockerId, blockedId);
    if (!block) {
      throw new UserNotBlockedError(blockedId);
    }

    await this.blockRepository.unblockUser(blockerId, blockedId);

    // Invalidate social counts cache for both users
    await this.socialCacheService.invalidateCountsBatch([blockerId, blockedId]);

    this.logger.info({
      event: 'user_unblocked',
      blockerId,
      blockedId,
    });

    // Audit: unblocking mirrors blocking. Captures who unblocked
    // whom so the social module can answer "is there a history
    // of X repeatedly blocking and unblocking Y as harassment?"
    // without a log grep.
    try {
      await this.auditLogService.record({
        eventType: 'social.user.unblocked',
        domain: 'social',
        action: 'user.unblocked',
        actorId: blockerId,
        subjectUserId: blockedId,
      });
    } catch (error) {
      this.logger.error({
        event: 'social_unblock_audit_write_failed',
        blockerId,
        blockedId,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

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
    const blocked = await this.blockRepository.getBlockedUsers(blockerId);
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
      const follow = await this.userFollowRepository.followUser(followerId, followingId);

      // Invalidate social counts cache for both users
      await this.socialCacheService.invalidateCountsBatch([followerId, followingId]);

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
    if (followerId === followingId) {
      throw new SelfFriendRequestError();
    }

    const follow = await this.userFollowRepository.findActiveFollow(followerId, followingId);
    if (!follow) {
      throw new FollowNotFoundError(followingId);
    }

    await this.userFollowRepository.unfollowUser(followerId, followingId);

    // Invalidate social counts cache for both users
    await this.socialCacheService.invalidateCountsBatch([followerId, followingId]);

    this.logger.info({
      event: 'user_unfollowed',
      followerId,
      followingId,
    });

    // Emit domain event
    this.eventBus.emitUserUnfollowed({
      eventType: 'user_unfollowed',
      followerId,
      followerUsername: follow.followerUsername,
      followingId,
      followingUsername: follow.followingUsername,
      timestamp: new Date(),
    });
  }

  async getFollowers(userId: string, limit: number, cursor?: string | null): Promise<Follower[]> {
    return this.userFollowRepository.getFollowers(userId, limit, cursor ?? undefined);
  }

  async getFollowersOfUser(
    requesterId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedFollowersResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    return this.userFollowRepository.getFollowersOfUser(targetUserId, cursor, limit);
  }

  async getFollowing(userId: string, limit: number, cursor?: string | null): Promise<Following[]> {
    return this.userFollowRepository.getFollowing(userId, limit, cursor ?? undefined);
  }

  async getFollowingOfUser(
    requesterId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedFollowingResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    return this.userFollowRepository.getFollowingOfUser(targetUserId, cursor, limit);
  }

  async getMutualFriends(
    requesterId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFriendsResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    return this.friendshipRepository.getMutualFriends(requesterId, targetUserId, cursor, limit);
  }

  async getMutualFollowers(
    requesterId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFollowersResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    return this.userFollowRepository.getMutualFollowers(requesterId, targetUserId, cursor, limit);
  }

  async getFeed(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedSocialFeedResult> {
    return await this.socialRepository.getFeed(userId, cursor, limit);
  }

  async getUserActivity(
    requesterId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedUserActivityResult> {
    const relationship = await this.socialRepository.getRelationshipStatus(
      requesterId,
      targetUserId,
    );

    if (relationship.isBlocked || relationship.isBlockedBy) {
      throw new BlockedUserError();
    }

    // Phase 3 (F-13): gate the read on the target user's
    // `showActivity` privacy flag. Self reads always succeed (the
    // existence check + early-return inside `assertPrivacyFlag`).
    // A 403 surfaces from `UserProfilePrivateError` → 403 when the
    // flag is `false`. The endpoint is documented in
    // `docs/audits/USER_MODULE_PRODUCTION_READINESS_AUDIT.md` (F-13).
    await this.userDomainService.assertPrivacyFlag(targetUserId, requesterId, 'showActivity');

    return this.socialRepository.findActivitiesByUserId(targetUserId, cursor, limit);
  }

  async recordFeedActivity(params: {
    userId: string;
    activityType: SocialFeedActivityType;
    occurredAt: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.socialRepository.createFeedActivity(params);
  }

  async getSuggestions(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedSocialSuggestionsResult> {
    return await this.socialRepository.getSuggestions(userId, cursor, limit);
  }

  async getRelationshipStatus(userId: string, targetId: string): Promise<RelationshipStatus> {
    return await this.socialRepository.getRelationshipStatus(userId, targetId);
  }

  async getSocialCounts(userId: string): Promise<SocialCounts> {
    return this.socialCacheService.getCountsWithCache(userId, () =>
      this.socialRepository.getSocialCounts(userId),
    );
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

    return await this.socialRepository.getSocialAnalytics(userId);
  }

  async getTrendingUsers(limit: number): Promise<TrendingUsersResult> {
    const result = await this.socialRepository.getTrendingUsers(limit);

    if (result.items.length === 0) {
      return result;
    }

    const userIds = result.items.map((u) => u.userId);

    // Fetch rank trends for all trending users
    const trends = await this.ranking.getRankTrendsForUsers(userIds, ['weekly', 'monthly']);

    // Enrich each trending user with rank trend data
    const enrichedItems = result.items.map((user) => {
      const userTrends = trends.get(user.userId) ?? [];
      const weeklyTrend = userTrends.find((t) => t.period === 'weekly') ?? null;
      const monthlyTrend = userTrends.find((t) => t.period === 'monthly') ?? null;
      return {
        ...user,
        weeklyRankTrend: weeklyTrend
          ? {
              period: weeklyTrend.period,
              currentRank: weeklyTrend.currentRank,
              previousRank: weeklyTrend.previousRank,
              change: weeklyTrend.change,
              direction: weeklyTrend.direction,
              currentXp: weeklyTrend.currentXp,
              previousXp: weeklyTrend.previousXp,
            }
          : null,
        monthlyRankTrend: monthlyTrend
          ? {
              period: monthlyTrend.period,
              currentRank: monthlyTrend.currentRank,
              previousRank: monthlyTrend.previousRank,
              change: monthlyTrend.change,
              direction: monthlyTrend.direction,
              currentXp: monthlyTrend.currentXp,
              previousXp: monthlyTrend.previousXp,
            }
          : null,
      };
    });

    return { items: enrichedItems };
  }

  async searchUsernameSuggestions(query: string, limit: number): Promise<UsernameSuggestion[]> {
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

    // Search users (excludes the searcher by default)
    const users = await this.userSearch.searchUsers(query.trim(), limit, searcherId);

    if (users.length === 0) {
      return [];
    }

    // Batch fetch relationship statuses for all searched users (fixes N+1)
    const userIds = users.map((u) => u.userId);
    const statusMap = await this.socialRepository.getRelationshipStatusesBatch(searcherId, userIds);

    // Build searchable users with relationship status
    const searchableUsers: SearchableUser[] = users.map((user) => {
      const status = statusMap.get(user.userId) ?? {
        isFriend: false,
        hasPendingRequest: false,
        isFollower: false,
        isFollowing: false,
        isBlocked: false,
        isBlockedBy: false,
      };
      return {
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isFriend: status.isFriend,
        hasPendingRequest: status.hasPendingRequest,
        isBlocked: status.isBlocked,
      };
    });

    // Filter out blocked users
    const filteredUsers = searchableUsers.filter((u) => !u.isBlocked);

    return filteredUsers;
  }

  /**
   * Get leaderboard of friends sorted by XP.
   * Supports weekly, monthly, and all-time rankings.
   *
   * Optimization: Fetches a capped number of friends (max of 3x limit or 50)
   * instead of always fetching 1000. This reduces database load for small limits
   * while still fetching enough candidates to fill the leaderboard after filtering
   * friends with zero XP.
   */
  async getFriendLeaderboard(
    userId: string,
    period: 'weekly' | 'monthly' | 'all_time',
    limit: number = 20,
  ): Promise<FriendLeaderboard> {
    // Optimization: Fetch enough friends to get `limit` entries after XP filtering.
    // Use 3x multiplier as a balance between fetching too many and having enough candidates.
    // Minimum of 50 ensures we have enough candidates for small limits.
    const friendFetchLimit = Math.max(limit * 3, 50);
    const friends = await this.socialRepository.getFriends(userId, friendFetchLimit, null);

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

    // Get rankings and trends for friends in parallel
    const [rankings, trends] = await Promise.all([
      this.ranking.getRankingsForUsers(friendIds, period),
      this.ranking.getRankTrendsForUsers(friendIds, ['weekly', 'monthly']),
    ]);

    // Build entries with rankings and trends
    const entries: FriendRankingEntry[] = friends
      .map((friend) => {
        const ranking = rankings.get(friend.userId);
        const userTrends = trends.get(friend.userId) ?? [];
        const weeklyTrend = userTrends.find((t) => t.period === 'weekly') ?? null;
        const monthlyTrend = userTrends.find((t) => t.period === 'monthly') ?? null;
        return {
          rank: 0, // Will be calculated
          userId: friend.userId,
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
          xp: ranking?.xp ?? 0,
          friendSince: friend.friendSince,
          weeklyRankTrend: weeklyTrend
            ? {
                period: weeklyTrend.period,
                currentRank: weeklyTrend.currentRank,
                previousRank: weeklyTrend.previousRank,
                change: weeklyTrend.change,
                direction: weeklyTrend.direction,
                currentXp: weeklyTrend.currentXp,
                previousXp: weeklyTrend.previousXp,
              }
            : null,
          monthlyRankTrend: monthlyTrend
            ? {
                period: monthlyTrend.period,
                currentRank: monthlyTrend.currentRank,
                previousRank: monthlyTrend.previousRank,
                change: monthlyTrend.change,
                direction: monthlyTrend.direction,
                currentXp: monthlyTrend.currentXp,
                previousXp: monthlyTrend.previousXp,
              }
            : null,
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

    return {
      period,
      entries: limitedEntries,
      currentUserRank,
      totalParticipants: entries.length,
    };
  }
}
