import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  type SharedTournamentEventBusPort,
  type SharedTournamentDomainEvent,
} from '@/common/events/tournament-shared-events';

@Injectable()
export class SharedTournamentEventBusAdapter implements SharedTournamentEventBusPort {
  private sharedHandlers: Array<(event: SharedTournamentDomainEvent) => void> = [];

  constructor(
    @InjectPinoLogger(SharedTournamentEventBusAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  subscribe(handler: (event: SharedTournamentDomainEvent) => void): () => void {
    this.sharedHandlers.push(handler);
    return () => {
      const index = this.sharedHandlers.indexOf(handler);
      if (index !== -1) {
        this.sharedHandlers.splice(index, 1);
      }
    };
  }

  publish(event: SharedTournamentDomainEvent): void {
    for (const handler of this.sharedHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'shared_tournament_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
