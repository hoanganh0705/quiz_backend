/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers notifications.
 * This adapter bridges the Tournament domain to the Notification domain.
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TournamentNotificationService } from '../../domain/services/tournament-notification.service';

export interface TournamentWonEvent {
  readonly eventType: 'tournament.won';
  readonly userId: string;
  readonly tournamentId: string;
  readonly tournamentTitle: string;
  readonly rank: number;
  readonly prize?: string;
  readonly timestamp: Date;
}

export interface TournamentParticipationEvent {
  readonly eventType: 'tournament.participated';
  readonly userId: string;
  readonly tournamentId: string;
  readonly tournamentTitle: string;
  readonly timestamp: Date;
}

export interface TournamentCompletedEvent {
  readonly eventType: 'tournament.completed';
  readonly userId: string;
  readonly tournamentId: string;
  readonly tournamentTitle: string;
  readonly rank: number;
  readonly totalParticipants: number;
  readonly timestamp: Date;
}

export interface TournamentStartingSoonEvent {
  readonly eventType: 'tournament.starting_soon';
  readonly userId: string;
  readonly tournamentId: string;
  readonly tournamentTitle: string;
  readonly startsAt: string;
  readonly timestamp: Date;
}

export type TournamentDomainEvent =
  | TournamentWonEvent
  | TournamentParticipationEvent
  | TournamentCompletedEvent
  | TournamentStartingSoonEvent;

@Injectable()
export class TournamentListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly tournamentNotificationService: TournamentNotificationService,
    @InjectPinoLogger(TournamentListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'notification_tournament_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /**
   * Handle tournament won event.
   */
  async handleTournamentWon(event: TournamentWonEvent): Promise<void> {
    try {
      await this.tournamentNotificationService.notifyTournamentWon({
        userId: event.userId,
        tournamentId: event.tournamentId,
        tournamentTitle: event.tournamentTitle,
        prize: event.prize,
      });

      this.logger.info({
        event: 'tournament_won_notification_triggered',
        userId: event.userId,
        tournamentId: event.tournamentId,
        rank: event.rank,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_won_notification_failed',
        userId: event.userId,
        tournamentId: event.tournamentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle tournament completed event.
   */
  async handleTournamentCompleted(event: TournamentCompletedEvent): Promise<void> {
    try {
      await this.tournamentNotificationService.notifyTournamentCompleted({
        userId: event.userId,
        tournamentId: event.tournamentId,
        tournamentTitle: event.tournamentTitle,
        rank: event.rank,
        totalParticipants: event.totalParticipants,
      });

      this.logger.info({
        event: 'tournament_completed_notification_triggered',
        userId: event.userId,
        tournamentId: event.tournamentId,
        rank: event.rank,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_completed_notification_failed',
        userId: event.userId,
        tournamentId: event.tournamentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle tournament starting soon event.
   */
  async handleTournamentStartingSoon(event: TournamentStartingSoonEvent): Promise<void> {
    try {
      await this.tournamentNotificationService.notifyTournamentStarting({
        userId: event.userId,
        tournamentId: event.tournamentId,
        tournamentTitle: event.tournamentTitle,
        startsAt: event.startsAt,
      });

      this.logger.info({
        event: 'tournament_starting_notification_triggered',
        userId: event.userId,
        tournamentId: event.tournamentId,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_starting_notification_failed',
        userId: event.userId,
        tournamentId: event.tournamentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
