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
import {
  COIN_SPEND_AMOUNTS,
  COIN_SPEND_DURATIONS_DAYS,
  COIN_ECONOMY_LIMITS,
} from '../coin.constants';
import { CoinAdminAdjustmentReasonRequiredError } from '../domain/errors/coin-spend.errors';
import type { CoinSpendResponseDto } from '../dto/response/coin-spend-response.dto';
import type { CoinTransactionsResponseDto } from '../dto/response/coin-transactions.dto';
import type { CoinWalletResponseDto } from '../dto/response/coin-wallet.dto';
import type { CoinTipRequestDto } from '../dto/request/coin-tip-request.dto';
import type { CoinFlairRequestDto } from '../dto/request/coin-flair-request.dto';
import type { CoinSuppressRequestDto } from '../dto/request/coin-suppress-request.dto';
import type { CoinAdminAdjustRequestDto } from '../dto/request/coin-admin-adjust-request.dto';
import type { CoinReason } from '../domain/types/coin.types';
import { startOfUtcDay } from '../domain/utils/utc-day';

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
      limit: effectiveLimit + 1,
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

  async tipUser(
    callerUserId: string,
    body: CoinTipRequestDto,
    idempotencyKey: string,
  ): Promise<CoinSpendResponseDto> {
    const amount = body.amount;
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
        durationDays: COIN_SPEND_DURATIONS_DAYS.PROFILE_FLAIR_SLOT,
      },
    });
    return this.toSpendResponseDto(result);
  }

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
        durationDays: COIN_SPEND_DURATIONS_DAYS.SUPPRESS_RECOMMENDED,
      },
    });
    return this.toSpendResponseDto(result);
  }

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
        source: 'attempt',
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

  private async lookupTransactionId(idempotencyKey: string): Promise<string> {
    const txId = await this.coinRepository.findTransactionIdByIdempotencyKey(idempotencyKey);
    if (!txId) {
      throw new Error(`adminAdjust: ledger row not found for idempotencyKey=${idempotencyKey}`);
    }
    return txId;
  }
}

function cryptoRandomUuid(): string {
  return (
    (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  );
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_TRANSACTIONS_LIMIT;
  if (limit < 1) return 1;
  if (limit > MAX_TRANSACTIONS_LIMIT) return MAX_TRANSACTIONS_LIMIT;
  return Math.floor(limit);
}

type CursorPayloadType = CursorPayload;

function encodeCursor(payload: CursorPayloadType): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeCursor(raw: string | undefined): CursorPayloadType | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>)['createdAt'] === 'string' &&
      typeof (parsed as Record<string, unknown>)['transactionId'] === 'string'
    ) {
      const p = parsed as Record<string, string>;
      return { createdAt: p['createdAt'], transactionId: p['transactionId'] };
    }
    return null;
  } catch {
    return null;
  }
}
