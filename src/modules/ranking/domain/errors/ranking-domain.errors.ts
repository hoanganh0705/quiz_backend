import { BaseDomainException } from '@/common/errors/base-domain.exception';

export abstract class RankingDomainError extends BaseDomainException {}

export class InvalidXpEventError extends RankingDomainError {
  readonly code = 'RANKING_INVALID_XP_EVENT';
  readonly context: { readonly event: unknown };
  readonly event: unknown;
  constructor(event: unknown, reason: string) {
    super(`Invalid XP event: ${reason}`);
    this.event = event;
    this.context = { event };
  }
}

export class RankCalculationError extends RankingDomainError {
  readonly code = 'RANKING_RANK_CALCULATION_ERROR';
  readonly context: Readonly<Record<string, unknown>>;
  constructor(period: string, reason: string, context?: Record<string, unknown>) {
    super('Rank calculation failed');
    this.context = { period, ...(context ?? {}) };
  }
}

export class PeriodResetError extends RankingDomainError {
  readonly code = 'RANKING_PERIOD_RESET_ERROR';
  readonly context: Readonly<Record<string, unknown>>;
  constructor(period: string, reason: string, context?: Record<string, unknown>) {
    super('Period reset failed');
    this.context = { period, ...(context ?? {}) };
  }
}
