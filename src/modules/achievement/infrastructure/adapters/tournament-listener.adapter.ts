/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers achievement evaluation.
 * This adapter bridges the Tournament domain to the Achievement domain.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { createCorrelationId } from '@/common/interceptors/correlation-id';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from '@/modules/tournament/domain/ports/tournament-domain-event-bus.port';
import type {
  TournamentDomainEvent,
  TournamentWonEvent,
} from '@/modules/tournament/domain/events';
import { RuleEngineService } from '../../domain/services/rule-engine.service';

@Injectable()
export class AchievementTournamentEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly tournamentEventBus: TournamentDomainEventBusPort,
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
    this.unsubscribe = this.tournamentEventBus.subscribe((event: TournamentDomainEvent) => {
      void this.handleEvent(event);
    });

    this.logger.info({
      event: 'achievement_tournament_listener_subscribed',
    });
  }

  private async handleEvent(event: TournamentDomainEvent): Promise<void> {
    if (event.eventType === 'tournament.won') {
      await this.handleTournamentWon(event);
    }
  }

  private async handleTournamentWon(event: TournamentWonEvent): Promise<void> {
    const correlationId = createCorrelationId();

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
