/**
 * DailyChallenge → Coin Listener Adapter
 *
 * Subscribes to `DailyChallengeCompletedEvent` (the new in-process
 * bus on the daily-challenge module, introduced in this phase) and
 * grants `DAILY_CHALLENGE_REWARD` (15 coins) per completion.
 *
 * Idempotency key per §9.5: `coin:{userId}:daily:{challengeId}`.
 * The challenge row has a unique `challenge_id` per (UTC date,
 * challenge) so the same physical completion cannot trigger two
 * grants, even on a retry of the same `DailyChallengeCompletedEvent`.
 *
 * Daily cap: bypassed by product design — daily challenges are
 * once-per-day by construction so a cap would never trigger anyway,
 * but the flag is explicit for symmetry with the other once-per-
 * milestone adapters.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  DAILY_CHALLENGE_DOMAIN_EVENT_BUS,
  type DailyChallengeDomainEventBus,
} from '@/modules/daily-challenge/domain/events/daily-challenge-domain.event-bus';
import type { DailyChallengeCompletedEvent } from '@/modules/daily-challenge/domain/events/daily-challenge-domain.events';
import {
  COIN_INGESTION_PORT,
  type CoinIngestionPort,
} from '../../domain/ports/coin-ingestion.port';
import { COIN_REWARDS } from '../../coin.constants';

@Injectable()
export class DailyChallengeCoinListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(DAILY_CHALLENGE_DOMAIN_EVENT_BUS)
    private readonly dailyChallengeBus: DailyChallengeDomainEventBus,
    @Inject(COIN_INGESTION_PORT)
    private readonly coinIngestion: CoinIngestionPort,
    @InjectPinoLogger(DailyChallengeCoinListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.dailyChallengeBus.subscribe(this.onCompleted.bind(this));
    this.logger.info({ event: 'daily_challenge_coin_listener_started' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async onCompleted(event: DailyChallengeCompletedEvent): Promise<void> {
    try {
      await this.coinIngestion.processCoinEvent({
        userId: event.userId,
        source: 'daily',
        amount: COIN_REWARDS.DAILY_CHALLENGE_REWARD,
        reason: 'DAILY_CHALLENGE_REWARD',
        referenceId: event.challengeId,
        metadata: {
          challengeId: event.challengeId,
          scorePercent: event.scorePercent,
          correctCount: event.correctCount,
          totalQuestions: event.totalQuestions,
          completedAt: event.completedAtIso,
        },
        applyDailyCap: false,
      });

      this.logger.info({
        event: 'daily_challenge_coin_grant_processed',
        userId: event.userId,
        challengeId: event.challengeId,
        amount: COIN_REWARDS.DAILY_CHALLENGE_REWARD,
      });
    } catch (error) {
      this.logger.error({
        event: 'daily_challenge_coin_listener_error',
        userId: event.userId,
        challengeId: event.challengeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
