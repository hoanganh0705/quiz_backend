import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CACHE_PROVIDER, type CacheProvider } from '@/common/ports/cache.provider';
import {
  COIN_REPOSITORY_PORT,
  type CoinRepositoryPort,
} from '../../domain/ports/coin-repository.port';
import { CoinMetricsService } from '../../domain/services/coin-metrics.service';

const RECONCILE_LOCK_KEY = 'coin:cron:reconcile';
const RECONCILE_LOCK_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CoinReconciliationSchedulerService {
  constructor(
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(CACHE_PROVIDER)
    private readonly cache: CacheProvider,
    private readonly metrics: CoinMetricsService,
    @InjectPinoLogger(CoinReconciliationSchedulerService.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron('0 2 * * *')
  async reconcileWallets(): Promise<void> {
    const lockToken = await this.cache.acquireAdvisoryLock(
      RECONCILE_LOCK_KEY,
      RECONCILE_LOCK_TTL_MS,
    );

    if (lockToken === null) {
      this.logger.debug({
        event: 'coin_reconciliation_skipped_lock_held',
        job: 'reconcileWallets',
      });
      return;
    }

    try {
      const startTime = Date.now();
      const mismatches = await this.coinRepository.findCoinMismatches();

      for (const row of mismatches) {
        this.logger.error({
          event: 'coin_wallet_balance_drift',
          userId: row.userId,
          storedBalance: row.storedBalance,
          expectedBalance: row.expectedBalance,
          delta: row.storedBalance - row.expectedBalance,
        });
        this.metrics.recordWalletBalanceDrift();
      }

      if (mismatches.length > 0) {
        this.logger.warn({
          event: 'coin_reconciliation_completed_with_drift',
          driftCount: mismatches.length,
          durationMs: Date.now() - startTime,
        });
      } else {
        this.logger.info({
          event: 'coin_reconciliation_passed',
          durationMs: Date.now() - startTime,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'coin_reconciliation_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.cache.releaseAdvisoryLock(RECONCILE_LOCK_KEY, lockToken);
    }
  }
}
