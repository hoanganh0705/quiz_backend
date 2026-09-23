import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { CoinReason } from '../types/coin.types';
import type { CoinSpendCategory } from '../ports/coin-spend.port';

type CoinMetricEvent =
  | {
      event: 'coin_event_processed' | 'coin_event_truncated_by_cap';
      metric: 'coin_events_processed_total';
      reason: CoinReason;
      outcome: 'committed' | 'truncated_by_cap';
    }
  | {
      event: 'coin_event_rejected_validation';
      metric: 'coin_events_processed_total';
      reason: string;
      outcome: 'rejected_validation';
    }
  | {
      event: 'coin_wallet_balance_drift_detected';
      metric: 'coin_wallet_balance_drift_total';
    }
  | {
      event: 'coin_insufficient_error';
      metric: 'coin_insufficient_errors_total';
      category: CoinSpendCategory;
    }
  | {
      event: 'coin_refund_processed' | 'coin_refund_replay';
      metric: 'coin_refunds_total';
      outcome: 'processed' | 'idempotent_replay';
    };

@Injectable()
export class CoinMetricsService {
  constructor(
    @InjectPinoLogger(CoinMetricsService.name)
    private readonly logger: PinoLogger,
  ) {}

  recordEventProcessed(reason: CoinReason): void {
    this.logger.info({
      metric: 'coin_events_processed_total',
      metricType: 'counter',
      increment: 1,
      event: 'coin_event_processed',
      reason,
      outcome: 'committed',
    });
  }

  recordEventTruncatedByCap(reason: CoinReason): void {
    this.logger.warn({
      metric: 'coin_events_processed_total',
      metricType: 'counter',
      increment: 1,
      event: 'coin_event_truncated_by_cap',
      reason,
      outcome: 'truncated_by_cap',
    });
  }

  recordEventRejectedValidation(reason: string): void {
    this.logger.warn({
      metric: 'coin_events_processed_total',
      metricType: 'counter',
      increment: 1,
      event: 'coin_event_rejected_validation',
      reason,
      outcome: 'rejected_validation',
    });
  }

  recordWalletBalanceDrift(): void {
    this.logger.error({
      metric: 'coin_wallet_balance_drift_total',
      metricType: 'counter',
      increment: 1,
      event: 'coin_wallet_balance_drift_detected',
    });
  }

  recordInsufficientCoins(category: CoinSpendCategory): void {
    this.logger.warn({
      metric: 'coin_insufficient_errors_total',
      metricType: 'counter',
      increment: 1,
      event: 'coin_insufficient_error',
      category,
    });
  }

  recordRefund(outcome: 'processed' | 'idempotent_replay'): void {
    this.logger.info({
      metric: 'coin_refunds_total',
      metricType: 'counter',
      increment: 1,
      event: outcome === 'processed' ? 'coin_refund_processed' : 'coin_refund_replay',
      outcome,
    });
  }
}
