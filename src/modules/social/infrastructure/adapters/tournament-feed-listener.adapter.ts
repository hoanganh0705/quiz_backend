import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TOURNAMENT_DOMAIN_EVENT_BUS, type TournamentDomainEventBusPort } from '@/modules/tournament/domain/ports/tournament-domain-event-bus.port';
import { TournamentJoinedEvent } from '@/modules/tournament/domain/events/tournament-joined.event';
import { TournamentParticipantWithdrawnEvent } from '@/modules/tournament/domain/events/tournament-participant-withdrawn.event';
import { SocialService } from '../../domain/services/social.service';

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
    this.unsubscribe = this.tournamentEventBus.subscribe((event) => {
      void this.handleEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async handleEvent(event: unknown): Promise<void> {
    if (event instanceof TournamentJoinedEvent) {
      await this.socialService.recordFeedActivity({
        userId: event.userId,
        activityType: 'tournament_joined',
        occurredAt: event.occurredAt.toISOString(),
        payload: {
          tournamentId: event.tournamentId,
        },
      });
      return;
    }

    if (event instanceof TournamentParticipantWithdrawnEvent) {
      this.logger.debug({
        event: 'social_feed_ignoring_tournament_withdrawn',
        tournamentId: event.tournamentId,
        userId: event.userId,
      });
    }
  }
}
