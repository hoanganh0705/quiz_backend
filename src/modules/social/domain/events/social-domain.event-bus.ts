import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
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
export class SocialDomainEventBus
  extends BaseDomainEventBus<SocialDomainEvent>
  implements SocialDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(SocialDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'social_event', propagateCorrelationId: true });
  }

  subscribe(handler: (event: SocialDomainEvent) => void): () => void {
    return super.subscribe(handler);
  }

  emitFriendRequestSent(event: FriendRequestSentEvent): void {
    this.dispatch(event);
  }

  emitFriendRequestAccepted(event: FriendRequestAcceptedEvent): void {
    this.dispatch(event);
  }

  emitFriendRequestRejected(event: FriendRequestRejectedEvent): void {
    this.dispatch(event);
  }

  emitFriendRequestCancelled(event: FriendRequestCancelledEvent): void {
    this.dispatch(event);
  }

  emitFriendRemoved(event: FriendRemovedEvent): void {
    this.dispatch(event);
  }

  emitUserBlocked(event: UserBlockedEvent): void {
    this.dispatch(event);
  }

  emitUserUnblocked(event: UserUnblockedEvent): void {
    this.dispatch(event);
  }

  emitUserFollowed(event: UserFollowedEvent): void {
    this.dispatch(event);
  }

  emitUserUnfollowed(event: UserUnfollowedEvent): void {
    this.dispatch(event);
  }
}
