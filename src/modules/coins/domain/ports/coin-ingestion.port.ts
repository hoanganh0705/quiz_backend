/**
 * Coin Ingestion Port
 *
 * The single capability the earn-side flow needs from the coin domain
 * is `processCoinEvent` — an atomic, idempotent, capped wallet delta.
 *
 * Listeners (Attempt, DailyChallenge, Streak, Badge, Tournament) inject
 * this port instead of the full service so they cannot accidentally
 * reach into private helpers (the daily-cap enforcement, the outbox
 * schedule, the ledger write). The implementation is `CoinIngestionService`.
 */

import type { CoinReason } from '../types/coin.types';

/**
 * The shape all five listener adapters (and the controller, once Phase
 * 4 ships) converge on. Kept narrow so adding a new earning surface
 * requires touching exactly one place — the `CoinReason` enum + the
 * `processCoinEvent` switch on `source`.
 */
export interface CoinEventInput {
  userId: string;
  /** Source discriminator — selects idempotency-key shape per §9.5. */
  source: 'attempt' | 'daily' | 'streak' | 'badge' | 'tournament';
  /**
   * Coin delta to grant. Must be positive for earn-side flows.
   * Negative is reserved for the spend-side path (a future Phase 4
   * deliverable).
   */
  amount: number;
  /**
   * Reason enum value — persisted to `coin_reason` and used as the
   * `reason` discriminator on `CoinBalanceChangedEvent`. Defaults to
   * the source-mapped value when not supplied, but each surface
   * writes its own reasoning in its own mapping.
   */
  reason: CoinReason;
  /** Source-row identifier — attemptId, challengeId, etc. */
  referenceId: string;
  /** Optional explicit idempotency key; otherwise derived per §9.5. */
  idempotencyKey?: string;
  /**
   * Free-form metadata stamped onto the ledger `metadata` jsonb. Used
   * for the badge type on `BADGE_REWARD`, the streak milestone day on
   * `STREAK_MILESTONE_REWARD`, etc.
   */
  metadata?: Record<string, unknown>;
  /**
   * When `true` (default), the service applies the daily 200-coin cap
   * per §9.4 and downgrades the granted amount if over budget. Set
   * `false` for streak / badge / tournament / daily-challenge rewards
   * which are once-per-milestone and intentionally bypass the cap.
   */
  applyDailyCap?: boolean;
}

export interface CoinIngestionPort {
  /**
   * Atomic, idempotent wallet delta + ledger write + outbox schedule.
   * Returns the post-update wallet. Idempotency is enforced via the
   * outbox partial unique index and the ledger full unique index on
   * `idempotency_key`.
   *
   * This method never throws on duplicate requests — a 23505 conflict
   * on the outbox insert is treated as a successful no-op (the row was
   * either already there or skipped via `ON CONFLICT DO NOTHING`).
   * Real validation failures (negative delta, unknown reason) throw.
   */
  processCoinEvent(
    event: CoinEventInput,
    now?: Date,
  ): Promise<{
    userId: string;
    appliedDelta: number;
    newBalance: number;
  }>;
}

export const COIN_INGESTION_PORT = Symbol('COIN_INGESTION_PORT');
