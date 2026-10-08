import { CoinApplicationService } from './coin.application.service';
import type { CoinRepositoryPort, CoinTransactionRow } from '../domain/ports/coin-repository.port';
import type { CoinSpendPort, CoinSpendResult } from '../domain/ports/coin-spend.port';
import type { CoinIngestionPort, CoinEventResult } from '../domain/ports/coin-ingestion.port';
import { CoinMetricsService } from '../domain/services/coin-metrics.service';
import {
  CoinAdminSelfAdjustmentError,
  CoinAdminDailyCapExceededError,
} from '../domain/errors/coin-spend.errors';

class FakeCoinRepository implements CoinRepositoryPort {
  wallets = new Map<string, { balance: number }>();
  transactionIdByKey = new Map<string, string>();

  async getWallet(): Promise<{
    userId: string;
    balance: number;
    createdAt: string;
    updatedAt: string;
  } | null> {
    return null;
  }
  async getLedgerSum(): Promise<number> {
    return 0;
  }
  async getDailyEarnCapSum(): Promise<number> {
    return 0;
  }
  async getAdminDailyAdjustmentSum(): Promise<number> {
    return 0;
  }
  async listTransactions(): Promise<CoinTransactionRow[]> {
    return [];
  }
  async applyDeltaInTx(): Promise<{
    wallet: { userId: string; balance: number; createdAt: string; updatedAt: string };
    appliedDelta: number;
    transactionId: string;
    createdAt: string;
  }> {
    throw new Error('not implemented');
  }
  async applySpendInTx(): Promise<null> {
    return null;
  }
  async getDailyTipCount(): Promise<number> {
    return 0;
  }
  async recipientExists(): Promise<boolean> {
    return true;
  }
  async quizExists(): Promise<boolean> {
    return true;
  }
  async getActiveSuppression(): Promise<null> {
    return null;
  }
  async writeFlairSlotInTx(): Promise<void> {
    /* no-op */
  }
  async writeQuizSuppressionInTx(): Promise<void> {
    /* no-op */
  }
  async findTransactionIdByIdempotencyKey(key: string): Promise<string | null> {
    return this.transactionIdByKey.get(key) ?? null;
  }
  async findCoinMismatches(): Promise<
    { userId: string; storedBalance: number; expectedBalance: number }[]
  > {
    return [];
  }
  async runInTransaction<T>(work: (tx: never, helpers: never) => Promise<T>): Promise<T> {
    return work({} as never, {} as never);
  }
}

class FakeCoinSpend implements CoinSpendPort {
  lastInput?: Parameters<CoinSpendPort['processSpend']>[0];

  async processSpend(
    input: Parameters<CoinSpendPort['processSpend']>[0],
  ): Promise<CoinSpendResult> {
    this.lastInput = input;
    return {
      transactionId: `tx-spend-${Math.random()}`,
      newBalance: 1000 - input.amount,
      appliedDelta: -input.amount,
    };
  }
}

class FakeCoinIngestion implements CoinIngestionPort {
  lastEvent?: CoinEventInput;
  private txIdCounter = 1;

  async processCoinEvent(
    event: Parameters<CoinIngestionPort['processCoinEvent']>[0],
  ): Promise<CoinEventResult> {
    this.lastEvent = event;
    return {
      newBalance: 500 + event.amount,
    };
  }

  setTransactionId(key: string, id: string, repo: FakeCoinRepository): void {
    repo.transactionIdByKey.set(key, id);
  }
}

function makeMetrics(): CoinMetricsService {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as {
    info: () => void;
    warn: () => void;
    error: () => void;
    debug: () => void;
    trace: () => void;
    fatal: () => void;
  };
  return new CoinMetricsService(logger as never);
}

function makeConfigService(overrides: Record<string, unknown> = {}): {
  get: (path: string) => unknown;
} {
  return {
    get: (path: string) => overrides[path] ?? null,
  };
}

const DEFAULT_DAILY_CAP = 10_000_000;

function makeService(
  overrides: {
    config?: Record<string, unknown>;
    repo?: FakeCoinRepository;
    spend?: FakeCoinSpend;
    ingestion?: FakeCoinIngestion;
    metrics?: CoinMetricsService;
  } = {},
) {
  const repo = overrides.repo ?? new FakeCoinRepository();
  const spend = overrides.spend ?? new FakeCoinSpend();
  const ingestion = overrides.ingestion ?? new FakeCoinIngestion();
  const config = makeConfigService(overrides.config ?? {});
  const metrics = overrides.metrics ?? makeMetrics();
  const service = new CoinApplicationService(repo, spend, ingestion, config as never, metrics);
  return { service, repo, spend, ingestion, config, metrics };
}

describe('CoinApplicationService adminAdjust', () => {
  it('refuses self-adjustment when targetUserId equals adminUserId', async () => {
    const { service } = makeService();
    await expect(
      service.adminAdjust('admin-1', {
        userId: 'admin-1',
        amount: 100,
        reason: 'test',
      }),
    ).rejects.toBeInstanceOf(CoinAdminSelfAdjustmentError);
  });

  it('refuses adjustment exceeding the per-admin daily cap for grants', async () => {
    const repo = new FakeCoinRepository();
    repo.getAdminDailyAdjustmentSum = async () => 9_900_000;

    const { service } = makeService({
      repo,
      config: { 'coinAdmin.dailyCapPerAdmin': DEFAULT_DAILY_CAP },
    });

    await expect(
      service.adminAdjust('admin-1', {
        userId: 'user-1',
        amount: 200_000,
        reason: 'test grant exceeding cap',
      }),
    ).rejects.toBeInstanceOf(CoinAdminDailyCapExceededError);
  });

  it('allows an adjustment that exactly reaches the daily cap', async () => {
    const repo = new FakeCoinRepository();
    repo.getAdminDailyAdjustmentSum = async () => 9_990_000;
    const ingestion = new FakeCoinIngestion();
    repo.findTransactionIdByIdempotencyKey = async (key: string) => `tx-${key}`;

    const { service } = makeService({
      repo,
      ingestion,
      config: { 'coinAdmin.dailyCapPerAdmin': DEFAULT_DAILY_CAP },
    });

    const result = await service.adminAdjust('admin-1', {
      userId: 'user-1',
      amount: 10_000,
      reason: 'exact cap',
    });

    expect(result.transactionId).toBeDefined();
  });

  it('records successful adjustment in the daily counter', async () => {
    const repo = new FakeCoinRepository();
    const ingestion = new FakeCoinIngestion();
    repo.findTransactionIdByIdempotencyKey = async (key: string) => `tx-${key}`;
    const metrics = makeMetrics();
    const { service } = makeService({ repo, ingestion, metrics });

    await service.adminAdjust('admin-1', {
      userId: 'user-1',
      amount: 500,
      reason: 'grant',
    });

    expect(
      (metrics as unknown as { logger: { info: jest.Mock } }).logger.info,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coin_admin_adjustment_ok',
        metric: 'coin_admin_adjustments_total',
        outcome: 'ok',
      }),
    );
  });

  it('records refused adjustment in the metrics when self-adjusting', async () => {
    const metrics = makeMetrics();
    const { service } = makeService({ metrics });

    await expect(
      service.adminAdjust('admin-1', {
        userId: 'admin-1',
        amount: 100,
        reason: 'test',
      }),
    ).rejects.toBeInstanceOf(CoinAdminSelfAdjustmentError);

    expect(
      (metrics as unknown as { logger: { warn: jest.Mock } }).logger.warn,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coin_admin_adjustment_refused',
        metric: 'coin_admin_adjustments_total',
        outcome: 'refused',
      }),
    );
  });

  it('records refused adjustment when daily cap exceeded', async () => {
    const repo = new FakeCoinRepository();
    repo.getAdminDailyAdjustmentSum = async () => 9_900_000;
    const metrics = makeMetrics();
    const { service } = makeService({
      repo,
      config: { 'coinAdmin.dailyCapPerAdmin': DEFAULT_DAILY_CAP },
      metrics,
    });

    await expect(
      service.adminAdjust('admin-1', {
        userId: 'user-1',
        amount: 200_000,
        reason: 'over cap',
      }),
    ).rejects.toBeInstanceOf(CoinAdminDailyCapExceededError);

    expect(
      (metrics as unknown as { logger: { warn: jest.Mock } }).logger.warn,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coin_admin_adjustment_refused',
        metric: 'coin_admin_adjustments_total',
        outcome: 'refused',
      }),
    );
  });

  it('does not check the daily cap for negative adjustments (clawbacks)', async () => {
    const repo = new FakeCoinRepository();
    repo.getAdminDailyAdjustmentSum = async () => DEFAULT_DAILY_CAP + 1;
    const spend = new FakeCoinSpend();

    const { service } = makeService({ repo, spend });

    await service.adminAdjust('admin-1', {
      userId: 'user-1',
      amount: -100,
      reason: 'clawback',
    });

    expect(spend.lastInput).toBeDefined();
  });

  it('uses the configured daily cap from the config service', async () => {
    const repo = new FakeCoinRepository();
    repo.getAdminDailyAdjustmentSum = async () => 80;
    const metrics = makeMetrics();
    const { service } = makeService({
      repo,
      config: { 'coinAdmin.dailyCapPerAdmin': 100 },
      metrics,
    });

    await expect(
      service.adminAdjust('admin-1', {
        userId: 'user-1',
        amount: 30,
        reason: 'over custom cap',
      }),
    ).rejects.toBeInstanceOf(CoinAdminDailyCapExceededError);
  });
});
