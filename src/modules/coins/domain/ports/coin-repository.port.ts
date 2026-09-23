import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type * as schema from '@/core/database/schema';

export type CoinTx = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

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

export interface ApplyDeltaParams {
  userId: string;
  delta: number;
  reason: string;
  referenceType: CoinReferenceType;
  referenceId: string | null;
  idempotencyKey: string;
  now: Date;
  expectedDelta: number;
  metadata: Record<string, unknown>;
}

export interface ApplySpendParams {
  userId: string;
  cost: number;
  reason: string;
  referenceType: CoinReferenceType;
  referenceId: string | null;
  idempotencyKey: string;
  now: Date;
  metadata: Record<string, unknown>;
}

export interface ApplyDeltaResult {
  wallet: UserWalletRow;
  appliedDelta: number;
  transactionId: string;
  createdAt: string;
}

export interface CoinRepositoryPort {
  getWallet(userId: string): Promise<UserWalletRow | null>;

  getLedgerSum(userId: string): Promise<number>;

  getDailyEarnCapSum(userId: string, todayUtcMidnight: Date): Promise<number>;

  listTransactions(params: {
    userId: string;
    cursorCreatedAt: string | null;
    cursorTransactionId: string | null;
    limit: number;
  }): Promise<CoinTransactionRow[]>;

  applyDeltaInTx(tx: CoinTx, params: ApplyDeltaParams): Promise<ApplyDeltaResult>;

  applySpendInTx(tx: CoinTx, params: ApplySpendParams): Promise<ApplyDeltaResult | null>;

  getDailyTipCount(userId: string, todayUtcMidnight: Date): Promise<number>;

  recipientExists(userId: string): Promise<boolean>;

  quizExists(quizId: string): Promise<boolean>;

  getActiveSuppression(
    userId: string,
    quizId: string,
    nowIso: string,
  ): Promise<{ suppressionId: string; expiresAt: string } | null>;

  writeFlairSlotInTx(
    tx: CoinTx,
    params: {
      userId: string;
      userBadgeId: string;
      coinTransactionId: string;
      durationDays: number;
    },
  ): Promise<void>;

  writeQuizSuppressionInTx(
    tx: CoinTx,
    params: {
      userId: string;
      quizId: string;
      coinTransactionId: string;
      durationDays: number;
    },
  ): Promise<void>;

  findTransactionIdByIdempotencyKey(idempotencyKey: string): Promise<string | null>;

  findCoinMismatches(): Promise<
    {
      userId: string;
      storedBalance: number;
      expectedBalance: number;
    }[]
  >;

  runInTransaction<T>(
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
  ): Promise<T>;
}

export const COIN_REPOSITORY_PORT = Symbol('COIN_REPOSITORY_PORT');
