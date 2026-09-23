/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { CoinSpendService } from './coin-spend.service';
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
    getDailyEarnCapSum: jest.fn(),
    listTransactions: jest.fn(),
    applyDeltaInTx: jest.fn().mockResolvedValue({
      wallet: {
        balance: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      appliedDelta: -50,
      transactionId: 'tx-1',
      createdAt: new Date().toISOString(),
    }),
    applySpendInTx: jest.fn().mockResolvedValue({
      wallet: {
        balance: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      appliedDelta: -50,
      transactionId: 'tx-1',
      createdAt: new Date().toISOString(),
    }),
    getDailyTipCount: jest.fn().mockResolvedValue(0),
    recipientExists: jest.fn(),
    quizExists: jest.fn(),
    getActiveSuppression: jest.fn().mockResolvedValue(null),
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
      if (existsMap[`${entity.kind}:${entity.id}`] === false) {
        throw new ReferencedEntityNotFoundError(entity);
      }
    }),
    exists: jest.fn(),
    invalidate: jest.fn(),
  } as unknown as ReferentialValidatorService;
}

function makeDb(): DrizzleDB {
  const txChain: any = {};
  txChain.transaction = jest.fn(async (work: any) => work(txChain));
  txChain.execute = jest.fn().mockResolvedValue({ rows: [{ exists: true }] });
  return txChain as unknown as DrizzleDB;
}

describe('CoinSpendService — referential validation', () => {
  const baseInput = {
    userId: 'u-1',
    category: 'tip' as const,
    reason: 'TIP_SENT' as any,
    amount: 50,
    referenceId: 'u-2',
    idempotencyKey: 'idem-1',
    metadata: {},
  };

  it('delegates to the validator with kind=tip for category=tip', async () => {
    const validator = makeValidator({ 'tip:u-2': true });
    const svc = new CoinSpendService(
      makeDb(),
      makeRepo(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processSpend(baseInput);
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'tip', id: 'u-2' });
  });

  it('delegates to the validator with kind=suppress for category=suppress', async () => {
    const validator = makeValidator({ 'suppress:q-1': true });
    const svc = new CoinSpendService(
      makeDb(),
      makeRepo(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processSpend({ ...baseInput, category: 'suppress', referenceId: 'q-1' });
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'suppress', id: 'q-1' });
  });

  it('delegates to the validator with kind=flair for category=flair', async () => {
    const validator = makeValidator({ 'flair:ub-1': true });
    const svc = new CoinSpendService(
      makeDb(),
      makeRepo(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processSpend({ ...baseInput, category: 'flair', referenceId: 'ub-1' });
    expect(validator.assertExists).toHaveBeenCalledWith({ kind: 'flair', id: 'ub-1' });
  });

  it('propagates ReferencedEntityNotFoundError from the validator', async () => {
    const validator = makeValidator({ 'tip:u-2': false });
    const svc = new CoinSpendService(
      makeDb(),
      makeRepo(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await expect(svc.processSpend(baseInput)).rejects.toBeInstanceOf(ReferencedEntityNotFoundError);
  });

  it('does not call the validator for category=admin', async () => {
    const validator = makeValidator();
    const svc = new CoinSpendService(
      makeDb(),
      makeRepo(),
      makeOutbox(),
      makeMetrics(),
      validator,
      makeLogger(),
    );
    await svc.processSpend({ ...baseInput, category: 'admin', referenceId: 'u-3' });
    expect(validator.assertExists).not.toHaveBeenCalled();
  });
});
