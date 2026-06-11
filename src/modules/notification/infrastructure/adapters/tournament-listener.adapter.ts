/**
 * Tournament Event Listener Adapter
 *
 * Listens to Tournament domain events and triggers notifications.
 * This adapter bridges the Tournament domain to the Notification domain.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from '@/modules/tournament/domain/ports/tournament-domain-event-bus.port';
import {
  type TournamentDomainEvent,
  type TournamentWonEvent,
  type TournamentCompletedEvent,
  type TournamentStartingSoonEvent,
} from '@/modules/tournament/domain/events';
import { TournamentNotificationService } from '../../domain/services/tournament-notification.service';

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
    this.unsubscribe = this.tournamentEventBus.subscribe((event: TournamentDomainEvent) => {
      void this.handleEvent(event);
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
