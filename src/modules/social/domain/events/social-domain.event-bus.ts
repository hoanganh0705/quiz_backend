/**
 * Social Domain Event Bus Implementation
 *
 * Simple in-process event bus using the observer pattern.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { correlationIdStorage, createCorrelationId, getCorrelationId } from '@/common/interceptors/correlation-id';
import type { SocialDomainEventBusPort, SocialDomainEvent } from './social-event-bus.port';
import type {
  FriendRequestSentEvent,
  FriendRequestAcceptedEvent,
  FriendRequestRejectedEvent,
  FriendRequestCancelledEvent,
  FriendRemovedEvent,
  UserBlockedEvent,
  UserUnblockedEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
} from './social-domain.events';

@Injectable()
export class SocialDomainEventBus implements SocialDomainEventBusPort {
  private handlers: Array<(event: SocialDomainEvent) => void> = [];

  constructor(
    @InjectPinoLogger(SocialDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: (event: SocialDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: SocialDomainEvent): void {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    for (const handler of this.handlers) {
      try {
        correlationIdStorage.run({ correlationId }, () => {
          handler(event);
        });
      } catch (error) {
        this.logger.error({
          event: 'social_event_handler_error',
          correlationId,
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  emitFriendRequestSent(event: FriendRequestSentEvent): void {
    this.emit(event);
  }

  emitFriendRequestAccepted(event: FriendRequestAcceptedEvent): void {
    this.emit(event);
  }

  emitFriendRequestRejected(event: FriendRequestRejectedEvent): void {
    this.emit(event);
  }

  emitFriendRequestCancelled(event: FriendRequestCancelledEvent): void {
    this.emit(event);
  }

  emitFriendRemoved(event: FriendRemovedEvent): void {
    this.emit(event);
  }

  emitUserBlocked(event: UserBlockedEvent): void {
    this.emit(event);
  }

  emitUserUnblocked(event: UserUnblockedEvent): void {
    this.emit(event);
  }

  emitUserFollowed(event: UserFollowedEvent): void {
    this.emit(event);
  }

  emitUserUnfollowed(event: UserUnfollowedEvent): void {
    this.emit(event);
  }
}
