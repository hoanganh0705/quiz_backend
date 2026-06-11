/**
 * Social Notification Service
 *
 * Composes and sends social-related notifications.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationChannelService } from '../../infrastructure/adapters/notification-channel.service';

export interface FriendRequestReceivedParams {
  userId: string;
  requesterId: string;
  requesterUsername: string;
  friendshipId: string;
}

export interface FriendRequestAcceptedParams {
  userId: string;
  addresseeUsername: string;
  friendshipId: string;
}

export interface UserFollowedParams {
  userId: string;
  followerUsername: string;
}

export interface UserUnfollowedParams {
  userId: string;
  unfollowerUsername: string;
}

@Injectable()
export class SocialNotificationService {
  constructor(
    private readonly channelService: NotificationChannelService,
    @InjectPinoLogger(SocialNotificationService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Send a friend request received notification.
   */
  async notifyFriendRequestReceived(params: FriendRequestReceivedParams): Promise<void> {
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
    });
  }

  /**
   * Send a friend request accepted notification.
   */
  async notifyFriendRequestAccepted(params: FriendRequestAcceptedParams): Promise<void> {
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
    });
  }

  /**
   * Send a notification when someone follows the user.
   */
  async notifyUserFollowed(params: UserFollowedParams): Promise<void> {
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

  /**
   * Send a notification when someone unfollows the user.
   */
  async notifyUserUnfollowed(params: UserUnfollowedParams): Promise<void> {
    const title = 'Follower Removed';
    const body = `${params.unfollowerUsername} unfollowed you`;

    await this.channelService.send({
      userId: params.userId,
      type: 'followed',
      title,
      body,
      metadata: {
        unfollowerUsername: params.unfollowerUsername,
      },
    });

    this.logger.info({
      event: 'user_unfollowed_notification_sent',
      userId: params.userId,
    });
  }
}
