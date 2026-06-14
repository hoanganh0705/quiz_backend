import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SHARED_TOURNAMENT_EVENT_BUS,
  type SharedTournamentEventBusPort,
  type SharedTournamentDomainEvent,
} from '@/common/events/tournament-shared-events';
import { SocialService } from '../../domain/services/social.service';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';

@Injectable()
export class TournamentFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(SHARED_TOURNAMENT_EVENT_BUS)
    private readonly tournamentEventBus: SharedTournamentEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(TournamentFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.tournamentEventBus.subscribe((event: SharedTournamentDomainEvent) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: SharedTournamentDomainEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    switch (event.eventType) {
      case 'tournament.joined':
        await this.socialService.recordFeedActivity({
          userId: event.userId,
          activityType: 'tournament_joined',
          occurredAt: event.timestamp.toISOString(),
          payload: {
            tournamentId: event.tournamentId,
          },
        });
        break;
      case 'tournament.participant.withdrawn':
        // Withdrawals are intentionally not broadcast to the social feed —
        // they reflect a user choice to step back from a public commitment and
        // are not the kind of activity friends want surfaced in their feed.
        // Log at info level for operational visibility (audit trail + dashboards)
        // without making the event publicly visible.
        this.logger.info({
          event: 'tournament_participant_withdrawn_observed',
          correlationId,
          tournamentId: event.tournamentId,
          userId: event.userId,
          withdrawnAt: event.timestamp.toISOString(),
        });
        break;
    }
  }
}
