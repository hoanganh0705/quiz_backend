/**
 * Coin Domain Event Bus
 *
 * Lightweight in-process pub/sub. Same observer-pattern shape as the
 * `RankingDomainEventBus` — handlers are push-down, errors are caught
 * and logged per-handler so one misbehaving subscriber cannot starve the
 * rest.
 *
 * Lifetime is bound to the application lifecycle: subscribers registered
 * in `OnModuleInit` are torn down implicitly when the process exits.
 * Long-running adapters store their unsubscribe handle in a private
 * field and call it in `OnModuleDestroy` to be tidy.
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { CoinBalanceChangedEvent, CoinTransactionRecordedEvent } from './coin-domain.events';
import type { CoinDomainEventBusPort } from './coin-domain-event-bus.port';
import type { CoinDomainEvent } from './coin-domain.events';

type CoinEventHandler = (event: CoinDomainEvent) => void;

@Injectable()
export class CoinDomainEventBus implements CoinDomainEventBusPort, OnModuleDestroy {
  private handlers: CoinEventHandler[] = [];

  constructor(
    @InjectPinoLogger(CoinDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.handlers = [];
  }

  subscribe(handler: CoinEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emitBalanceChanged(event: CoinBalanceChangedEvent): void {
    this.logger.debug({
      event: 'coin_event_emitted',
      eventType: 'coin.balance_changed',
      userId: event.userId,
      delta: event.delta,
      reason: event.reason,
    });
    this.dispatch(event);
  }

  emitTransactionRecorded(event: CoinTransactionRecordedEvent): void {
    this.logger.debug({
      event: 'coin_event_emitted',
      eventType: 'coin.transaction_recorded',
      userId: event.userId,
      reason: event.reason,
    });
    this.dispatch(event);
  }

  private dispatch(event: CoinDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({
          event: 'coin_event_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export const COIN_DOMAIN_EVENT_BUS = Symbol('COIN_DOMAIN_EVENT_BUS');
