import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { userFollows, users, userProfiles, blockedUsers } from '@/core/database/schema';
import type { UserFollowRepositoryPort } from '../../domain/ports/user-follow-ports';
import type {
  UserFollow,
  Follower,
  Following,
  PaginatedFollowersResult,
  PaginatedFollowingResult,
  PaginatedMutualFollowersResult,
} from '../../domain/types/social.types';
import { eq, and, sql, desc, count, lte, isNull, aliasedTable } from 'drizzle-orm';

@Injectable()
export class UserFollowRepository implements UserFollowRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    const result = await this.db.execute(sql<{
      followId: string;
      followerId: string;
      followingId: string;
      createdAt: string;
    }>`
      INSERT INTO user_follows (follower_id, following_id)
      VALUES (${followerId}::uuid, ${followingId}::uuid)
      ON CONFLICT (follower_id, following_id) WHERE deleted_at IS NULL
      DO NOTHING
      RETURNING
        follow_id     AS "followId",
        follower_id   AS "followerId",
        following_id  AS "followingId",
        created_at    AS "createdAt"
    `);

    let follow: {
      followId: string;
      followerId: string;
      followingId: string;
      createdAt: string;
    };

    if (result.rows.length > 0) {
      follow = result.rows[0] as {
        followId: string;
        followerId: string;
        followingId: string;
        createdAt: string;
      };
    } else {
      const existing = await this.db
        .select({
          followId: userFollows.followId,
          followerId: userFollows.followerId,
          followingId: userFollows.followingId,
          createdAt: userFollows.createdAt,
        })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, followerId),
            eq(userFollows.followingId, followingId),
            isNull(userFollows.deletedAt),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error('followUser: UPSERT returned no row and existing row not found');
      }
      follow = existing[0];
    }

    const [followerRow, followingRow] = await Promise.all([
      this.db.select({ username: users.username }).from(users).where(eq(users.userId, followerId)),
      this.db.select({ username: users.username }).from(users).where(eq(users.userId, followingId)),
    ]);

    return {
      followId: follow.followId,
      followerId: follow.followerId,
      followingId: follow.followingId,
      followerUsername: followerRow[0]?.username ?? '',
      followingUsername: followingRow[0]?.username ?? '',
      createdAt: follow.createdAt,
    };
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .update(userFollows)
      .set({ deletedAt: now })
      .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)));
  }

  async findActiveFollow(followerId: string, followingId: string): Promise<UserFollow | null> {
    const [row] = await this.db
      .select()
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId),
          isNull(userFollows.deletedAt),
        ),
      )
      .limit(1);

    return (row as unknown as UserFollow) ?? null;
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

  async getFollowersOfUser(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedFollowersResult> {
    const effectiveLimit = limit ?? 20;

    // Decode cursor if provided
    let cursorCondition = '';
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        cursorCondition = `AND (uf.created_at < '${decoded.followedAt}' OR (uf.created_at = '${decoded.followedAt}' AND uf.follow_id < '${decoded.followId}'::uuid))`;
      } catch {
        cursorCondition = '';
      }
    }

    const rows = await this.db.execute(sql`
      SELECT
        uf.follower_id AS "userId",
        u.username AS username,
        up.avatar_url AS "avatarUrl",
        uf.created_at AS "followedAt"
      FROM user_follows uf
      INNER JOIN users u ON u.user_id = uf.follower_id
      LEFT JOIN user_profiles up ON up.user_id = u.user_id
      WHERE uf.following_id = ${userId}::uuid
        AND uf.deleted_at IS NULL
        ${sql.raw(cursorCondition ? ` ${cursorCondition}` : '')}
      ORDER BY uf.created_at DESC, uf.follow_id DESC
      LIMIT ${effectiveLimit + 1}
    `);

    const followerRows = rows.rows as Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      followedAt: string;
    }>;

    const hasNextPage = followerRows.length > effectiveLimit;
    const items = hasNextPage ? followerRows.slice(0, effectiveLimit) : followerRows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({ followedAt: lastItem.followedAt, followId: lastItem.userId }),
            'utf8',
          ).toString('base64url')
        : null;

    return {
      items: items.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        followedAt: row.followedAt,
      })),
      pagination: {
        kind: 'cursor',
        limit: effectiveLimit,
        hasNextPage,
        nextCursor,
      },
    };
  }

  async getFollowingOfUser(
    userId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedFollowingResult> {
    const effectiveLimit = limit ?? 20;

    // Decode cursor if provided
    let cursorCondition = '';
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        cursorCondition = `AND (uf.created_at < '${decoded.followedAt}' OR (uf.created_at = '${decoded.followedAt}' AND uf.follow_id < '${decoded.followId}'::uuid))`;
      } catch {
        cursorCondition = '';
      }
    }

    const rows = await this.db.execute(sql`
      SELECT
        uf.following_id AS "userId",
        u.username AS username,
        up.avatar_url AS "avatarUrl",
        uf.created_at AS "followedAt"
      FROM user_follows uf
      INNER JOIN users u ON u.user_id = uf.following_id
      LEFT JOIN user_profiles up ON up.user_id = u.user_id
      WHERE uf.follower_id = ${userId}::uuid
        AND uf.deleted_at IS NULL
        ${sql.raw(cursorCondition ? ` ${cursorCondition}` : '')}
      ORDER BY uf.created_at DESC, uf.follow_id DESC
      LIMIT ${effectiveLimit + 1}
    `);

    const followingRows = rows.rows as Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
      followedAt: string;
    }>;

    const hasNextPage = followingRows.length > effectiveLimit;
    const items = hasNextPage ? followingRows.slice(0, effectiveLimit) : followingRows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(
            JSON.stringify({ followedAt: lastItem.followedAt, followId: lastItem.userId }),
            'utf8',
          ).toString('base64url')
        : null;

    return {
      items: items.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
        followedAt: row.followedAt,
      })),
      pagination: {
        kind: 'cursor',
        limit: effectiveLimit,
        hasNextPage,
        nextCursor,
      },
    };
  }

  async getMutualFollowers(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFollowersResult> {
    const effectiveLimit = limit ?? 20;

    // Decode cursor if provided (for username-based cursor)
    let cursorCondition = '';
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        cursorCondition = `AND shared_following.username > '${decoded.username}'`;
      } catch {
        cursorCondition = '';
      }
    }

    const u = aliasedTable(users, 'u');
    const up = aliasedTable(userProfiles, 'up');

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
        ${u.userId} AS "userId",
        ${u.username} AS username,
        ${up.avatarUrl} AS "avatarUrl"
      FROM shared_following sf
      INNER JOIN ${users} u ON ${u.userId} = sf.user_id
      LEFT JOIN ${userProfiles} up ON ${up.userId} = ${u.userId}
      WHERE ${u.deletedAt} IS NULL
    `;

    const rowsResult = await this.db.execute(sql`
      SELECT *
      FROM (${mutualFollowersQuery}) shared_following
      WHERE 1=1 ${sql.raw(cursorCondition ? ` ${cursorCondition}` : '')}
      ORDER BY shared_following.username ASC
      LIMIT ${effectiveLimit + 1}
    `);

    const rows = rowsResult.rows as Array<{
      userId: string;
      username: string;
      avatarUrl: string | null;
    }>;

    const hasNextPage = rows.length > effectiveLimit;
    const items = hasNextPage ? rows.slice(0, effectiveLimit) : rows;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(JSON.stringify({ username: lastItem.username }), 'utf8').toString('base64url')
        : null;

    return {
      items: items.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl,
      })),
      pagination: {
        kind: 'cursor',
        limit: effectiveLimit,
        hasNextPage,
        nextCursor,
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

  async getUsernamesForUsers(
    followerId: string,
    followingId: string,
  ): Promise<{ followerUsername: string; followingUsername: string }> {
    const [followerRow, followingRow] = await Promise.all([
      this.db.select({ username: users.username }).from(users).where(eq(users.userId, followerId)),
      this.db.select({ username: users.username }).from(users).where(eq(users.userId, followingId)),
    ]);

    return {
      followerUsername: followerRow[0]?.username ?? '',
      followingUsername: followingRow[0]?.username ?? '',
    };
  }
}
