/**
 * Social Domain Events
 *
 * Defines all events emitted by the Social Domain.
 */

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
  readonly addresseeUsername: string;
  readonly timestamp: Date;
}

export interface FriendRequestRejectedEvent {
  readonly eventType: 'friend_request_rejected';
  readonly friendshipId: string;
  readonly requesterId: string;
  readonly addresseeId: string;
  readonly timestamp: Date;
}

export interface FriendRequestCancelledEvent {
  readonly eventType: 'friend_request_cancelled';
  readonly friendshipId: string;
  readonly requesterId: string;
  readonly addresseeId: string;
  readonly timestamp: Date;
}

export interface FriendRemovedEvent {
  readonly eventType: 'friend_removed';
  readonly userId: string;
  readonly friendId: string;
  readonly timestamp: Date;
}

export interface UserBlockedEvent {
  readonly eventType: 'user_blocked';
  readonly blockerId: string;
  readonly blockedId: string;
  readonly reason: string | null;
  readonly timestamp: Date;
}

export interface UserUnblockedEvent {
  readonly eventType: 'user_unblocked';
  readonly blockerId: string;
  readonly blockedId: string;
  readonly timestamp: Date;
}

export interface UserFollowedEvent {
  readonly eventType: 'user_followed';
  readonly followId: string;
  readonly followerId: string;
  readonly followerUsername: string;
  readonly followingId: string;
  readonly followingUsername: string;
  readonly timestamp: Date;
}

export interface UserUnfollowedEvent {
  readonly eventType: 'user_unfollowed';
  readonly followerId: string;
  readonly followerUsername: string;
  readonly followingId: string;
  readonly followingUsername: string;
  readonly timestamp: Date;
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
