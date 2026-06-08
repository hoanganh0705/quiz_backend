import { Injectable } from '@nestjs/common';
import type { TournamentDomainEventBusPort } from '../../domain/ports/tournament-domain-event-bus.port';

@Injectable()
export class InMemoryTournamentDomainEventBus implements TournamentDomainEventBusPort {
  publish(event: unknown): void {
    void event;
  }
}
