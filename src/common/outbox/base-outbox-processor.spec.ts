/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import {
  BaseOutboxProcessor,
  OutboxIdempotencyConflictError,
  computeNextAttemptIso,
} from './base-outbox-processor';
import type { DrizzleDB } from '@/core/database/database.module';
import type { BaseOutboxRow } from './base-outbox-processor';

type UpdateCall = {
  setValues: Record<string, unknown>;
  whereArg: unknown;
};

class TestProcessor extends BaseOutboxProcessor {
  protected readonly batchSize = 100;
  protected readonly maxRetries = 3;
  protected readonly baseDelaySeconds = 30;
  protected readonly aggregateType = 'test';
  protected readonly logPrefix = 'test';

  public dispatchCalls: BaseOutboxRow[] = [];
  public conflictCalls: BaseOutboxRow[] = [];
  public failWith: Error | null = null;
  public dispatchImpl: ((row: BaseOutboxRow) => Promise<void> | void) | null = null;

  protected async dispatch(row: BaseOutboxRow): Promise<void> {
    this.dispatchCalls.push(row);
    if (this.failWith) throw this.failWith;
    if (this.dispatchImpl) await this.dispatchImpl(row);
  }

  protected onIdempotencyConflict(row: BaseOutboxRow): void {
    this.conflictCalls.push(row);
  }
}

function makePendingChain(rows: ReadonlyArray<Record<string, unknown>>): any {
  const self: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    for: jest.fn(),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockReturnValue(self);
  self.for.mockResolvedValue(rows);
  return self;
}

function makeUpdateChain(): { chain: any; calls: UpdateCall[] } {
  const calls: UpdateCall[] = [];
  const where = jest.fn().mockImplementation((arg: unknown) => {
    const last = calls[calls.length - 1];
    if (last) last.whereArg = arg;
    return undefined;
  });
  const set = jest.fn().mockImplementation((values: Record<string, unknown>) => {
    calls.push({ setValues: values, whereArg: undefined });
    return { where };
  });
  const chain = { set };
  return { chain, calls };
}

function makeDb(pending: ReadonlyArray<Record<string, unknown>>): {
  db: DrizzleDB;
  updateChain: ReturnType<typeof makeUpdateChain>;
  selectChain: any;
} {
  const updateChain = makeUpdateChain();
  const selectChain = makePendingChain(pending);
  const db = {
    select: jest.fn().mockReturnValue(selectChain),
    update: jest.fn().mockReturnValue(updateChain.chain),
  } as unknown as DrizzleDB;
  return { db, updateChain, selectChain };
}

const baseRow: BaseOutboxRow = {
  eventId: 'ev-1',
  aggregateType: 'test',
  eventType: 'test.event',
  payload: { userId: 'u-1' },
  createdAt: '2026-01-01T00:00:00.000Z',
  attemptCount: 0,
  idempotencyKey: 'xp:test',
  correlationId: 'corr-1',
};

describe('BaseOutboxProcessor — pending selection', () => {
  it('applies FOR UPDATE SKIP LOCKED when selecting the batch', async () => {
    const processor = new TestProcessor();
    const { db, selectChain } = makeDb([]);

    await processor.runProcessPendingEvents(db);

    expect(selectChain.for).toHaveBeenCalledWith('update', { skipLocked: true });
  });

  it('returns zero counters when no rows are pending', async () => {
    const processor = new TestProcessor();
    const { db } = makeDb([]);

    const result = await processor.runProcessPendingEvents(db);

    expect(result).toEqual({
      processed: 0,
      failed: 0,
      retried: 0,
      movedToDlq: 0,
      idempotencyConflicts: 0,
      scanned: 0,
    });
    expect(processor.dispatchCalls).toHaveLength(0);
  });

  it('dispatches each row and marks it processed', async () => {
    const processor = new TestProcessor();
    const rows = [
      { ...baseRow, eventId: 'a' },
      { ...baseRow, eventId: 'b' },
    ];
    const { db, updateChain } = makeDb(rows);

    const result = await processor.runProcessPendingEvents(db);

    expect(result.scanned).toBe(2);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(processor.dispatchCalls.map((r) => r.eventId)).toEqual(['a', 'b']);
    expect(updateChain.calls).toHaveLength(2);
    expect(updateChain.calls[0]?.setValues).toMatchObject({ processedAt: expect.any(String) });
  });
});

describe('BaseOutboxProcessor — idempotency conflict path', () => {
  it('marks the row processed and counts it as a conflict when dispatch throws a unique-violation', async () => {
    const processor = new TestProcessor();
    processor.failWith = new Error('duplicate key value violates unique constraint 23505');
    const rows = [{ ...baseRow, eventId: 'conflict-1' }];
    const { db, updateChain } = makeDb(rows);

    const result = await processor.runProcessPendingEvents(db);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.idempotencyConflicts).toBe(1);
    expect(processor.conflictCalls.map((r) => r.eventId)).toEqual(['conflict-1']);
    expect(updateChain.calls).toHaveLength(1);
    expect(updateChain.calls[0]?.setValues).toMatchObject({ processedAt: expect.any(String) });
  });

  it('treats an OutboxIdempotencyConflictError as a non-retryable conflict', async () => {
    const processor = new TestProcessor();
    processor.failWith = new OutboxIdempotencyConflictError('already applied');
    const rows = [{ ...baseRow, eventId: 'conflict-2', attemptCount: 4 }];
    const { db } = makeDb(rows);

    const result = await processor.runProcessPendingEvents(db);

    expect(result.processed).toBe(1);
    expect(result.idempotencyConflicts).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.retried).toBe(0);
    expect(result.movedToDlq).toBe(0);
    expect(processor.conflictCalls.map((r) => r.eventId)).toEqual(['conflict-2']);
  });

  it('still retries a non-conflict error', async () => {
    const processor = new TestProcessor();
    processor.failWith = new Error('redis is down');
    const rows = [{ ...baseRow, eventId: 'transient', attemptCount: 0 }];
    const { db, updateChain } = makeDb(rows);

    const result = await processor.runProcessPendingEvents(db);

    expect(result.failed).toBe(1);
    expect(result.retried).toBe(1);
    expect(result.movedToDlq).toBe(0);
    expect(updateChain.calls[0]?.setValues).toMatchObject({
      attemptCount: 1,
      lastError: 'redis is down',
    });
    expect(updateChain.calls[0]?.setValues['failedAt']).toBeUndefined();
    expect(updateChain.calls[0]?.setValues['dlqReason']).toBeUndefined();
    expect(updateChain.calls[0]?.setValues['nextAttemptAt']).toEqual(expect.any(String));
  });
});

describe('BaseOutboxProcessor — DLQ discipline', () => {
  it('moves the row to DLQ once attemptCount exceeds maxRetries', async () => {
    const processor = new TestProcessor();
    processor.failWith = new Error('still broken');
    const rows = [{ ...baseRow, eventId: 'doomed', attemptCount: 3 }];
    const { db, updateChain } = makeDb(rows);

    const result = await processor.runProcessPendingEvents(db);

    expect(result.failed).toBe(1);
    expect(result.movedToDlq).toBe(1);
    expect(result.retried).toBe(0);
    expect(updateChain.calls[0]?.setValues).toMatchObject({
      attemptCount: 4,
      failedAt: expect.any(String),
      dlqReason: 'exhausted_retries:still broken',
    });
  });

  it('still retries when attemptCount equals maxRetries (DLQ only after exceeding)', async () => {
    const processor = new TestProcessor();
    processor.failWith = new Error('flaky');
    const rows = [{ ...baseRow, eventId: 'boundary', attemptCount: 2 }];
    const { db, updateChain } = makeDb(rows);

    const result = await processor.runProcessPendingEvents(db);

    expect(result.retried).toBe(1);
    expect(result.movedToDlq).toBe(0);
    expect(updateChain.calls[0]?.setValues).toMatchObject({
      attemptCount: 3,
    });
    expect(updateChain.calls[0]?.setValues['failedAt']).toBeUndefined();
    expect(updateChain.calls[0]?.setValues['dlqReason']).toBeUndefined();
  });
});

describe('BaseOutboxProcessor — DLQ monitor', () => {
  it('counts DLQ rows by aggregate type', async () => {
    const processor = new TestProcessor();
    const rows = [{ eventId: 'p-1' }, { eventId: 'p-2' }];
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(rows),
    };
    const db = { select: jest.fn().mockReturnValue(chain) } as unknown as DrizzleDB;

    const count = await processor.runMonitorDeadLetterQueue(db);

    expect(count).toBe(2);
  });

  it('returns zero when no DLQ rows exist', async () => {
    const processor = new TestProcessor();
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    const db = { select: jest.fn().mockReturnValue(chain) } as unknown as DrizzleDB;

    const count = await processor.runMonitorDeadLetterQueue(db);

    expect(count).toBe(0);
  });
});

describe('computeNextAttemptIso', () => {
  it('produces monotonically increasing delays from the base', () => {
    const now = '2026-01-01T00:00:00.000Z';
    const a = computeNextAttemptIso(1, now, 30);
    const b = computeNextAttemptIso(2, now, 30);
    const c = computeNextAttemptIso(3, now, 30);

    const aMs = Date.parse(a) - Date.parse(now);
    const bMs = Date.parse(b) - Date.parse(now);
    const cMs = Date.parse(c) - Date.parse(now);

    expect(aMs).toBe(30_000);
    expect(bMs).toBe(60_000);
    expect(cMs).toBe(120_000);
  });
});
