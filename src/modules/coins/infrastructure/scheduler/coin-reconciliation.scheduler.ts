/**
 * Coin Reconciliation Scheduler (Phase 7 — §16).
 *
 * Nightly job that scans `user_wallets.balance` against
 * `SUM(coin_transactions.amount)` for every active user. A drift row
 * is logged at `error` level (with the full payload — `userId`,
 * `storedBalance`, `expectedBalance`) and increments the
 * `coin_wallet_balance_drift_total` Prometheus counter via
 * `CoinMetricsService`.
 *
 * ## Scheduling
 *
 *   `@Cron('0 2 * * *')` — 02:00 UTC nightly. Picked the 02:00 slot
 *   to keep it 90 minutes after the comment reconciler (03:30 — see
 *   `CommentCounterReconcilerService`) so the two jobs cannot race
 *   on shared rows, and 90 minutes before the ranking consistency
 *   check (03:30) so the on-call path has the coin drift summary
 *   available when the XP drift summary arrives.
 *
 * ## Distributed lock
 *
 * `coin:cron:reconcile` — Redis advisory lock with a 5-minute TTL.
 * In a multi-replica deployment only one instance runs the job per
 * night; the others log `coin_reconciliation_skipped_lock_held` at
 * `debug` and exit.
 *
 * ## Why "log + counter" and not auto-heal
 *
 * The ledger is the source of truth (design §9.6) — a drifted
 * `user_wallets.balance` is a *bug*, not a routine state, and the
 * fix path is non-trivial:
 *
 *   - Was the credit correct and the wallet update lost? Refund the
 *     user, investigate the write path.
 *   - Was the debit correct and the wallet over-deducted? Refill
 *     the user, investigate the write path.
 *   - Is the ledger row a duplicate from a retry? Reverse the
 *     duplicate.
 *
 * None of those are safe to automate. The on-call path reads the
 * `error`-level log lines, reconciles in a transaction with
 * `SELECT … FOR UPDATE`, and ships a fix PR with the audit trail.
 *
 * Mirrors `RankingSchedulerService.handleConsistencyCheck`.
 */

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

  /**
   * Runs at 02:00 UTC every night. Acquires the global reconcile
   * lock, scans for drift rows, logs + counts each one. Never throws
   * — failures are caught and logged at `error` so a transient DB
   * hiccup doesn't take down the cron loop.
   */
  @Cron('0 2 * * *')
  async reconcileWallets(): Promise<void> {
    const lockToken = crypto.randomUUID();
    const acquired = await this.cache.acquireAdvisoryLock(
      RECONCILE_LOCK_KEY,
      RECONCILE_LOCK_TTL_MS,
    );

    if (!acquired) {
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
        // One error log + one counter increment per drift row. The
        // log carries the full payload so the on-call has both the
        // aggregate count (Prometheus) and the per-row diagnostic
        // (Loki / grep).
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
