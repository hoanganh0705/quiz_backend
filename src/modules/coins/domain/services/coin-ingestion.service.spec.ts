/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { CoinIngestionService } from './coin-ingestion.service';
import { ReferentialValidatorService } from '@/common/database/referential-validator.service';
import { ReferencedEntityNotFoundError } from '@/common/database/references.types';
import type { DrizzleDB } from '@/core/database/database.module';
import type { CoinRepositoryPort } from '../ports/coin-repository.port';
import type { CoinOutboxPort } from '../ports/coin-outbox.port';
import type { CoinMetricsService } from './coin-metrics.service';

function makeLogger(): any {
  return { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function makeRepo(): CoinRepositoryPort {
  return {
    getWallet: jest.fn(),
    getLedgerSum: jest.fn(),
    getDailyEarnCapSum: jest.fn().mockResolvedValue(0),
    listTransactions: jest.fn(),
    applyDeltaInTx: jest.fn(),
    applySpendInTx: jest.fn(),
    getDailyTipCount: jest.fn(),
    recipientExists: jest.fn(),
    quizExists: jest.fn(),
    getActiveSuppression: jest.fn(),
    writeFlairSlotInTx: jest.fn(),
    writeQuizSuppressionInTx: jest.fn(),
    findTransactionIdByIdempotencyKey: jest.fn(),
    findCoinMismatches: jest.fn(),
    runInTransaction: jest.fn(),
  } as unknown as CoinRepositoryPort;
}

function makeOutbox(): CoinOutboxPort {
  return {
    scheduleCoinEvent: jest.fn().mockResolvedValue(undefined),
    scheduleCoinSpend: jest.fn().mockResolvedValue(undefined),
  } as unknown as CoinOutboxPort;
}

function makeMetrics(): CoinMetricsService {
  return {
    recordEventProcessed: jest.fn(),
    recordEventRejectedValidation: jest.fn(),
    recordEventTruncatedByCap: jest.fn(),
  } as unknown as CoinMetricsService;
}

function makeValidator(existsMap: Record<string, boolean> = {}): ReferentialValidatorService {
  return {
    assertExists: jest.fn(async (entity) => {
      const key = `${entity.kind}:${entity.id}`;
      if (existsMap[key] === false) {
        throw new ReferencedEntityNotFoundError(entity);
      }
    }),
    exists: jest.fn(async (entity) => existsMap[`${entity.kind}:${entity.id}`] ?? true),
    invalidate: jest.fn(),
  } as unknown as ReferentialValidatorService;
}

function makeDb(): DrizzleDB {
  const txChain: any = {};
  txChain.transaction = jest.fn(async (work: any) => work(txChain));
  txChain.update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([]),
      }),
    }),
  });
  txChain.insert = jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([
        {
          transactionId: 'tx-1',
          balanceAfter: 100,
          createdAt: new Date().toISOString(),
        },
      ]),
    }),
  });
  return txChain as unknown as DrizzleDB;
}

function makeRepoWithApply(): CoinRepositoryPort {
  const base = makeRepo();
  (base.applyDeltaInTx as jest.Mock).mockResolvedValue({
    wallet: {
      balance: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    appliedDelta: 50,
    transactionId: 'tx-1',
    createdAt: new Date().toISOString(),
  });
  return base;
}

describe('CoinIngestionService — referential validation', () => {
  const baseEvent = {
    userId: 'u-1',
    source: 'attempt' as const,
    amount: 50,
    reason: 'QUIZ_COMPLETION_REWARD' as any,
    referenceId: 'att-1',
    idempotencyKey: 'idem-1',
    metadata: {},
    applyDailyCap: false,
  };

  it('delegates to the validator with kind=attempt for source=attempt', async () => {
    const validator = makeValidator({ 'attempt:att-1': true });
    const svc = new CoinIngestionService(
      makeDb(),
      makeRepoWithApply(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await expect(svc.processCoinEvent(baseEvent)).resolves.toBeDefined();
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'attempt', id: 'att-1' });
  });

  it('maps source=daily to kind=daily_challenge', async () => {
    const validator = makeValidator();
    const svc = new CoinIngestionService(
      makeDb(),
      makeRepoWithApply(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processCoinEvent({ ...baseEvent, source: 'daily', referenceId: 'dc-1' });
    expect(validator.assertExists).toHaveBeenCalledWith({
      kind: 'daily_challenge',
      id: 'dc-1',
    });
  });

  it('maps source=streak to kind=streak', async () => {
    const validator = makeValidator();
    const svc = new CoinIngestionService(
      makeDb(),
      makeRepoWithApply(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processCoinEvent({ ...baseEvent, source: 'streak', referenceId: '7' });
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'streak', id: '7' });
  });

  it('maps source=badge to kind=badge', async () => {
    const validator = makeValidator();
    const svc = new CoinIngestionService(
      makeDb(),
      makeRepoWithApply(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processCoinEvent({ ...baseEvent, source: 'badge', referenceId: 'ub-1' });
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'badge', id: 'ub-1' });
  });

  it('maps source=tournament to kind=tournament', async () => {
    const validator = makeValidator();
    const svc = new CoinIngestionService(
      makeDb(),
      makeRepoWithApply(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processCoinEvent({ ...baseEvent, source: 'tournament', referenceId: 't-1' });
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'tournament', id: 't-1' });
  });

  it('throws ReferencedEntityNotFoundError when the validator rejects', async () => {
    const validator = makeValidator({ 'attempt:att-1': false });
    const svc = new CoinIngestionService(
      makeDb(),
      makeRepoWithApply(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await expect(svc.processCoinEvent(baseEvent)).rejects.toBeInstanceOf(
      ReferencedEntityNotFoundError,
    );
  });
});
