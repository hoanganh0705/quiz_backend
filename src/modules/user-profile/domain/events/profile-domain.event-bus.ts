/**
 * Profile Domain Event Bus Implementation
 *
 * Simple in-process event bus using the observer pattern.
 */

import { Injectable } from '@nestjs/common';
import type {
  ProfileInitializedEvent,
  ProfileUpdatedEvent,
  ProfileVisibilityChangedEvent,
} from '../events/profile.events';
import { ProfileDomainEventBusPort } from '../ports/profile-event-bus.port';

type ProfileEvent = ProfileInitializedEvent | ProfileUpdatedEvent | ProfileVisibilityChangedEvent;

/**
 * In-memory event bus for profile domain events.
 */
@Injectable()
export class ProfileDomainEventBus implements ProfileDomainEventBusPort {
  private handlers: Array<(event: ProfileEvent) => void> = [];

  subscribe(handler: (event: ProfileEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  private emit(event: ProfileEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in profile event handler:', error);
      }
    }
  }

  emitProfileInitialized(event: ProfileInitializedEvent): void {
    this.emit(event);
  }

  emitProfileUpdated(event: ProfileUpdatedEvent): void {
    this.emit(event);
  }

  emitProfileVisibilityChanged(event: ProfileVisibilityChangedEvent): void {
    this.emit(event);
  }
}
