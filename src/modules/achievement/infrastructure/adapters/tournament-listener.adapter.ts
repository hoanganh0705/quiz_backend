/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers achievement evaluation.
 * This adapter bridges the Tournament domain to the Achievement domain.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RuleEngineService } from '../../domain/services/rule-engine.service';
import { ACHIEVEMENT_REPOSITORY_PORT } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';

export interface TournamentWonEvent {
  readonly eventType: 'tournament.won';
  readonly userId: string;
  readonly tournamentId: string;
  readonly tournamentTitle: string;
  readonly rank: number;
  readonly timestamp: Date;
}

export interface TournamentParticipationEvent {
  readonly eventType: 'tournament.participated';
  readonly userId: string;
  readonly tournamentId: string;
  readonly tournamentTitle: string;
  readonly participatedAt: Date;
}

export interface TournamentMilestoneEvent {
  readonly eventType: 'tournament.milestone';
  readonly userId: string;
  readonly tournamentsWon: number;
  readonly milestone: number;
  readonly timestamp: Date;
}

export type TournamentDomainEvent =
  | TournamentWonEvent
  | TournamentParticipationEvent
  | TournamentMilestoneEvent;

@Injectable()
export class TournamentEventListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly ruleEngineService: RuleEngineService,
    @Inject(ACHIEVEMENT_REPOSITORY_PORT)
    private readonly achievementRepository: AchievementRepositoryPort,
    @InjectPinoLogger(TournamentEventListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.logger.info({
      event: 'achievement_tournament_listener_subscribed',
    });
  }

  /**
   * Handle tournament won event.
   */
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

  /**
   * Handle tournament participation event.
   */
  async handleTournamentParticipation(event: TournamentParticipationEvent): Promise<void> {
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

  /**
   * Handle tournament milestone event.
   */
  async handleTournamentMilestone(event: TournamentMilestoneEvent): Promise<void> {
    try {
      const results = await this.ruleEngineService.evaluateEvent({
        userId: event.userId,
        eventType: 'tournament.milestone',
        eventData: {
          tournamentsWon: event.tournamentsWon,
          milestone: event.milestone,
        },
      });

      this.logger.info({
        event: 'tournament_milestone_evaluated',
        userId: event.userId,
        tournamentsWon: event.tournamentsWon,
        milestone: event.milestone,
        badgesAwarded: results.filter((r) => r.awarded).length,
        results,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_milestone_evaluation_failed',
        userId: event.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
