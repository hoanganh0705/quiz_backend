import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { friendships, blockedUsers, userFollows, users, userProfiles } from '@/core/database/schema';
import { SOCIAL_REPOSITORY_PORT, type SocialRepositoryPort } from '../../domain/ports/social-ports';
import type {
  Friendship,
  BlockedUser,
  UserFollow,
  FriendRequest,
  Friend,
  Follower,
  Following,
  SocialCounts,
  RelationshipStatus,
  RespondToFriendRequestParams,
} from '../../domain/types/social.types';
import { eq, and, or, sql, desc, count } from 'drizzle-orm';

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

  async getFriendRequest(friendshipId: string): Promise<Friendship | null> {
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
        ),
      )
      .orderBy(desc(friendships.createdAt));

    return rows.map(r => ({
      friendshipId: r.friendshipId as string,
      requesterId: r.requesterId as string,
      requesterUsername: r.username as string,
      requesterDisplayName: r.displayName as string | null,
      requesterAvatarUrl: r.avatarUrl as string | null,
      createdAt: r.createdAt as string,
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
        ),
      )
      .orderBy(desc(friendships.createdAt));

    return rows.map(r => ({
      friendshipId: r.friendshipId as string,
      requesterId: r.requesterId as string,
      requesterUsername: r.username as string,
      requesterDisplayName: r.displayName as string | null,
      requesterAvatarUrl: r.avatarUrl as string | null,
      createdAt: r.createdAt as string,
    }));
  }

  async respondToFriendRequest(params: RespondToFriendRequestParams, requesterId: string): Promise<void> {
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

  async getFriends(userId: string, limit: number, cursor?: string | null): Promise<Friend[]> {
    const condition = or(
      eq(friendships.requesterId, userId),
      eq(friendships.addresseeId, userId),
    );

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
      .innerJoin(users, sql`CASE WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId} ELSE ${friendships.requesterId} END = ${users.userId}`)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(condition, eq(friendships.status, 'accepted')))
      .orderBy(desc(friendships.updatedAt))
      .limit(limit + 1);

    return rows.map(r => ({
      friendshipId: r.friendshipId as string,
      userId: r.userId as string,
      username: r.username as string,
      displayName: r.displayName as string | null,
      avatarUrl: r.avatarUrl as string | null,
      friendSince: r.createdAt as string,
    }));
  }

  async getFriendCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(friendships)
      .where(
        and(
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId),
          ),
          eq(friendships.status, 'accepted'),
        ),
      );

    return Number(result[0]?.count ?? 0);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.db
      .delete(friendships)
      .where(
        and(
          or(
            and(
              eq(friendships.requesterId, userId),
              eq(friendships.addresseeId, friendId),
            ),
            and(
              eq(friendships.requesterId, friendId),
              eq(friendships.addresseeId, userId),
            ),
          ),
          eq(friendships.status, 'accepted'),
        ),
      );
  }

  async blockUser(blockerId: string, blockedId: string, reason?: string): Promise<BlockedUser> {
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
    await this.db
      .delete(blockedUsers)
      .where(
        and(
          eq(blockedUsers.blockerId, blockerId),
          eq(blockedUsers.blockedId, blockedId),
        ),
      );
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: count() })
      .from(blockedUsers)
      .where(
        and(
          eq(blockedUsers.blockerId, blockerId),
          eq(blockedUsers.blockedId, blockedId),
        ),
      );

    return Number(result?.count ?? 0) > 0;
  }

  async getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
    const rows = await this.db
      .select()
      .from(blockedUsers)
      .where(eq(blockedUsers.blockerId, blockerId))
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
    await this.db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId),
        ),
      );
  }

  async getFollowers(userId: string, limit: number, cursor?: string | null): Promise<Follower[]> {
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
      .where(eq(userFollows.followingId, userId))
      .orderBy(desc(userFollows.createdAt))
      .limit(limit + 1);

    return rows.map(r => ({
      followId: r.followId as string,
      userId: r.userId as string,
      username: r.username as string,
      displayName: r.displayName as string | null,
      avatarUrl: r.avatarUrl as string | null,
      followedAt: r.createdAt as string,
    }));
  }

  async getFollowing(userId: string, limit: number, cursor?: string | null): Promise<Following[]> {
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
      .where(eq(userFollows.followerId, userId))
      .orderBy(desc(userFollows.createdAt))
      .limit(limit + 1);

    return rows.map(r => ({
      followId: r.followId as string,
      userId: r.userId as string,
      username: r.username as string,
      displayName: r.displayName as string | null,
      avatarUrl: r.avatarUrl as string | null,
      followedAt: r.createdAt as string,
    }));
  }

  async getFollowerCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userFollows)
      .where(eq(userFollows.followingId, userId));

    return Number(result[0]?.count ?? 0);
  }

  async getFollowingCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));

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
          ),
        ),
      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, targetId),
            eq(userFollows.followingId, userId),
          ),
        ),
      this.db
        .select({ count: count() })
        .from(userFollows)
        .where(
          and(
            eq(userFollows.followerId, userId),
            eq(userFollows.followingId, targetId),
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
}
