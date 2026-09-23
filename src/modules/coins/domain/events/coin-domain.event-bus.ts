import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import { RetryQueue } from '@/common/events/retry-queue';
import type {
  CoinBalanceChangedEvent,
  CoinRefundedEvent,
  CoinTransactionRecordedEvent,
} from './coin-domain.events';
import { COIN_DOMAIN_EVENT_BUS, type CoinDomainEventBusPort } from './coin-domain-event-bus.port';
import type { CoinDomainEvent } from './coin-domain.events';

export { COIN_DOMAIN_EVENT_BUS };

type CoinEventHandler = (event: CoinDomainEvent) => void;

@Injectable()
export class CoinDomainEventBus implements CoinDomainEventBusPort, OnModuleInit, OnModuleDestroy {
  private readonly retryQueue: RetryQueue<CoinDomainEvent>;

  constructor(
    @Inject(CACHE_PROVIDER) cache: CacheProvider,
    @InjectPinoLogger(CoinDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {
    this.retryQueue = new RetryQueue<CoinDomainEvent>(cache, logger, {
      retryQueuePrefix: 'coin:event_retry_queue',
      deadLetterKey: 'coin:event_dead_letter',
      retryDelaysMs: [5_000, 10_000, 20_000, 40_000, 80_000] as const,
      pollIntervalMs: 10_000,
      pollLockKey: 'coin:event_retry_poll_lock',
      pollLockTtlMs: 8_000,
      loggerName: CoinDomainEventBus.name,
    });
  }

  onModuleInit(): void {
    this.retryQueue.start();
  }

  onModuleDestroy(): void {
    this.retryQueue.stop();
  }

  subscribe(handler: CoinEventHandler): () => void {
    return this.retryQueue.subscribe((event: CoinDomainEvent) => {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'coin_event_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }

  emitBalanceChanged(event: CoinBalanceChangedEvent): void {
    this.logger.debug({
      event: 'coin_event_emitted',
      eventType: 'coin.balance_changed',
      userId: event.userId,
      delta: event.delta,
      reason: event.reason,
    });
    this.retryQueue.dispatch(event);
  }

  emitTransactionRecorded(event: CoinTransactionRecordedEvent): void {
    this.logger.debug({
      event: 'coin_event_emitted',
      eventType: 'coin.transaction_recorded',
      userId: event.userId,
      reason: event.reason,
    });
    this.retryQueue.dispatch(event);
  }

  emitRefunded(event: CoinRefundedEvent): void {
    this.logger.debug({
      event: 'coin_event_emitted',
      eventType: 'coin.refunded',
      userId: event.userId,
      refundAmount: event.refundAmount,
      refundReason: event.refundReason,
    });
    this.retryQueue.dispatch(event);
  }
}
