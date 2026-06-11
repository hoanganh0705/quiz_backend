import { Injectable } from '@nestjs/common';
import type { TournamentDomainEventBusPort } from '../../domain/ports/tournament-domain-event-bus.port';
import type { TournamentDomainEvent } from '../../domain/events';

@Injectable()
export class InMemoryTournamentDomainEventBus implements TournamentDomainEventBusPort {
  private handlers: Array<(event: TournamentDomainEvent) => void> = [];

  subscribe(handler: (event: TournamentDomainEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  publish(event: TournamentDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in tournament event handler:', error);
      }
    }
  }
}
