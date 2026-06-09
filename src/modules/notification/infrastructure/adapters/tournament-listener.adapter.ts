/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers notifications.
 * This adapter bridges the Tournament domain to the Notification domain.
 */

import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from '@/modules/tournament/domain/ports/tournament-domain-event-bus.port';
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
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly tournamentEventBus: TournamentDomainEventBusPort,
    @InjectPinoLogger(TournamentListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();

    this.logger.info({
      event: 'notification_tournament_listener_initialized',
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private subscribe(): void {
    this.unsubscribe = this.tournamentEventBus.subscribe((event) => {
      void this.handleEvent(event as TournamentDomainEvent);
    });
  }

  private async handleEvent(event: TournamentDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'tournament.won':
        await this.handleTournamentWon(event);
        break;
      case 'tournament.completed':
        await this.handleTournamentCompleted(event);
        break;
      case 'tournament.starting_soon':
        await this.handleTournamentStartingSoon(event);
        break;
      case 'tournament.participated':
        this.logger.debug({
          event: 'tournament_participated_notification_ignored',
          userId: event.userId,
          tournamentId: event.tournamentId,
        });
        break;
    }
  }

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
