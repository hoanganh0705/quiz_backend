/**
 * Social Notification Listener
 *
 * Subscribes to Social domain events and dispatches notifications.
 * Hosted in SocialModule to avoid cross-module import cycles.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SOCIAL_DOMAIN_EVENT_BUS,
  type SocialDomainEventBusPort,
} from '../../domain/events/social-event-bus.port';
import type {
  SocialDomainEvent,
  FriendRequestSentEvent,
  FriendRequestAcceptedEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
} from '../../domain/events/social-domain.events';
import { NOTIFICATION_CHANNEL_SERVICE } from '@/modules/notification/domain/ports';
import type { NotificationChannelServicePort } from '@/modules/notification/domain/ports';

@Injectable()
export class SocialNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(SOCIAL_DOMAIN_EVENT_BUS)
    private readonly socialEventBus: SocialDomainEventBusPort,
    @Inject(NOTIFICATION_CHANNEL_SERVICE)
    private readonly channelService: NotificationChannelServicePort,
    @InjectPinoLogger(SocialNotificationListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.socialEventBus.subscribe(this.handleSocialEvent.bind(this));

    this.logger.info({
      event: 'social_notification_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handleSocialEvent(event: SocialDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'friend_request_sent':
        await this.handleFriendRequestSent(event);
        break;

      case 'friend_request_accepted':
        await this.handleFriendRequestAccepted(event);
        break;

      case 'user_followed':
        await this.handleUserFollowed(event);
        break;

      case 'user_unfollowed':
        await this.handleUserUnfollowed(event);
        break;

      default:
        this.logger.debug({
          event: 'unhandled_social_notification_event',
          eventType: event.eventType,
        });
    }
  }

  private async handleFriendRequestSent(event: FriendRequestSentEvent): Promise<void> {
    try {
      const title = 'New Friend Request';
      const body = `${event.requesterUsername} sent you a friend request`;

      await this.channelService.send({
        userId: event.addresseeId,
        type: 'friend_request',
        title,
        body,
        metadata: {
          requesterId: event.requesterId,
          requesterUsername: event.requesterUsername,
          friendshipId: event.friendshipId,
        },
      });

      this.logger.info({
        event: 'friend_request_notification_sent',
        requesterId: event.requesterId,
        addresseeId: event.addresseeId,
        friendshipId: event.friendshipId,
      });
    } catch (error) {
      this.logger.error({
        event: 'friend_request_notification_failed',
        requesterId: event.requesterId,
        addresseeId: event.addresseeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleFriendRequestAccepted(event: FriendRequestAcceptedEvent): Promise<void> {
    try {
      const title = 'Friend Request Accepted';
      const body = `${event.addresseeUsername} accepted your friend request`;

      await this.channelService.send({
        userId: event.requesterId,
        type: 'friend_accepted',
        title,
        body,
        metadata: {
          friendshipId: event.friendshipId,
        },
      });

      this.logger.info({
        event: 'friend_accepted_notification_sent',
        friendshipId: event.friendshipId,
        requesterId: event.requesterId,
        addresseeId: event.addresseeId,
      });
    } catch (error) {
      this.logger.error({
        event: 'friend_accepted_notification_failed',
        friendshipId: event.friendshipId,
        requesterId: event.requesterId,
        addresseeId: event.addresseeId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleUserFollowed(event: UserFollowedEvent): Promise<void> {
    try {
      const title = 'New Follower';
      const body = `${event.followerUsername} started following you`;

      await this.channelService.send({
        userId: event.followingId,
        type: 'followed',
        title,
        body,
        metadata: {
          followerUsername: event.followerUsername,
        },
      });

      this.logger.info({
        event: 'user_followed_notification_sent',
        followerId: event.followerId,
        followingId: event.followingId,
      });
    } catch (error) {
      this.logger.error({
        event: 'user_followed_notification_failed',
        followerId: event.followerId,
        followingId: event.followingId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleUserUnfollowed(event: UserUnfollowedEvent): Promise<void> {
    try {
      const title = 'Follower Removed';
      const body = `${event.followerUsername} unfollowed you`;

      await this.channelService.send({
        userId: event.followingId,
        type: 'followed',
        title,
        body,
        metadata: {
          unfollowerUsername: event.followerUsername,
        },
      });

      this.logger.info({
        event: 'user_unfollowed_notification_sent',
        followerId: event.followerId,
        followingId: event.followingId,
      });
    } catch (error) {
      this.logger.error({
        event: 'user_unfollowed_notification_failed',
        followerId: event.followerId,
        followingId: event.followingId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
