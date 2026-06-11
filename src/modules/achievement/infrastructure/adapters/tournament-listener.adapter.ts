/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers achievement evaluation.
 * This adapter bridges the Tournament domain to the Achievement domain.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from '@/modules/tournament/domain/ports/tournament-domain-event-bus.port';
import type {
  TournamentDomainEvent,
  TournamentWonEvent,
  TournamentJoinedEvent,
} from '@/modules/tournament/domain/events';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';

@Injectable()
export class TournamentEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly tournamentEventBus: TournamentDomainEventBusPort,
    @InjectPinoLogger(TournamentEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
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
    switch (event.eventType) {
      case 'tournament.won':
        await this.handleTournamentWon(event);
        break;
      case 'tournament.joined':
        await this.handleTournamentParticipation(event);
        break;
    }
  }

  async handleTournamentWon(event: TournamentWonEvent): Promise<void> {
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
        userId: event.userId,
        tournamentId: event.tournamentId,
        rank: event.rank,
        badgesAwarded: results.filter((r) => r.awarded).length,
        results,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_won_evaluation_failed',
        userId: event.userId,
        tournamentId: event.tournamentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async handleTournamentParticipation(event: TournamentJoinedEvent): Promise<void> {
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'tournament.participated',
        eventData: {
          tournamentId: event.tournamentId,
          participated: true,
        },
      });

      this.logger.info({
        event: 'tournament_participation_evaluated',
        userId: event.userId,
        tournamentId: event.tournamentId,
        badgesAwarded: results.filter((r) => r.awarded).length,
        results,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_participation_evaluation_failed',
        userId: event.userId,
        tournamentId: event.tournamentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
