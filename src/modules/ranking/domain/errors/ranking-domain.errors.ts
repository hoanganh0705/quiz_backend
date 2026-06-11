/**
 * Ranking Domain Errors
 */

export class RankingDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RankingDomainError';
  }
}

export class InvalidXpEventError extends RankingDomainError {
  constructor(
    public readonly event: unknown,
    reason: string,
  ) {
    super(`Invalid XP event: ${reason}`, 'INVALID_XP_EVENT', { event });
    this.name = 'InvalidXpEventError';
  }
}

export class RankCalculationError extends RankingDomainError {
  constructor(period: string, reason: string, context?: Record<string, unknown>) {
    super(`Rank calculation failed for ${period}: ${reason}`, 'RANK_CALCULATION_ERROR', {
      period,
      ...context,
    });
    this.name = 'RankCalculationError';
  }
}

export class PeriodResetError extends RankingDomainError {
  constructor(period: string, reason: string, context?: Record<string, unknown>) {
    super(`Period reset failed for ${period}: ${reason}`, 'PERIOD_RESET_ERROR', {
      period,
      ...context,
    });
    this.name = 'PeriodResetError';
  }
}
