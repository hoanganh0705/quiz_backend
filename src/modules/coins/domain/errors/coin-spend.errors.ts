/**
 * Coin Spend Domain Errors
 *
 * Typed exceptions raised by `CoinSpendService`. The HTTP layer maps these
 * to RFC 7807 problem-detail responses (see `errors.coins` enum in the
 * design doc §13).
 *
 * Why a separate file
 *   - Keeps `coin-domain.errors.ts` as the single import surface for
 *     callers; future spends (purchase gift card, donate to charity, …)
 *     add their own typed error class without touching the existing
 *     earn-side exceptions.
 *   - Each error extends `BaseDomainException` so the global exception
 *     filter recognises them and surfaces the right status code / code
 *     slug via the `ProblemCodeMapping`.
 */

import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * The caller tried to spend more coins than they have. Maps to HTTP 409
 * with code `INSUFFICIENT_COINS` (design §13).
 */
export class InsufficientCoinsError extends BaseDomainException {
  readonly code = 'INSUFFICIENT_COINS';
  constructor(
    public readonly userId: string,
    public readonly currentBalance: number,
    public readonly required: number,
  ) {
    super(`INSUFFICIENT_COINS: user ${userId} has ${currentBalance} coins; ${required} required`);
  }
}

/**
 * The sender already tipped `>= COIN_ECONOMY_LIMITS.DAILY_TIP_COUNT_CAP`
 * distinct authors today. Maps to HTTP 429 with code
 * `COIN_TIP_DAILY_CAP_EXCEEDED`.
 */
export class CoinTipDailyCapExceededError extends BaseDomainException {
  readonly code = 'COIN_TIP_DAILY_CAP_EXCEEDED';
  constructor(
    public readonly userId: string,
    public readonly tipCountToday: number,
    public readonly cap: number,
  ) {
    super(
      `COIN_TIP_DAILY_CAP_EXCEEDED: user ${userId} already sent ${tipCountToday} tips today (cap ${cap})`,
    );
  }
}

/**
 * The sender tried to tip themselves. Maps to HTTP 422 with code
 * `COIN_TIP_SELF_NOT_ALLOWED`.
 */
export class CoinTipSelfNotAllowedError extends BaseDomainException {
  readonly code = 'COIN_TIP_SELF_NOT_ALLOWED';
  constructor(public readonly userId: string) {
    super(`COIN_TIP_SELF_NOT_ALLOWED: user ${userId} cannot tip themselves`);
  }
}

/**
 * The recipient user does not exist (or is not visible to the caller).
 * Maps to HTTP 404 with code `COIN_TIP_RECIPIENT_NOT_FOUND`.
 */
export class CoinTipRecipientNotFoundError extends BaseDomainException {
  readonly code = 'COIN_TIP_RECIPIENT_NOT_FOUND';
  constructor(public readonly recipientUserId: string) {
    super(`COIN_TIP_RECIPIENT_NOT_FOUND: user ${recipientUserId} not found`);
  }
}

/**
 * The flair slot was requested against a `userBadgeId` the caller does
 * not own (or the badge has been revoked). Maps to HTTP 422 with code
 * `COIN_FLAIR_BADGE_NOT_OWNED`.
 */
export class CoinFlairBadgeNotOwnedError extends BaseDomainException {
  readonly code = 'COIN_FLAIR_BADGE_NOT_OWNED';
  constructor(
    public readonly userId: string,
    public readonly userBadgeId: string,
  ) {
    super(`COIN_FLAIR_BADGE_NOT_OWNED: user ${userId} does not own userBadge ${userBadgeId}`);
  }
}

/**
 * The suppression was requested against a `quizId` that does not exist
 * or is not visible to the caller. Maps to HTTP 404 with code
 * `COIN_SUPPRESS_QUIZ_NOT_FOUND`.
 */
export class CoinSuppressQuizNotFoundError extends BaseDomainException {
  readonly code = 'COIN_SUPPRESS_QUIZ_NOT_FOUND';
  constructor(public readonly quizId: string) {
    super(`COIN_SUPPRESS_QUIZ_NOT_FOUND: quiz ${quizId} not found`);
  }
}

/**
 * The user already has an active suppression for the requested quiz.
 * Maps to HTTP 409 with code `COIN_SUPPRESS_ALREADY_ACTIVE`.
 */
export class CoinSuppressAlreadyActiveError extends BaseDomainException {
  readonly code = 'COIN_SUPPRESS_ALREADY_ACTIVE';
  constructor(
    public readonly userId: string,
    public readonly quizId: string,
    public readonly expiresAtIso: string,
  ) {
    super(
      `COIN_SUPPRESS_ALREADY_ACTIVE: user ${userId} already suppresses quiz ${quizId} until ${expiresAtIso}`,
    );
  }
}

/**
 * The admin adjustment was submitted without a `reason`. The ledger is
 * the audit trail; a reason is required so a future investigator can
 * reconstruct intent. Maps to HTTP 422 with code
 * `COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED`.
 */
export class CoinAdminAdjustmentReasonRequiredError extends BaseDomainException {
  readonly code = 'COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED';
  constructor(public readonly adminUserId: string) {
    super(
      `COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED: admin ${adminUserId} must supply a non-empty reason`,
    );
  }
}
