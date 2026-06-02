/**
 * Social Event Handler
 *
 * Subscribes to Social domain events and triggers notifications.
 * Bridges the Social domain to the Notification domain.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SOCIAL_DOMAIN_EVENT_BUS,
  type SocialDomainEventBusPort,
} from '@/modules/social/domain/events/social-event-bus.port';
import type { SocialDomainEvent } from '@/modules/social/domain/events/social-domain.events';
import { SocialListenerAdapter } from '@/modules/notification/infrastructure/adapters/social-listener.adapter';

@Injectable()
export class SocialEventHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribeFn?: () => void;

  constructor(
    @Inject(SOCIAL_DOMAIN_EVENT_BUS)
    private readonly socialEventBus: SocialDomainEventBusPort,
    private readonly socialListenerAdapter: SocialListenerAdapter,
    @InjectPinoLogger(SocialEventHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribeToSocialEvents();

    this.logger.info({
      event: 'social_event_handler_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribeFn?.();
  }

  private subscribeToSocialEvents(): void {
    this.unsubscribeFn = this.socialEventBus.subscribe(this.handleSocialEvent.bind(this));
  }

  private async handleSocialEvent(event: SocialDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'friend_request_sent':
        await this.socialListenerAdapter.handleFriendRequestSent({
          eventType: 'friend_request_sent',
          friendshipId: event.friendshipId,
          requesterId: event.requesterId,
          requesterUsername: event.requesterUsername,
          addresseeId: event.addresseeId,
          addresseeUsername: event.addresseeUsername,
          timestamp: event.timestamp,
        });
        break;

      case 'friend_request_accepted':
        await this.socialListenerAdapter.handleFriendRequestAccepted({
          eventType: 'friend_request_accepted',
          friendshipId: event.friendshipId,
          requesterId: event.requesterId,
          addresseeId: event.addresseeId,
          timestamp: event.timestamp,
        });
        break;

      // Other events can be handled here if needed in the future
      // case 'friend_request_rejected':
      // case 'friend_request_cancelled':
      // case 'friend_removed':
      // case 'user_blocked':
      // case 'user_unblocked':
      // case 'user_followed':
      // case 'user_unfollowed':
      default:
        this.logger.debug({
          event: 'unhandled_social_event',
          eventType: event.eventType,
        });
    }
  }
}
