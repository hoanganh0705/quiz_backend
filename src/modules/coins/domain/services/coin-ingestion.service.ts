import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as schema from '@/core/database/schema';
import { COIN_OUTBOX_PORT, type CoinOutboxPort } from '../ports/coin-outbox.port';
import { COIN_REPOSITORY_PORT, type CoinRepositoryPort } from '../ports/coin-repository.port';
import type { CoinEventInput } from '../ports/coin-ingestion.port';
import { DAILY_CAP_REASONS, type CoinReason } from '../types/coin.types';
import { COIN_ECONOMY_LIMITS } from '../../coin.constants';
import { CoinEventValidationError } from '../errors/coin-spend.errors';
import { startOfUtcDay } from '../utils/utc-day';
import { CoinMetricsService } from './coin-metrics.service';
import { ReferentialValidatorService } from '@/common/database/referential-validator.service';
import { asReferencedEntity, type ReferencedEntity } from '@/common/database/references.types';

@Injectable()
export class CoinIngestionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(COIN_OUTBOX_PORT)
    private readonly outbox: CoinOutboxPort,
    private readonly metrics: CoinMetricsService,
    private readonly referentialValidator: ReferentialValidatorService,
    @InjectPinoLogger(CoinIngestionService.name)
    private readonly logger: PinoLogger,
  ) {}

  async processCoinEvent(
    event: CoinEventInput,
    now: Date = new Date(),
  ): Promise<{ userId: string; appliedDelta: number; newBalance: number }> {
    try {
      this.validateEvent(event);
    } catch (error) {
      this.metrics.recordEventRejectedValidation(String(event.reason ?? 'unknown'));
      throw error;
    }

    const referenceEntity = this.buildReferenceEntity(event);
    if (referenceEntity) {
      await this.referentialValidator.assertExists(referenceEntity);
    }

    const idempotencyKey = event.idempotencyKey ?? deriveIdempotencyKey(event);
    const nowIso = now.toISOString();

    this.logger.info({
      event: 'coin_event_received',
      userId: event.userId,
      source: event.source,
      reason: event.reason,
      amount: event.amount,
      idempotencyKey,
    });

    const appliedDelta = await this.computeAppliedDelta(event, now);

    if (appliedDelta === 0) {
      const wallet = await this.coinRepository.getWallet(event.userId);
      this.logger.info({
        event: 'coin_daily_cap_truncated',
        userId: event.userId,
        reason: event.reason,
        requestedAmount: event.amount,
        newBalance: wallet?.balance ?? 0,
      });
      this.metrics.recordEventTruncatedByCap(event.reason);
      return {
        userId: event.userId,
        appliedDelta: 0,
        newBalance: wallet?.balance ?? 0,
      };
    }

    const referenceType = mapReferenceType(event.source);

    const { wallet, transactionId } = await this.db.transaction(async (tx) => {
      const result = await this.coinRepository.applyDeltaInTx(tx, {
        userId: event.userId,
        delta: appliedDelta,
        reason: event.reason,
        referenceType,
        referenceId: event.referenceId,
        idempotencyKey,
        now,
        expectedDelta: event.amount,
        metadata: event.metadata ?? {},
      });

      await this.outbox.scheduleCoinEvent(
        {
          eventType: 'coin.added',
          payload: {
            eventType: 'coin.added',
            userId: event.userId,
            reason: event.reason,
            amount: appliedDelta,
            newBalance: result.wallet.balance,
            transactionId: result.transactionId,
            balanceAfter: result.wallet.balance,
            referenceType,
            referenceId: event.referenceId,
            metadata: event.metadata ?? {},
            ledgerCreatedAt: result.createdAt,
            occurredAt: nowIso,
          },
          nowIso,
          idempotencyKey,
        },
        tx,
      );

      return result;
    });

    this.logger.info({
      event: 'coin_event_processed',
      userId: event.userId,
      source: event.source,
      reason: event.reason,
      requestedAmount: event.amount,
      appliedAmount: appliedDelta,
      newBalance: wallet.balance,
      transactionId,
      idempotencyKey,
    });

    this.metrics.recordEventProcessed(event.reason);

    return {
      userId: event.userId,
      appliedDelta,
      newBalance: wallet.balance,
    };
  }

  private validateEvent(event: CoinEventInput): void {
    if (!event.userId || typeof event.userId !== 'string') {
      throw new CoinEventValidationError('userId is required');
    }
    if (!Number.isInteger(event.amount) || event.amount <= 0) {
      throw new CoinEventValidationError(`amount must be a positive integer (got ${event.amount})`);
    }
    if (!event.referenceId || typeof event.referenceId !== 'string') {
      throw new CoinEventValidationError('referenceId is required');
    }
    if (!event.reason || !isValidCoinReason(event.reason)) {
      throw new CoinEventValidationError(
        `reason must be a known CoinReason (got ${String(event.reason)})`,
      );
    }
  }

  private async computeAppliedDelta(event: CoinEventInput, now: Date): Promise<number> {
    const applyCap = event.applyDailyCap ?? DAILY_CAP_REASONS.has(event.reason);
    if (!applyCap) return event.amount;

    const todayMidnight = startOfUtcDay(now);
    const earnedSoFar = await this.coinRepository.getDailyEarnCapSum(event.userId, todayMidnight);

    const cap = COIN_ECONOMY_LIMITS.DAILY_QUIZ_EARNINGS_CAP;
    const remaining = Math.max(0, cap - earnedSoFar);
    return Math.min(event.amount, remaining);
  }

  private buildReferenceEntity(event: CoinEventInput): ReferencedEntity | null {
    if (!event.referenceId) return null;
    try {
      return (
        sourceToReferencedEntity(event.source, event.referenceId) ??
        asReferencedEntity({ kind: 'attempt', id: event.referenceId })
      );
    } catch {
      return null;
    }
  }
}

function mapReferenceType(
  source: CoinEventInput['source'],
): 'attempt' | 'daily_challenge' | 'streak' | 'badge' | 'tournament' {
  switch (source) {
    case 'attempt':
      return 'attempt';
    case 'daily':
      return 'daily_challenge';
    case 'streak':
      return 'streak';
    case 'badge':
      return 'badge';
    case 'tournament':
      return 'tournament';
  }
}

function isValidCoinReason(reason: string): reason is CoinReason {
  return (schema.coinReason.enumValues as readonly string[]).includes(reason);
}

function deriveIdempotencyKey(event: CoinEventInput): string {
  return `coin:${event.userId}:${event.source}:${event.referenceId}`;
}

function sourceToReferencedEntity(
  source: CoinEventInput['source'],
  id: string,
): ReferencedEntity | null {
  switch (source) {
    case 'attempt':
      return { kind: 'attempt', id };
    case 'daily':
      return { kind: 'daily_challenge', id };
    case 'streak':
      return { kind: 'streak', id };
    case 'badge':
      return { kind: 'badge', id };
    case 'tournament':
      return { kind: 'tournament', id };
  }
}
