/**
 * Daily-challenge domain event bus.
 *
 * Mirrors the other module-local buses (Attempt, User) — simple
 * observer pattern, in-process, no Redis. Until Phase 3 there was no
 * event surface on this module, so this bus is brand-new and the
 * only consumer today is `DailyChallengeCoinListenerAdapter`.
 *
 * Capacity for future consumers: a real-time "today's results"
 * ticker, an "I did today's challenge" notification, etc.
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { DailyChallengeDomainEvent } from './daily-challenge-domain.events';

type Handler = (event: DailyChallengeDomainEvent) => void | Promise<void>;

@Injectable()
export class DailyChallengeDomainEventBus implements OnModuleDestroy {
  private handlers: Handler[] = [];

  constructor(
    @InjectPinoLogger(DailyChallengeDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleDestroy(): void {
    this.handlers = [];
  }

  subscribe(handler: Handler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) this.handlers.splice(idx, 1);
    };
  }

  emitCompleted(event: DailyChallengeDomainEvent): void {
    this.logger.debug({
      event: 'daily_challenge_event_emitted',
      eventType: 'daily_challenge.completed',
      challengeId: event.challengeId,
      userId: event.userId,
    });
    this.dispatch(event);
  }

  private dispatch(event: DailyChallengeDomainEvent): void {
    for (const handler of this.handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            this.logger.error({
              event: 'daily_challenge_event_handler_error',
              eventType: event.eventType,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        this.logger.error({
          event: 'daily_challenge_event_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

export const DAILY_CHALLENGE_DOMAIN_EVENT_BUS = Symbol('DAILY_CHALLENGE_DOMAIN_EVENT_BUS');
