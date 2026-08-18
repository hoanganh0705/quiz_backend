import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { friendships, users, userProfiles, blockedUsers } from '@/core/database/schema';
import type { FriendshipRepositoryPort } from '../../domain/ports/friendship-ports';
import type {
  Friendship,
  FriendRequest,
  Friend,
  PaginatedMutualFriendsResult,
  RespondToFriendRequestParams,
} from '../../domain/types/social.types';
import { eq, and, or, sql, desc, count, lte, isNull, aliasedTable } from 'drizzle-orm';

@Injectable()
export class FriendshipRepository implements FriendshipRepositoryPort {
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
        addresseeId: friendships.addresseeId,
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
      addresseeId: r.addresseeId,
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
      // The Sent list is "requests I sent to someone" — the row we
      // want to show is the addressee (recipient). Join on
      // `addresseeId` so `username`/`displayName`/`avatarUrl`
      // resolve to the recipient's identity, not the current user.
      // Mirrors `getPendingRequests` which joins on `requesterId`
      // because the Incoming list shows the sender.
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
      addresseeId: r.addresseeId,
      // `requesterXxx` is the DTO field used by both the Sent and
      // Incoming payloads. For the Sent list the recipient is the
      // person the row should describe, so the addressee's profile
      // is surfaced through these fields. (See `dto-adapters.ts#toFriendRequest`
      // on the client.)
      requesterUsername: r.username,
      requesterDisplayName: r.displayName,
      requesterAvatarUrl: r.avatarUrl,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Mark a pending friend request as accepted or rejected. Like
   * `cancelFriendRequestById`, this filters on `status='pending'` AND
   * `isNull(deletedAt)` so a tombstoned row (one that the requester
   * cancelled concurrently) cannot be flipped out of the pending
   * state. Returns the row count so the caller can detect the
   * "already terminal" race and surface
   * `SOCIAL_FRIEND_REQUEST_NOT_FOUND` rather than silently succeed.
   */
  async respondToFriendRequest(
    params: RespondToFriendRequestParams,
    requesterId: string,
  ): Promise<number> {
    const newStatus = params.accept ? 'accepted' : 'rejected';

    const result = await this.db
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
          isNull(friendships.deletedAt),
        ),
      )
      .returning({ friendshipId: friendships.friendshipId });

    return result.length;
  }

  /**
   * Soft-delete a pending friend request that the requester is
   * cancelling. Unlike `removeFriend`, this targets the row by its
   * `friendshipId` (so it cannot accidentally match an accepted
   * friendship with the same pair of users) and is restricted to
   * `status='pending'` so a no-longer-cancellable row is a no-op
   * rather than a silent success.
   *
   * Returns the number of rows updated so the caller can detect the
   * "already terminal" case (0) and surface `SOCIAL_FRIEND_REQUEST_NOT_FOUND`
   * upstream, matching the audit-friendly semantics of `removeFriend`.
   */
  async cancelFriendRequestById(friendshipId: string): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db
      .update(friendships)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(friendships.friendshipId, friendshipId),
          eq(friendships.status, 'pending'),
          isNull(friendships.deletedAt),
        ),
      )
      .returning({ friendshipId: friendships.friendshipId });

    return result.length;
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

  async findAcceptedFriendship(userId: string, friendId: string): Promise<Friendship | null> {
    const [row] = await this.db
      .select()
      .from(friendships)
      .where(
        and(
          or(
            and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId)),
            and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId)),
          ),
          eq(friendships.status, 'accepted'),
          isNull(friendships.deletedAt),
        ),
      )
      .limit(1);

    return (row as Friendship | undefined) ?? null;
  }

  async getMutualFriends(
    userId: string,
    targetUserId: string,
    cursor?: string | null,
    limit?: number,
  ): Promise<PaginatedMutualFriendsResult> {
    const effectiveLimit = limit ?? 20;

    // Decode cursor if provided (for username-based cursor)
    let cursorCondition = '';
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        cursorCondition = `AND mutual_friends.username > '${decoded.username}'`;
      } catch {
        cursorCondition = '';
      }
    }

    const u = aliasedTable(users, 'u');
    const up = aliasedTable(userProfiles, 'up');

    const mutualFriendsQuery = sql<{
      userId: string;
      username: string;
      displayName: string | null;
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
        ${u.userId} AS "userId",
        ${u.username} AS username,
        ${up.displayName} AS "displayName",
        ${up.avatarUrl} AS "avatarUrl"
      FROM shared_friends sf
      INNER JOIN ${users} u ON ${u.userId} = sf.user_id
      LEFT JOIN ${userProfiles} up ON ${up.userId} = ${u.userId}
      WHERE ${u.deletedAt} IS NULL
    `;

    const rowsResult = await this.db.execute(sql`
      SELECT *
      FROM (${mutualFriendsQuery}) mutual_friends
      WHERE 1=1 ${sql.raw(cursorCondition ? ` ${cursorCondition}` : '')}
      ORDER BY mutual_friends.username ASC
      LIMIT ${effectiveLimit + 1}
    `);

    const rows = rowsResult.rows as Array<{
      userId: string;
      username: string;
      displayName: string | null;
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
        displayName: row.displayName,
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
}
