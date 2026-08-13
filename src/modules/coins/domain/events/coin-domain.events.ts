/**
 * Coin Domain Events
 *
 * Two events are emitted by the coin ingestion flow:
 *
 *   - `CoinBalanceChangedEvent` — fired by `CoinOutboxProcessorService`
 *     after a wallet delta is committed. Carries the post-update balance so
 *     listeners (realtime gateway, social-feed projector) don't have to
 *     re-read the row.
 *
 *   - `CoinTransactionRecordedEvent` — same fan-out, but with the full
 *     ledger row payload (for the wallet history page that wants to
 *     prepend without refetching, or the social-feed entry that wants the
 *     reason + amount + balanceAfter triplet).
 *
 * Both events are **in-process** — see `CoinDomainEventBus`. The realtime
 * gateway is one of the consumers; the social feed activity projector is
 * another (Phase 5 hooks it up).
 */

import type { CoinReason } from '../types/coin.types';

/**
 * Event emitted when a user's wallet balance changes (positive or
 * negative delta). Positive deltas come from the earn-side ingestion
 * path; negative deltas come from the spend-side path (Phase 4 deliverable).
 */
export interface CoinBalanceChangedEvent {
  readonly eventType: 'coin.balance_changed';
  readonly userId: string;
  /** Signed integer — positive for earnings, negative for spends. */
  readonly delta: number;
  readonly reason: CoinReason;
  readonly newBalance: number;
  /** Coarse reference discriminator — matches the ledger's `reference_type` column. */
  readonly referenceType:
    | 'attempt'
    | 'daily_challenge'
    | 'streak'
    | 'badge'
    | 'tournament'
    | 'tip'
    | 'flair'
    | 'suppress'
    | 'admin'
    | null;
  /** Opaque ID of the source row (attempt_id, challenge_id, …). */
  readonly referenceId: string | null;
  readonly timestamp: Date;
}

/**
 * Event emitted when a `coin_transactions` row is recorded. The payload
 * is a flat shape suitable for the realtime `coin:transaction_recorded`
 * wire event (§10.1) and the future social-feed activity entry.
 *
 * `balanceAfter` is denormalised per-row so a history-page consumer can
 * render without re-aggregating over the ledger.
 */
export interface CoinTransactionRecordedEvent {
  readonly eventType: 'coin.transaction_recorded';
  readonly transactionId: string;
  readonly userId: string;
  readonly reason: CoinReason;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly referenceType:
    | 'attempt'
    | 'daily_challenge'
    | 'streak'
    | 'badge'
    | 'tournament'
    | 'tip'
    | 'flair'
    | 'suppress'
    | 'admin'
    | null;
  readonly referenceId: string | null;
  readonly timestamp: Date;
}

/**
 * Union of all events emitted by the coin domain bus.
 */
export type CoinDomainEvent = CoinBalanceChangedEvent | CoinTransactionRecordedEvent;
