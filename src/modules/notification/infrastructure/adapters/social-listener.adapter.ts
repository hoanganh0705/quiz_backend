/**
 * Social Event Listener Adapter
 *
 * Listens to Social domain events and triggers notifications.
 * This adapter bridges the Social domain to the Notification domain.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SocialNotificationService } from '../../domain/services/social-notification.service';

export interface FriendRequestSentEvent {
  readonly eventType: 'friend_request_sent';
  readonly friendshipId: string;
  readonly requesterId: string;
  readonly requesterUsername: string;
  readonly addresseeId: string;
  readonly addresseeUsername: string;
  readonly timestamp: Date;
}

export interface FriendRequestAcceptedEvent {
  readonly eventType: 'friend_request_accepted';
  readonly friendshipId: string;
  readonly requesterId: string;
  readonly addresseeId: string;
  readonly timestamp: Date;
}

@Injectable()
export class SocialListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly socialNotificationService: SocialNotificationService,
    @InjectPinoLogger(SocialListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'notification_social_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /**
   * Handle friend request sent event.
   * This is called by the social listener to notify the addressee.
   */
  async handleFriendRequestSent(event: FriendRequestSentEvent): Promise<void> {
    try {
      await this.socialNotificationService.notifyFriendRequestReceived({
        userId: event.addresseeId,
        requesterId: event.requesterId,
        requesterUsername: event.requesterUsername,
        friendshipId: event.friendshipId,
      });

      this.logger.info({
        event: 'friend_request_notification_triggered',
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

  /**
   * Handle friend request accepted event.
   * This is called by the social listener to notify the original requester.
   */
  async handleFriendRequestAccepted(event: FriendRequestAcceptedEvent): Promise<void> {
    try {
      await this.socialNotificationService.notifyFriendRequestAccepted({
        userId: event.requesterId,
        addresseeUsername: '', // Will be enriched by the notification service if needed
        friendshipId: event.friendshipId,
      });

      this.logger.info({
        event: 'friend_accepted_notification_triggered',
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
}
