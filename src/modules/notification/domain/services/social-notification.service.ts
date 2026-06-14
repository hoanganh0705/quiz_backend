/**
 * Social Notification Service
 *
 * Composes and sends social-related notifications. This is the public surface
 * exposed via SOCIAL_NOTIFICATION_PORT for the Social module to consume
 * without reaching into Notification internals.
 *
 * Mirrors the 9 social events emitted by the Social domain. Each method takes
 * a flat parameter object so the Social listener can pass the event directly
 * without unpacking.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export interface NotifyFriendRequestReceivedParams {
  userId: string;
  requesterId: string;
  requesterUsername: string;
  friendshipId: string;
}

export interface NotifyFriendRequestAcceptedParams {
  userId: string;
  requesterId: string;
  addresseeUsername: string;
  friendshipId: string;
}

export interface NotifyFriendRequestRejectedParams {
  userId: string;
  requesterId: string;
  addresseeId: string;
  friendshipId: string;
}

export interface NotifyFriendRequestCancelledParams {
  userId: string;
  requesterId: string;
  addresseeId: string;
  friendshipId: string;
}

export interface NotifyFriendRemovedParams {
  userId: string;
  friendId: string;
  removedBy: string;
}

export interface NotifyUserFollowedParams {
  userId: string;
  followerUsername: string;
}

export interface NotifyUserUnfollowedParams {
  userId: string;
  followerUsername: string;
}

export interface NotifyUserBlockedParams {
  userId: string;
  blockerId: string;
  reason: string | null;
}

export interface NotifyUserUnblockedParams {
  userId: string;
  blockerId: string;
}

/**
 * Port interface exposed to the Social module. The Notification module
 * provides the implementation via SOCIAL_NOTIFICATION_PORT.
 */
export interface SocialNotificationPort {
  notifyFriendRequestReceived(params: NotifyFriendRequestReceivedParams): Promise<void>;
  notifyFriendRequestAccepted(params: NotifyFriendRequestAcceptedParams): Promise<void>;
  notifyFriendRequestRejected(params: NotifyFriendRequestRejectedParams): Promise<void>;
  notifyFriendRequestCancelled(params: NotifyFriendRequestCancelledParams): Promise<void>;
  notifyFriendRemoved(params: NotifyFriendRemovedParams): Promise<void>;
  notifyUserFollowed(params: NotifyUserFollowedParams): Promise<void>;
  notifyUserUnfollowed(params: NotifyUserUnfollowedParams): Promise<void>;
  notifyUserBlocked(params: NotifyUserBlockedParams): Promise<void>;
  notifyUserUnblocked(params: NotifyUserUnblockedParams): Promise<void>;
}

@Injectable()
export class SocialNotificationService implements SocialNotificationPort {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(SocialNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async notifyFriendRequestReceived(params: NotifyFriendRequestReceivedParams): Promise<void> {
    const title = 'New Friend Request';
    const body = `${params.requesterUsername} sent you a friend request`;

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_request',
      title,
      body,
      metadata: {
        requesterId: params.requesterId,
        requesterUsername: params.requesterUsername,
        friendshipId: params.friendshipId,
      },
    });

    this.logger.info({
      event: 'friend_request_notification_sent',
      userId: params.userId,
      requesterId: params.requesterId,
      friendshipId: params.friendshipId,
    });
  }

  async notifyFriendRequestAccepted(params: NotifyFriendRequestAcceptedParams): Promise<void> {
    const title = 'Friend Request Accepted';
    const body = `${params.addresseeUsername} accepted your friend request`;

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_accepted',
      title,
      body,
      metadata: {
        friendshipId: params.friendshipId,
      },
    });

    this.logger.info({
      event: 'friend_accepted_notification_sent',
      userId: params.userId,
      friendshipId: params.friendshipId,
    });
  }

  async notifyFriendRequestRejected(params: NotifyFriendRequestRejectedParams): Promise<void> {
    const title = 'Friend Request Declined';
    const body = 'Your friend request was declined';

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_request',
      title,
      body,
      metadata: {
        friendshipId: params.friendshipId,
      },
    });

    this.logger.info({
      event: 'friend_request_rejected_notification_sent',
      userId: params.userId,
      requesterId: params.requesterId,
      addresseeId: params.addresseeId,
      friendshipId: params.friendshipId,
    });
  }

  async notifyFriendRequestCancelled(params: NotifyFriendRequestCancelledParams): Promise<void> {
    const title = 'Friend Request Cancelled';
    const body = 'A friend request sent to you was cancelled';

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_request',
      title,
      body,
      metadata: {
        friendshipId: params.friendshipId,
      },
    });

    this.logger.info({
      event: 'friend_request_cancelled_notification_sent',
      userId: params.userId,
      requesterId: params.requesterId,
      addresseeId: params.addresseeId,
      friendshipId: params.friendshipId,
    });
  }

  async notifyFriendRemoved(params: NotifyFriendRemovedParams): Promise<void> {
    const title = 'Friend Removed';
    const body = 'A friend removed you from their friends list';

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_accepted',
      title,
      body,
      metadata: {
        userId: params.removedBy,
      },
    });

    this.logger.info({
      event: 'friend_removed_notification_sent',
      userId: params.userId,
      friendId: params.friendId,
    });
  }

  async notifyUserFollowed(params: NotifyUserFollowedParams): Promise<void> {
    const title = 'New Follower';
    const body = `${params.followerUsername} started following you`;

    await this.channelService.send({
      userId: params.userId,
      type: 'followed',
      title,
      body,
      metadata: {
        followerUsername: params.followerUsername,
      },
    });

    this.logger.info({
      event: 'user_followed_notification_sent',
      userId: params.userId,
    });
  }

  async notifyUserUnfollowed(params: NotifyUserUnfollowedParams): Promise<void> {
    const title = 'Follower Removed';
    const body = `${params.followerUsername} unfollowed you`;

    await this.channelService.send({
      userId: params.userId,
      type: 'followed',
      title,
      body,
      metadata: {
        unfollowerUsername: params.followerUsername,
      },
    });

    this.logger.info({
      event: 'user_unfollowed_notification_sent',
      userId: params.userId,
    });
  }

  async notifyUserBlocked(params: NotifyUserBlockedParams): Promise<void> {
    const title = 'You Have Been Blocked';
    const body = 'You have been blocked by a user';

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_request',
      title,
      body,
      metadata: {
        blockerId: params.blockerId,
        reason: params.reason,
      },
    });

    this.logger.info({
      event: 'user_blocked_notification_sent',
      userId: params.userId,
      blockerId: params.blockerId,
    });
  }

  async notifyUserUnblocked(params: NotifyUserUnblockedParams): Promise<void> {
    const title = 'You Have Been Unblocked';
    const body = 'You have been unblocked by a user';

    await this.channelService.send({
      userId: params.userId,
      type: 'friend_request',
      title,
      body,
      metadata: {
        blockerId: params.blockerId,
      },
    });

    this.logger.info({
      event: 'user_unblocked_notification_sent',
      userId: params.userId,
      blockerId: params.blockerId,
    });
  }
}
