/**
 * User Profile Domain Events
 */

export interface ProfileInitializedEvent {
  readonly eventType: 'profile.initialized';
  readonly userId: string;
  readonly timestamp: Date;
}

export interface ProfileUpdatedEvent {
  readonly eventType: 'profile.updated';
  readonly userId: string;
  readonly changes: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface ProfileVisibilityChangedEvent {
  readonly eventType: 'profile.visibility_changed';
  readonly userId: string;
  readonly isPublic: boolean;
  readonly timestamp: Date;
}

export type ProfileDomainEvent =
  | ProfileInitializedEvent
  | ProfileUpdatedEvent
  | ProfileVisibilityChangedEvent;
