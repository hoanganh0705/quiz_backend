/**
 * Social Domain Event Bus Port
 *
 * Defines the interface for publishing and subscribing to social domain events.
 */

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
} from '../events/social-domain.events';

export interface SocialDomainEventBusPort {
  subscribe(handler: (event: SocialDomainEvent) => void): () => void;

  emitFriendRequestSent(event: FriendRequestSentEvent): void;
  emitFriendRequestAccepted(event: FriendRequestAcceptedEvent): void;
  emitFriendRequestRejected(event: FriendRequestRejectedEvent): void;
  emitFriendRequestCancelled(event: FriendRequestCancelledEvent): void;
  emitFriendRemoved(event: FriendRemovedEvent): void;
  emitUserBlocked(event: UserBlockedEvent): void;
  emitUserUnblocked(event: UserUnblockedEvent): void;
  emitUserFollowed(event: UserFollowedEvent): void;
  emitUserUnfollowed(event: UserUnfollowedEvent): void;
}

export type SocialDomainEvent =
  | FriendRequestSentEvent
  | FriendRequestAcceptedEvent
  | FriendRequestRejectedEvent
  | FriendRequestCancelledEvent
  | FriendRemovedEvent
  | UserBlockedEvent
  | UserUnblockedEvent
  | UserFollowedEvent
  | UserUnfollowedEvent;

export const SOCIAL_DOMAIN_EVENT_BUS = Symbol('SOCIAL_DOMAIN_EVENT_BUS');
