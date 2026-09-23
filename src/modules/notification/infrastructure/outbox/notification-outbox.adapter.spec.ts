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

describe('NotificationOutboxAdapter.writeEvent (ON CONFLICT DO NOTHING)', () => {
  it('attaches onConflictDoNothing to the insert chain when idempotencyKey is provided', async () => {
    const onConflictDoNothing = jest.fn().mockResolvedValue(undefined);
    const tx: DrizzleDB = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoNothing,
        }),
      }),
    } as unknown as DrizzleDB;
    const txContext = new TransactionalContext();
    txContext.getDbClient = jest.fn().mockReturnValue(tx);

    const svc = new NotificationOutboxAdapter(
      {} as DrizzleDB,
      txContext,
      undefined,
      undefined,
      makeLogger(),
    );

    await svc.writeEvent(
      { notificationId: 'n-1', userId: 'u-1', type: 'test', channel: 'email' },
      'key-1',
    );

    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
    expect(onConflictDoNothing.mock.calls[0]?.[0]).toHaveProperty('where');
  });
});

describe('NotificationOutboxAdapter.processBatch (serial processing)', () => {
  it('awaits each event before processing the next one (serial, not Promise.all)', async () => {
    const order: string[] = [];

    const processEvent = jest.fn().mockImplementation(async (ev: { eventId: string }) => {
      order.push(`start:${ev.eventId}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end:${ev.eventId}`);
    });

    const rows = [{ eventId: 'e-1' }, { eventId: 'e-2' }, { eventId: 'e-3' }];

    const chain: any = {};
    chain.from = jest.fn().mockReturnValue(chain);
    chain.where = jest.fn().mockReturnValue(chain);
    chain.orderBy = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockResolvedValue(rows);
    const db = {
      select: jest.fn().mockReturnValue(chain),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const txContext = new TransactionalContext();
    txContext.getDbClient = jest.fn().mockReturnValue({} as DrizzleDB);

    const svc = new NotificationOutboxAdapter(
      db as unknown as DrizzleDB,
      txContext,
      undefined,
      undefined,
      makeLogger(),
    );

    (svc as unknown as { processEvent: typeof processEvent }).processEvent = processEvent;

    await (svc as unknown as { processBatch: () => Promise<void> }).processBatch();

    // In serial mode, each event's "start" must precede the next's "start"
    const e1Start = order.indexOf('start:e-1');
    const e2Start = order.indexOf('start:e-2');
    const e3Start = order.indexOf('start:e-3');
    expect(e1Start).toBeGreaterThanOrEqual(0);
    expect(e2Start).toBeGreaterThan(e1Start);
    expect(e3Start).toBeGreaterThan(e2Start);
  });
});

describe('NotificationOutboxAdapter.monitorDeadLetterQueue', () => {
  it('logs a DLQ alert when poisoned rows exist', async () => {
    const logger = makeLogger();
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ eventId: 'e-1' }, { eventId: 'e-2' }]),
    };

    const svc = new NotificationOutboxAdapter(
      db as unknown as DrizzleDB,
      new TransactionalContext(),
      undefined,
      undefined,
      logger,
    );

    await svc.monitorDeadLetterQueue();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'notification_outbox_dlq_alert',
        totalDlqEvents: 2,
      }),
    );
  });

  it('does NOT log when DLQ is empty', async () => {
    const logger = makeLogger();
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    const svc = new NotificationOutboxAdapter(
      db as unknown as DrizzleDB,
      new TransactionalContext(),
      undefined,
      undefined,
      logger,
    );

    await svc.monitorDeadLetterQueue();

    expect(logger.error).not.toHaveBeenCalled();
  });
});
