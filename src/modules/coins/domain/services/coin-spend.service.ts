import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';
import { DRIZZLE } from '@/core/database/drizzle.constants';

import { COIN_OUTBOX_PORT, type CoinOutboxPort } from '../ports/coin-outbox.port';
import { COIN_REPOSITORY_PORT, type CoinRepositoryPort } from '../ports/coin-repository.port';
import {
  type CoinSpendInput,
  type CoinSpendPort,
  type CoinSpendResult,
} from '../ports/coin-spend.port';
import {
  InsufficientCoinsError,
  CoinFlairBadgeNotOwnedError,
  CoinSuppressAlreadyActiveError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CoinSuppressQuizNotFoundError,
  CoinTipDailyCapExceededError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CoinTipRecipientNotFoundError,
  CoinTipSelfNotAllowedError,
  CoinSpendValidationError,
  InsufficientCoinsDeferredError,
} from '../errors/coin-spend.errors';
import { CoinMetricsService } from './coin-metrics.service';
import { COIN_ECONOMY_LIMITS, COIN_SPEND_DURATIONS_DAYS } from '../../coin.constants';
import { startOfUtcDay } from '../utils/utc-day';
import { ReferentialValidatorService } from '@/common/database/referential-validator.service';

@Injectable()
export class CoinSpendService implements CoinSpendPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(COIN_OUTBOX_PORT)
    private readonly outbox: CoinOutboxPort,
    private readonly metrics: CoinMetricsService,
    private readonly referentialValidator: ReferentialValidatorService,
    @InjectPinoLogger(CoinSpendService.name)
    private readonly logger: PinoLogger,
  ) {}

  async processSpend(input: CoinSpendInput, now: Date = new Date()): Promise<CoinSpendResult> {
    this.validateInput(input);
    const nowIso = now.toISOString();

    await this.runPreTransactionGuards(input, now);

    const referenceType = mapReferenceType(input.category);
    const referenceId = input.referenceId;
    const delta = -input.amount;
    const metadata = input.metadata ?? {};

    let result: Awaited<ReturnType<CoinRepositoryPort['applySpendInTx']>>;
    try {
      result = await this.db.transaction(async (tx) => {
        const outcome = await this.coinRepository.applySpendInTx(tx, {
          userId: input.userId,
          cost: input.amount,
          reason: input.reason,
          referenceType,
          referenceId,
          idempotencyKey: input.idempotencyKey,
          now,
          metadata,
        });

        if (outcome === null) {
          throw new InsufficientCoinsDeferredError(input.userId, input.amount);
        }

        await this.outbox.scheduleCoinEvent(
          {
            eventType: 'coin.spent',
            payload: {
              eventType: 'coin.spent',
              userId: input.userId,
              reason: input.reason,
              amount: delta,
              newBalance: outcome.wallet.balance,
              transactionId: outcome.transactionId,
              balanceAfter: outcome.wallet.balance,
              referenceType,
              referenceId,
              category: input.category,
              metadata,
              ledgerCreatedAt: outcome.createdAt,
              occurredAt: nowIso,
            },
            nowIso,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );

        if (input.category === 'flair') {
          const userBadgeId =
            typeof input.metadata?.['userBadgeId'] === 'string'
              ? input.metadata['userBadgeId']
              : input.referenceId;
          await this.coinRepository.writeFlairSlotInTx(tx, {
            userId: input.userId,
            userBadgeId,
            coinTransactionId: outcome.transactionId,
            durationDays: COIN_SPEND_DURATIONS_DAYS.PROFILE_FLAIR_SLOT,
          });
        }

        if (input.category === 'suppress') {
          await this.coinRepository.writeQuizSuppressionInTx(tx, {
            userId: input.userId,
            quizId: input.referenceId,
            coinTransactionId: outcome.transactionId,
            durationDays: COIN_SPEND_DURATIONS_DAYS.SUPPRESS_RECOMMENDED,
          });
        }

        return outcome;
      });
    } catch (error) {
      if (error instanceof InsufficientCoinsDeferredError) {
        const wallet = await this.coinRepository.getWallet(input.userId);
        this.metrics.recordInsufficientCoins(input.category);
        throw new InsufficientCoinsError(input.userId, wallet?.balance ?? 0, input.amount);
      }
      throw error;
    }

    this.logger.info({
      event: 'coin_spend_processed',
      userId: input.userId,
      category: input.category,
      reason: input.reason,
      cost: input.amount,
      newBalance: result.wallet.balance,
      transactionId: result.transactionId,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      userId: input.userId,
      appliedDelta: delta,
      newBalance: result.wallet.balance,
      transactionId: result.transactionId,
    };
  }

  private async runPreTransactionGuards(input: CoinSpendInput, now: Date): Promise<void> {
    if (input.category === 'tip') {
      if (input.referenceId === input.userId) {
        throw new CoinTipSelfNotAllowedError(input.userId);
      }
      await this.referentialValidator.assertExists({ kind: 'tip', id: input.referenceId });
      const todayMidnight = startOfUtcDay(now);
      const tipCountToday = await this.coinRepository.getDailyTipCount(input.userId, todayMidnight);
      const cap = COIN_ECONOMY_LIMITS.DAILY_TIP_COUNT_CAP;
      if (tipCountToday + 1 > cap) {
        throw new CoinTipDailyCapExceededError(input.userId, tipCountToday, cap);
      }
    }

    if (input.category === 'suppress') {
      await this.referentialValidator.assertExists({ kind: 'suppress', id: input.referenceId });
      const active = await this.coinRepository.getActiveSuppression(
        input.userId,
        input.referenceId,
        now.toISOString(),
      );
      if (active) {
        throw new CoinSuppressAlreadyActiveError(input.userId, input.referenceId, active.expiresAt);
      }
    }

    if (input.category === 'flair') {
      const userBadgeId =
        typeof input.metadata?.['userBadgeId'] === 'string'
          ? input.metadata['userBadgeId']
          : input.referenceId;
      await this.referentialValidator.assertExists({ kind: 'flair', id: userBadgeId });
      const owns = await this.userBadgeIsOwned(input.userId, userBadgeId);
      if (!owns) {
        throw new CoinFlairBadgeNotOwnedError(input.userId, userBadgeId);
      }
    }
  }

  private async userBadgeIsOwned(userId: string, userBadgeId: string): Promise<boolean> {
    const result = await this.db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(
        SELECT 1 FROM user_badges
        WHERE user_badge_id = ${userBadgeId}::uuid
          AND user_id = ${userId}::uuid
          AND revoked_at IS NULL
      ) AS "exists"
    `);
    return Boolean(result.rows[0]?.exists);
  }

  private validateInput(input: CoinSpendInput): void {
    if (!input.userId) {
      throw new CoinSpendValidationError('CoinSpendService.processSpend: userId is required');
    }
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new CoinSpendValidationError(
        `CoinSpendService.processSpend: amount must be a positive integer (got ${input.amount})`,
      );
    }
    if (!input.idempotencyKey) {
      throw new CoinSpendValidationError(
        'CoinSpendService.processSpend: idempotencyKey is required',
      );
    }
    if (!input.referenceId) {
      throw new CoinSpendValidationError('CoinSpendService.processSpend: referenceId is required');
    }
  }
}

function mapReferenceType(
  category: CoinSpendInput['category'],
): 'tip' | 'flair' | 'suppress' | 'admin' {
  return category;
}
