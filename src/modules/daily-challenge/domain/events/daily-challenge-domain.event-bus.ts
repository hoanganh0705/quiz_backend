import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { DailyChallengeDomainEvent } from './daily-challenge-domain.events';

type Handler = (event: DailyChallengeDomainEvent) => void | Promise<void>;
type PendingPromise = Promise<void>;

@Injectable()
export class DailyChallengeDomainEventBus implements OnModuleDestroy {
  private handlers: Handler[] = [];
  private pending: Set<PendingPromise> = new Set();

  constructor(
    @InjectPinoLogger(DailyChallengeDomainEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.handlers = [];
    if (this.pending.size === 0) return;
    await Promise.allSettled(Array.from(this.pending));
    this.pending.clear();
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
          this.pending.add(result);
          result
            .catch((error) => {
              this.logger.error({
                event: 'daily_challenge_event_handler_error',
                eventType: event.eventType,
                error: error instanceof Error ? error.message : String(error),
              });
            })
            .finally(() => {
              this.pending.delete(result);
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
