import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import {
  friendships,
  blockedUsers,
  userFollows,
  users,
  userProfiles,
  socialFeedActivities,
} from '@/core/database/schema';
import { type SocialRepositoryPort } from '../../domain/ports/social-ports';
import type {
  Friendship,
  BlockedUser,
  UserFollow,
  FriendRequest,
  Friend,
  Follower,
  Following,
  RespondToFriendRequestParams,
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
} from '../../domain/types/social.types';
import { eq, and, or, sql, desc, count, lte, isNull } from 'drizzle-orm';
import type { SocialCounts, RelationshipStatus } from '../../domain/types/social.types';

const MUTUAL_FRIENDS_REASON_FALLBACK = 'Suggested based on mutual connections';
const MUTUAL_FOLLOWERS_REASON_FALLBACK = 'Suggested based on mutual followers';

@Injectable()
export class SocialRepository implements SocialRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createFriendRequest(requesterId: string, addresseeId: string): Promise<Friendship> {
    const [friendship] = await this.db
      .insert(friendships)
      .values({
        requesterId,
        addresseeId,
        status: 'pending',
      })
      .returning();

    return friendship as Friendship;
  }

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

  async getFriendRequest(friendshipId: string): Promise<Friendship> {
    const [friendship] = await this.db
      .select()
      .from(friendships)
      .where(eq(friendships.friendshipId, friendshipId));

    return (friendship as Friendship) ?? null;
  }

  async getPendingRequests(addresseeId: string): Promise<FriendRequest[]> {
    const rows = await this.db
      .select({
        friendshipId: friendships.friendshipId,
        requesterId: friendships.requesterId,
        createdAt: friendships.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.requesterId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(friendships.addresseeId, addresseeId),
          eq(friendships.status, 'pending'),
          isNull(friendships.deletedAt),
        ),
      )
      .orderBy(desc(friendships.createdAt));

    return rows.map((r) => ({
      friendshipId: r.friendshipId,
      requesterId: r.requesterId,
      requesterUsername: r.username,
      requesterDisplayName: r.displayName,
      requesterAvatarUrl: r.avatarUrl,
      createdAt: r.createdAt,
    }));
  }

  async getSentRequests(requesterId: string): Promise<FriendRequest[]> {
    const rows = await this.db
      .select({
        friendshipId: friendships.friendshipId,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        createdAt: friendships.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(friendships)
      .innerJoin(users, eq(friendships.addresseeId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(
        and(
          eq(friendships.requesterId, requesterId),
          eq(friendships.status, 'pending'),
          isNull(friendships.deletedAt),
        ),
      )
      .orderBy(desc(friendships.createdAt));

    return rows.map((r) => ({
      friendshipId: r.friendshipId,
      requesterId: r.requesterId,
      requesterUsername: r.username,
      requesterDisplayName: r.displayName,
      requesterAvatarUrl: r.avatarUrl,
      createdAt: r.createdAt,
    }));
  }

  async respondToFriendRequest(
    params: RespondToFriendRequestParams,
    requesterId: string,
  ): Promise<void> {
    const newStatus = params.accept ? 'accepted' : 'rejected';

    await this.db
      .update(friendships)
      .set({
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(friendships.friendshipId, params.friendshipId),
          eq(friendships.addresseeId, requesterId),
          eq(friendships.status, 'pending'),
        ),
      );
  }

  async getFriends(userId: string, limit: number, cursor?: string): Promise<Friend[]> {
    const baseCondition = or(
      eq(friendships.requesterId, userId),
      eq(friendships.addresseeId, userId),
    );

    const cursorCondition = cursor ? lte(friendships.updatedAt, cursor) : undefined;

    const whereClause = cursor
      ? and(
          baseCondition,
          eq(friendships.status, 'accepted'),
          isNull(friendships.deletedAt),
          cursorCondition,
        )
      : and(baseCondition, eq(friendships.status, 'accepted'), isNull(friendships.deletedAt));

    const rows = await this.db
      .select({
        friendshipId: friendships.friendshipId,
        userId: sql<string>`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END`,
        createdAt: friendships.updatedAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(friendships)
      .innerJoin(
        users,
        sql`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END = ${users.userId}`,
      )
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(whereClause)
      .orderBy(desc(friendships.updatedAt))
      .limit(limit + 1);

    return rows.map((r) => ({
      friendshipId: r.friendshipId,
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      friendSince: r.createdAt,
    }));
  }

  async getFriendCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(friendships)
      .where(
        and(
          or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
          eq(friendships.status, 'accepted'),
          isNull(friendships.deletedAt),
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(friendships)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          or(
            and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId)),
            and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId)),
          ),
          eq(friendships.status, 'accepted'),
        ),
      );
  }

  async blockUser(blockerId: string, blockedId: string, reason?: string): Promise<BlockedUser> {
    // Check if already blocked (not deleted)
    const existing = await this.db
      .select()
      .from(blockedUsers)
      .where(
        and(
          eq(blockedUsers.blockerId, blockerId),
          eq(blockedUsers.blockedId, blockedId),
          isNull(blockedUsers.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0] as BlockedUser;
    }

    // Check if previously blocked (soft deleted) and restore
    const previouslyBlocked = await this.db
      .select()
      .from(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)))
      .limit(1);

    if (previouslyBlocked.length > 0) {
      const [updated] = await this.db
        .update(blockedUsers)
        .set({ reason: reason ?? null, deletedAt: null })
        .where(eq(blockedUsers.blockId, previouslyBlocked[0].blockId))
        .returning();

      return updated as BlockedUser;
    }

    // Create new block
    const [blocked] = await this.db
      .insert(blockedUsers)
      .values({
        blockerId,
        blockedId,
        reason: reason ?? null,
      })
      .returning();

    return blocked as BlockedUser;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(blockedUsers)
      .set({ deletedAt: now })
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: count() })
      .from(blockedUsers)
      .where(
        and(
          eq(blockedUsers.blockerId, blockerId),
          eq(blockedUsers.blockedId, blockedId),
          isNull(blockedUsers.deletedAt),
        ),
      );

    return Number(result?.count ?? 0) > 0;
  }

  async getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
    const rows = await this.db
      .select()
      .from(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), isNull(blockedUsers.deletedAt)))
      .orderBy(desc(blockedUsers.createdAt));

    return rows as BlockedUser[];
  }

  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const [follow] = await this.db
      .insert(userFollows)
      .values({
        followerId,
        followingId,
      })
      .returning();

    return follow as UserFollow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(userFollows)
      .set({ deletedAt: now })
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)));
  }

  async getFollowers(userId: string, limit: number, cursor?: string): Promise<Follower[]> {
    const baseCondition = eq(userFollows.followingId, userId);
    const cursorCondition = cursor ? lte(userFollows.createdAt, cursor) : undefined;

    const whereClause = cursor
      ? and(baseCondition, isNull(userFollows.deletedAt), cursorCondition)
      : and(baseCondition, isNull(userFollows.deletedAt));

    const rows = await this.db
      .select({
        followId: userFollows.followId,
        userId: userFollows.followerId,
        createdAt: userFollows.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followerId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(whereClause)
      .orderBy(desc(userFollows.createdAt))
      .limit(limit + 1);

    return rows.map((r) => ({
      followId: r.followId,
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      followedAt: r.createdAt,
    }));
  }

  async getFollowersOfUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowersResult> {
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          userId: userFollows.followerId,
          username: users.username,
          avatarUrl: userProfiles.avatarUrl,
          followedAt: userFollows.createdAt,
        })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followerId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(and(eq(userFollows.followingId, userId), isNull(userFollows.deletedAt)))
        .orderBy(desc(userFollows.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(and(eq(userFollows.followingId, userId), isNull(userFollows.deletedAt))),
    ]);

    return {
      items: rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        followedAt: row.followedAt,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalResult[0]?.count ?? 0),
      },
    };
  }

  async getFollowing(userId: string, limit: number, cursor?: string): Promise<Following[]> {
    const baseCondition = eq(userFollows.followerId, userId);
    const cursorCondition = cursor ? lte(userFollows.createdAt, cursor) : undefined;

    const whereClause = cursor
      ? and(baseCondition, isNull(userFollows.deletedAt), cursorCondition)
      : and(baseCondition, isNull(userFollows.deletedAt));

    const rows = await this.db
      .select({
        followId: userFollows.followId,
        userId: userFollows.followingId,
        createdAt: userFollows.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followingId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(whereClause)
      .orderBy(desc(userFollows.createdAt))
      .limit(limit + 1);

    return rows.map((r) => ({
      followId: r.followId,
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      followedAt: r.createdAt,
    }));
  }

  async getFollowingOfUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedFollowingResult> {
    const offset = (page - 1) * limit;

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          userId: userFollows.followingId,
          username: users.username,
          avatarUrl: userProfiles.avatarUrl,
          followedAt: userFollows.createdAt,
        })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followingId, users.userId))
        .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
        .where(and(eq(userFollows.followerId, userId), isNull(userFollows.deletedAt)))
        .orderBy(desc(userFollows.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(and(eq(userFollows.followerId, userId), isNull(userFollows.deletedAt))),
    ]);

    return {
      items: rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        followedAt: row.followedAt,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalResult[0]?.count ?? 0),
      },
    };
  }

  async getMutualFriends(
    userId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFriendsResult> {
    const offset = (page - 1) * limit;

    const mutualFriendsQuery = sql<{
      userId: string;
      username: string;
      avatarUrl: string | null;
    }>`
      WITH user_friends AS (
        SELECT CASE
          WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId}
          ELSE ${friendships.requesterId}
        END AS friend_id
        FROM ${friendships}
        WHERE (${friendships.requesterId} = ${userId} OR ${friendships.addresseeId} = ${userId})
          AND ${friendships.status} = 'accepted'
          AND ${friendships.deletedAt} IS NULL
      ),
      target_friends AS (
        SELECT CASE
          WHEN ${friendships.requesterId} = ${targetUserId} THEN ${friendships.addresseeId}
          ELSE ${friendships.requesterId}
        END AS friend_id
        FROM ${friendships}
        WHERE (${friendships.requesterId} = ${targetUserId} OR ${friendships.addresseeId} = ${targetUserId})
          AND ${friendships.status} = 'accepted'
          AND ${friendships.deletedAt} IS NULL
      ),
      shared_friends AS (
        SELECT uf.friend_id AS user_id
        FROM user_friends uf
        INNER JOIN target_friends tf ON tf.friend_id = uf.friend_id
        WHERE uf.friend_id NOT IN (
          SELECT ${blockedUsers.blockedId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockerId} = ${userId}
            AND ${blockedUsers.deletedAt} IS NULL
          UNION
          SELECT ${blockedUsers.blockerId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockedId} = ${userId}
            AND ${blockedUsers.deletedAt} IS NULL
          UNION
          SELECT ${blockedUsers.blockedId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockerId} = ${targetUserId}
            AND ${blockedUsers.deletedAt} IS NULL
          UNION
          SELECT ${blockedUsers.blockerId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockedId} = ${targetUserId}
            AND ${blockedUsers.deletedAt} IS NULL
        )
      )
      SELECT
        u.${users.userId} AS "userId",
        u.${users.username} AS username,
        up.${userProfiles.avatarUrl} AS "avatarUrl"
      FROM shared_friends sf
      INNER JOIN ${users} u ON u.${users.userId} = sf.user_id
      LEFT JOIN ${userProfiles} up ON up.${userProfiles.userId} = u.${users.userId}
      WHERE u.${users.deletedAt} IS NULL
    `;

    const rowsPromise = this.db.execute(sql`
      SELECT *
      FROM (${mutualFriendsQuery}) mutual_friends
      ORDER BY mutual_friends.username ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const totalPromise = this.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (${mutualFriendsQuery}) mutual_friends
    `);

    const [rowsResult, totalResult] = await Promise.all([rowsPromise, totalPromise]);

    const rows = rowsResult.rows as Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
    }>;
    const total = Number((totalResult.rows[0] as { total?: number } | undefined)?.total ?? 0);

    return {
      items: rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async getMutualFollowers(
    userId: string,
    targetUserId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedMutualFollowersResult> {
    const offset = (page - 1) * limit;

    const mutualFollowersQuery = sql<{
      userId: string;
      username: string;
      avatarUrl: string | null;
    }>`
      WITH user_following AS (
        SELECT ${userFollows.followingId} AS followed_user_id
        FROM ${userFollows}
        WHERE ${userFollows.followerId} = ${userId}
          AND ${userFollows.deletedAt} IS NULL
      ),
      target_following AS (
        SELECT ${userFollows.followingId} AS followed_user_id
        FROM ${userFollows}
        WHERE ${userFollows.followerId} = ${targetUserId}
          AND ${userFollows.deletedAt} IS NULL
      ),
      shared_following AS (
        SELECT uf.followed_user_id AS user_id
        FROM user_following uf
        INNER JOIN target_following tf ON tf.followed_user_id = uf.followed_user_id
        WHERE uf.followed_user_id NOT IN (
          SELECT ${blockedUsers.blockedId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockerId} = ${userId}
            AND ${blockedUsers.deletedAt} IS NULL
          UNION
          SELECT ${blockedUsers.blockerId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockedId} = ${userId}
            AND ${blockedUsers.deletedAt} IS NULL
          UNION
          SELECT ${blockedUsers.blockedId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockerId} = ${targetUserId}
            AND ${blockedUsers.deletedAt} IS NULL
          UNION
          SELECT ${blockedUsers.blockerId}
          FROM ${blockedUsers}
          WHERE ${blockedUsers.blockedId} = ${targetUserId}
            AND ${blockedUsers.deletedAt} IS NULL
        )
      )
      SELECT
        u.${users.userId} AS "userId",
        u.${users.username} AS username,
        up.${userProfiles.avatarUrl} AS "avatarUrl"
      FROM shared_following sf
      INNER JOIN ${users} u ON u.${users.userId} = sf.user_id
      LEFT JOIN ${userProfiles} up ON up.${userProfiles.userId} = u.${users.userId}
      WHERE u.${users.deletedAt} IS NULL
    `;

    const rowsPromise = this.db.execute(sql`
      SELECT *
      FROM (${mutualFollowersQuery}) mutual_followers
      ORDER BY mutual_followers.username ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const totalPromise = this.db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM (${mutualFollowersQuery}) mutual_followers
    `);

    const [rowsResult, totalResult] = await Promise.all([rowsPromise, totalPromise]);

    const rows = rowsResult.rows as Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
    }>;
    const total = Number((totalResult.rows[0] as { total?: number } | undefined)?.total ?? 0);

    return {
      items: rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
      })),
      pagination: {
        page,
        limit,
        total,
      },
    };
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

  async getFollowerCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userFollows)
      .where(and(eq(userFollows.followingId, userId), isNull(userFollows.deletedAt)));

    return Number(result[0]?.count ?? 0);
  }

  async getFollowingCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, userId), isNull(userFollows.deletedAt)));

    return Number(result[0]?.count ?? 0);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: count() })
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId),
          isNull(userFollows.deletedAt),
        ),
      );

    return Number(result?.count ?? 0) > 0;
  }

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

      this.isBlocked(userId, targetId),
      this.isBlocked(targetId, userId),
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

  async getSocialCounts(userId: string): Promise<SocialCounts> {
    const [friendCount, followerCount, followingCount] = await Promise.all([
      this.getFriendCount(userId),
      this.getFollowerCount(userId),
      this.getFollowingCount(userId),
    ]);

    return {
      friendCount,
      followerCount,
      followingCount,
    };
  }

  async getUserSocialStats(userId: string): Promise<UserSocialStats> {
    const [friends, followers, following] = await Promise.all([
      this.getFriendCount(userId),
      this.getFollowerCount(userId),
      this.getFollowingCount(userId),
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
      this.getFriendCount(userId),
      this.getFollowerCount(userId),
      this.getFollowingCount(userId),
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
          u.${users.userId} AS "userId",
          u.${users.username} AS username,
          up.${userProfiles.avatarUrl} AS "avatarUrl",
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
        LEFT JOIN ${userProfiles} up ON up.${userProfiles.userId} = u.${users.userId}
        LEFT JOIN follower_totals ft ON ft.user_id = u.${users.userId}
        LEFT JOIN new_followers nf ON nf.user_id = u.${users.userId}
        LEFT JOIN new_friendships nfr ON nfr.user_id = u.${users.userId}
        LEFT JOIN activity_counts ac ON ac.user_id = u.${users.userId}
        WHERE u.${users.deletedAt} IS NULL
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
}
