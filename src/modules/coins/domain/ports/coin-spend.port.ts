/**
 * Coin Spend Port
 *
 * The single entry point for the spend-side of the coin economy.
 * The application layer depends on this port; the implementation
 * (`CoinSpendService`) is the only place that mutates the wallet
 * for debit operations.
 *
 * Mirrors `CoinIngestionPort` (the earn-side entry point) so the
 * two halves of the economy have symmetrical shapes:
 *
 *   processCoinEvent (earn)  →  +delta, idempotency-key prefix per source
 *   processSpend      (spend) →  -delta, idempotency-key prefix per source
 *
 * Both methods:
 *   - validate the input,
 *   - run a daily-cap / balance-guard check inside a transaction,
 *   - write the wallet + ledger + outbox rows atomically,
 *   - return the post-spend wallet state.
 */

import type { CoinReason } from '../types/coin.types';

export type CoinSpendCategory = 'tip' | 'flair' | 'suppress' | 'admin';

export interface CoinSpendInput {
  /** Authenticated caller. The wallet being debited. */
  userId: string;
  /** Spend category. */
  category: CoinSpendCategory;
  /** Reason written into the ledger row. */
  reason: CoinReason;
  /** Coin amount to debit. Must be positive; the service flips the sign. */
  amount: number;
  /** Reference identifier — recipientUserId for tips, userBadgeId for flair, quizId for suppress, etc. */
  referenceId: string;
  /** Caller-supplied idempotency key (e.g. header value or a derived deterministic key). */
  idempotencyKey: string;
  /** Per-category metadata. Persisted to the ledger `metadata` jsonb. */
  metadata?: Record<string, unknown>;
}

export interface CoinSpendResult {
  userId: string;
  appliedDelta: number; // negative integer (e.g. -25)
  newBalance: number;
  transactionId: string;
}

export interface CoinSpendPort {
  /**
   * Atomically debit the user's wallet and append the ledger row.
   * Throws `InsufficientCoinsError` when the post-update balance
   * would go below zero. Throws category-specific domain errors
   * for self-tips, missing recipients, etc.
   */
  processSpend(input: CoinSpendInput, now?: Date): Promise<CoinSpendResult>;
}

export const COIN_SPEND_PORT = Symbol('COIN_SPEND_PORT');
