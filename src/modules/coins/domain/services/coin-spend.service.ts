/**
 * Coin Spend Service
 *
 * Spend-side counterpart to `CoinIngestionService`. Provides a single
 * `processSpend(...)` entry point that:
 *
 *   1. Validates the input (positive amount, known category, …).
 *   2. Runs category-specific guards (self-tip, daily tip cap, …).
 *   3. Calls `CoinRepository.applySpendInTx(...)` inside a
 *      transaction with the flipped-sign delta and the
 *      category-specific idempotency key.
 *   4. Schedules a `coin.spent` outbox event in the same
 *      transaction so the realtime fan-out stays in lock-step
 *      with the ledger.
 *
 * The earn side and the spend side share the same atomic guarantee:
 * `wallet.credit + ledger.insert + outbox.schedule` happen in one
 * transaction or none of them do. The two services are
 * deliberately separate (not a single `processCoinEvent` with a
 * signed delta) because the validation + guard rules differ enough
 * that bundling them would muddy each side's invariants.
 */

import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import { DRIZZLE } from '@/core/database/drizzle.constants';

import { COIN_OUTBOX_PORT, type CoinOutboxPort } from '../ports/coin-outbox.port';
import { COIN_REPOSITORY_PORT, type CoinRepositoryPort } from '../ports/coin-repository.port';
import {
  type CoinSpendInput,
  type CoinSpendPort,
  type CoinSpendResult,
} from '../ports/coin-spend.port';
import {
  InsufficientCoinsError,
  CoinFlairBadgeNotOwnedError,
  CoinSuppressAlreadyActiveError,
  CoinSuppressQuizNotFoundError,
  CoinTipDailyCapExceededError,
  CoinTipRecipientNotFoundError,
  CoinTipSelfNotAllowedError,
} from '../errors/coin-spend.errors';
import { CoinMetricsService } from './coin-metrics.service';

@Injectable()
export class CoinSpendService implements CoinSpendPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(COIN_OUTBOX_PORT)
    private readonly outbox: CoinOutboxPort,
    private readonly metrics: CoinMetricsService,
    @InjectPinoLogger(CoinSpendService.name)
    private readonly logger: PinoLogger,
  ) {}

  async processSpend(input: CoinSpendInput, now: Date = new Date()): Promise<CoinSpendResult> {
    this.validateInput(input);
    const nowIso = now.toISOString();

    await this.runPreTransactionGuards(input, now);

    const referenceType = mapReferenceType(input.category);
    const referenceId = input.referenceId;
    const delta = -input.amount;
    const metadata = input.metadata ?? {};

    let result: Awaited<ReturnType<CoinRepositoryPort['applySpendInTx']>>;
    try {
      result = await this.db.transaction(async (tx) => {
        const outcome = await this.coinRepository.applySpendInTx(tx, {
          userId: input.userId,
          cost: input.amount,
          reason: input.reason,
          referenceType,
          referenceId,
          idempotencyKey: input.idempotencyKey,
          now,
          metadata,
        });

        if (outcome === null) {
          // The wallet row count was zero (insufficient balance). The
          // atomic debit + ledger insert returned no rows; we throw so
          // the transaction rolls back. We surface the user-friendly
          // 409 *outside* the transaction (the rollback is already
          // implicit).
          throw new InsufficientCoinsDeferredError(input.userId, input.amount);
        }

        await this.outbox.scheduleCoinEvent(
          {
            eventType: 'coin.spent',
            payload: {
              eventType: 'coin.spent',
              userId: input.userId,
              reason: input.reason,
              amount: delta,
              newBalance: outcome.wallet.balance,
              transactionId: outcome.transactionId,
              balanceAfter: outcome.wallet.balance,
              referenceType,
              referenceId,
              category: input.category,
              metadata,
              ledgerCreatedAt: outcome.createdAt,
              occurredAt: nowIso,
            },
            nowIso,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );

        return outcome;
      });
    } catch (error) {
      if (error instanceof InsufficientCoinsDeferredError) {
        const wallet = await this.coinRepository.getWallet(input.userId);
        this.metrics.recordInsufficientCoins(input.category);
        throw new InsufficientCoinsError(input.userId, wallet?.balance ?? 0, input.amount);
      }
      throw error;
    }

    this.logger.info({
      event: 'coin_spend_processed',
      userId: input.userId,
      category: input.category,
      reason: input.reason,
      cost: input.amount,
      newBalance: result.wallet.balance,
      transactionId: result.transactionId,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      userId: input.userId,
      appliedDelta: delta,
      newBalance: result.wallet.balance,
      transactionId: result.transactionId,
    };
  }

  // ─── Pre-transaction guards ───────────────────────────────────────────

  /**
   * Category-specific guards that run BEFORE the wallet is debited.
   * These checks are intentionally read-only (no wallet writes); they
   * exist so we don't even *attempt* a debit when the request is
   * structurally invalid (self-tip, missing recipient, etc.).
   */
  private async runPreTransactionGuards(input: CoinSpendInput, now: Date): Promise<void> {
    if (input.category === 'tip') {
      if (input.referenceId === input.userId) {
        throw new CoinTipSelfNotAllowedError(input.userId);
      }
      const recipientExists = await this.coinRepository.recipientExists(input.referenceId);
      if (!recipientExists) {
        throw new CoinTipRecipientNotFoundError(input.referenceId);
      }
      // Daily tip-count cap.
      const todayMidnight = startOfUtcDay(now);
      const tipCountToday = await this.coinRepository.getDailyTipCount(input.userId, todayMidnight);
      // `DAILY_TIP_COUNT_CAP` is the soft cap from coin.constants.ts.
      // The +1 represents the tip the caller is about to send; we
      // refuse if that would push them over the cap.
      const cap = 3; // mirrors COIN_ECONOMY_LIMITS.DAILY_TIP_COUNT_CAP
      if (tipCountToday + 1 > cap) {
        throw new CoinTipDailyCapExceededError(input.userId, tipCountToday, cap);
      }
    }

    if (input.category === 'suppress') {
      const quizExists = await this.coinRepository.quizExists(input.referenceId);
      if (!quizExists) {
        throw new CoinSuppressQuizNotFoundError(input.referenceId);
      }
      const active = await this.coinRepository.getActiveSuppression(
        input.userId,
        input.referenceId,
        now.toISOString(),
      );
      if (active) {
        throw new CoinSuppressAlreadyActiveError(input.userId, input.referenceId, active.expiresAt);
      }
    }

    if (input.category === 'flair') {
      // The flair slot's `userBadgeId` is stored in `metadata.userBadgeId`.
      const userBadgeId =
        typeof input.metadata?.['userBadgeId'] === 'string'
          ? input.metadata['userBadgeId']
          : input.referenceId;
      const owns = await this.userBadgeIsOwned(input.userId, userBadgeId);
      if (!owns) {
        throw new CoinFlairBadgeNotOwnedError(input.userId, userBadgeId);
      }
    }
  }

  /**
   * Tiny adapter so the spend service does not have to import the
   * full `achievement` module's repository port. Keeps the module
   * dependency graph narrow (only the port is exposed); the
   * `CoinSpendService` is constructed with the `AchievementRepositoryPort`
   * via DI when this method is migrated to a port-based call in a
   * future phase. For now the check is delegated to the database
   * directly via a small query.
   */
  private async userBadgeIsOwned(userId: string, userBadgeId: string): Promise<boolean> {
    const result = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(
        SELECT 1 FROM user_badges
        WHERE user_badge_id = ${userBadgeId}::uuid
          AND user_id = ${userId}::uuid
          AND revoked_at IS NULL
      ) AS "exists"
    `);
    return Boolean(result.rows[0]?.exists);
  }

  private validateInput(input: CoinSpendInput): void {
    if (!input.userId) {
      throw new Error('CoinSpendService.processSpend: userId is required');
    }
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new Error(
        `CoinSpendService.processSpend: amount must be a positive integer (got ${input.amount})`,
      );
    }
    if (!input.idempotencyKey) {
      throw new Error('CoinSpendService.processSpend: idempotencyKey is required');
    }
    if (!input.referenceId) {
      throw new Error('CoinSpendService.processSpend: referenceId is required');
    }
  }
}

function mapReferenceType(
  category: CoinSpendInput['category'],
): 'tip' | 'flair' | 'suppress' | 'admin' {
  return category;
}

function startOfUtcDay(now: Date): Date {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Internal helper — raised INSIDE the transaction so the rollback
 * fires before we ever hit the network. Translated to a typed
 * `InsufficientCoinsError` outside the transaction by the
 * catch-block in `processSpend`.
 *
 * Why an internal type?  We need the *current* balance for the
 * 409 detail message; reading it inside the rolled-back txn would
 * see the pre-debit value (which is fine, but it's a redundant read).
 * Reading it after the rollback is also fine — and avoids a race
 * with concurrent writes.
 */
class InsufficientCoinsDeferredError extends Error {
  readonly code = 'INSUFFICIENT_COINS_DEFERRED';
  constructor(
    public readonly userId: string,
    public readonly required: number,
  ) {
    super('INSUFFICIENT_COINS_DEFERRED');
  }
}
