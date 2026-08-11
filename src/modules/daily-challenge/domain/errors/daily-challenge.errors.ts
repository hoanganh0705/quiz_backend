import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Module-namespace marker for daily-challenge domain errors. Mirrors
 * the `QuizDomainError` pattern in `modules/quiz/domain/errors`.
 */
export abstract class DailyChallengeDomainError extends BaseDomainException {}

/**
 * Thrown when the requested daily challenge cannot be found (e.g. the
 * cron has not rotated the day and there is no recent expired
 * snapshot either). 404 Not Found.
 */
export class DailyChallengeNotFoundError extends DailyChallengeDomainError {
  readonly code = 'DAILY_CHALLENGE_NOT_FOUND';
  constructor(message = 'No active daily challenge for today.') {
    super(message);
  }
}

/**
 * Thrown when the caller is racing the rotation — the attempt row
 * refers to a challenge that has been superseded by a new day. 409
 * Conflict.
 */
export class DailyChallengeConflictError extends DailyChallengeDomainError {
  readonly code = 'DAILY_CHALLENGE_CONFLICT';
  constructor(message: string) {
    super(message);
  }
}
