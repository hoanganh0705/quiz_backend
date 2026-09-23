/**
 * Shared External Event Bus
 *
 * A Redis pub/sub event bus for events that cross module boundaries.
 * Modules publish events here so that other modules can subscribe without
 * creating circular imports or hard module-level dependencies.
 *
 * Uses Redis pub/sub to support multi-instance deployments — every API
 * instance subscribes to the channel and receives all published events.
 * Within each instance, handlers are invoked synchronously with the
 * originating correlation ID restored via AsyncLocalStorage.
 *
 * Currently handles: `external.xp.earned` (from Attempt → Ranking).
 *
 * Extensible: add more cross-domain event types here as needed.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type Redis from 'ioredis';
import type { PubSubProvider } from '@/common/ports/pubsub.provider';
import { PUBSUB_PROVIDER } from '@/common/ports/pubsub.provider';
import { correlationIdStorage } from '@/common/interceptors/correlation-id';

export const EXTERNAL_EVENT_BUS = Symbol('EXTERNAL_EVENT_BUS');

const REDIS_CHANNEL = 'external:events';

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
  publishXpEarned(event: ExternalXpEarnedEvent): Promise<void>;
}

export interface ExternalEventBusConsumerPort {
  subscribe(eventType: string, handler: (event: ExternalEvent) => void): () => void;
}

export const EXTERNAL_EVENT_BUS_PRODUCER_PORT = Symbol('EXTERNAL_EVENT_BUS_PRODUCER_PORT');
export const EXTERNAL_EVENT_BUS_CONSUMER_PORT = Symbol('EXTERNAL_EVENT_BUS_CONSUMER_PORT');

/**
 * Aggregate port that exposes both producer and consumer capabilities.
 * Used by modules that need to publish and subscribe through the same
 * binding. Modules that only need one direction should inject the narrower
 * ExternalEventBusProducerPort or ExternalEventBusConsumerPort instead.
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
 * bus automatically restores it into the module-level `correlationIdStorage`
 * AsyncLocalStorage before invoking any subscriber, so consumers can simply
 * call `getCorrelationId()` and read the same ID without having to thread
 * it through their own bookkeeping.
 *
 * **Idempotency.** Every published XP event MUST carry a deterministic
 * `idempotencyKey` (e.g. `${tournamentId}:${userId}:${rank}` for tournament
 * XP, `xp:${userId}:attempt:${attemptId}` for attempt XP). Downstream
 * consumers (`XpIngestionService`) trust this key verbatim and must not
 * derive their own. Producers that omit the key cause `publishXpEarned` to
 * throw, surfacing the bug at integration time rather than letting it pass
 * through to a duplicate XP grant on retry.
 */
export interface ExternalXpEarnedEvent {
  readonly eventType: 'external.xp.earned';
  readonly userId: string;
  readonly amount: number;
  readonly source: 'quiz_attempt' | 'tournament' | 'bonus' | 'achievement';
  readonly attemptId?: string;
  readonly tournamentId?: string;
  readonly categoryId?: string;
  /** Tournament finish rank — used as part of the idempotency key for tournament XP. */
  readonly rank?: number;
  /** Achievement identifier — used as part of the idempotency key for achievement XP. */
  readonly achievementId?: string;
  /** Bonus identifier — used as part of the idempotency key for bonus XP. */
  readonly bonusId?: string;
  readonly timestamp: Date;
  readonly correlationId?: string;
  /**
   * Deterministic key for deduplication. Every producer must supply a stable
   * per-event value. Consumers trust this verbatim and do not derive their
   * own fallback.
   */
  readonly idempotencyKey: string;
}

export type ExternalEvent = ExternalXpEarnedEvent;

type ExternalEventHandler = (event: ExternalEvent) => void | Promise<void>;

interface SerializedExternalEvent {
  eventType: string;
  userId: string;
  amount: number;
  source: string;
  attemptId?: string;
  tournamentId?: string;
  categoryId?: string;
  rank?: number;
  achievementId?: string;
  bonusId?: string;
  timestamp: string;
  correlationId?: string;
  idempotencyKey?: string;
}

@Injectable()
export class CommonExternalEventBus implements ExternalEventBusPort, OnModuleInit, OnModuleDestroy {
  private readonly handlers: Map<string, Set<ExternalEventHandler>> = new Map();
  private subscriber: Redis | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    @Inject(PUBSUB_PROVIDER)
    private readonly pubSub: PubSubProvider,
    @InjectPinoLogger(CommonExternalEventBus.name)
    private readonly logger: PinoLogger,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(REDIS_CHANNEL);
      } catch {
        // best-effort
      }
      try {
        await this.subscriber.quit();
      } catch {
        // best-effort
      }
      this.subscriber = null;
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;

    try {
      const subscriber = this.pubSub.createSubscriber();
      this.subscriber = subscriber;

      subscriber.on('error', (error) => {
        this.logger.error({
          event: 'external_event_bus_subscriber_error',
          message: error.message,
        });
        void this.scheduleReconnect();
      });

      subscriber.on('end', () => {
        void this.scheduleReconnect();
      });

      await subscriber.subscribe(REDIS_CHANNEL);
      subscriber.on('message', (channel, raw) => {
        if (channel !== REDIS_CHANNEL) return;
        this.handleRedisMessage(raw);
      });

      this.reconnectAttempts = 0;
      this.logger.info({
        event: 'external_event_bus_subscribed',
        channel: REDIS_CHANNEL,
      });
    } catch (error) {
      this.logger.error({
        event: 'external_event_bus_subscribe_failed',
        message: error instanceof Error ? error.message : 'unknown',
      });
      void this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    if (this.reconnectTimer !== null) return;
    this.reconnectAttempts += 1;
    const delaySeconds = Math.min(60, 2 ** Math.min(this.reconnectAttempts - 1, 5));
    const delayMs = delaySeconds * 1000;
    this.logger.warn({
      event: 'external_event_bus_reconnect_scheduled',
      delayMs,
      attempt: this.reconnectAttempts,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  // ---------------------------------------------------------------------------
  // Public API — consumer side
  // ---------------------------------------------------------------------------

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
      if (typeHandlers.size === 0) {
        this.handlers.delete(eventType);
      }
      this.logger.debug({
        event: 'external_event_subscription_removed',
        eventType,
      });
    };
  }

  // ---------------------------------------------------------------------------
  // Public API — producer side
  // ---------------------------------------------------------------------------

  /**
   * Publish an external XP earned event.
   *
   * @throws Error when the Redis publish fails — callers must handle rejections.
   * @throws Error when the event is missing a non-empty `idempotencyKey`. This
   *   surfaces the producer bug at integration time rather than silently
   *   emitting events that the ranking consumer cannot deduplicate.
   */
  async publishXpEarned(event: ExternalXpEarnedEvent): Promise<void> {
    if (typeof event.idempotencyKey !== 'string' || event.idempotencyKey.length === 0) {
      throw new Error('publishXpEarned: idempotencyKey is required');
    }

    const payload: SerializedExternalEvent = {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };

    this.logger.info({
      event: 'external_event_published',
      eventType: event.eventType,
      userId: event.userId,
      correlationId: event.correlationId,
    });

    try {
      await this.pubSub.publish(REDIS_CHANNEL, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({
        event: 'external_event_publish_failed',
        eventType: event.eventType,
        correlationId: event.correlationId,
        error: message,
      });
      throw new Error(`Failed to publish external event: ${message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Redis message handling
  // ---------------------------------------------------------------------------

  private handleRedisMessage(raw: string): void {
    const parsed = this.parseRawMessage(raw);
    if (parsed === null) return;

    const event = this.parseExternalXpEarnedEvent(parsed);
    if (event === null) return;

    this.invokeHandlers(event);
  }

  private parseRawMessage(raw: string): SerializedExternalEvent | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!this.isSerializedExternalEvent(parsed)) {
        this.logger.warn({
          event: 'external_event_bus_unknown_message_shape',
          raw,
        });
        return null;
      }
      return parsed;
    } catch (error) {
      this.logger.warn({
        event: 'external_event_bus_malformed_message',
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private isSerializedExternalEvent(value: unknown): value is SerializedExternalEvent {
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return (
      typeof obj['eventType'] === 'string' &&
      typeof obj['userId'] === 'string' &&
      typeof obj['amount'] === 'number' &&
      typeof obj['source'] === 'string' &&
      typeof obj['timestamp'] === 'string'
    );
  }

  private parseExternalXpEarnedEvent(
    parsed: SerializedExternalEvent,
  ): ExternalXpEarnedEvent | null {
    if (parsed.eventType !== 'external.xp.earned') {
      this.logger.warn({
        event: 'external_event_bus_unknown_event_type',
        eventType: parsed.eventType,
      });
      return null;
    }

    if (!this.isValidSource(parsed.source)) {
      this.logger.warn({
        event: 'external_event_bus_invalid_source',
        source: parsed.source,
      });
      return null;
    }

    const timestamp = new Date(parsed.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      this.logger.warn({
        event: 'external_event_bus_malformed_timestamp',
        timestamp: parsed.timestamp,
      });
      return null;
    }

    return Object.freeze({
      eventType: 'external.xp.earned' as const,
      userId: parsed.userId,
      amount: parsed.amount,
      source: parsed.source,
      attemptId: parsed.attemptId,
      tournamentId: parsed.tournamentId,
      categoryId: parsed.categoryId,
      rank: parsed.rank,
      timestamp,
      correlationId: parsed.correlationId,
      idempotencyKey: parsed.idempotencyKey ?? '',
    });
  }

  private isValidSource(value: string): value is ExternalXpEarnedEvent['source'] {
    return (
      value === 'quiz_attempt' ||
      value === 'tournament' ||
      value === 'bonus' ||
      value === 'achievement'
    );
  }

  // ---------------------------------------------------------------------------
  // Handler dispatch
  // ---------------------------------------------------------------------------

  private invokeHandlers(event: ExternalEvent): void {
    const typeHandlers = this.handlers.get(event.eventType);
    if (!typeHandlers || typeHandlers.size === 0) return;

    const dispatch = () => {
      for (const handler of typeHandlers) {
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
      }
    };

    if (event.correlationId) {
      correlationIdStorage.run({ correlationId: event.correlationId }, dispatch);
    } else {
      dispatch();
    }
  }
}
