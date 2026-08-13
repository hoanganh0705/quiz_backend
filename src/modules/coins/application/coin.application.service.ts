/**
 * Coin Application Service
 *
 * Phase 4 read-side orchestration:
 *
 *   - `getMyWallet(userId)`        — returns the cached balance + today's
 *                                    daily-cap usage. Fast read for the
 *                                    header pill and the wallet page.
 *   - `listMyTransactions(userId)` — cursor-paginated ledger read.
 *
 * The presenter (`coin.presenter.ts`) wraps these into the canonical
 * `{ data, meta }` envelope. The application service deliberately
 * emits a `{ items, pagination }` shape so the presenter can wrap it
 * uniformly with other paginated endpoints.
 *
 * Writes (tip / flair / suppress / admin adjust) remain 501 stubs in
 * Phase 4 — they are scheduled for a future deliverable per the design
 * doc's phased rollout. The controller keeps the route mounted so the
 * OpenAPI stays stable.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  COIN_REPOSITORY_PORT,
  type CoinRepositoryPort,
} from '../domain/ports/coin-repository.port';
import {
  COIN_SPEND_PORT,
  type CoinSpendInput,
  type CoinSpendPort,
  type CoinSpendResult,
} from '../domain/ports/coin-spend.port';
import {
  COIN_INGESTION_PORT,
  type CoinIngestionPort,
  type CoinEventInput,
} from '../domain/ports/coin-ingestion.port';
import { COIN_SPEND_AMOUNTS, COIN_ECONOMY_LIMITS } from '../coin.constants';
import { CoinAdminAdjustmentReasonRequiredError } from '../domain/errors/coin-spend.errors';
import type { CoinSpendResponseDto } from '../dto/response/coin-spend-response.dto';
import type { CoinTransactionsResponseDto } from '../dto/response/coin-transactions.dto';
import type { CoinWalletResponseDto } from '../dto/response/coin-wallet.dto';
import type { CoinTipRequestDto } from '../dto/request/coin-tip-request.dto';
import type { CoinFlairRequestDto } from '../dto/request/coin-flair-request.dto';
import type { CoinSuppressRequestDto } from '../dto/request/coin-suppress-request.dto';
import type { CoinAdminAdjustRequestDto } from '../dto/request/coin-admin-adjust-request.dto';
import type { CoinReason } from '../domain/types/coin.types';

const DEFAULT_TRANSACTIONS_LIMIT = 20;
const MAX_TRANSACTIONS_LIMIT = 50;

type CursorPayload = {
  createdAt: string;
  transactionId: string;
};

@Injectable()
export class CoinApplicationService {
  constructor(
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(COIN_SPEND_PORT)
    private readonly coinSpend: CoinSpendPort,
    @Inject(COIN_INGESTION_PORT)
    private readonly coinIngestion: CoinIngestionPort,
  ) {}

  /**
   * Returns the wallet + today's daily-cap usage.
   *
   * Lazy creation: a user who has never been credited does not have a
   * `user_wallets` row. We return a synthetic zero-balance shape
   * (`createdAt`/`updatedAt` = request time, `lastTransactionAt` =
   * null) so the UI never has to render a "missing wallet" state.
   */
  async getMyWallet(userId: string): Promise<CoinWalletResponseDto> {
    const wallet = await this.coinRepository.getWallet(userId);
    const todayMidnight = startOfUtcDay(new Date());
    const earnedToday = await this.coinRepository.getDailyEarnCapSum(userId, todayMidnight);

    if (wallet) {
      return {
        balance: wallet.balance,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
        lastTransactionAt: wallet.updatedAt,
        earnedToday,
        dailyEarnCap: COIN_ECONOMY_LIMITS.DAILY_QUIZ_EARNINGS_CAP,
      };
    }

    const now = new Date().toISOString();
    return {
      balance: 0,
      createdAt: now,
      updatedAt: now,
      lastTransactionAt: null,
      earnedToday,
      dailyEarnCap: COIN_ECONOMY_LIMITS.DAILY_QUIZ_EARNINGS_CAP,
    };
  }

  /**
   * Cursor-paginated ledger read. The cursor is opaque base64url;
   * any malformed cursor surfaces as `null` (start from latest).
   */
  async listMyTransactions(
    userId: string,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<CoinTransactionsResponseDto> {
    const effectiveLimit = clampLimit(limit);

    const decoded = decodeCursor(cursor);
    const rows = await this.coinRepository.listTransactions({
      userId,
      cursorCreatedAt: decoded?.createdAt ?? null,
      cursorTransactionId: decoded?.transactionId ?? null,
      limit: effectiveLimit + 1, // +1 to detect next page
    });

    const hasNextPage = rows.length > effectiveLimit;
    const pageRows = hasNextPage ? rows.slice(0, effectiveLimit) : rows;
    const lastRow = pageRows.at(-1);

    return {
      items: pageRows.map((row) => ({
        transactionId: row.transactionId,
        amount: row.amount,
        balanceAfter: row.balanceAfter,
        reason: row.reason,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      pagination: {
        kind: 'cursor' as const,
        limit: effectiveLimit,
        hasNextPage,
        nextCursor:
          hasNextPage && lastRow
            ? encodeCursor({
                createdAt: lastRow.createdAt,
                transactionId: lastRow.transactionId,
              })
            : null,
      },
    };
  }

  // ─── Phase 6 (S-coin-spend): spend-side orchestration ─────────────────

  /**
   * Tip a quiz author. Delegates to `CoinSpendService`; this method
   * builds the `idempotencyKey` and `metadata` payload and returns a
   * `{ transactionId, balance, createdAt }` envelope.
   */
  async tipUser(
    callerUserId: string,
    body: CoinTipRequestDto,
    idempotencyKey: string,
  ): Promise<CoinSpendResponseDto> {
    const amount = body.amount; // enum value
    const result = await this.spend({
      userId: callerUserId,
      category: 'tip',
      reason: 'TIP_SENT' as CoinReason,
      amount,
      referenceId: body.recipientUserId,
      idempotencyKey,
      metadata: {
        recipientUserId: body.recipientUserId,
        quizId: body.quizId ?? null,
        message: body.message ?? null,
      },
    });
    return this.toSpendResponseDto(result);
  }

  /**
   * Pin one of the caller's owned badges to their profile for 7 days.
   * Writes a row to `user_flair_slots` AFTER the ledger row commits so
   * the slot cannot exist without a corresponding spend (the unique
   * index on `user_flair_slots.coin_transaction_id` enforces the
   * 1:1 relationship in the same transaction).
   */
  async purchaseFlair(
    callerUserId: string,
    body: CoinFlairRequestDto,
    idempotencyKey: string,
  ): Promise<CoinSpendResponseDto> {
    const amount = COIN_SPEND_AMOUNTS.PROFILE_FLAIR_SLOT_7D;
    const result = await this.spend({
      userId: callerUserId,
      category: 'flair',
      reason: 'FLAIR_PURCHASED' as CoinReason,
      amount,
      referenceId: body.userBadgeId,
      idempotencyKey,
      metadata: {
        userBadgeId: body.userBadgeId,
        durationDays: 7,
      },
    });
    await this.writeFlairSlotRow(callerUserId, body.userBadgeId, result.transactionId, 7);
    return this.toSpendResponseDto(result);
  }

  /**
   * Hide a quiz from the caller's Recommended rail for 30 days.
   * Writes a row to `user_quiz_suppressions` in the same way as the
   * flair flow.
   */
  async suppressRecommendedQuiz(
    callerUserId: string,
    body: CoinSuppressRequestDto,
    idempotencyKey: string,
  ): Promise<CoinSpendResponseDto> {
    const amount = COIN_SPEND_AMOUNTS.SUPPRESS_RECOMMENDED_30D;
    const result = await this.spend({
      userId: callerUserId,
      category: 'suppress',
      reason: 'SUPPRESS_RECOMMENDED_PURCHASED' as CoinReason,
      amount,
      referenceId: body.quizId,
      idempotencyKey,
      metadata: {
        quizId: body.quizId,
        durationDays: 30,
      },
    });
    await this.writeSuppressionRow(callerUserId, body.quizId, result.transactionId, 30);
    return this.toSpendResponseDto(result);
  }

  /**
   * Admin credit / clawback. The amount is signed; positive credits,
   * negative debits. The `reason` field is REQUIRED and persisted to
   * `metadata.reason` so the ledger is the audit trail.
   *
   * Implementation note: the admin path does not flow through
   * `CoinSpendService.processSpend` because that service treats
   * amounts as positive costs and flips the sign. For admin
   * adjustments the caller is trusted with the sign itself; we hand
   * the signed amount to `CoinIngestionService` (for positive) or to
   * the spend-side repository helper (for negative) so the wallet
   * row count guard still applies on the clawback case.
   */
  async adminAdjust(
    adminUserId: string,
    body: CoinAdminAdjustRequestDto,
  ): Promise<CoinSpendResponseDto> {
    if (!body.reason || body.reason.trim().length === 0) {
      throw new CoinAdminAdjustmentReasonRequiredError(adminUserId);
    }
    const idempotencyKey = body.idempotencyKey ?? cryptoRandomUuid();
    const metadata = {
      adminUserId,
      reason: body.reason,
      kind: 'admin_adjustment',
    };

    let newBalance: number;
    let transactionId: string;

    if (body.amount > 0) {
      const event: CoinEventInput = {
        userId: body.userId,
        source: 'attempt', // re-using the source enum for admin grants
        amount: body.amount,
        reason: 'ADMIN_ADJUSTMENT' as CoinReason,
        referenceId: adminUserId,
        idempotencyKey,
        metadata,
        applyDailyCap: false,
      };
      const result = await this.coinIngestion.processCoinEvent(event);
      newBalance = result.newBalance;
      transactionId = await this.lookupTransactionId(idempotencyKey);
    } else if (body.amount < 0) {
      const input: CoinSpendInput = {
        userId: body.userId,
        category: 'admin',
        reason: 'ADMIN_ADJUSTMENT' as CoinReason,
        amount: -body.amount,
        referenceId: adminUserId,
        idempotencyKey,
        metadata,
      };
      const result = await this.coinSpend.processSpend(input);
      newBalance = result.newBalance;
      transactionId = result.transactionId;
    } else {
      throw new CoinAdminAdjustmentReasonRequiredError(adminUserId);
    }

    return {
      transactionId,
      balance: newBalance,
      createdAt: new Date().toISOString(),
      amount: body.amount,
    };
  }

  // ─── Spend side-table writers ────────────────────────────────────────

  /**
   * Append a row to `user_flair_slots` for the freshly-debited
   * transaction. The unique index on
   * `user_flair_slots.coin_transaction_id` guarantees idempotency: a
   * retry of the same spend call will conflict and this insert will
   * short-circuit.
   */
  private async writeFlairSlotRow(
    userId: string,
    userBadgeId: string,
    coinTransactionId: string,
    durationDays: number,
  ): Promise<void> {
    await this.coinRepository.writeFlairSlot({
      userId,
      userBadgeId,
      coinTransactionId,
      durationDays,
    });
  }

  private async writeSuppressionRow(
    userId: string,
    quizId: string,
    coinTransactionId: string,
    durationDays: number,
  ): Promise<void> {
    await this.coinRepository.writeQuizSuppression({
      userId,
      quizId,
      coinTransactionId,
      durationDays,
    });
  }

  private async spend(input: CoinSpendInput): Promise<CoinSpendResult> {
    return this.coinSpend.processSpend(input);
  }

  private toSpendResponseDto(result: CoinSpendResult): CoinSpendResponseDto {
    return {
      transactionId: result.transactionId,
      balance: result.newBalance,
      createdAt: new Date().toISOString(),
      amount: result.appliedDelta,
    };
  }

  /**
   * After `CoinIngestionService.processCoinEvent` runs we need the
   * `transaction_id` it produced (the ingestion service returns the
   * new balance but not the ledger-row id). The admin-adjust path
   * uses the deterministic idempotency key as the lookup so we don't
   * need a new port method.
   */
  private async lookupTransactionId(idempotencyKey: string): Promise<string> {
    const txId = await this.coinRepository.findTransactionIdByIdempotencyKey(idempotencyKey);
    if (!txId) {
      throw new Error(`adminAdjust: ledger row not found for idempotencyKey=${idempotencyKey}`);
    }
    return txId;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function cryptoRandomUuid(): string {
  // Use the global crypto API; the project does not have `uuid` in the
  // spend path's dependency tree.
  return (
    (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
    // Fallback: 32 hex chars (uuidv4-shaped). Should never hit in
    // Node.js 18+ where `crypto.randomUUID` is always available.
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  );
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_TRANSACTIONS_LIMIT;
  if (limit < 1) return 1;
  if (limit > MAX_TRANSACTIONS_LIMIT) return MAX_TRANSACTIONS_LIMIT;
  return Math.floor(limit);
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeCursor(raw: string | undefined): CursorPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.createdAt === 'string' &&
      typeof parsed.transactionId === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function startOfUtcDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
