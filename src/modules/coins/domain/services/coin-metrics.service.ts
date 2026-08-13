/**
 * Coin Metrics Service
 *
 * Phase 7 — Observability (§16).
 *
 * Counter-style metrics for the coin economy, emitted as structured
 * Pino logs so a log-based metric collector (e.g. Promtail +
 * Prometheus) can scrape them without introducing `prom-client` to
 * the dependency tree.
 *
 * This mirrors `OAuthMetricsService` (the canonical pattern in this
 * codebase) — every counter is a `pino.info` / `pino.warn` line with
 * a stable `metric` name, a `metricType: 'counter'` discriminator,
 * the relevant labels, and `increment: 1`. The shape is the same
 * one the existing Grafana dashboards already parse.
 *
 * ## Metrics
 *
 *   - `coin_events_processed_total{reason, outcome}`
 *       Reason — one of `CoinReason` (`QUIZ_COMPLETION_REWARD`,
 *       `DAILY_CHALLENGE_REWARD`, `STREAK_BONUS`, …).
 *       Outcome — `'committed' | 'truncated_by_cap' | 'rejected_validation'`.
 *       Incremented once per `CoinIngestionService.processCoinEvent`
 *       call (after the validation + cap pass, before the transaction
 *       commits — the metric is emitted from the path that always
 *       returns, so retries via idempotency keys re-increment and
 *       the caller is expected to dedup by `idempotency_key` at
 *       the dashboard layer if needed).
 *
 *   - `coin_wallet_balance_drift_total`
 *       Incremented once per drift row from
 *       `CoinRepository.findCoinMismatches` (per user, per night).
 *       The reconciler also logs the full row payload at `error`
 *       level so the on-call path has both an aggregate counter
 *       and the per-drift diagnostic.
 *
 *   - `coin_insufficient_errors_total{category}`
 *       Category — `'tip' | 'flair' | 'suppress' | 'admin'`.
 *       Incremented once per `InsufficientCoinsError` thrown by
 *       `CoinSpendService.processSpend`. This is a per-user,
 *       per-request counter — high cardinality is expected (any
 *       user can hit it), so the dashboard panel groups by
 *       `category` and plots a rate.
 *
 * ## Why log-based
 *
 * - No new dependency (`prom-client` is intentionally absent).
 * - The OAuth metrics service already established the convention.
 * - Grafana Loki / Promtail already scrape every Pino log, so the
 *   metrics surface for free.
 *
 * The trade-off is that high-traffic counters lose atomicity when
 * emitted across multiple replicas (each replica emits its own
 * counter line). For the volumes we expect (≤ a few events per
 * user per minute) this is acceptable; Promtail / Prometheus
 * `sum by (reason)` aggregates correctly.
 */

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
    };

@Injectable()
export class CoinMetricsService {
  constructor(
    @InjectPinoLogger(CoinMetricsService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Increments `coin_events_processed_total{reason, outcome='committed'}`.
   * Called from `CoinIngestionService` after the wallet write + outbox
   * schedule commit successfully.
   */
  recordEventProcessed(reason: CoinReason): void {
    this.logMetric('info', {
      event: 'coin_event_processed',
      metric: 'coin_events_processed_total',
      reason,
      outcome: 'committed',
    });
  }

  /**
   * Increments `coin_events_processed_total{reason, outcome='truncated_by_cap'}`.
   * Called when the daily 200-coin cap zeroes out the requested delta
   * (no ledger row written, no outbox row scheduled).
   */
  recordEventTruncatedByCap(reason: CoinReason): void {
    this.logMetric('warn', {
      event: 'coin_event_truncated_by_cap',
      metric: 'coin_events_processed_total',
      reason,
      outcome: 'truncated_by_cap',
    });
  }

  /**
   * Increments `coin_events_processed_total{reason, outcome='rejected_validation'}`.
   * Called when `validateEvent` throws — invalid amount, unknown
   * reason, missing `referenceId`, etc. This is a developer-error
   * counter, not a user-facing one.
   */
  recordEventRejectedValidation(reason: string): void {
    this.logMetric('warn', {
      event: 'coin_event_rejected_validation',
      metric: 'coin_events_processed_total',
      reason,
      outcome: 'rejected_validation',
    });
  }

  /**
   * Increments `coin_wallet_balance_drift_total`. Called once per
   * drift row by the nightly reconciler (in addition to the per-row
   * `error` Pino log).
   */
  recordWalletBalanceDrift(): void {
    this.logMetric('error', {
      event: 'coin_wallet_balance_drift_detected',
      metric: 'coin_wallet_balance_drift_total',
    });
  }

  /**
   * Increments `coin_insufficient_errors_total{category}`.
   * Called from `CoinSpendService` right before throwing
   * `InsufficientCoinsError` so dashboards can plot spend refusals
   * by category.
   */
  recordInsufficientCoins(category: CoinSpendCategory): void {
    this.logMetric('warn', {
      event: 'coin_insufficient_error',
      metric: 'coin_insufficient_errors_total',
      category,
    });
  }

  private logMetric(level: 'info' | 'warn' | 'error', event: CoinMetricEvent): void {
    // The Pino API requires a single object argument; we forward
    // every label the dashboard needs (`reason`, `outcome`,
    // `category`) as first-class fields so Promtail / Loki can
    // index them without parsing the message.
    this.logger[level]({
      metric: event.metric,
      metricType: 'counter',
      increment: 1,
      event: event.event,
      ...('reason' in event ? { reason: event.reason } : {}),
      ...('outcome' in event ? { outcome: event.outcome } : {}),
      ...('category' in event ? { category: event.category } : {}),
    });
  }
}
