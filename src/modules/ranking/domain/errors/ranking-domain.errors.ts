import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Ranking-module namespace marker for ranking-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, tournament, review, bookmark, instance, social,
 * achievement, and comment modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new RankingDomainError' src/` returns no matches.
 *
 * Phase 3.2 specific note (rev4.9): the prior per-module filter
 * `RankingDomainExceptionFilter` was a `@Catch()` catch-all that
 * shadows `GlobalExceptionFilter`. After Phase 3.2 the catch-all is
 * removed; the global filter handles all errors via `ProblemCodeMapping`
 * (the 3 concrete exceptions) or via its standard `HttpException` /
 * uncaught `Error` paths. This is a **wire-shape change** —
 * `extensions.code` is now set for the 3 ranking domain exceptions
 * (the prior filter emitted `'INTERNAL_ERROR'` for all of them).
 *
 * Architecturally, this base class is the second in the codebase to
 * carry `code`/`context` on the **base** rather than on each subclass
 * (alongside `AchievementDomainError`). After Phase 3.2 the `code`
 * field moves to each subclass as a class-level `readonly` per the
 * plan §8.4.2 directive ("the 4 existing codes translate directly" —
 * corrected to 3 codes, not 4: the actual count is 3). Constructor
 * signatures stay the same; the constructor-arg `code` becomes a
 * subclass-level `readonly code = '...'` field.
 */
export abstract class RankingDomainError extends BaseDomainException {}

/**
 * Thrown when an XP event fails validation (negative amount, malformed
 * structure, etc.). 422 Unprocessable Entity.
 *
 * Wire-shape improvement: prior per-module filter was a `@Catch()`
 * catch-all that returned 500 with a hardcoded `'Internal server
 * error'` envelope. The thrown message and the constructor-injected
 * `code: 'INVALID_XP_EVENT'` were both discarded. After Phase 3.2
 * the global filter resolves the new code `RANKING_INVALID_XP_EVENT`
 * and preserves the thrown message.
 *
 * Status upgrade from 500 → 422: this is a semantic correction.
 * The exception represents rejected input (a malformed XP event from
 * the upstream pipeline), not an internal server failure. 422
 * Unprocessable Entity is the correct semantic.
 */
export class InvalidXpEventError extends RankingDomainError {
  readonly code = 'RANKING_INVALID_XP_EVENT';
  readonly context: { readonly event: unknown };
  /**
   * The raw event payload that failed validation. Public readonly
   * for in-process debugging (carried over from the prior class).
   * Not exposed on the wire (the global filter's `extensions` does
   * not include `context`).
   */
  readonly event: unknown;
  constructor(event: unknown, reason: string) {
    super(`Invalid XP event: ${reason}`);
    this.event = event;
    this.context = { event };
  }
}

/**
 * Thrown when an internal rank calculation fails (database deadlock,
 * consistency violation, etc.). 500 Internal Server Error.
 *
 * Wire-shape improvement: prior per-module filter was a `@Catch()`
 * catch-all that returned 500 with a hardcoded `'Internal server
 * error'` envelope. The thrown message and the constructor-injected
 * `code: 'RANK_CALCULATION_ERROR'` were both discarded. After Phase
 * 3.2 the global filter resolves the new code
 * `RANKING_RANK_CALCULATION_ERROR` and preserves the thrown message.
 */
export class RankCalculationError extends RankingDomainError {
  readonly code = 'RANKING_RANK_CALCULATION_ERROR';
  readonly context: Readonly<Record<string, unknown>>;
  constructor(period: string, reason: string, context?: Record<string, unknown>) {
    super(`Rank calculation failed for ${period}: ${reason}`);
    this.context = { period, ...(context ?? {}) };
  }
}

/**
 * Thrown when a period reset fails (scheduler failure, database
 * deadlock, etc.). 500 Internal Server Error.
 *
 * Wire-shape improvement: prior per-module filter was a `@Catch()`
 * catch-all that returned 500 with a hardcoded `'Internal server
 * error'` envelope. The thrown message and the constructor-injected
 * `code: 'PERIOD_RESET_ERROR'` were both discarded. After Phase 3.2
 * the global filter resolves the new code
 * `RANKING_PERIOD_RESET_ERROR` and preserves the thrown message.
 */
export class PeriodResetError extends RankingDomainError {
  readonly code = 'RANKING_PERIOD_RESET_ERROR';
  readonly context: Readonly<Record<string, unknown>>;
  constructor(period: string, reason: string, context?: Record<string, unknown>) {
    super(`Period reset failed for ${period}: ${reason}`);
    this.context = { period, ...(context ?? {}) };
  }
}
