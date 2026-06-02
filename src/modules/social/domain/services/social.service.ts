import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SOCIAL_REPOSITORY_PORT, type SocialRepositoryPort } from '../ports/social-ports';
import {
  SOCIAL_DOMAIN_EVENT_BUS,
  type SocialDomainEventBusPort,
} from '../ports';
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
    @Inject(SOCIAL_DOMAIN_EVENT_BUS)
    private readonly eventBus: SocialDomainEventBusPort,
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

    await this.socialRepository.respondToFriendRequest(
      { friendshipId, accept },
      userId,
    );

    this.logger.info({
      event: accept ? 'friend_request_accepted' : 'friend_request_rejected',
      friendshipId,
      userId,
    });

    // Emit domain event
    if (accept) {
      this.eventBus.emitFriendRequestAccepted({
        eventType: 'friend_request_accepted',
        friendshipId,
        requesterId: friendship.requesterId,
        addresseeId: friendship.addresseeId,
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
        followingId,
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

    this.logger.info({
      event: 'user_unfollowed',
      followerId,
      followingId,
    });

    // Emit domain event
    this.eventBus.emitUserUnfollowed({
      eventType: 'user_unfollowed',
      followerId,
      followingId,
      timestamp: new Date(),
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
