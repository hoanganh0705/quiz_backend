/**
 * Social Notification Listener
 *
 * Subscribes to Social domain events and dispatches notifications via
 * SOCIAL_NOTIFICATION_PORT. The Notification module owns the implementation
 * (SocialNotificationService) and exports it through the port token, so
 * Social does not reach into Notification internals.
 *
 * Hosted in SocialModule to avoid cross-module import cycles.
 */

import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SOCIAL_DOMAIN_EVENT_BUS,
  type SocialDomainEventBusPort,
} from '../../domain/events/social-event-bus.port';
import type {
  SocialDomainEvent,
  FriendRequestSentEvent,
  FriendRequestAcceptedEvent,
  FriendRequestRejectedEvent,
  FriendRequestCancelledEvent,
  FriendRemovedEvent,
  UserBlockedEvent,
  UserUnblockedEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
} from '../../domain/events/social-domain.events';
import { SOCIAL_NOTIFICATION_PORT, type SocialNotificationPort } from '@/modules/notification/domain/ports';

@Injectable()
export class SocialNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(SOCIAL_DOMAIN_EVENT_BUS)
    private readonly socialEventBus: SocialDomainEventBusPort,
    @Inject(forwardRef(() => SOCIAL_NOTIFICATION_PORT))
    private readonly socialNotifications: SocialNotificationPort,
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
    try {
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

        case 'friend_request_rejected':
          await this.handleFriendRequestRejected(event);
          break;

        case 'friend_request_cancelled':
          await this.handleFriendRequestCancelled(event);
          break;

        case 'friend_removed':
          await this.handleFriendRemoved(event);
          break;

        case 'user_blocked':
          await this.handleUserBlocked(event);
          break;

        case 'user_unblocked':
          await this.handleUserUnblocked(event);
          break;
      }
    } catch (error) {
      this.logger.error({
        event: 'social_notification_dispatch_failed',
        eventType: event.eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleFriendRequestSent(event: FriendRequestSentEvent): Promise<void> {
    await this.socialNotifications.notifyFriendRequestReceived({
      userId: event.addresseeId,
      requesterId: event.requesterId,
      requesterUsername: event.requesterUsername,
      friendshipId: event.friendshipId,
    });
  }

  private async handleFriendRequestAccepted(event: FriendRequestAcceptedEvent): Promise<void> {
    await this.socialNotifications.notifyFriendRequestAccepted({
      userId: event.requesterId,
      requesterId: event.requesterId,
      addresseeUsername: event.addresseeUsername,
      friendshipId: event.friendshipId,
    });
  }

  private async handleUserFollowed(event: UserFollowedEvent): Promise<void> {
    await this.socialNotifications.notifyUserFollowed({
      userId: event.followingId,
      followerUsername: event.followerUsername,
    });
  }

  private async handleUserUnfollowed(event: UserUnfollowedEvent): Promise<void> {
    await this.socialNotifications.notifyUserUnfollowed({
      userId: event.followingId,
      followerUsername: event.followerUsername,
    });
  }

  private async handleFriendRequestRejected(event: FriendRequestRejectedEvent): Promise<void> {
    await this.socialNotifications.notifyFriendRequestRejected({
      userId: event.requesterId,
      requesterId: event.requesterId,
      addresseeId: event.addresseeId,
      friendshipId: event.friendshipId,
    });
  }

  private async handleFriendRequestCancelled(event: FriendRequestCancelledEvent): Promise<void> {
    await this.socialNotifications.notifyFriendRequestCancelled({
      userId: event.addresseeId,
      requesterId: event.requesterId,
      addresseeId: event.addresseeId,
      friendshipId: event.friendshipId,
    });
  }

  private async handleFriendRemoved(event: FriendRemovedEvent): Promise<void> {
    await this.socialNotifications.notifyFriendRemoved({
      userId: event.friendId,
      friendId: event.friendId,
      removedBy: event.userId,
    });
  }

  private async handleUserBlocked(event: UserBlockedEvent): Promise<void> {
    await this.socialNotifications.notifyUserBlocked({
      userId: event.blockedId,
      blockerId: event.blockerId,
      reason: event.reason,
    });
  }

  private async handleUserUnblocked(event: UserUnblockedEvent): Promise<void> {
    await this.socialNotifications.notifyUserUnblocked({
      userId: event.blockedId,
      blockerId: event.blockerId,
    });
  }
}
