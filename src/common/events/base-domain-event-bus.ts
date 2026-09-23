import { Injectable } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import {
  correlationIdStorage,
  createCorrelationId,
  getCorrelationId,
} from '@/common/interceptors/correlation-id';

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
  }

  dispatchToSubscribers(event: TEvent): void {
    const snapshot = Array.from(this.handlers);
    for (const handler of snapshot) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch(() => {
            return;
          });
        }
      } catch {
        return;
      }
    }
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
