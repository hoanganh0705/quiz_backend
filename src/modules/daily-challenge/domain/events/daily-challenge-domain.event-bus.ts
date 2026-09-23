import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type { DailyChallengeDomainEvent } from './daily-challenge-domain.events';

type PendingPromise = Promise<void>;

@Injectable()
export class DailyChallengeDomainEventBus
  extends BaseDomainEventBus<DailyChallengeDomainEvent>
  implements OnModuleDestroy
{
  private pending: Set<PendingPromise> = new Set();

  constructor(
    @InjectPinoLogger(DailyChallengeDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'daily_challenge_event' });
  }

  async onModuleDestroy(): Promise<void> {
    this.clear();
    if (this.pending.size === 0) return;
    await Promise.allSettled(Array.from(this.pending));
    this.pending.clear();
  }

  subscribe(handler: (event: DailyChallengeDomainEvent) => void | Promise<void>): () => void {
    return super.subscribe(async (event) => {
      const result = handler(event);
      if (result instanceof Promise) {
        this.pending.add(result);
        try {
          await result;
        } finally {
          this.pending.delete(result);
        }
      }
    });
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
}

export const DAILY_CHALLENGE_DOMAIN_EVENT_BUS = Symbol('DAILY_CHALLENGE_DOMAIN_EVENT_BUS');
