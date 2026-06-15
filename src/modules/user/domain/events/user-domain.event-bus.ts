import { Injectable } from '@nestjs/common';
import type {
  UserProfileUpdatedEvent,
  UserSettingsUpdatedEvent,
  UserStreakUpdatedEvent,
} from './user-domain.events';
import type { UserDomainEventBusPort } from './user-domain-event-bus.port';

@Injectable()
export class UserDomainEventBus implements UserDomainEventBusPort {
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

  emitProfileUpdated(event: UserProfileUpdatedEvent): void {
    this.emit(event);
  }

  emitSettingsUpdated(event: UserSettingsUpdatedEvent): void {
    this.emit(event);
  }

  emitStreakUpdated(event: UserStreakUpdatedEvent): void {
    this.emit(event);
  }
}
