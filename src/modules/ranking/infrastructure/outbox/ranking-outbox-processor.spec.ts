/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { RankingOutboxProcessorService } from './ranking-outbox-processor.service';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeDbHandleForDlqMonitor(rows: ReadonlyArray<Record<string, unknown>>): any {
  const self: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockResolvedValue(rows);
  return { select: jest.fn().mockReturnValue(self) };
}

function makeDbAsDrizzle(rows: ReadonlyArray<Record<string, unknown>>): any {
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
  const updateChain: any = {};
  updateChain.set = jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue(undefined),
  });
  return {
    select: jest.fn().mockReturnValue(self),
    update: jest.fn().mockReturnValue(updateChain),
  };
}

function makeProcessor(
  dlqRows: ReadonlyArray<Record<string, unknown>>,
): RankingOutboxProcessorService {
  return new RankingOutboxProcessorService(
    makeDbHandleForDlqMonitor(dlqRows),
    { dispatchToSubscribers: jest.fn() } as any,
    makeLogger(),
  );
}

describe('RankingOutboxProcessorService (DLQ monitor)', () => {
  it('logs a DLQ alert when poisoned rows exist', async () => {
    const processor = makeProcessor([
      { eventId: 'e-1', attemptCount: 9 },
      { eventId: 'e-2', attemptCount: 11 },
    ]);

    await processor.monitorDeadLetterQueue();

    const logger = processor['logger'] as unknown as { error: jest.Mock };
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ranking_outbox_dlq_alert',
        totalDlqEvents: 2,
      }),
    );
  });

  it('does NOT log when DLQ is empty', async () => {
    const processor = makeProcessor([]);

    await processor.monitorDeadLetterQueue();

    const logger = processor['logger'] as unknown as { error: jest.Mock };
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('RankingOutboxProcessorService — idempotency conflict', () => {
  it('marks processed without retrying when dispatch throws a unique-violation error', async () => {
    const db = makeDbAsDrizzle([
      { eventId: 'e-conflict', attemptCount: 2, eventType: 'ranking.updated' },
    ]);
    const processor = new RankingOutboxProcessorService(
      db,
      {
        dispatchToSubscribers: jest.fn().mockImplementation(() => {
          throw new Error('duplicate key value violates unique constraint 23505');
        }),
      } as any,
      makeLogger(),
    );

    const result = await processor.runProcessPendingEvents(db);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.idempotencyConflicts).toBe(1);
  });
});
