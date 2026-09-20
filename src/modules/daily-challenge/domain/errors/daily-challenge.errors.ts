import { BaseDomainException } from '@/common/errors/base-domain.exception';

export abstract class DailyChallengeDomainError extends BaseDomainException {}

export class DailyChallengeNotFoundError extends DailyChallengeDomainError {
  readonly code = 'DAILY_CHALLENGE_NOT_FOUND';
  constructor(message = 'No active daily challenge for today.') {
    super(message);
  }
}

export class DailyChallengeConflictError extends DailyChallengeDomainError {
  readonly code = 'DAILY_CHALLENGE_CONFLICT';
  constructor(message = 'Daily challenge attempt is out of sync with the next question index.') {
    super(message);
  }
}
