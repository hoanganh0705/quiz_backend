import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';

import {
  COIN_DOMAIN_EVENT_BUS,
  type CoinDomainEventBusPort,
} from '../events/coin-domain-event-bus.port';
import {
  COIN_REPOSITORY_PORT,
  type CoinRepositoryPort,
  type CoinTx,
  type CoinReferenceType,
} from '../ports/coin-repository.port';
import type { CoinReason } from '../types/coin.types';
import { CoinTransactionNotFoundError } from '../errors/coin-spend.errors';
import { CoinMetricsService } from './coin-metrics.service';
import { coinTransactions } from '@/core/database/schema/coins/schema';

export interface CoinRefundParams {
  userId: string;
  originalTransactionId: string;
  refundAmount: number;
  refundReason: string;
  idempotencyKey: string;
}

export interface CoinRefundResult {
  refundTransactionId: string;
  newBalance: number;
}

@Injectable()
export class CoinRefundService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(COIN_REPOSITORY_PORT)
    private readonly coinRepository: CoinRepositoryPort,
    @Inject(COIN_DOMAIN_EVENT_BUS)
    private readonly eventBus: CoinDomainEventBusPort,
    private readonly metrics: CoinMetricsService,
    @InjectPinoLogger(CoinRefundService.name)
    private readonly logger: PinoLogger,
  ) {}

  async refund(params: CoinRefundParams, now: Date = new Date()): Promise<CoinRefundResult> {
    if (!params.userId) {
      throw new Error('CoinRefundService.refund: userId is required');
    }
    if (!Number.isInteger(params.refundAmount) || params.refundAmount <= 0) {
      throw new Error(
        `CoinRefundService.refund: refundAmount must be a positive integer (got ${params.refundAmount})`,
      );
    }
    if (!params.idempotencyKey) {
      throw new Error('CoinRefundService.refund: idempotencyKey is required');
    }
    if (!params.originalTransactionId) {
      throw new Error('CoinRefundService.refund: originalTransactionId is required');
    }

    const existing = await this.coinRepository.findTransactionIdByIdempotencyKey(
      params.idempotencyKey,
    );
    if (existing !== null) {
      const wallet = await this.coinRepository.getWallet(params.userId);
      this.metrics.recordRefund('idempotent_replay');
      return {
        refundTransactionId: existing,
        newBalance: wallet?.balance ?? 0,
      };
    }

    const nowIso = now.toISOString();

    const result = await this.db.transaction(async (tx) => {
      const original = await this.findTransactionForRefund(tx, params.originalTransactionId);
      const referenceType = original.referenceType as CoinReferenceType | null;
      const referenceId = original.referenceId;

      const outcome = await this.coinRepository.applyDeltaInTx(tx, {
        userId: params.userId,
        delta: params.refundAmount,
        reason: 'admin',
        referenceType: 'admin',
        referenceId,
        idempotencyKey: params.idempotencyKey,
        now,
        expectedDelta: params.refundAmount,
        metadata: {
          refund: true,
          originalTransactionId: original.transactionId,
          originalReason: original.reason,
          refundReason: params.refundReason,
        },
      });

      this.eventBus.emitRefunded({
        eventType: 'coin.refunded',
        refundId: outcome.transactionId,
        userId: params.userId,
        originalTransactionId: original.transactionId,
        originalReason: original.reason as CoinReason,
        refundAmount: params.refundAmount,
        balanceAfter: outcome.wallet.balance,
        refundReason: params.refundReason,
        referenceType,
        referenceId,
        timestamp: now,
      });

      return outcome;
    });

    this.metrics.recordRefund('processed');
    this.logger.info({
      event: 'coin_refund_processed',
      userId: params.userId,
      originalTransactionId: params.originalTransactionId,
      refundAmount: params.refundAmount,
      refundTransactionId: result.transactionId,
      idempotencyKey: params.idempotencyKey,
    });

    return {
      refundTransactionId: result.transactionId,
      newBalance: result.wallet.balance,
    };
  }

  private async findTransactionForRefund(
    tx: CoinTx,
    transactionId: string,
  ): Promise<{
    transactionId: string;
    userId: string;
    reason: string;
    referenceType: string | null;
    referenceId: string | null;
  }> {
    const rows = await tx
      .select({
        transactionId: coinTransactions.transactionId,
        userId: coinTransactions.userId,
        reason: coinTransactions.reason,
        referenceType: coinTransactions.referenceType,
        referenceId: coinTransactions.referenceId,
      })
      .from(coinTransactions)
      .where(eq(coinTransactions.transactionId, transactionId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new CoinTransactionNotFoundError(transactionId);
    }
    return {
      transactionId: row.transactionId,
      userId: row.userId,
      reason: row.reason,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
    };
  }
}
