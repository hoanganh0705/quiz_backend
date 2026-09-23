import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  EXTERNAL_EVENT_BUS_CONSUMER_PORT,
  type ExternalEventBusConsumerPort,
  type ExternalXpEarnedEvent,
} from '@/common/events';
import {
  COIN_INGESTION_PORT,
  type CoinIngestionPort,
} from '../../domain/ports/coin-ingestion.port';
import { COIN_REWARDS } from '../../coin.constants';

type TournamentPlacement = 1 | 2 | 3;

const TOURNAMENT_PLACEMENT_REWARDS = COIN_REWARDS.TOURNAMENT_PLACEMENT_REWARD;

@Injectable()
export class TournamentCoinListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(EXTERNAL_EVENT_BUS_CONSUMER_PORT)
    private readonly externalBus: ExternalEventBusConsumerPort,
    @Inject(COIN_INGESTION_PORT)
    private readonly coinIngestion: CoinIngestionPort,
    @InjectPinoLogger(TournamentCoinListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.externalBus.subscribe('external.xp.earned', this.onXpEarned.bind(this));
    this.logger.info({ event: 'tournament_coin_listener_started' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async onXpEarned(event: ExternalXpEarnedEvent): Promise<void> {
    if (event.source !== 'tournament') return;
    if (event.rank === undefined || event.rank === null) return;
    if (!this.isEligiblePlacement(event.rank)) return;
    if (!event.tournamentId) {
      this.logger.warn({
        event: 'tournament_coin_listener_missing_tournament_id',
        userId: event.userId,
        rank: event.rank,
      });
      return;
    }

    const placement = event.rank;
    const reward = TOURNAMENT_PLACEMENT_REWARDS[placement];
    if (!reward) return;

    try {
      await this.coinIngestion.processCoinEvent({
        userId: event.userId,
        source: 'tournament',
        amount: reward,
        reason: 'TOURNAMENT_PLACEMENT_REWARD',
        referenceId: `${event.tournamentId}:${placement}`,
        metadata: {
          tournamentId: event.tournamentId,
          rank: placement,
          xpAmount: event.amount,
        },
        applyDailyCap: false,
      });

      this.logger.info({
        event: 'tournament_coin_grant_processed',
        userId: event.userId,
        tournamentId: event.tournamentId,
        rank: placement,
        amount: reward,
      });
    } catch (error) {
      this.logger.error({
        event: 'tournament_coin_listener_error',
        userId: event.userId,
        tournamentId: event.tournamentId,
        rank: placement,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isEligiblePlacement(rank: number): rank is TournamentPlacement {
    return rank === 1 || rank === 2 || rank === 3;
  }
}
