import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  socialFeedActivities,
  users,
  userProfiles,
  userFollows,
  friendships,
  blockedUsers,
} from '@/core/database/schema';
import type { SocialRepositoryPort } from '../../domain/ports/social-ports';
import type {
  PaginatedSocialFeedResult,
  PaginatedUserActivityResult,
  SocialFeedActivityType,
  SocialCounts,
  UserSocialStats,
  MySocialAnalytics,
  TrendingUsersResult,
  RelationshipStatus,
  PaginatedSocialSuggestionsResult,
} from '../../domain/types/social.types';
import { eq, and, count, desc, isNull, sql, lte, or } from 'drizzle-orm';
import {
  FRIENDSHIP_REPOSITORY_PORT,
  type FriendshipRepositoryPort,
} from '../../domain/ports/friendship-ports';
import {
  USER_FOLLOW_REPOSITORY_PORT,
  type UserFollowRepositoryPort,
} from '../../domain/ports/user-follow-ports';
import { BLOCK_REPOSITORY_PORT, type BlockRepositoryPort } from '../../domain/ports/block-ports';

const MUTUAL_FRIENDS_REASON_FALLBACK = 'Suggested based on mutual connections';
const MUTUAL_FOLLOWERS_REASON_FALLBACK = 'Suggested based on mutual followers';

@Injectable()
export class SocialRepository implements SocialRepositoryPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(FRIENDSHIP_REPOSITORY_PORT)
    private readonly friendshipRepository: FriendshipRepositoryPort,
    @Inject(USER_FOLLOW_REPOSITORY_PORT)
    private readonly userFollowRepository: UserFollowRepositoryPort,
    @Inject(BLOCK_REPOSITORY_PORT)
    private readonly blockRepository: BlockRepositoryPort,
  ) {}

  // Feed methods
  async createFeedActivity(params: {
    userId: string;
    activityType: string;
    occurredAt: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(socialFeedActivities).values({
      userId: params.userId,
      activityType: params.activityType as SocialFeedActivityType,
      occurredAt: params.occurredAt,
      payload: params.payload,
    });
  }

  async getFeed(page: number, limit: number): Promise<PaginatedSocialFeedResult> {
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          id: socialFeedActivities.activityId,
          type: socialFeedActivities.activityType,
          occurredAt: socialFeedActivities.occurredAt,
          userId: users.userId,
          username: users.username,
          payload: socialFeedActivities.payload,
        })
        .from(socialFeedActivities)
        .innerJoin(users, eq(socialFeedActivities.userId, users.userId))
        .where(isNull(users.deletedAt))
        .orderBy(desc(socialFeedActivities.occurredAt), desc(socialFeedActivities.activityId))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(socialFeedActivities),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        occurredAt: row.occurredAt,
        user: {
          userId: row.userId,
          username: row.username,
        },
        payload: row.payload as Record<string, unknown>,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalResult[0]?.count ?? 0),
      },
    };
  }

  async findActivitiesByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedUserActivityResult> {
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          type: socialFeedActivities.activityType,
          occurredAt: socialFeedActivities.occurredAt,
          payload: socialFeedActivities.payload,
        })
        .from(socialFeedActivities)
        .innerJoin(users, eq(socialFeedActivities.userId, users.userId))
        .where(and(eq(socialFeedActivities.userId, userId), isNull(users.deletedAt)))
        .orderBy(desc(socialFeedActivities.occurredAt), desc(socialFeedActivities.activityId))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(socialFeedActivities)
        .innerJoin(users, eq(socialFeedActivities.userId, users.userId))
        .where(and(eq(socialFeedActivities.userId, userId), isNull(users.deletedAt))),
    ]);

    return {
      items: rows.map((row) => ({
        type: row.type,
        occurredAt: row.occurredAt,
        payload: row.payload as Record<string, unknown>,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalResult[0]?.count ?? 0),
      },
    };
  }

  // Stats methods
  async getSocialCounts(userId: string): Promise<SocialCounts> {
    const [friendCount, followerCount, followingCount] = await Promise.all([
      this.friendshipRepository.getFriendCount(userId),
      this.userFollowRepository.getFollowerCount(userId),
      this.userFollowRepository.getFollowingCount(userId),
    ]);

    return {
      friendCount,
      followerCount,
      followingCount,
    };
  }

  async getUserSocialStats(userId: string): Promise<UserSocialStats> {
    const [friends, followers, following] = await Promise.all([
      this.friendshipRepository.getFriendCount(userId),
      this.userFollowRepository.getFollowerCount(userId),
      this.userFollowRepository.getFollowingCount(userId),
    ]);

    return {
      friends,
      followers,
      following,
    };
  }

  async getSocialAnalytics(userId: string): Promise<MySocialAnalytics> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [friends, followers, following, followersThirtyDaysAgo] = await Promise.all([
      this.friendshipRepository.getFriendCount(userId),
      this.userFollowRepository.getFollowerCount(userId),
      this.userFollowRepository.getFollowingCount(userId),
      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followingId, userId),
            lte(userFollows.createdAt, thirtyDaysAgo),
            or(isNull(userFollows.deletedAt), lte(userFollows.deletedAt, thirtyDaysAgo)),
          ),
        ),
    ]);

    const previousFollowers = Number(followersThirtyDaysAgo[0]?.count ?? 0);

    return {
      friends,
      followers,
      following,
      growth30Days: followers - previousFollowers,
    };
  }

  // Discovery methods
  async getSuggestions(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedSocialSuggestionsResult> {
    const offset = (page - 1) * limit;

    const candidates = sql<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      mutualFriends: number;
      mutualFollowers: number;
      score: number;
    }>`
      WITH my_friends AS (
        SELECT CASE
          WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId}
          ELSE ${friendships.requesterId}
        END AS friend_id
        FROM ${friendships}
        WHERE (${friendships.requesterId} = ${userId} OR ${friendships.addresseeId} = ${userId})
          AND ${friendships.status} = 'accepted'
          AND ${friendships.deletedAt} IS NULL
      ),
      my_following AS (
        SELECT ${userFollows.followingId} AS following_id
        FROM ${userFollows}
        WHERE ${userFollows.followerId} = ${userId}
          AND ${userFollows.deletedAt} IS NULL
      ),
      excluded_users AS (
        SELECT ${userId}::uuid AS user_id
        UNION
        SELECT CASE
          WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId}
          ELSE ${friendships.requesterId}
        END AS user_id
        FROM ${friendships}
        WHERE (${friendships.requesterId} = ${userId} OR ${friendships.addresseeId} = ${userId})
          AND ${friendships.status} = 'accepted'
          AND ${friendships.deletedAt} IS NULL
        UNION
        SELECT CASE
          WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId}
          ELSE ${friendships.requesterId}
        END AS user_id
        FROM ${friendships}
        WHERE (${friendships.requesterId} = ${userId} OR ${friendships.addresseeId} = ${userId})
          AND ${friendships.status} = 'pending'
          AND ${friendships.deletedAt} IS NULL
        UNION
        SELECT ${blockedUsers.blockedId} AS user_id
        FROM ${blockedUsers}
        WHERE ${blockedUsers.blockerId} = ${userId}
          AND ${blockedUsers.deletedAt} IS NULL
        UNION
        SELECT ${blockedUsers.blockerId} AS user_id
        FROM ${blockedUsers}
        WHERE ${blockedUsers.blockedId} = ${userId}
          AND ${blockedUsers.deletedAt} IS NULL
      ),
      mutual_friend_counts AS (
        SELECT
          CASE
            WHEN f2.${friendships.requesterId} = mf.friend_id THEN f2.${friendships.addresseeId}
            ELSE f2.${friendships.requesterId}
          END AS candidate_id,
          COUNT(*)::int AS mutual_friends
        FROM my_friends mf
        JOIN ${friendships} f2
          ON (f2.${friendships.requesterId} = mf.friend_id OR f2.${friendships.addresseeId} = mf.friend_id)
         AND f2.${friendships.status} = 'accepted'
         AND f2.${friendships.deletedAt} IS NULL
        WHERE CASE
            WHEN f2.${friendships.requesterId} = mf.friend_id THEN f2.${friendships.addresseeId}
            ELSE f2.${friendships.requesterId}
          END NOT IN (SELECT user_id FROM excluded_users)
        GROUP BY 1
      ),
      mutual_follower_counts AS (
        SELECT
          uf2.${userFollows.followerId} AS candidate_id,
          COUNT(*)::int AS mutual_followers
        FROM my_following mf
        JOIN ${userFollows} uf2
          ON uf2.${userFollows.followingId} = mf.following_id
         AND uf2.${userFollows.deletedAt} IS NULL
        WHERE uf2.${userFollows.followerId} NOT IN (SELECT user_id FROM excluded_users)
        GROUP BY 1
      ),
      ranked_candidates AS (
        SELECT
          u.${users.userId} AS user_id,
          u.${users.username} AS username,
          up.${userProfiles.avatarUrl} AS avatar_url,
          COALESCE(mfc.mutual_friends, 0)::int AS mutual_friends,
          COALESCE(mfol.mutual_followers, 0)::int AS mutual_followers,
          (COALESCE(mfc.mutual_friends, 0) * 1000 + COALESCE(mfol.mutual_followers, 0) * 100)::int AS score
        FROM ${users} u
        LEFT JOIN ${userProfiles} up ON up.${userProfiles.userId} = u.${users.userId}
        LEFT JOIN mutual_friend_counts mfc ON mfc.candidate_id = u.${users.userId}
        LEFT JOIN mutual_follower_counts mfol ON mfol.candidate_id = u.${users.userId}
        WHERE u.${users.deletedAt} IS NULL
          AND u.${users.userId} NOT IN (SELECT user_id FROM excluded_users)
          AND (COALESCE(mfc.mutual_friends, 0) > 0 OR COALESCE(mfol.mutual_followers, 0) > 0)
      )
      SELECT
        user_id AS "userId",
        username,
        avatar_url AS "avatarUrl",
        mutual_friends AS "mutualFriends",
        mutual_followers AS "mutualFollowers",
        score
      FROM ranked_candidates
    `;

    const rowsPromise = this.db.execute(sql`
      SELECT *
      FROM (${candidates}) ranked
      ORDER BY ranked.score DESC, ranked."mutualFriends" DESC, ranked."mutualFollowers" DESC, ranked.username ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const totalPromise = this.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (${candidates}) ranked
    `);

    const [rowsResult, totalResult] = await Promise.all([rowsPromise, totalPromise]);

    const rows = rowsResult.rows as Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      mutualFriends: number;
      mutualFollowers: number;
      score: number;
    }>;
    const total = Number((totalResult.rows[0] as { total?: number } | undefined)?.total ?? 0);

    return {
      items: rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        mutualFriends: Number(row.mutualFriends ?? 0),
        mutualFollowers: Number(row.mutualFollowers ?? 0),
        reason:
          Number(row.mutualFriends ?? 0) > 0
            ? `${Number(row.mutualFriends)} mutual friend${Number(row.mutualFriends) === 1 ? '' : 's'}`
            : Number(row.mutualFollowers ?? 0) > 0
              ? `${Number(row.mutualFollowers)} mutual follower${Number(row.mutualFollowers) === 1 ? '' : 's'}`
              : Number(row.score ?? 0) > 0
                ? MUTUAL_FOLLOWERS_REASON_FALLBACK
                : MUTUAL_FRIENDS_REASON_FALLBACK,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async getTrendingUsers(limit: number): Promise<TrendingUsersResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const rows = await this.db.execute(sql`
      WITH follower_totals AS (
        SELECT
          ${userFollows.followingId} AS user_id,
          COUNT(*)::int AS followers
        FROM ${userFollows}
        WHERE ${userFollows.deletedAt} IS NULL
        GROUP BY ${userFollows.followingId}
      ),
      new_followers AS (
        SELECT
          ${userFollows.followingId} AS user_id,
          COUNT(*)::int AS new_followers_last_30_days
        FROM ${userFollows}
        WHERE ${userFollows.deletedAt} IS NULL
          AND ${userFollows.createdAt} >= ${thirtyDaysAgo}
        GROUP BY ${userFollows.followingId}
      ),
      new_friendships AS (
        SELECT
          related.user_id,
          COUNT(*)::int AS new_friendships_last_30_days
        FROM (
          SELECT ${friendships.requesterId} AS user_id
          FROM ${friendships}
          WHERE ${friendships.status} = 'accepted'
            AND ${friendships.deletedAt} IS NULL
            AND ${friendships.updatedAt} >= ${thirtyDaysAgo}
          UNION ALL
          SELECT ${friendships.addresseeId} AS user_id
          FROM ${friendships}
          WHERE ${friendships.status} = 'accepted'
            AND ${friendships.deletedAt} IS NULL
            AND ${friendships.updatedAt} >= ${thirtyDaysAgo}
        ) related
        GROUP BY related.user_id
      ),
      activity_counts AS (
        SELECT
          ${socialFeedActivities.userId} AS user_id,
          COUNT(*)::int AS activity_count_last_30_days
        FROM ${socialFeedActivities}
        WHERE ${socialFeedActivities.occurredAt} >= ${thirtyDaysAgo}
          AND ${socialFeedActivities.activityType} IN (
            'badge_earned',
            'tournament_joined',
            'tournament_won',
            'discussion_created',
            'discussion_solved',
            'rank_milestone'
          )
        GROUP BY ${socialFeedActivities.userId}
      ),
      scored_users AS (
        SELECT
          u.user_id AS "userId",
          u.username AS username,
          up.avatar_url AS "avatarUrl",
          COALESCE(ft.followers, 0)::int AS followers,
          COALESCE(nf.new_followers_last_30_days, 0)::int AS new_followers_last_30_days,
          COALESCE(nfr.new_friendships_last_30_days, 0)::int AS new_friendships_last_30_days,
          COALESCE(ac.activity_count_last_30_days, 0)::int AS activity_count_last_30_days,
          (
            COALESCE(ft.followers, 0)
            + COALESCE(nf.new_followers_last_30_days, 0) * 5
            + COALESCE(nfr.new_friendships_last_30_days, 0) * 3
            + COALESCE(ac.activity_count_last_30_days, 0) * 2
          )::int AS "trendScore"
        FROM ${users} u
        LEFT JOIN ${userProfiles} up ON up.user_id = u.user_id
        LEFT JOIN follower_totals ft ON ft.user_id = u.user_id
        LEFT JOIN new_followers nf ON nf.user_id = u.user_id
        LEFT JOIN new_friendships nfr ON nfr.user_id = u.user_id
        LEFT JOIN activity_counts ac ON ac.user_id = u.user_id
        WHERE u.deleted_at IS NULL
      )
      SELECT
        "userId",
        username,
        "avatarUrl",
        followers,
        "trendScore",
        CASE
          WHEN followers >= (new_followers_last_30_days * 5)
            AND followers >= (activity_count_last_30_days * 2)
            AND followers >= (new_friendships_last_30_days * 3)
            THEN 'most_followed'
          WHEN (new_followers_last_30_days * 5) >= followers
            AND (new_followers_last_30_days * 5) >= (activity_count_last_30_days * 2)
            AND (new_followers_last_30_days * 5) >= (new_friendships_last_30_days * 3)
            THEN 'fastest_growing'
          WHEN (activity_count_last_30_days * 2) >= followers
            AND (activity_count_last_30_days * 2) >= (new_followers_last_30_days * 5)
            AND (activity_count_last_30_days * 2) >= (new_friendships_last_30_days * 3)
            THEN 'most_active'
          ELSE 'rising_star'
        END AS "trendReason"
      FROM scored_users
      WHERE "trendScore" > 0
      ORDER BY "trendScore" DESC, followers DESC, username ASC
      LIMIT ${limit}
    `);

    return {
      items: rows.rows as TrendingUsersResult['items'],
    };
  }

  // Cross-domain methods
  async getRelationshipStatus(userId: string, targetId: string): Promise<RelationshipStatus> {
    const [
      friendResult,
      pendingResult,
      followerResult,
      followingResult,
      blockedResult,
      blockedByResult,
    ] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(friendships)
        .where(
          and(
            or(
              and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, targetId)),
              and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, userId)),
            ),
            eq(friendships.status, 'accepted'),
            isNull(friendships.deletedAt),
          ),
        ),

      this.db
        .select({ count: count() })
        .from(friendships)
        .where(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, targetId),
            eq(friendships.status, 'pending'),
            isNull(friendships.deletedAt),
          ),
        ),

      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, targetId),
            eq(userFollows.followingId, userId),
            isNull(userFollows.deletedAt),
          ),
        ),

      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, userId),
            eq(userFollows.followingId, targetId),
            isNull(userFollows.deletedAt),
          ),
        ),

      this.blockRepository.isBlocked(userId, targetId),
      this.blockRepository.isBlocked(targetId, userId),
    ]);

    return {
      isFriend: Number(friendResult[0]?.count ?? 0) > 0,
      hasPendingRequest: Number(pendingResult[0]?.count ?? 0) > 0,
      isFollower: Number(followerResult[0]?.count ?? 0) > 0,
      isFollowing: Number(followingResult[0]?.count ?? 0) > 0,
      isBlocked: blockedResult,
      isBlockedBy: blockedByResult,
    };
  }

  async getUsernamesForUsers(
    followerId: string,
    followingId: string,
  ): Promise<{ followerUsername: string; followingUsername: string }> {
    return this.userFollowRepository.getUsernamesForUsers(followerId, followingId);
  }

  // Stub methods for backwards compatibility - these delegate to specialized repos
  // Friend requests
  async createFriendRequest(requesterId: string, addresseeId: string) {
    return this.friendshipRepository.createFriendRequest(requesterId, addresseeId);
  }

  async getFriendRequest(friendshipId: string) {
    return this.friendshipRepository.getFriendRequest(friendshipId);
  }

  async getPendingRequests(addresseeId: string) {
    return this.friendshipRepository.getPendingRequests(addresseeId);
  }

  async getSentRequests(requesterId: string) {
    return this.friendshipRepository.getSentRequests(requesterId);
  }

  async respondToFriendRequest(params: any, requesterId: string) {
    return this.friendshipRepository.respondToFriendRequest(params, requesterId);
  }

  // Friends
  async getFriends(userId: string, limit: number, cursor?: string | null) {
    return this.friendshipRepository.getFriends(userId, limit, cursor ?? undefined);
  }

  async getFriendCount(userId: string) {
    return this.friendshipRepository.getFriendCount(userId);
  }

  async removeFriend(userId: string, friendId: string) {
    return this.friendshipRepository.removeFriend(userId, friendId);
  }

  async getMutualFriends(userId: string, targetUserId: string, page: number, limit: number) {
    return this.friendshipRepository.getMutualFriends(userId, targetUserId, page, limit);
  }

  // Following
  async followUser(followerId: string, followingId: string) {
    return this.userFollowRepository.followUser(followerId, followingId);
  }

  async unfollowUser(followerId: string, followingId: string) {
    return this.userFollowRepository.unfollowUser(followerId, followingId);
  }

  async getFollowers(userId: string, limit: number, cursor?: string | null) {
    return this.userFollowRepository.getFollowers(userId, limit, cursor ?? undefined);
  }

  async getFollowersOfUser(userId: string, page: number, limit: number) {
    return this.userFollowRepository.getFollowersOfUser(userId, page, limit);
  }

  async getFollowing(userId: string, limit: number, cursor?: string | null) {
    return this.userFollowRepository.getFollowing(userId, limit, cursor ?? undefined);
  }

  async getFollowingOfUser(userId: string, page: number, limit: number) {
    return this.userFollowRepository.getFollowingOfUser(userId, page, limit);
  }

  async getMutualFollowers(userId: string, targetUserId: string, page: number, limit: number) {
    return this.userFollowRepository.getMutualFollowers(userId, targetUserId, page, limit);
  }

  async getFollowerCount(userId: string) {
    return this.userFollowRepository.getFollowerCount(userId);
  }

  async getFollowingCount(userId: string) {
    return this.userFollowRepository.getFollowingCount(userId);
  }

  async isFollowing(followerId: string, followingId: string) {
    return this.userFollowRepository.isFollowing(followerId, followingId);
  }

  // Blocking
  async blockUser(blockerId: string, blockedId: string, reason?: string) {
    return this.blockRepository.blockUser(blockerId, blockedId, reason);
  }

  async unblockUser(blockerId: string, blockedId: string) {
    return this.blockRepository.unblockUser(blockerId, blockedId);
  }

  async isBlocked(blockerId: string, blockedId: string) {
    return this.blockRepository.isBlocked(blockerId, blockedId);
  }

  async getBlockedUsers(blockerId: string) {
    return this.blockRepository.getBlockedUsers(blockerId);
  }
}
