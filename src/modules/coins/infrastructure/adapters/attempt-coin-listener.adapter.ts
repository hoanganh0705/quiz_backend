import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ATTEMPT_DOMAIN_EVENT_BUS,
  type AttemptDomainEventBusPort,
} from '@/modules/attempt/domain/events/attempt-domain-event-bus.port';
import type { AttemptCompletedEvent } from '@/modules/attempt/domain/events/attempt-domain.events';
import {
  COIN_INGESTION_PORT,
  type CoinIngestionPort,
} from '../../domain/ports/coin-ingestion.port';
import { COIN_REWARDS } from '../../coin.constants';

@Injectable()
export class AttemptCoinListenerAdapter implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(ATTEMPT_DOMAIN_EVENT_BUS)
    private readonly attemptBus: AttemptDomainEventBusPort,
    @Inject(COIN_INGESTION_PORT)
    private readonly coinIngestion: CoinIngestionPort,
    @InjectPinoLogger(AttemptCoinListenerAdapter.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.attemptBus.subscribe(this.onEvent.bind(this));
    this.logger.info({ event: 'attempt_coin_listener_started' });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async onEvent(event: unknown): Promise<void> {
    if (!this.isAttemptCompleted(event)) return;

    const passed = this.isPassingScore(event.scorePercent);
    const isPerfect = event.scorePercent === '100.00';
    if (!passed && !isPerfect) return;

    try {
      if (passed) {
        await this.coinIngestion.processCoinEvent({
          userId: event.userId,
          source: 'attempt',
          amount: COIN_REWARDS.QUIZ_COMPLETION_REWARD,
          reason: 'QUIZ_COMPLETION_REWARD',
          referenceId: event.attemptId,
        });
      }

      if (isPerfect) {
        await this.coinIngestion.processCoinEvent({
          userId: event.userId,
          source: 'attempt',
          amount: COIN_REWARDS.QUIZ_PERFECT_BONUS,
          reason: 'QUIZ_PERFECT_BONUS',
          referenceId: event.attemptId,
        });
      }

      this.logger.debug({
        event: 'attempt_coin_grant_processed',
        userId: event.userId,
        attemptId: event.attemptId,
        passed,
        isPerfect,
      });
    } catch (error) {
      this.logger.error({
        event: 'attempt_coin_listener_error',
        userId: event.userId,
        attemptId: event.attemptId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isPassingScore(scorePercent: string): boolean {
    const numeric = Number(scorePercent);
    return Number.isFinite(numeric) && numeric > 0;
  }

  private isAttemptCompleted(event: unknown): event is AttemptCompletedEvent {
    return (
      event instanceof Object &&
      'eventType' in event &&
      (event as { eventType: unknown }).eventType === 'attempt.completed'
    );
  }
}
