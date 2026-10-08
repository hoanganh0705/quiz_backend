/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */
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
    {
      acquireAdvisoryLock: jest.fn().mockResolvedValue('t-1'),
      releaseAdvisoryLock: jest.fn(),
      renewAdvisoryLock: jest.fn(),
    } as any,
    { getCircuitState: () => 'closed' } as any,
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

class MockCoinDomainEventBus {
  readonly emittedBalanceChanged: Array<unknown> = [];
  readonly emittedTransactionRecorded: Array<unknown> = [];

  emitBalanceChanged(event: unknown): void {
    this.emittedBalanceChanged.push(event);
  }

  emitTransactionRecorded(event: unknown): void {
    this.emittedTransactionRecorded.push(event);
  }

  emitRefunded(): void {
    // not used in this test
  }
}

describe('CoinOutboxProcessorService — single-event dispatch', () => {
  it('emits only coin.transaction_recorded (not coin.balance_changed) for coin.added', async () => {
    const mockBus = new MockCoinDomainEventBus();
    const processor = new CoinOutboxProcessorService(
      {} as any,
      mockBus as any,
      {
        acquireAdvisoryLock: jest.fn(),
        releaseAdvisoryLock: jest.fn(),
      } as any,
      { getCircuitState: () => 'closed' } as any,
      makeLogger(),
    );

    const payload = {
      eventType: 'coin.added',
      userId: 'u-1',
      reason: 'daily_streak',
      amount: 10,
      newBalance: 100,
      transactionId: 'tx-1',
      balanceAfter: 100,
      referenceType: 'streak',
      referenceId: 's-1',
      metadata: {},
      ledgerCreatedAt: '2026-01-01T00:00:00.000Z',
      occurredAt: '2026-01-01T00:00:00.000Z',
    };

    await (
      processor as unknown as {
        dispatchCoinAdded: (p: typeof payload) => Promise<void>;
      }
    ).dispatchCoinAdded(payload);

    expect(mockBus.emittedBalanceChanged).toHaveLength(0);
    expect(mockBus.emittedTransactionRecorded).toHaveLength(1);
  });

  it('emits only coin.transaction_recorded (not coin.balance_changed) for coin.spent', async () => {
    const mockBus = new MockCoinDomainEventBus();
    const processor = new CoinOutboxProcessorService(
      {} as any,
      mockBus as any,
      {
        acquireAdvisoryLock: jest.fn(),
        releaseAdvisoryLock: jest.fn(),
      } as any,
      { getCircuitState: () => 'closed' } as any,
      makeLogger(),
    );

    const payload = {
      eventType: 'coin.spent',
      userId: 'u-1',
      reason: 'tournament_entry',
      amount: -5,
      newBalance: 95,
      transactionId: 'tx-2',
      balanceAfter: 95,
      referenceType: 'tournament',
      referenceId: 't-1',
      metadata: {},
      ledgerCreatedAt: '2026-01-01T00:00:00.000Z',
      occurredAt: '2026-01-01T00:00:00.000Z',
      category: 'tournament',
    };

    await (
      processor as unknown as {
        dispatchCoinSpent: (p: typeof payload) => Promise<void>;
      }
    ).dispatchCoinSpent(payload);

    expect(mockBus.emittedBalanceChanged).toHaveLength(0);
    expect(mockBus.emittedTransactionRecorded).toHaveLength(1);
  });
});
