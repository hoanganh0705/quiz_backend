import type { PinoLogger } from 'nestjs-pino';
import {
  NotificationOutboxAdapter,
  type NotificationOutboxEvent,
} from './notification-outbox.adapter';
import type { DrizzleDB } from '@/core/database/database.module';
import type { CacheProvider } from '@/common/ports/cache.provider';
import type { NotificationDomainEventBus } from '../../domain/ports';
import { TransactionalContext } from '@/common/interceptors/transactional-context';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

function makeDb(): DrizzleDB {
  return {} as DrizzleDB;
}

function makeCache(): CacheProvider {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    acquireAdvisoryLock: jest.fn().mockResolvedValue('lock-token'),
    releaseAdvisoryLock: jest.fn().mockResolvedValue(undefined),
  } as unknown as CacheProvider;
}

function makeService(
  opts: {
    db?: DrizzleDB;
    cache?: CacheProvider;
    eventBus?: NotificationDomainEventBus | undefined;
  } = {},
) {
  const db = opts.db ?? makeDb();
  const cache = opts.cache ?? makeCache();
  const eventBus: NotificationDomainEventBus | undefined =
    'eventBus' in opts
      ? opts.eventBus
      : ({
          emit: jest.fn(),
          subscribe: jest.fn(),
          subscribeAll: jest.fn(),
          clear: jest.fn(),
        } as unknown as NotificationDomainEventBus);

  const txContext = new TransactionalContext();
  const service = new NotificationOutboxAdapter(db, txContext, eventBus, cache, makeLogger());

  return { service, db, cache, eventBus, txContext };
}

describe('NotificationOutboxAdapter.writeEvent', () => {
  it('throws when called outside a @Transactional context', async () => {
    const { service } = makeService();
    const event: NotificationOutboxEvent = {
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
    };
    await expect(service.writeEvent(event)).rejects.toThrow(/Transactional/);
  });
});

describe('NotificationOutboxAdapter.dispatchEvent', () => {
  it('emits a notification.sent event on the domain event bus', async () => {
    const emit = jest.fn();
    const { service } = makeService({
      eventBus: { emit } as unknown as NotificationDomainEventBus,
    });
    await (
      service as unknown as {
        dispatchEvent: (e: NotificationOutboxEvent) => Promise<void>;
      }
    ).dispatchEvent({
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
    });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'notification.sent',
        notificationId: 'n-1',
        userId: 'user-1',
      }),
    );
  });

  it('throws when the event bus is missing', async () => {
    const { service } = makeService({ eventBus: undefined });
    await expect(
      (
        service as unknown as {
          dispatchEvent: (e: NotificationOutboxEvent) => Promise<void>;
        }
      ).dispatchEvent({
        notificationId: 'n-1',
        userId: 'user-1',
        type: 'achievement_earned',
        channel: 'in_app',
      }),
    ).rejects.toThrow(/NotificationDomainEventBus/);
  });
});

describe('NotificationOutboxAdapter.calculateBackoff', () => {
  it('doubles the delay for each retry', () => {
    const { service } = makeService();
    const calc = service as unknown as {
      calculateBackoff: (attempt: number) => number;
    };
    expect(calc.calculateBackoff(1)).toBe(1000);
    expect(calc.calculateBackoff(2)).toBe(2000);
    expect(calc.calculateBackoff(3)).toBe(4000);
  });

  it('caps at 60s', () => {
    const { service } = makeService();
    const calc = service as unknown as {
      calculateBackoff: (attempt: number) => number;
    };
    expect(calc.calculateBackoff(20)).toBe(60_000);
  });
});
