import { Injectable } from '@nestjs/common';
import type {
  TagCreatedEvent,
  TagUpdatedEvent,
  TagDeletedEvent,
  TagRestoredEvent,
  TagFollowedEvent,
  TagUnfollowedEvent,
} from './tag-domain.events';
import type { TagDomainEventBusPort } from './tag-domain-event-bus.port';

@Injectable()
export class TagDomainEventBus implements TagDomainEventBusPort {
  private handlers: Array<(event: unknown) => void> = [];

  subscribe(handler: (event: unknown) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: unknown): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  emitTagCreated(event: TagCreatedEvent): void {
    this.emit(event);
  }

  emitTagUpdated(event: TagUpdatedEvent): void {
    this.emit(event);
  }

  emitTagDeleted(event: TagDeletedEvent): void {
    this.emit(event);
  }

  emitTagRestored(event: TagRestoredEvent): void {
    this.emit(event);
  }

  emitTagFollowed(event: TagFollowedEvent): void {
    this.emit(event);
  }

  emitTagUnfollowed(event: TagUnfollowedEvent): void {
    this.emit(event);
  }
}
