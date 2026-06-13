import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  TOURNAMENT_DOMAIN_EVENT_BUS,
  type TournamentDomainEventBusPort,
} from '@/modules/tournament/domain/ports/tournament-domain-event-bus.port';
import type { TournamentDomainEvent } from '@/modules/tournament/domain/events';
import { SocialService } from '../../domain/services/social.service';
import { getCorrelationId, createCorrelationId } from '@/common/interceptors/correlation-id';

@Injectable()
export class TournamentFeedListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(TOURNAMENT_DOMAIN_EVENT_BUS)
    private readonly tournamentEventBus: TournamentDomainEventBusPort,
    private readonly socialService: SocialService,
    @InjectPinoLogger(TournamentFeedListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.tournamentEventBus.subscribe((event: TournamentDomainEvent) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: TournamentDomainEvent): Promise<void> {
    const correlationId = getCorrelationId() ?? createCorrelationId();

    switch (event.eventType) {
      case 'tournament.joined':
        await this.socialService.recordFeedActivity({
          userId: event.userId,
          activityType: 'tournament_joined',
          occurredAt: event.occurredAt.toISOString(),
          payload: {
            tournamentId: event.tournamentId,
          },
        });
        break;
      case 'tournament.participant.withdrawn':
        this.logger.debug({
          event: 'social_feed_ignoring_tournament_withdrawn',
          correlationId,
          tournamentId: event.tournamentId,
          userId: event.userId,
        });
        break;
    }
  }
}
