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

export const EXTERNAL_EVENT_BUS = Symbol('EXTERNAL_EVENT_BUS');

export interface ExternalEventBusPort {
  subscribe(eventType: string, handler: (event: ExternalEvent) => void): () => void;
  publishXpEarned(event: ExternalXpEarnedEvent): void;
}

export interface ExternalXpEarnedEvent {
  readonly eventType: 'external.xp.earned';
  readonly userId: string;
  readonly amount: number;
  readonly source: 'quiz_attempt' | 'tournament' | 'bonus' | 'achievement';
  readonly attemptId?: string;
  readonly tournamentId?: string;
  readonly categoryId?: string;
  readonly timestamp: Date;
}

export type ExternalEvent = ExternalXpEarnedEvent;

type ExternalEventHandler = (event: ExternalEvent) => void | Promise<void>;

@Injectable()
export class CommonExternalEventBus {
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
    });

    const typeHandlers = this.handlers.get(event.eventType);
    if (!typeHandlers || typeHandlers.size === 0) return;

    for (const handler of typeHandlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            this.logger.error({
              event: 'external_event_handler_error',
              eventType: event.eventType,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        this.logger.error({
          event: 'external_event_handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
