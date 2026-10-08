import { Inject, Injectable, Optional } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import {
  correlationIdStorage,
  createCorrelationId,
  getCorrelationId,
} from '@/common/interceptors/correlation-id';
import { TracingProvider } from '@/core/observability/tracing.provider';

export type BaseEventHandler<TEvent> = (event: TEvent) => void | Promise<void>;

export interface BaseDomainEventBusOptions {
  logEventName: string;
  propagateCorrelationId?: boolean;
}

@Injectable()
export class BaseDomainEventBus<TEvent> {
  private readonly handlers: Set<BaseEventHandler<TEvent>> = new Set();
  private readonly options: BaseDomainEventBusOptions;

  constructor(
    protected readonly logger: PinoLogger,
    options: BaseDomainEventBusOptions,
    @Optional()
    @Inject(TracingProvider)
    protected readonly tracing?: TracingProvider,
  ) {
    this.options = {
      propagateCorrelationId: false,
      ...options,
    };
  }

  subscribe(handler: BaseEventHandler<TEvent>): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  size(): number {
    return this.handlers.size;
  }

  clear(): void {
    this.handlers.clear();
  }

  dispatch(event: TEvent): void {
    const eventType = this.readEventType(event);
    const dispatchOnce = (): void => {
      const snapshot = Array.from(this.handlers);
      const correlationId = getCorrelationId() ?? createCorrelationId();

      for (const handler of snapshot) {
        const invoke = () => {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((error: unknown) => {
              this.logError(event, error);
            });
          }
        };

        try {
          if (this.options.propagateCorrelationId === true) {
            correlationIdStorage.run({ correlationId }, invoke);
          } else {
            invoke();
          }
        } catch (error) {
          this.logError(event, error);
        }
      }
    };

    if (!this.tracing) {
      dispatchOnce();
      return;
    }

    void this.tracing.withSpan(
      `${this.options.logEventName}.dispatch`,
      { kind: 'internal', attributes: { 'event.type': eventType } },
      () => {
        dispatchOnce();
        return Promise.resolve();
      },
    );
  }

  dispatchToSubscribers(event: TEvent): void {
    const snapshot = Array.from(this.handlers);
    for (const handler of snapshot) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((error: unknown) => {
            this.logError(event, error);
          });
        }
      } catch (error) {
        this.logError(event, error);
      }
    }
  }

  async dispatchStrict(event: TEvent): Promise<void> {
    const eventType = this.readEventType(event);
    const dispatchOnce = async (): Promise<void> => {
      const snapshot = Array.from(this.handlers);
      const settled = await Promise.allSettled(
        snapshot.map((handler) => Promise.resolve().then(() => handler(event))),
      );
      settled.forEach((result) => {
        if (result.status === 'rejected') {
          this.logError(event, result.reason);
        }
      });
    };

    if (!this.tracing) {
      await dispatchOnce();
      return;
    }

    await this.tracing.withSpan(
      `${this.options.logEventName}.dispatchStrict`,
      { kind: 'internal', attributes: { 'event.type': eventType } },
      async () => {
        await dispatchOnce();
      },
    );
  }

  private readEventType(event: TEvent): string {
    const raw = (event as { eventType?: unknown }).eventType;
    return typeof raw === 'string' ? raw : 'unknown';
  }

  private logError(event: TEvent, error: unknown): void {
    const eventType = (event as { eventType?: unknown }).eventType;
    this.logger.error({
      event: `${this.options.logEventName}_handler_error`,
      ...(typeof eventType === 'string' ? { eventType } : {}),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
