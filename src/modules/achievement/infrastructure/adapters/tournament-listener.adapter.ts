/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers achievement evaluation.
 * This adapter bridges the Tournament domain to the Achievement domain.
 *
 * Subscribes to SHARED_TOURNAMENT_EVENT_BUS (the cross-module shared kernel
 * for tournament events) rather than the internal Tournament bus, so
 * Achievement doesn't depend on Tournament internals.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  SHARED_TOURNAMENT_EVENT_BUS,
  type SharedTournamentEventBusPort,
  type SharedTournamentDomainEvent,
  type SharedTournamentWonEvent,
} from '@/common/events/tournament-shared-events';
import { RuleEngineService } from '../../domain/services/rule-engine.service';

@Injectable()
export class AchievementTournamentEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(SHARED_TOURNAMENT_EVENT_BUS)
    private readonly tournamentEventBus: SharedTournamentEventBusPort,
    @InjectPinoLogger(AchievementTournamentEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.tournamentEventBus.subscribe((event: SharedTournamentDomainEvent) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'achievement_tournament_listener_subscribed',
    });
  }

  private async handleEvent(event: SharedTournamentDomainEvent): Promise<void> {
    if (event.eventType === 'tournament.won') {
      await this.handleTournamentWon(event);
    }
  }

  private async handleTournamentWon(event: SharedTournamentWonEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'tournament.won',
        eventData: {
          tournamentId: event.tournamentId,
          tournamentTitle: event.tournamentTitle,
          rank: event.rank,
          tournamentsWon: 1,
        },
      });

      this.logger.info({
        event: 'tournament_won_evaluated',
        correlationId,
        userId: event.userId,
        tournamentId: event.tournamentId,
        rank: event.rank,
        badgesAwarded: results.filter((r) => r.awarded).length,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_won_evaluation_failed',
        correlationId,
        userId: event.userId,
        tournamentId: event.tournamentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
