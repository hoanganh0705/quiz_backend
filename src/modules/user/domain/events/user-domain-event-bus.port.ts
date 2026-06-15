import type {
  UserProfileUpdatedEvent,
  UserSettingsUpdatedEvent,
  UserStreakUpdatedEvent,
} from './user-domain.events';

export const USER_DOMAIN_EVENT_BUS = Symbol('USER_DOMAIN_EVENT_BUS');

export interface UserDomainEventBusPort {
  subscribe(handler: (event: unknown) => void): () => void;
  emitProfileUpdated(event: UserProfileUpdatedEvent): void;
  emitSettingsUpdated(event: UserSettingsUpdatedEvent): void;
  emitStreakUpdated(event: UserStreakUpdatedEvent): void;
}
