import { BaseDomainException } from '@/common/errors/base-domain.exception';

export abstract class CoinDomainError extends BaseDomainException {}

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

export class CoinTipSelfNotAllowedError extends BaseDomainException {
  readonly code = 'COIN_TIP_SELF_NOT_ALLOWED';
  constructor(public readonly userId: string) {
    super(`COIN_TIP_SELF_NOT_ALLOWED: user ${userId} cannot tip themselves`);
  }
}

export class CoinTipRecipientNotFoundError extends BaseDomainException {
  readonly code = 'COIN_TIP_RECIPIENT_NOT_FOUND';
  constructor(public readonly recipientUserId: string) {
    super(`COIN_TIP_RECIPIENT_NOT_FOUND: user ${recipientUserId} not found`);
  }
}

export class CoinFlairBadgeNotOwnedError extends BaseDomainException {
  readonly code = 'COIN_FLAIR_BADGE_NOT_OWNED';
  constructor(
    public readonly userId: string,
    public readonly userBadgeId: string,
  ) {
    super(`COIN_FLAIR_BADGE_NOT_OWNED: user ${userId} does not own userBadge ${userBadgeId}`);
  }
}

export class CoinSuppressQuizNotFoundError extends BaseDomainException {
  readonly code = 'COIN_SUPPRESS_QUIZ_NOT_FOUND';
  constructor(public readonly quizId: string) {
    super(`COIN_SUPPRESS_QUIZ_NOT_FOUND: quiz ${quizId} not found`);
  }
}

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

export class CoinAdminAdjustmentReasonRequiredError extends BaseDomainException {
  readonly code = 'COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED';
  constructor(public readonly adminUserId: string) {
    super(
      `COIN_ADMIN_ADJUSTMENT_REASON_REQUIRED: admin ${adminUserId} must supply a non-empty reason`,
    );
  }
}

export class CoinSpendValidationError extends BaseDomainException {
  readonly code = 'COIN_SPEND_INVALID';
  constructor(message: string) {
    super(message);
  }
}

export class CoinEventValidationError extends BaseDomainException {
  readonly code = 'COIN_EVENT_INVALID';
  constructor(message: string) {
    super(message);
  }
}

export class InsufficientCoinsDeferredError extends BaseDomainException {
  readonly code = 'INSUFFICIENT_COINS_DEFERRED';
  constructor(
    public readonly userId: string,
    public readonly required: number,
  ) {
    super('INSUFFICIENT_COINS_DEFERRED');
  }
}

export class CoinTransactionNotFoundError extends BaseDomainException {
  readonly code = 'COIN_TRANSACTION_NOT_FOUND';
  constructor(public readonly transactionId: string) {
    super(`COIN_TRANSACTION_NOT_FOUND: transaction ${transactionId} does not exist`);
  }
}
