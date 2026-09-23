import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  COIN_DOMAIN_EVENT_BUS,
  type CoinDomainEventBusPort,
} from '../../domain/events/coin-domain-event-bus.port';
import type { CoinDomainEvent } from '../../domain/events/coin-domain.events';
import { CoinGateway } from '../../transport/gateway/coin.gateway';

@Injectable()
export class CoinWebSocketListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribers: Array<() => void> = [];

  constructor(
    @Inject(COIN_DOMAIN_EVENT_BUS)
    private readonly coinEventBus: CoinDomainEventBusPort,
    private readonly coinGateway: CoinGateway,
    @InjectPinoLogger(CoinWebSocketListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.unsubscribers.push(
      this.coinEventBus.subscribe((event: CoinDomainEvent) => {
        this.handleEvent(event);
      }),
    );

    this.logger.info({
      event: 'coin_ws_listener_subscribed',
    });
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.unsubscribers) {
      try {
        unsubscribe();
      } catch (error) {
        this.logger.warn({
          event: 'coin_ws_listener_unsubscribe_failed',
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
    this.unsubscribers = [];
  }

  private handleEvent(event: CoinDomainEvent): void {
    try {
      this.coinGateway.pushToUser(event);
    } catch (error) {
      this.logger.error({
        event: 'coin_ws_push_failed',
        eventType: event.eventType,
        userId: event.userId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
