/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/unbound-method */
import { CoinOutboxProcessorService } from './coin-outbox-processor.service';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeQueryChainWithSkipLocked(rows: ReadonlyArray<Record<string, unknown>>): any {
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

function makeQueryChainPlain(rows: ReadonlyArray<Record<string, unknown>>): any {
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
  return self;
}

function makeDbHandle(
  pendingRows: ReadonlyArray<Record<string, unknown>>,
  dlqRows: ReadonlyArray<Record<string, unknown>>,
): any {
  const pendingChain = makeQueryChainWithSkipLocked(pendingRows);
  const dlqChain = makeQueryChainPlain(dlqRows);

  const selectResult: any = {};
  selectResult.select = jest.fn((cols: unknown) => {
    const hasDlqReason =
      typeof cols === 'object' && cols !== null && Object.keys(cols).includes('dlqReason');
    return hasDlqReason ? dlqChain : pendingChain;
  });

  return { db: selectResult, pendingChain, dlqChain };
}

function makeProcessor(
  pendingRows: ReadonlyArray<Record<string, unknown>>,
  dlqRows: ReadonlyArray<Record<string, unknown>>,
): CoinOutboxProcessorService {
  const { db } = makeDbHandle(pendingRows, dlqRows);
  return new CoinOutboxProcessorService(
    db as any,
    { emitBalanceChanged: jest.fn(), emitTransactionRecorded: jest.fn() } as any,
    makeLogger(),
  );
}

describe('CoinOutboxProcessorService (DLQ monitor)', () => {
  it('logs a DLQ alert when poisoned rows exist', async () => {
    const processor = makeProcessor(
      [],
      [
        { eventId: 'e-1', attemptCount: 9 },
        { eventId: 'e-2', attemptCount: 11 },
      ],
    );

    await processor.monitorDeadLetterQueue();

    expect(processor['logger'].error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coin_outbox_dlq_alert',
        totalDlqEvents: 2,
      }),
    );
  });

  it('does NOT log when DLQ is empty', async () => {
    const processor = makeProcessor([], []);

    await processor.monitorDeadLetterQueue();

    expect(processor['logger'].error).not.toHaveBeenCalled();
  });
});

describe('CoinOutboxProcessorService (SKIP LOCKED)', () => {
  it('applies FOR UPDATE SKIP LOCKED when selecting pending events', async () => {
    const processor = makeProcessor([], []);

    const db = (processor as any)['db'] as any;
    await processor.runProcessPendingEvents(db);

    const chain = db.select.mock.results[0].value;
    expect(chain.for).toHaveBeenCalledWith('update', { skipLocked: true });
  });
});
