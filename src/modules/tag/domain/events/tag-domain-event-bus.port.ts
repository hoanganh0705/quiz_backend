import {
  type TagCreatedEvent,
  type TagUpdatedEvent,
  type TagDeletedEvent,
  type TagRestoredEvent,
  type TagFollowedEvent,
  type TagUnfollowedEvent,
} from './tag-domain.events';

export const TAG_DOMAIN_EVENT_BUS = Symbol('TAG_DOMAIN_EVENT_BUS');

export interface TagDomainEventBusPort {
  subscribe(handler: (event: unknown) => void): () => void;
  emitTagCreated(event: TagCreatedEvent): void;
  emitTagUpdated(event: TagUpdatedEvent): void;
  emitTagDeleted(event: TagDeletedEvent): void;
  emitTagRestored(event: TagRestoredEvent): void;
  emitTagFollowed(event: TagFollowedEvent): void;
  emitTagUnfollowed(event: TagUnfollowedEvent): void;
}
