import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SOCIAL_REPOSITORY_PORT, type SocialRepositoryPort } from '../ports/social-ports';
import type {
  Friendship,
  FriendRequest,
  Friend,
  Follower,
  Following,
  SocialCounts,
  RelationshipStatus,
  CreateFriendRequestParams,
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
import { isPostgresUniqueViolation } from '@/common/utils/db-error.util';

@Injectable()
export class SocialService {
  constructor(
    @Inject(SOCIAL_REPOSITORY_PORT)
    private readonly socialRepository: SocialRepositoryPort,
    @InjectPinoLogger(SocialService.name)
    private readonly logger: PinoLogger,
  ) {}

  async sendFriendRequest(requesterId: string, params: CreateFriendRequestParams): Promise<FriendRequest> {
    const { addresseeId } = params;

    if (requesterId === addresseeId) {
      throw new SelfFriendRequestError();
    }

    const relationship = await this.socialRepository.getRelationshipStatus(requesterId, addresseeId);

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

    await this.socialRepository.respondToFriendRequest(
      { friendshipId, accept },
      userId,
    );

    this.logger.info({
      event: accept ? 'friend_request_accepted' : 'friend_request_rejected',
      friendshipId,
      userId,
    });
  }

  async cancelFriendRequest(requesterId: string, friendshipId: string): Promise<void> {
    const friendship = await this.socialRepository.getFriendRequest(friendshipId);

    if (!friendship) {
      throw new FriendRequestNotFoundError(friendshipId);
    }

    if (friendship.requesterId !== requesterId) {
      throw new FriendRequestForbiddenError();
    }

    await this.socialRepository.removeFriend(requesterId, friendship.addresseeId);

    this.logger.info({
      event: 'friend_request_cancelled',
      friendshipId,
      requesterId,
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

    await this.socialRepository.removeFriend(blockerId, blockedId);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.socialRepository.unblockUser(blockerId, blockedId);

    this.logger.info({
      event: 'user_unblocked',
      blockerId,
      blockedId,
    });
  }

  async getBlockedUsers(blockerId: string): Promise<{ blockedId: string; reason: string | null }[]> {
    const blocked = await this.socialRepository.getBlockedUsers(blockerId);
    return blocked.map(b => ({ blockedId: b.blockedId, reason: b.reason }));
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
      await this.socialRepository.followUser(followerId, followingId);

      this.logger.info({
        event: 'user_followed',
        followerId,
        followingId,
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

    this.logger.info({
      event: 'user_unfollowed',
      followerId,
      followingId,
    });
  }

  async getFollowers(userId: string, limit: number, cursor?: string | null): Promise<Follower[]> {
    return this.socialRepository.getFollowers(userId, limit, cursor);
  }

  async getFollowing(userId: string, limit: number, cursor?: string | null): Promise<Following[]> {
    return this.socialRepository.getFollowing(userId, limit, cursor);
  }

  async getRelationshipStatus(userId: string, targetId: string): Promise<RelationshipStatus> {
    return this.socialRepository.getRelationshipStatus(userId, targetId);
  }

  async getSocialCounts(userId: string): Promise<SocialCounts> {
    return this.socialRepository.getSocialCounts(userId);
  }
}
