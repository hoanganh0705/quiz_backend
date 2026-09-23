/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import type { PinoLogger } from 'nestjs-pino';
import { DailyChallengeXpOutboxProcessorService } from './daily-challenge-xp-outbox-processor.service';
import type { DrizzleDB } from '@/core/database/database.module';
import type { ExternalEventBusProducerPort } from '@/common/events/common-external-event-bus';

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

function makeSelectChain(rows: unknown[]) {
  const chain: any = {};
  for (const m of ['from', 'where', 'orderBy']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.for = jest.fn().mockResolvedValue(rows);
  return chain;
}

function makePlainChain(rows: unknown[]) {
  const chain: any = {};
  for (const m of ['from', 'where', 'orderBy']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.limit = jest.fn().mockResolvedValue(rows);
  return chain;
}

function makeUpdateChain() {
  const updateSetChain: any = {};
  updateSetChain.where = jest.fn().mockResolvedValue(undefined);
  const updateChain: any = {};
  updateChain.set = jest.fn().mockReturnValue(updateSetChain);
  return updateChain;
}

function makeDb(pending: unknown[]): {
  db: DrizzleDB;
} {
  const selectChain = makeSelectChain(pending);
  const updateChain = makeUpdateChain();
  const dbMock = {
    select: jest.fn().mockReturnValue(selectChain),
    update: jest.fn().mockReturnValue(updateChain),
  } as unknown as DrizzleDB & { select: jest.Mock; update: jest.Mock };
  return { db: dbMock as unknown as DrizzleDB };
}

function makeService(pending: unknown[]) {
  const { db } = makeDb(pending);
  const externalBus = {
    publishXpEarned: jest.fn().mockResolvedValue(undefined),
  } as unknown as ExternalEventBusProducerPort & { publishXpEarned: jest.Mock };
  const logger = makeLogger();
  const processor = new DailyChallengeXpOutboxProcessorService(
    db,
    externalBus,
    logger as unknown as PinoLogger,
  );
  return { processor, db, externalBus, logger };
}

const baseEvent = {
  eventId: 'evt-1',
  eventType: 'daily_challenge.xp_to_publish',
  payload: {
    userId: 'user-1',
    challengeId: 'c-1',
    amount: 100,
    idempotencyKey: 'xp:user-1:daily_challenge:c-1',
    timestamp: new Date().toISOString(),
  },
  attemptCount: 0,
  idempotencyKey: 'xp:user-1:daily_challenge:c-1',
  correlationId: null,
  aggregateType: 'daily_challenge',
  createdAt: new Date().toISOString(),
};

describe('DailyChallengeXpOutboxProcessorService', () => {
  it('returns zero counts when no pending events exist', async () => {
    const { processor } = makeService([]);
    const result = await processor.processPendingEvents();
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it('publishes a valid pending row and marks it processed', async () => {
    const { processor, externalBus } = makeService([baseEvent]);
    const result = await processor.processPendingEvents();
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(externalBus.publishXpEarned).toHaveBeenCalledTimes(1);
    const dispatched = externalBus.publishXpEarned.mock.calls[0]?.[0];
    expect(dispatched).toMatchObject({
      userId: 'user-1',
      amount: 100,
      idempotencyKey: 'xp:user-1:daily_challenge:c-1',
      source: 'bonus',
    });
  });

  it('marks a row failed when payload is invalid (missing userId)', async () => {
    const bad = {
      ...baseEvent,
      eventId: 'evt-bad',
      payload: { ...baseEvent.payload, userId: '' },
    };
    const { processor, externalBus } = makeService([bad]);
    const result = await processor.processPendingEvents();
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    expect(externalBus.publishXpEarned).not.toHaveBeenCalled();
  });

  it('marks a row failed when publishXpEarned throws (transient)', async () => {
    const { processor, externalBus } = makeService([{ ...baseEvent, attemptCount: 4 }]);
    externalBus.publishXpEarned = jest.fn().mockRejectedValue(new Error('redis-down'));
    const result = await processor.processPendingEvents();
    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('skips and marks processed when dispatch throws an idempotency-conflict error', async () => {
    const { processor, externalBus } = makeService([{ ...baseEvent, attemptCount: 4 }]);
    externalBus.publishXpEarned = jest.fn().mockImplementation(() => {
      throw new Error(
        'duplicate key value violates unique constraint uq_outbox_events_idempotency_unprocessed 23505',
      );
    });
    const result = await processor.processPendingEvents();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
  });
});

describe('DailyChallengeXpOutboxProcessorService DLQ monitor', () => {
  it('logs an alert when poison rows exist', async () => {
    const stubDb = { select: jest.fn() } as unknown as DrizzleDB;
    const stubLogger = makeLogger();
    const stubExternalBus = {
      publishXpEarned: jest.fn(),
    } as unknown as ExternalEventBusProducerPort;
    const processor = new DailyChallengeXpOutboxProcessorService(
      stubDb,
      stubExternalBus,
      stubLogger as unknown as PinoLogger,
    );

    const dlqChain = makePlainChain([{ eventId: 'poison-1' }]);
    stubDb.select = jest.fn().mockReturnValue(dlqChain);

    await processor.monitorDeadLetterQueue();

    const errorCalls = (stubLogger.error as jest.Mock).mock.calls;
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    expect(errorCalls[0]?.[0]).toMatchObject({
      event: 'daily_challenge_xp_outbox_dlq_alert',
    });
  });

  it('does not log when no poison rows exist', async () => {
    const stubDb = { select: jest.fn() } as unknown as DrizzleDB;
    const stubLogger = makeLogger();
    const stubExternalBus = {
      publishXpEarned: jest.fn(),
    } as unknown as ExternalEventBusProducerPort;
    const processor = new DailyChallengeXpOutboxProcessorService(
      stubDb,
      stubExternalBus,
      stubLogger as unknown as PinoLogger,
    );

    const emptyChain = makePlainChain([]);
    stubDb.select = jest.fn().mockReturnValue(emptyChain);

    await processor.monitorDeadLetterQueue();
    expect((stubLogger.error as jest.Mock).mock.calls.length).toBe(0);
  });
});
