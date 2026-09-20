import { BaseDomainException } from '@/common/errors/base-domain.exception';

export abstract class QuizAnalyticsError extends BaseDomainException {}

export class QuizNotFoundError extends QuizAnalyticsError {
  readonly code = 'QUIZ_ANALYTICS_NOT_FOUND';
  constructor(quizId: string) {
    super(`Quiz not found: ${quizId}`);
  }
}

/**
 * Thrown when an analytics computation (e.g. trending score, popularity
 * ranking, percentile bucket) fails for an internal reason. 500 Internal
 * Server Error.
 */
export class AnalyticsCalculationError extends QuizAnalyticsError {
  readonly code = 'QUIZ_ANALYTICS_CALCULATION_FAILED';
  constructor(message: string) {
    super(`Analytics calculation failed: ${message}`);
  }
}
