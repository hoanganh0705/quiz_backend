/**
 * Shared External Event Bus
 *
 * A singleton in-process event bus for events that cross module boundaries.
 * Modules publish events here so that other modules can subscribe without
 * creating circular imports or hard module-level dependencies.
 *
 * Currently handles: `external.xp.earned` (from Attempt → Ranking).
 *
 * Extensible: add more cross-domain event types here as needed.
 */

import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { correlationIdStorage } from '@/common/interceptors/correlation-id';

export const EXTERNAL_EVENT_BUS = Symbol('EXTERNAL_EVENT_BUS');

/**
 * Port interface for the external event bus.
 *
 * The producer side (modules that publish `external.xp.earned`) only needs the
 * `publishXpEarned` method, so it should inject `EXTERNAL_EVENT_BUS_PRODUCER_PORT`.
 * The consumer side only needs `subscribe`, so it should inject
 * `EXTERNAL_EVENT_BUS_CONSUMER_PORT`. This split keeps producers from
 * accidentally depending on the subscription surface (and vice versa), and
 * matches the producer-side pattern used by Attempt / Tournament.
 */
export interface ExternalEventBusProducerPort {
  publishXpEarned(event: ExternalXpEarnedEvent): void;
}

export interface ExternalEventBusConsumerPort {
  subscribe(eventType: string, handler: (event: ExternalEvent) => void): () => void;
}

export const EXTERNAL_EVENT_BUS_PRODUCER_PORT = Symbol('EXTERNAL_EVENT_BUS_PRODUCER_PORT');
export const EXTERNAL_EVENT_BUS_CONSUMER_PORT = Symbol('EXTERNAL_EVENT_BUS_CONSUMER_PORT');

/**
 * Legacy aggregate port retained for backward compatibility. New code should
 * use the narrower producer/consumer ports.
 */
export interface ExternalEventBusPort
  extends ExternalEventBusProducerPort, ExternalEventBusConsumerPort {}

/**
 * Shared external XP-earned event payload.
 *
 * Includes an optional `correlationId` so that handlers in downstream modules
 * (Ranking, etc.) can join their own log lines to the originating request
 * chain. Producers should set this from `getCorrelationId()` (falling back to
 * a freshly-generated UUID via `createCorrelationId()`) at publish time; the
 * `CommonExternalEventBus.publish()` method automatically restores it into
 * the module-level `correlationIdStorage` AsyncLocalStorage before invoking
 * any subscriber, so consumers can simply call `getCorrelationId()` and read
 * the same ID without having to thread it through their own bookkeeping.
 */
export interface ExternalXpEarnedEvent {
  readonly eventType: 'external.xp.earned';
  readonly userId: string;
  readonly amount: number;
  readonly source: 'quiz_attempt' | 'tournament' | 'bonus' | 'achievement';
  readonly attemptId?: string;
  readonly tournamentId?: string;
  readonly categoryId?: string;
  readonly timestamp: Date;
  readonly correlationId?: string;
}

export type ExternalEvent = ExternalXpEarnedEvent;

type ExternalEventHandler = (event: ExternalEvent) => void | Promise<void>;

@Injectable()
export class CommonExternalEventBus implements ExternalEventBusPort {
  private readonly handlers: Map<string, Set<ExternalEventHandler>> = new Map();

  constructor(
    @InjectPinoLogger(CommonExternalEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Subscribe to a specific external event type.
   */
  subscribe(eventType: string, handler: ExternalEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const typeHandlers = this.handlers.get(eventType)!;
    typeHandlers.add(handler);

    this.logger.debug({
      event: 'external_event_subscription_created',
      eventType,
    });

    return () => {
      typeHandlers.delete(handler);
      this.logger.debug({
        event: 'external_event_subscription_removed',
        eventType,
      });
    };
  }

  /**
   * Publish an external XP earned event.
   */
  publishXpEarned(event: ExternalXpEarnedEvent): void {
    this.publish(event);
  }

  private publish(event: ExternalEvent): void {
    this.logger.info({
      event: 'external_event_published',
      eventType: event.eventType,
      userId: event.userId,
      correlationId: event.correlationId,
    });

    const typeHandlers = this.handlers.get(event.eventType);
    if (!typeHandlers || typeHandlers.size === 0) return;

    for (const handler of typeHandlers) {
      // Restore the originating correlation ID (if present) into the
      // module-level AsyncLocalStorage so downstream consumers can read it via
      // `getCorrelationId()` without any extra plumbing on their end.
      const dispatch = () => {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((error) => {
              this.logger.error({
                event: 'external_event_handler_error',
                eventType: event.eventType,
                correlationId: event.correlationId,
                error: error instanceof Error ? error.message : String(error),
              });
            });
          }
        } catch (error) {
          this.logger.error({
            event: 'external_event_handler_error',
            eventType: event.eventType,
            correlationId: event.correlationId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      if (event.correlationId) {
        correlationIdStorage.run({ correlationId: event.correlationId }, dispatch);
      } else {
        dispatch();
      }
    }
  }
}
