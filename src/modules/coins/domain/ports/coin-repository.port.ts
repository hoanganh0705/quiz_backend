/**
 * Coin Wallet Repository Port
 *
 * Data-access surface for the wallet + ledger pair. The implementation
 * (`CoinRepository`) uses raw SQL for the atomic wallet-upsert +
 * ledger-insert path because Drizzle's typed builders cannot express the
 * `INSERT … ON CONFLICT DO NOTHING; UPDATE … ; INSERT INTO
 * coin_transactions` sequence in one transaction.
 *
 * The spend-side methods (`applySpendInTx`, `getTipRecipientWallet` for
 * P2P tips) are exposed here too — they're placeholders for Phase 4 work
 * and will throw `NotImplementedException` (or surface as `never` in TS)
 * until then. Including them now lets the service layer treat the port
 * as the full capability surface and avoids having to widen the port
 * mid-sprint.
 */

export type UserWalletRow = {
  userId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type CoinTransactionRow = {
  transactionId: string;
  userId: string;
  reason: string;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CoinReferenceType =
  | 'attempt'
  | 'daily_challenge'
  | 'streak'
  | 'badge'
  | 'tournament'
  | 'tip'
  | 'flair'
  | 'suppress'
  | 'admin';

export interface CoinRepositoryPort {
  /**
   * Return the user's wallet row, or `null` if no wallet has been created
   * yet. Note: a zero-balance wallet is NEVER explicitly created by
   * `applyDeltaInTx` — it's lazily upserted on the first write. This
   * function only returns rows that exist.
   */
  getWallet(userId: string): Promise<UserWalletRow | null>;

  /**
   * Total of `coin_transactions.amount` for the user across all
   * reasons. The source of truth per design §9.6. Used for the
   * reconciler (`findCoinMismatches`) and for backfills.
   */
  getLedgerSum(userId: string): Promise<number>;

  /**
   * Sum of today's earn-side credits that count toward the 200/day cap
   * (only `QUIZ_COMPLETION_REWARD` + `QUIZ_PERFECT_BONUS`). Used by the
   * ingestion service to downscale the delta on a high-burst day
   * (design §9.4).
   *
   * `todayUtcMidnight` is supplied by the caller so the test suite can
   * pin the cutoff.
   */
  getDailyEarnCapSum(userId: string, todayUtcMidnight: Date): Promise<number>;

  /**
   * Cursor-paginated read of a user's `coin_transactions` rows. The
   * cursor is a (createdAt, transactionId) tuple base64-encoded by the
   * caller; `null` starts from the latest. Newest-first ordering
   * matches the wallet history UI.
   */
  listTransactions(params: {
    userId: string;
    cursorCreatedAt: string | null;
    cursorTransactionId: string | null;
    limit: number;
  }): Promise<CoinTransactionRow[]>;

  /**
   * Atomic earn-side write. Atomically:
   *   1. Upserts the `user_wallets` row (zero-balance on first write).
   *   2. `UPDATE user_wallets SET balance = balance + :delta` clamped to
   *      `[0, 1_000_000]`.
   *   3. Inserts the ledger row with `balance_after = post-update
   *      wallet balance`.
   *
   * Returns the post-update wallet row. Idempotency is enforced upstream
   * by the partial unique index on `outbox_events.idempotency_key` (the
   * outbox row is committed first); the ledger row's full unique index
   * on `idempotency_key` is the second line of defense against
   * concurrent retries.
   *
   * `expectedDelta` is what the caller asked for; `appliedDelta` is
   * what the daily-cap pass actually allowed. They differ when the cap
   * truncated the grant.
   */
  applyDeltaInTx(
    tx: unknown,
    params: {
      userId: string;
      delta: number;
      reason: string;
      referenceType: CoinReferenceType;
      referenceId: string | null;
      idempotencyKey: string;
      now: Date;
      /** Expected delta — what the caller asked for. */
      expectedDelta: number;
      metadata: Record<string, unknown>;
    },
  ): Promise<{
    wallet: UserWalletRow;
    appliedDelta: number;
    transactionId: string;
    createdAt: string;
  }>;

  /**
   * Atomic spend-side write (Phase 6). Atomically:
   *   1. `UPDATE user_wallets SET balance = balance - :cost` with a
   *      `balance >= :cost` guard in the WHERE clause so the UPDATE
   *      silently no-ops when the user is broke. Returns the row
   *      count so the service can distinguish "success" from
   *      "insufficient funds" without a second round-trip.
   *   2. Inserts the ledger row with `balance_after = post-update
   *      wallet balance`.
   *
   * The implementation MUST issue the UPDATE + INSERT inside a single
   * transaction so the wallet row and the ledger row are committed
   * together (or rolled back together). The idempotency-key partial
   * unique index on `outbox_events` is the first line of defense
   * against duplicate spends; the full unique index on
   * `coin_transactions.idempotency_key` is the second.
   *
   * `expectedDelta` is what the caller asked for; `appliedDelta` is
   * the negative delta that the SQL actually applied (for spends
   * these are equal — a spend is all-or-nothing).
   */
  applySpendInTx(
    tx: unknown,
    params: {
      userId: string;
      cost: number;
      reason: string;
      referenceType: CoinReferenceType;
      referenceId: string | null;
      idempotencyKey: string;
      now: Date;
      metadata: Record<string, unknown>;
    },
  ): Promise<{
    wallet: UserWalletRow;
    appliedDelta: number;
    transactionId: string;
    createdAt: string;
  } | null>;

  /**
   * Count of `coin_transactions` rows this user wrote today (UTC) with
   * `reference_type = 'tip'` and a positive `amount` (i.e. the rows
   * the user created by *sending* tips, not by *receiving* a refund).
   *
   * The spend-side `DAILY_TIP_COUNT_CAP` uses this to refuse a 4th
   * tip in the same UTC day.
   */
  getDailyTipCount(userId: string, todayUtcMidnight: Date): Promise<number>;

  /**
   * Resolve a recipient's user-id (the row must exist; used by the
   * tip endpoint before debiting the sender). Returns the
   * canonical user-id (the input) on hit, or `null` on miss. The
   * caller wraps a `null` return into a `CoinTipRecipientNotFoundError`.
   */
  recipientExists(userId: string): Promise<boolean>;

  /**
   * Resolve a quiz by id. Used by the suppress endpoint to validate
   * `quizId` before debiting the user. Returns `null` on miss; the
   * caller wraps into `CoinSuppressQuizNotFoundError`.
   */
  quizExists(quizId: string): Promise<boolean>;

  /**
   * Return the user's active (not-yet-expired) suppression row for a
   * quiz, if one exists. Used to refuse a re-buy while a previous
   * suppression is still active.
   */
  getActiveSuppression(
    userId: string,
    quizId: string,
    nowIso: string,
  ): Promise<{ suppressionId: string; expiresAt: string } | null>;

  /**
   * Append a row to `user_flair_slots` for a freshly-debited
   * transaction. The unique index on
   * `user_flair_slots.coin_transaction_id` provides the idempotency
   * guarantee — a retry of the same spend call returns silently.
   */
  writeFlairSlot(params: {
    userId: string;
    userBadgeId: string;
    coinTransactionId: string;
    durationDays: number;
  }): Promise<void>;

  /**
   * Append a row to `user_quiz_suppressions` for a freshly-debited
   * transaction. Same idempotency guarantee as `writeFlairSlot`.
   */
  writeQuizSuppression(params: {
    userId: string;
    quizId: string;
    coinTransactionId: string;
    durationDays: number;
  }): Promise<void>;

  /**
   * Resolve the ledger-row id for an idempotency key. Used by the
   * admin-adjust path to surface the ledger row's UUID to the
   * response after `CoinIngestionService.processCoinEvent` returns.
   * Returns `null` on miss; the caller turns that into a 500.
   */
  findTransactionIdByIdempotencyKey(idempotencyKey: string): Promise<string | null>;

  /**
   * Phase 7 — Reconciliation (§16).
   *
   * Return every user whose `user_wallets.balance` disagrees with
   * `SUM(coin_transactions.amount)` (the immutable ledger is the
   * source of truth per design §9.6). The reconciler turns the
   * returned rows into a Pino error log + a Prometheus counter
   * increment (`coin_wallet_balance_drift_total`); it does NOT
   * auto-heal — a wallet write that drifts is a bug, not a routine
   * state, so the on-call path is to inspect the drift manually.
   *
   * The shape mirrors `RankingRepository.findXpMismatches`. Unlike
   * the XP path there is no period-vs-all-time check (coins are
   * strictly cumulative), only the cached balance vs the ledger
   * sum.
   *
   * Soft-deleted users are skipped — they may have a stale wallet
   * row but no recent activity, and the join is harmless.
   */
  findCoinMismatches(): Promise<
    {
      userId: string;
      storedBalance: number;
      expectedBalance: number;
    }[]
  >;
}

export const COIN_REPOSITORY_PORT = Symbol('COIN_REPOSITORY_PORT');
