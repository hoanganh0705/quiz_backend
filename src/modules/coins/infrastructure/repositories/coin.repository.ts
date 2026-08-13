/**
 * Coin Repository Implementation
 *
 * Implements `CoinRepositoryPort` using Drizzle ORM. The earn-side write
 * (`applyDeltaInTx`) runs inside the caller's transaction — the ingestion
 * service owns the transaction boundary because it also schedules the
 * outbox row, and the two must commit together.
 *
 * ## Atomic wallet delta + ledger write
 *
 * The hot path is `applyDeltaInTx`. It runs three steps in this exact
 * order inside the caller's transaction:
 *
 *   1. `INSERT INTO user_wallets (user_id, balance, …) VALUES (:u, :d, …)
 *      ON CONFLICT (user_id) DO NOTHING` — upserts the wallet row on
 *      first credit.
 *   2. `UPDATE user_wallets SET balance = balance + :appliedDelta,
 *      updated_at = :now WHERE user_id = :u` — adds the delta.
 *   3. `INSERT INTO coin_transactions (transaction_id, user_id, reason,
 *      amount, balance_after, reference_type, reference_id,
 *      idempotency_key, metadata, created_at) VALUES (uuidv7(), :u,
 *      :reason, :delta, (SELECT balance FROM user_wallets WHERE user_id
 *      = :u), …)` — append the ledger row with the post-update balance.
 *
 * The `appliedDelta` is what the daily-cap pass allowed (may be lower
 * than the caller's `expectedDelta`); the function returns both so the
 * caller can log / surface the truncation.
 */

import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { sql, and, eq, desc } from 'drizzle-orm';
import { coinTransactions } from '@/core/database/schema';
import type {
  CoinRepositoryPort,
  UserWalletRow,
  CoinTransactionRow,
} from '../../domain/ports/coin-repository.port';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

type ApplyDeltaResult = {
  userId: string;
  balance: number | string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class CoinRepository implements CoinRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ─── Reads (non-tx) ────────────────────────────────────────────────────

  async getWallet(userId: string): Promise<UserWalletRow | null> {
    const result = await this.db.execute<{
      userId: string;
      balance: number | string;
      createdAt: string;
      updatedAt: string;
    }>(sql`
      SELECT
        user_id   AS "userId",
        balance   AS "balance",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM user_wallets
      WHERE user_id = ${userId}::uuid
    `);

    const row = result.rows[0];
    if (!row) return null;
    return {
      userId: row.userId,
      balance: Number(row.balance),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getLedgerSum(userId: string): Promise<number> {
    const result = await this.executeRaw<{ sum: number | string | null }>(sql`
      SELECT COALESCE(SUM(amount), 0) AS sum
      FROM coin_transactions
      WHERE user_id = ${userId}::uuid
    `);
    const sum = result.rows[0]?.sum;
    return Number(sum ?? 0);
  }

  async getDailyEarnCapSum(userId: string, todayUtcMidnight: Date): Promise<number> {
    const cutoffIso = todayUtcMidnight.toISOString();
    const result = await this.executeRaw<{ sum: number | string | null }>(sql`
      SELECT COALESCE(SUM(amount), 0) AS sum
      FROM coin_transactions
      WHERE user_id = ${userId}::uuid
        AND reason IN ('QUIZ_COMPLETION_REWARD', 'QUIZ_PERFECT_BONUS')
        AND amount > 0
        AND created_at >= ${cutoffIso}::timestamptz
    `);
    return Number(result.rows[0]?.sum ?? 0);
  }

  async listTransactions(params: {
    userId: string;
    cursorCreatedAt: string | null;
    cursorTransactionId: string | null;
    limit: number;
  }): Promise<CoinTransactionRow[]> {
    const { userId, cursorCreatedAt, cursorTransactionId, limit } = params;

    // Keyset pagination on (createdAt DESC, transactionId DESC). The
    // composite predicate (createdAt, transactionId) < (cursorCreatedAt,
    // cursorTransactionId) tuple-compares efficiently — see
    // `idx_coin_transactions_user_cursor`.
    const conditions = [eq(coinTransactions.userId, userId)];
    if (cursorCreatedAt !== null && cursorTransactionId !== null) {
      conditions.push(
        sql`(${coinTransactions.createdAt}, ${coinTransactions.transactionId}) < (${cursorCreatedAt}::timestamptz, ${cursorTransactionId}::uuid)`,
      );
    }

    const rows = await this.db
      .select()
      .from(coinTransactions)
      .where(and(...conditions))
      .orderBy(desc(coinTransactions.createdAt), desc(coinTransactions.transactionId))
      .limit(limit);

    return rows as CoinTransactionRow[];
  }

  // ─── In-transaction write ──────────────────────────────────────────────

  async applyDeltaInTx(
    tx: unknown,
    params: {
      userId: string;
      delta: number;
      reason: string;
      referenceType:
        | 'attempt'
        | 'daily_challenge'
        | 'streak'
        | 'badge'
        | 'tournament'
        | 'tip'
        | 'flair'
        | 'suppress'
        | 'admin';
      referenceId: string | null;
      idempotencyKey: string;
      now: Date;
      expectedDelta: number;
      metadata: Record<string, unknown>;
    },
  ): Promise<{
    wallet: UserWalletRow;
    appliedDelta: number;
    transactionId: string;
    createdAt: string;
  }> {
    const client = tx as DrizzleDB;
    const { userId, delta, reason, referenceType, referenceId, idempotencyKey, now, metadata } =
      params;

    const nowIso = now.toISOString();
    const metadataJson = JSON.stringify(metadata ?? {});

    // Path: upsert wallet → increment balance → insert ledger row.
    //
    // We avoid using Drizzle's typed builder for the upsert because the
    // builder cannot atomically execute `INSERT … ON CONFLICT DO NOTHING`
    // followed by a self-referencing `UPDATE` in one statement. The CTE
    // below expresses the same three steps in a single round-trip:
    //
    //   1. `upsert` — `INSERT … ON CONFLICT DO NOTHING RETURNING *`. On
    //      first credit this returns the freshly-inserted row. On any
    //      subsequent credit the conflict is silently dropped.
    //   2. `updated` — `UPDATE user_wallets SET balance = balance + :delta
    //      WHERE user_id = :u`. Always runs (it covers both branches).
    //      The `CHECK (balance >= 0)` constraint guards debits (Phase 4
    //      spend-side path).
    //   3. `ledger` — `INSERT INTO coin_transactions` carrying
    //      `balance_after = updated.balance`. The full unique index on
    //      `idempotency_key` provides the second line of defense against
    //      concurrent retries (the first line is the partial unique
    //      index on the outbox row).
    //
    // All three statements commit in the caller's transaction.
    // The transactionId is captured so the outbox can emit a
    // `CoinTransactionRecordedEvent` with the canonical row id (the
    // gateway forwards this to the client without a follow-up SELECT).
    const result = await client.execute(sql<{
      userId: string;
      balance: number | string;
      createdAt: string;
      updatedAt: string;
      appliedDelta: number | string;
      transactionId: string;
    }>`
      WITH upsert AS (
        INSERT INTO user_wallets (user_id, balance, created_at, updated_at)
        VALUES (${userId}::uuid, ${delta}, ${nowIso}::timestamptz, ${nowIso}::timestamptz)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING user_id, balance, created_at, updated_at
      ),
      updated AS (
        UPDATE user_wallets
        SET balance = user_wallets.balance + ${delta},
            updated_at = ${nowIso}::timestamptz
        WHERE user_wallets.user_id = ${userId}::uuid
        RETURNING user_id, balance, created_at, updated_at
      ),
      effective AS (
        SELECT * FROM upsert
        UNION ALL
        SELECT * FROM updated
      ),
      wallet_after AS (
        SELECT DISTINCT ON (user_id) user_id, balance, created_at, updated_at
        FROM effective
        WHERE user_id = ${userId}::uuid
        ORDER BY user_id,
          CASE WHEN updated_at = ${nowIso}::timestamptz THEN 1 ELSE 0 END DESC,
          created_at DESC
      ),
      ledger AS (
        INSERT INTO coin_transactions (
          transaction_id, user_id, reason, amount,
          balance_after, reference_type, reference_id,
          idempotency_key, metadata, created_at
        )
        SELECT
          uuidv7(),
          wallet_after.user_id,
          ${reason},
          ${delta},
          wallet_after.balance,
          ${referenceType},
          ${referenceId},
          ${idempotencyKey},
          ${metadataJson}::jsonb,
          ${nowIso}::timestamptz
        FROM wallet_after
        RETURNING transaction_id, amount, created_at
      )
      SELECT
        wallet_after.user_id        AS "userId",
        wallet_after.balance       AS "balance",
        wallet_after.created_at    AS "createdAt",
        wallet_after.updated_at    AS "updatedAt",
        ${delta}                   AS "appliedDelta",
        ledger.transaction_id      AS "transactionId"
      FROM wallet_after
      CROSS JOIN ledger
    `);

    const row = result.rows[0] as
      | (ApplyDeltaResult & {
          appliedDelta: number | string;
          transactionId: string;
        })
      | undefined;
    if (!row) {
      throw new Error(
        `CoinRepository.applyDeltaInTx: no row returned for user ${userId} (delta=${delta}, key=${idempotencyKey})`,
      );
    }

    return {
      wallet: {
        userId: row.userId,
        balance: Number(row.balance),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      appliedDelta: Number(row.appliedDelta),
      transactionId: row.transactionId,
      createdAt: row.createdAt,
    };
  }

  // ─── Phase 6 (S-coin-spend): spend-side writes ─────────────────────────────

  async applySpendInTx(
    tx: unknown,
    params: {
      userId: string;
      cost: number;
      reason: string;
      referenceType:
        | 'attempt'
        | 'daily_challenge'
        | 'streak'
        | 'badge'
        | 'tournament'
        | 'tip'
        | 'flair'
        | 'suppress'
        | 'admin';
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
  } | null> {
    const client = tx as DrizzleDB;
    const { userId, cost, reason, referenceType, referenceId, idempotencyKey, now, metadata } =
      params;
    if (!Number.isInteger(cost) || cost <= 0) {
      throw new Error(
        `CoinRepository.applySpendInTx: cost must be a positive integer (got ${cost})`,
      );
    }

    const nowIso = now.toISOString();
    const metadataJson = JSON.stringify(metadata ?? {});
    const delta = -cost;

    // Atomic guarded debit:
    //   1. UPDATE … WHERE balance >= :cost and RETURNING the post-update row.
    //   2. INSERT INTO coin_transactions … balance_after = :balance.
    //
    // If the user has insufficient balance the UPDATE matches zero rows; the
    // INSERT is wrapped in a CTE that requires at least one row from the
    // UPDATE so the whole statement returns zero rows. The function then
    // returns `null` and the caller surfaces `InsufficientCoinsError`.
    const result = await client.execute(sql<{
      userId: string;
      balance: number | string;
      createdAt: string;
      updatedAt: string;
      appliedDelta: number | string;
      transactionId: string;
    }>`
      WITH debit AS (
        UPDATE user_wallets
        SET balance = balance - ${cost},
            updated_at = ${nowIso}::timestamptz
        WHERE user_id = ${userId}::uuid
          AND balance >= ${cost}
        RETURNING user_id, balance, created_at, updated_at
      ),
      ledger AS (
        INSERT INTO coin_transactions (
          transaction_id, user_id, reason, amount,
          balance_after, reference_type, reference_id,
          idempotency_key, metadata, created_at
        )
        SELECT
          uuidv7(),
          debit.user_id,
          ${reason},
          ${delta},
          debit.balance,
          ${referenceType},
          ${referenceId},
          ${idempotencyKey},
          ${metadataJson}::jsonb,
          ${nowIso}::timestamptz
        FROM debit
        RETURNING transaction_id, amount, created_at
      )
      SELECT
        debit.user_id        AS "userId",
        debit.balance        AS "balance",
        debit.created_at     AS "createdAt",
        debit.updated_at     AS "updatedAt",
        ${delta}             AS "appliedDelta",
        ledger.transaction_id AS "transactionId"
      FROM debit
      CROSS JOIN ledger
    `);

    const row = result.rows[0] as
      | (ApplyDeltaResult & {
          appliedDelta: number | string;
          transactionId: string;
        })
      | undefined;
    if (!row) {
      // Insufficient balance — caller turns this into InsufficientCoinsError.
      return null;
    }

    return {
      wallet: {
        userId: row.userId,
        balance: Number(row.balance),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      appliedDelta: Number(row.appliedDelta),
      transactionId: row.transactionId,
      createdAt: row.createdAt,
    };
  }

  async getDailyTipCount(userId: string, todayUtcMidnight: Date): Promise<number> {
    const result = await this.db.execute<{ count: number | string }>(sql`
      SELECT COUNT(*)::int AS "count"
      FROM coin_transactions
      WHERE user_id = ${userId}::uuid
        AND reason = 'TIP_SENT'
        AND created_at >= ${todayUtcMidnight.toISOString()}::timestamptz
    `);
    const row = result.rows[0];
    return Number(row?.count ?? 0);
  }

  async recipientExists(userId: string): Promise<boolean> {
    const result = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(
        SELECT 1 FROM users WHERE user_id = ${userId}::uuid AND deleted_at IS NULL
      ) AS "exists"
    `);
    return Boolean(result.rows[0]?.exists);
  }

  async quizExists(quizId: string): Promise<boolean> {
    const result = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(
        SELECT 1 FROM quizzes WHERE quiz_id = ${quizId}::uuid
      ) AS "exists"
    `);
    return Boolean(result.rows[0]?.exists);
  }

  async getActiveSuppression(
    userId: string,
    quizId: string,
    nowIso: string,
  ): Promise<{ suppressionId: string; expiresAt: string } | null> {
    const result = await this.db.execute<{
      suppressionId: string;
      expiresAt: string;
    }>(sql`
      SELECT suppression_id AS "suppressionId",
             expires_at     AS "expiresAt"
      FROM user_quiz_suppressions
      WHERE user_id = ${userId}::uuid
        AND quiz_id = ${quizId}::uuid
        AND expires_at > ${nowIso}::timestamptz
      ORDER BY expires_at DESC
      LIMIT 1
    `);
    const row = result.rows[0];
    if (!row) return null;
    return { suppressionId: row.suppressionId, expiresAt: row.expiresAt };
  }

  async writeFlairSlot(params: {
    userId: string;
    userBadgeId: string;
    coinTransactionId: string;
    durationDays: number;
  }): Promise<void> {
    const { userId, userBadgeId, coinTransactionId, durationDays } = params;
    const nowIso = new Date().toISOString();
    const slotEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    // Look up the `badgeId` from the user-badge row so the slot's
    // badge_id column stays consistent (used by the profile header
    // renderer to fetch the badge catalog row in one query).
    const lookup = await this.db.execute<{ badgeId: string }>(sql`
      SELECT badge_id AS "badgeId"
      FROM user_badges
      WHERE user_badge_id = ${userBadgeId}::uuid
        AND user_id = ${userId}::uuid
        AND revoked_at IS NULL
    `);
    const badgeId = lookup.rows[0]?.badgeId;
    if (!badgeId) {
      throw new Error(
        `CoinRepository.writeFlairSlot: userBadgeId ${userBadgeId} not owned by ${userId}`,
      );
    }

    await this.db.execute(sql`
      INSERT INTO user_flair_slots (
        user_id, user_badge_id, badge_id,
        slot_start, slot_end, coin_transaction_id
      )
      VALUES (
        ${userId}::uuid,
        ${userBadgeId}::uuid,
        ${badgeId}::uuid,
        ${nowIso}::timestamptz,
        ${slotEnd}::timestamptz,
        ${coinTransactionId}::uuid
      )
      ON CONFLICT (coin_transaction_id) DO NOTHING
    `);
  }

  async writeQuizSuppression(params: {
    userId: string;
    quizId: string;
    coinTransactionId: string;
    durationDays: number;
  }): Promise<void> {
    const { userId, quizId, coinTransactionId, durationDays } = params;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    await this.db.execute(sql`
      INSERT INTO user_quiz_suppressions (
        user_id, quiz_id, expires_at, coin_transaction_id
      )
      VALUES (
        ${userId}::uuid,
        ${quizId}::uuid,
        ${expiresAt}::timestamptz,
        ${coinTransactionId}::uuid
      )
      ON CONFLICT (coin_transaction_id) DO NOTHING
    `);
  }

  async findTransactionIdByIdempotencyKey(idempotencyKey: string): Promise<string | null> {
    const result = await this.db.execute<{ transactionId: string }>(sql`
      SELECT transaction_id AS "transactionId"
      FROM coin_transactions
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    return result.rows[0]?.transactionId ?? null;
  }

  // ─── Phase 7 (Reconciliation) ────────────────────────────────────────

  /**
   * Phase 7 — Reconciliation (§16).
   *
   * Compares `user_wallets.balance` against
   * `SUM(coin_transactions.amount)` per user (the immutable ledger is
   * the source of truth per design §9.6). The reconciler turns each
   * drift row into a Pino error log + a Prometheus counter
   * (`coin_wallet_balance_drift_total`).
   *
   * Three checks:
   *   1. `stored < 0` — physically impossible; the
   *      `user_wallets.balance >= 0` check constraint should already
   *      prevent this, but the reconciler covers a future migration
   *      that loosens it.
   *   2. `stored <> SUM(amount)` — the cached balance drifted from
   *      the ledger (typically a missed write, a rolled-back
   *      transaction that committed one half, or a manual SQL fix).
   *   3. `users` row missing or soft-deleted — skipped (the LEFT
   *      JOIN only surfaces live users; soft-deleted users can have
   *      a wallet but no recent activity).
   *
   * This mirrors `RankingRepository.findXpMismatches` but with one
   * column (no period-vs-all-time check — coins are strictly
   * cumulative).
   */
  async findCoinMismatches(): Promise<
    {
      userId: string;
      storedBalance: number;
      expectedBalance: number;
    }[]
  > {
    const result = await this.executeRaw<{
      userId: string;
      storedBalance: number | string;
      expectedBalance: number | string;
    }>(sql`
      SELECT
        w.user_id                                 AS "userId",
        w.balance                                 AS "storedBalance",
        COALESCE(SUM(ct.amount), 0)              AS "expectedBalance"
      FROM user_wallets w
      LEFT JOIN coin_transactions ct
        ON ct.user_id = w.user_id
      WHERE EXISTS (
        SELECT 1 FROM users u
        WHERE u.user_id = w.user_id
          AND u.deleted_at IS NULL
      )
      GROUP BY w.user_id, w.balance
      HAVING w.balance < 0
          OR w.balance <> COALESCE(SUM(ct.amount), 0)
    `);

    return result.rows.map((row) => ({
      userId: row.userId,
      storedBalance: Number(row.storedBalance),
      expectedBalance: Number(row.expectedBalance),
    }));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    return (await this.db.execute(query)) as unknown as RawQueryResult<T>;
  }
}
