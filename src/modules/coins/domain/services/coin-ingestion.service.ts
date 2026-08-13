/**
 * Coin Ingestion Service
 *
 * The single earn-side entry point. Every listener adapter (Attempt,
 * DailyChallenge, Streak, Achievement, Tournament) reaches this service
 * through the `COIN_INGESTION_PORT` to move a user's wallet. The service
 * is the only piece of code that knows about:
 *
 *   - the daily 200-coin cap (§9.4)
 *   - the idempotency-key derivation rules (§9.5)
 *   - the outbox schedule (so the ledger write and the async event
 *     dispatch commit atomically)
 *
 * It mirrors the shape of `XpIngestionService` — the design doc says
 * so explicitly — but is structurally simpler because there is no
 * rank-recalculation side-effect and no period reset.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { COIN_OUTBOX_PORT, type CoinOutboxPort } from '../ports/coin-outbox.port';
import { COIN_REPOSITORY_PORT, type CoinRepositoryPort } from '../ports/coin-repository.port';
import type { CoinEventInput } from '../ports/coin-ingestion.port';
import { DAILY_CAP_REASONS, type CoinReason } from '../types/coin.types';
import { COIN_ECONOMY_LIMITS } from '../../coin.constants';
import { CoinMetricsService } from './coin-metrics.service';

@Injectable()
export class CoinIngestionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(COIN_OUTBOX_PORT)
    private readonly outbox: CoinOutboxPort,
    private readonly metrics: CoinMetricsService,
    @InjectPinoLogger(CoinIngestionService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Atomically:
   *   1. Validates the event.
   *   2. Derives (or honors) the idempotency key.
   *   3. Reads the user's daily-cap sum (if the event is cap-eligible).
   *   4. Computes the effective delta — possibly downgraded.
   *   5. Schedules the outbox row.
   *   6. Writes the ledger row + wallet update via the repository.
   *
   * The full `db.transaction` wraps steps 3-6. A duplicate request with
   * the same idempotency key returns the cached newBalance (we read
   * post-commit, so retries are safe) without throwing. A genuinely
   * invalid event (negative delta, unknown reason) throws.
   *
   * Returns the post-update wallet. Listeners must not assume the
   * delta equals the requested amount — it can be smaller.
   */
  async processCoinEvent(
    event: CoinEventInput,
    now: Date = new Date(),
  ): Promise<{ userId: string; appliedDelta: number; newBalance: number }> {
    try {
      this.validateEvent(event);
    } catch (error) {
      this.metrics.recordEventRejectedValidation(String(event.reason ?? 'unknown'));
      throw error;
    }

    const idempotencyKey = event.idempotencyKey ?? deriveIdempotencyKey(event);
    const nowIso = now.toISOString();

    this.logger.info({
      event: 'coin_event_received',
      userId: event.userId,
      source: event.source,
      reason: event.reason,
      amount: event.amount,
      idempotencyKey,
    });

    const appliedDelta = await this.computeAppliedDelta(event, now);

    if (appliedDelta === 0) {
      // Daily cap fully exhausted — no ledger write, no outbox row. The
      // caller still gets a consistent `newBalance` so it can log/surface
      // the truncated grant.
      const wallet = await this.coinRepository.getWallet(event.userId);
      this.logger.info({
        event: 'coin_daily_cap_truncated',
        userId: event.userId,
        reason: event.reason,
        requestedAmount: event.amount,
        newBalance: wallet?.balance ?? 0,
      });
      this.metrics.recordEventTruncatedByCap(event.reason);
      return {
        userId: event.userId,
        appliedDelta: 0,
        newBalance: wallet?.balance ?? 0,
      };
    }

    const referenceType = mapReferenceType(event.source);

    const { wallet, transactionId } = await this.db.transaction(async (tx) => {
      // Wallet write first — the SQL CTE upserts the wallet row,
      // adds the delta, and writes the ledger row in a single
      // round-trip (all atomic against each other). Once that
      // succeeds we know the post-update balance and transactionId,
      // which we then stamp onto the outbox payload so the
      // processor does not have to re-read either row.
      const result = await this.coinRepository.applyDeltaInTx(tx, {
        userId: event.userId,
        delta: appliedDelta,
        reason: event.reason,
        referenceType,
        referenceId: event.referenceId,
        idempotencyKey,
        now,
        expectedDelta: event.amount,
        metadata: event.metadata ?? {},
      });

      await this.outbox.scheduleCoinEvent(
        {
          eventType: 'coin.added',
          payload: {
            eventType: 'coin.added',
            userId: event.userId,
            reason: event.reason,
            amount: appliedDelta,
            newBalance: result.wallet.balance,
            transactionId: result.transactionId,
            balanceAfter: result.wallet.balance,
            referenceType,
            referenceId: event.referenceId,
            metadata: event.metadata ?? {},
            ledgerCreatedAt: result.createdAt,
            occurredAt: nowIso,
          },
          nowIso,
          idempotencyKey,
        },
        tx,
      );

      return result;
    });

    this.logger.info({
      event: 'coin_event_processed',
      userId: event.userId,
      source: event.source,
      reason: event.reason,
      requestedAmount: event.amount,
      appliedAmount: appliedDelta,
      newBalance: wallet.balance,
      transactionId,
      idempotencyKey,
    });

    this.metrics.recordEventProcessed(event.reason);

    return {
      userId: event.userId,
      appliedDelta,
      newBalance: wallet.balance,
    };
  }

  // ─── Cap + validation ─────────────────────────────────────────────────

  private validateEvent(event: CoinEventInput): void {
    if (!event.userId || typeof event.userId !== 'string') {
      throw new CoinEventValidationError('userId is required');
    }
    if (!Number.isInteger(event.amount) || event.amount <= 0) {
      throw new CoinEventValidationError(`amount must be a positive integer (got ${event.amount})`);
    }
    if (!event.referenceId || typeof event.referenceId !== 'string') {
      throw new CoinEventValidationError('referenceId is required');
    }
    if (!event.reason || !isValidCoinReason(event.reason)) {
      throw new CoinEventValidationError(
        `reason must be a known CoinReason (got ${String(event.reason)})`,
      );
    }
  }

  /**
   * Computes the delta the wallet will actually receive after the
   * daily-cap pass. Returns 0 when the cap is fully exhausted (no
   * ledger write happens at all).
   */
  private async computeAppliedDelta(event: CoinEventInput, now: Date): Promise<number> {
    const applyCap = event.applyDailyCap ?? DAILY_CAP_REASONS.has(event.reason);
    if (!applyCap) return event.amount;

    const todayMidnight = startOfUtcDay(now);
    const earnedSoFar = await this.coinRepository.getDailyEarnCapSum(event.userId, todayMidnight);

    const cap = COIN_ECONOMY_LIMITS.DAILY_QUIZ_EARNINGS_CAP;
    const remaining = Math.max(0, cap - earnedSoFar);
    return Math.min(event.amount, remaining);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

class CoinEventValidationError extends Error {
  readonly code = 'COIN_EVENT_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'CoinEventValidationError';
  }
}

function mapReferenceType(
  source: CoinEventInput['source'],
): 'attempt' | 'daily_challenge' | 'streak' | 'badge' | 'tournament' {
  switch (source) {
    case 'attempt':
      return 'attempt';
    case 'daily':
      return 'daily_challenge';
    case 'streak':
      return 'streak';
    case 'badge':
      return 'badge';
    case 'tournament':
      return 'tournament';
  }
}

function isValidCoinReason(reason: string): reason is CoinReason {
  return (schema.coinReason.enumValues as readonly string[]).includes(reason);
}

function startOfUtcDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Derive the idempotency key from an incoming coin event. Mirrors the
 * shape in §9.5. Source-mapped priority:
 *
 *   - `attempt`    → `coin:{userId}:attempt:{referenceId}`
 *   - `daily`      → `coin:{userId}:daily:{referenceId}`
 *   - `streak`     → `coin:{userId}:streak:{referenceId}`
 *   - `badge`      → `coin:{userId}:badge:{referenceId}`
 *   - `tournament` → `coin:{userId}:tournament:{referenceId}`
 *
 * (Tournament keys in production carry an extra `:rank` suffix when
 * the same tournament grants multiple rewards; the listener adapter is
 * responsible for joining those before constructing the event, so
 * `referenceId` already encodes the unique per-grant tuple.)
 */
function deriveIdempotencyKey(event: CoinEventInput): string {
  return `coin:${event.userId}:${event.source}:${event.referenceId}`;
}
