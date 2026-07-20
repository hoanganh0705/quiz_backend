/**
 * Shared Tournament Event Bus Adapter
 *
 * Phase 3 / Issue #41 — REMOVED dual delivery.
 *
 * Previously this adapter subscribed to the internal `TournamentDomainEventBus`
 * and forwarded events to the shared bus, creating a duplicate delivery path:
 *
 *   Path A: Internal bus → SharedTournamentEventBusAdapter → shared bus subscribers
 *   Path B: Outbox → TournamentOutboxProcessorService → shared bus (direct publish)
 *
 * With the transactional outbox, `TournamentOutboxProcessorService` now dispatches
 * directly to both the internal bus AND the shared bus in a single operation,
 * so the `SharedTournamentEventBusAdapter` no longer needs to subscribe to the
 * internal bus. The shared bus consumers now receive events from exactly one
 * source: the outbox processor's direct publish call.
 *
 * This adapter is kept as a thin pass-through for any direct subscribers
 * to the shared bus port. It does NOT subscribe to the internal bus.
 */

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
