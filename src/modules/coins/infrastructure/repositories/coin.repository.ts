import { Inject, Injectable } from '@nestjs/common';
import { sql, and, eq, desc } from 'drizzle-orm';
import { coinTransactions } from '@/core/database/schema';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import type {
  CoinRepositoryPort,
  UserWalletRow,
  CoinTransactionRow,
  CoinTx,
  ApplyDeltaParams,
  ApplySpendParams,
  ApplyDeltaResult,
} from '../../domain/ports/coin-repository.port';

type RawQueryResult<T> = {
  rows: T[];
  rowCount?: number | null;
};

type ApplyDeltaRawRow = {
  userId: string;
  balance: number | string;
  createdAt: string;
  updatedAt: string;
  appliedDelta: number | string;
  transactionId: string;
};

@Injectable()
export class CoinRepository implements CoinRepositoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getWallet(userId: string): Promise<UserWalletRow | null> {
    const result = await this.db.execute<ApplyDeltaRawRow>(sql`
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

  async applyDeltaInTx(tx: CoinTx, params: ApplyDeltaParams): Promise<ApplyDeltaResult> {
    const { userId, delta, reason, referenceType, referenceId, idempotencyKey, now, metadata } =
      params;

    const nowIso = now.toISOString();
    const metadataJson = JSON.stringify(metadata ?? {});
    const result = await tx.execute(sql<ApplyDeltaRawRow>`
      WITH upsert AS (
        INSERT INTO user_wallets (user_id, balance, created_at, updated_at)
        VALUES (${userId}::uuid, GREATEST(0, LEAST(1000000, ${delta})), ${nowIso}::timestamptz, ${nowIso}::timestamptz)
        ON CONFLICT (user_id) DO NOTHING
        RETURNING user_id, balance, created_at, updated_at
      ),
      updated AS (
        UPDATE user_wallets
        SET balance = LEAST(1000000, GREATEST(0, user_wallets.balance + ${delta})),
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
        ON CONFLICT (idempotency_key) DO NOTHING
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

    const row = result.rows[0];
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

  async applySpendInTx(tx: CoinTx, params: ApplySpendParams): Promise<ApplyDeltaResult | null> {
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

    const result = await tx.execute(sql<ApplyDeltaRawRow>`
      WITH debit AS (
        UPDATE user_wallets
        SET balance = GREATEST(0, balance - ${cost}),
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
        ON CONFLICT (idempotency_key) DO NOTHING
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

    const row = result.rows[0];
    if (!row) return null;

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

  async writeFlairSlotInTx(
    tx: CoinTx,
    params: {
      userId: string;
      userBadgeId: string;
      coinTransactionId: string;
      durationDays: number;
    },
  ): Promise<void> {
    const { userId, userBadgeId, coinTransactionId, durationDays } = params;
    const nowIso = new Date().toISOString();
    const slotEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const lookupRaw = await tx.execute(sql<{
      badgeId: string;
      badgeName: string;
      badgeIconUrl: string | null;
      badgeColor: string | null;
    }>`
      SELECT
        ub.badge_id    AS "badgeId",
        b.name         AS "badgeName",
        b.icon_url     AS "badgeIconUrl",
        b.color        AS "badgeColor"
      FROM user_badges ub
      INNER JOIN badges b ON b.badge_id = ub.badge_id
      WHERE ub.user_badge_id = ${userBadgeId}::uuid
        AND ub.user_id = ${userId}::uuid
        AND ub.revoked_at IS NULL
      FOR UPDATE
    `);
    const lookup = lookupRaw as {
      rows: Array<{
        badgeId: string;
        badgeName: string;
        badgeIconUrl: string | null;
        badgeColor: string | null;
      }>;
    };
    const badge = lookup.rows[0];
    if (!badge) {
      throw new Error(
        `CoinRepository.writeFlairSlotInTx: userBadgeId ${userBadgeId} not owned by ${userId}`,
      );
    }

    await tx.execute(sql`
      INSERT INTO user_flair_slots (
        user_id, user_badge_id, badge_id,
        badge_name, badge_icon_url, badge_color,
        slot_start, slot_end, coin_transaction_id
      )
      VALUES (
        ${userId}::uuid,
        ${userBadgeId}::uuid,
        ${badge.badgeId}::uuid,
        ${badge.badgeName},
        ${badge.badgeIconUrl ?? ''},
        ${badge.badgeColor},
        ${nowIso}::timestamptz,
        ${slotEnd}::timestamptz,
        ${coinTransactionId}::uuid
      )
      ON CONFLICT (coin_transaction_id) DO NOTHING
    `);
  }

  async writeQuizSuppressionInTx(
    tx: CoinTx,
    params: {
      userId: string;
      quizId: string;
      coinTransactionId: string;
      durationDays: number;
    },
  ): Promise<void> {
    const { userId, quizId, coinTransactionId, durationDays } = params;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    await tx.execute(sql`
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

  async runInTransaction<T>(
    work: (
      tx: CoinTx,
      helpers: {
        applyDeltaInTx(params: ApplyDeltaParams): Promise<ApplyDeltaResult>;
        applySpendInTx(params: ApplySpendParams): Promise<ApplyDeltaResult | null>;
        writeFlairSlotInTx(params: {
          userId: string;
          userBadgeId: string;
          coinTransactionId: string;
          durationDays: number;
        }): Promise<void>;
        writeQuizSuppressionInTx(params: {
          userId: string;
          quizId: string;
          coinTransactionId: string;
          durationDays: number;
        }): Promise<void>;
      },
    ) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const helpers = {
        applyDeltaInTx: (params: ApplyDeltaParams): Promise<ApplyDeltaResult> =>
          this.applyDeltaInTx(tx, params),
        applySpendInTx: (params: ApplySpendParams): Promise<ApplyDeltaResult | null> =>
          this.applySpendInTx(tx, params),
        writeFlairSlotInTx: (params: {
          userId: string;
          userBadgeId: string;
          coinTransactionId: string;
          durationDays: number;
        }): Promise<void> => this.writeFlairSlotInTx(tx, params),
        writeQuizSuppressionInTx: (params: {
          userId: string;
          quizId: string;
          coinTransactionId: string;
          durationDays: number;
        }): Promise<void> => this.writeQuizSuppressionInTx(tx, params),
      };
      return work(tx, helpers);
    });
  }

  private async executeRaw<T>(query: ReturnType<typeof sql>): Promise<RawQueryResult<T>> {
    const result = await this.db.execute(query);
    return result as unknown as RawQueryResult<T>;
  }
}
