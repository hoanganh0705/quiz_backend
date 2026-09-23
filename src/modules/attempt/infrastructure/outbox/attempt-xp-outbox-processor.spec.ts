/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { AttemptXpOutboxProcessorService } from './attempt-xp-outbox-processor.service';
import type { ExternalEventBusProducerPort } from '@/common/events/common-external-event-bus';
import type { DrizzleDB } from '@/core/database/database.module';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
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

function makeUpdateChain() {
  const updateSetChain: any = {};
  updateSetChain.where = jest.fn().mockResolvedValue(undefined);
  const updateChain: any = {};
  updateChain.set = jest.fn().mockReturnValue(updateSetChain);
  return updateChain;
}

function makeDb(rows: unknown[]) {
  const selectChain = makeSelectChain(rows);
  const updateChain = makeUpdateChain();
  return {
    db: {
      select: jest.fn().mockReturnValue(selectChain),
      update: jest.fn().mockReturnValue(updateChain),
    },
  };
}

function makeProcessor(opts: {
  rows: ReadonlyArray<Record<string, unknown>>;
  publishXp: jest.Mock;
}): AttemptXpOutboxProcessorService {
  const { db } = makeDb([...opts.rows]);
  return new AttemptXpOutboxProcessorService(
    db as unknown as DrizzleDB,
    { publishXpEarned: opts.publishXp } as ExternalEventBusProducerPort,
    makeLogger(),
  );
}

const baseRow = {
  eventId: 'ev-1',
  aggregateType: 'attempt',
  eventType: 'attempt.xp_to_publish',
  payload: {
    userId: 'u-1',
    attemptId: 'att-1',
    amount: 25,
    idempotencyKey: 'xp:u-1:attempt:att-1',
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  attemptCount: 0,
  idempotencyKey: 'xp:u-1:attempt:att-1',
  correlationId: 'corr-1',
};

describe('AttemptXpOutboxProcessorService', () => {
  it('publishes a single external.xp.earned per drained row', async () => {
    const publishXp = jest.fn().mockResolvedValue(undefined);
    const processor = makeProcessor({ rows: [baseRow], publishXp });

    const result = await processor.processPendingEvents();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(publishXp).toHaveBeenCalledTimes(1);

    const event = publishXp.mock.calls[0]?.[0];
    expect(event.eventType).toBe('external.xp.earned');
    expect(event.userId).toBe('u-1');
    expect(event.attemptId).toBe('att-1');
    expect(event.amount).toBe(25);
    expect(event.idempotencyKey).toBe('xp:u-1:attempt:att-1');
  });

  it('returns 0/0 when no rows are ready to drain', async () => {
    const publishXp = jest.fn();
    const processor = makeProcessor({ rows: [], publishXp });

    const result = await processor.processPendingEvents();

    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(publishXp).not.toHaveBeenCalled();
  });

  it('counts the row as failed when publishXpEarned throws', async () => {
    const publishXp = jest.fn().mockRejectedValue(new Error('redis-down'));
    const processor = makeProcessor({ rows: [baseRow], publishXp });

    const result = await processor.processPendingEvents();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(publishXp).toHaveBeenCalledTimes(1);
  });

  it('does NOT call publishXpEarned when userId is missing from the payload', async () => {
    const publishXp = jest.fn();
    const bad = { ...baseRow, eventId: 'ev-2', payload: { ...baseRow.payload, userId: '' } };
    const processor = makeProcessor({ rows: [bad], publishXp });

    await processor.processPendingEvents();

    expect(publishXp).not.toHaveBeenCalled();
  });

  it('marks a row processed without retrying when dispatch throws a unique-violation error', async () => {
    const publishXp = jest.fn().mockImplementation(() => {
      throw new Error('duplicate key value violates unique constraint 23505');
    });
    const processor = makeProcessor({ rows: [baseRow], publishXp });

    const result = await processor.processPendingEvents();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
  });
});
