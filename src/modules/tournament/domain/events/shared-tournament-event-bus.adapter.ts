/**
 * Shared Tournament Event Bus Adapter
 *
 * Bridges the internal TournamentDomainEventBus to the shared tournament event bus port.
 * Re-emits Tournament domain events as SharedTournamentDomainEvent types so that
 * external consumers (Achievement, Social) receive well-defined, stable types
 * rather than depending on Tournament module internals.
 *
 * This adapter subscribes to the internal bus and re-emits events on the shared bus.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  type SharedTournamentEventBusPort,
  type SharedTournamentDomainEvent,
  type SharedTournamentJoinedEvent,
  type SharedTournamentParticipantWithdrawnEvent,
  type SharedTournamentWonEvent,
} from '@/common/events/tournament-shared-events';
import type { TournamentDomainEventBusPort } from '../ports/tournament-domain-event-bus.port';
import { TOURNAMENT_DOMAIN_EVENT_BUS } from '../ports';
import type {
  TournamentJoinedEvent,
  TournamentParticipantWithdrawnEvent,
  TournamentWonEvent,
} from '../events';

@Injectable()
export class SharedTournamentEventBusAdapter
  implements SharedTournamentEventBusPort, OnModuleInit, OnModuleDestroy
{
  private sharedHandlers: Array<(event: SharedTournamentDomainEvent) => void> = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly internalBus: TournamentDomainEventBusPort,
    @InjectPinoLogger(SharedTournamentEventBusAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.internalBus.subscribe((event) => {
      void this.forwardToSharedBus(event);
    });

    this.logger.info({
      event: 'shared_tournament_event_bus_adapter_subscribed',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  subscribe(handler: (event: SharedTournamentDomainEvent) => void): () => void {
    this.sharedHandlers.push(handler);
    return () => {
      const index = this.sharedHandlers.indexOf(handler);
      if (index !== -1) {
        this.sharedHandlers.splice(index, 1);
      }
    };
  }

  private forwardToSharedBus(event: unknown): void {
    const sharedEvent = this.toSharedEvent(event);
    if (!sharedEvent) return;

    for (const handler of this.sharedHandlers) {
      try {
        handler(sharedEvent);
      } catch (error) {
        this.logger.error({
          event: 'shared_tournament_handler_error',
          eventType: sharedEvent.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private toSharedEvent(event: unknown): SharedTournamentDomainEvent | null {
    if (!event || typeof event !== 'object' || !('eventType' in event)) {
      return null;
    }
    const e = event as { eventType: string };

    switch (e.eventType) {
      case 'tournament.joined':
        return this.toSharedTournamentJoined(event as TournamentJoinedEvent);
      case 'tournament.participant.withdrawn':
        return this.toSharedTournamentParticipantWithdrawn(
          event as TournamentParticipantWithdrawnEvent,
        );
      case 'tournament.won':
        return this.toSharedTournamentWon(event as TournamentWonEvent);
      default:
        return null;
    }
  }

  private toSharedTournamentJoined(event: TournamentJoinedEvent): SharedTournamentJoinedEvent {
    return {
      eventType: 'tournament.joined',
      tournamentId: event.tournamentId,
      userId: event.userId,
      tournamentTitle: event.tournamentTitle,
      timestamp: event.occurredAt,
    };
  }

  private toSharedTournamentParticipantWithdrawn(
    event: TournamentParticipantWithdrawnEvent,
  ): SharedTournamentParticipantWithdrawnEvent {
    return {
      eventType: 'tournament.participant.withdrawn',
      tournamentId: event.tournamentId,
      userId: event.userId,
      timestamp: event.withdrawnAt,
    };
  }

  private toSharedTournamentWon(event: TournamentWonEvent): SharedTournamentWonEvent {
    return {
      eventType: 'tournament.won',
      tournamentId: event.tournamentId,
      userId: event.userId,
      tournamentTitle: event.tournamentTitle,
      rank: event.rank,
      timestamp: event.timestamp,
    };
  }
}
