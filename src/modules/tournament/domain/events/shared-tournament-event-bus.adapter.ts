import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  type SharedTournamentEventBusPort,
  type SharedTournamentDomainEvent,
} from '@/common/events/tournament-shared-events';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';

const SHARED_TOURNAMENT_FANOUT_TTL_SECONDS = 30;

@Injectable()
export class SharedTournamentEventBusAdapter implements SharedTournamentEventBusPort {
  private sharedHandlers: Array<(event: SharedTournamentDomainEvent) => void> = [];

  constructor(
    @InjectPinoLogger(SharedTournamentEventBusAdapter.name)
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider | null,
  ) {}

  subscribe(handler: (event: SharedTournamentDomainEvent) => void): () => void {
    this.sharedHandlers.push(handler);
    return () => {
      const index = this.sharedHandlers.indexOf(handler);
      if (index !== -1) {
        this.sharedHandlers.splice(index, 1);
      }
    };
  }

  publish(event: SharedTournamentDomainEvent): void {
    const fanoutKey = buildTournamentFanoutKey(event);
    if (fanoutKey && this.cache) {
      void this.tryClaimFanout(fanoutKey, event, this.cache);
      return;
    }

    this.dispatchToHandlers(event);
  }

  private async tryClaimFanout(
    fanoutKey: string,
    event: SharedTournamentDomainEvent,
    cache: CacheProvider,
  ): Promise<void> {
    let claimed: boolean;
    try {
      claimed = await cache.setIfNotExistsWithTtlSeconds(
        fanoutKey,
        '1',
        SHARED_TOURNAMENT_FANOUT_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn({
        event: 'shared_tournament_fanout_dedupe_unavailable',
        eventType: event.eventType,
        message: error instanceof Error ? error.message : String(error),
      });
      claimed = true;
    }

    if (!claimed) {
      this.logger.debug({
        event: 'shared_tournament_fanout_skipped_duplicate',
        eventType: event.eventType,
        fanoutKey,
      });
      return;
    }

    this.dispatchToHandlers(event);
  }

  private dispatchToHandlers(event: SharedTournamentDomainEvent): void {
    for (const handler of this.sharedHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'shared_tournament_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function buildTournamentFanoutKey(event: SharedTournamentDomainEvent): string | null {
  if (typeof event.tournamentId !== 'string' || typeof event.userId !== 'string') {
    return null;
  }
  return `shared:tournament:fanout:${event.eventType}:${event.userId}:${event.tournamentId}`;
}
