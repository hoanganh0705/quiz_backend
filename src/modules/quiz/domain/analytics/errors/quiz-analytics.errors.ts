import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Quiz-analytics namespace marker for analytics-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. This intermediate stays abstract (no `code`) because
 * no `QuizAnalyticsError` is thrown directly; only its concrete subclasses
 * are. Direct consumers: `quiz-analytics.service.ts`.
 */
export abstract class QuizAnalyticsError extends BaseDomainException {}

/**
 * Thrown when no analytics row exists for the requested quiz id. 404 Not
 * Found.
 *
 * Distinct from the quiz-main `QuizNotFoundError` (code `QUIZ_NOT_FOUND`)
 * — that one is the CRUD resource lookup; this one is the analytics lookup.
 * The discussion module has a third `QuizNotFoundError` in
 * `src/modules/discussion/domain/errors` with code `DISCUSSION_QUIZ_NOT_FOUND`
 * (planned in Phase 1's user-module PR). The three classes are distinct at
 * the TypeScript level; clients distinguish them via `extensions.code`.
 *
 * Wire-shape NOTE (improvement): the prior setup had no
 * `@Catch(QuizAnalyticsError)` filter, so this exception fell through to
 * `GlobalExceptionFilter`'s plain-`Error` branch and surfaced as 500. The
 * comment in `quiz-review.controller.ts` described the *intended* behavior
 * as 404, but the wire shape was actually 500. After Phase 1, the wire
 * shape matches the intent: 404 with `extensions.code: 'QUIZ_ANALYTICS_NOT_FOUND'`.
 */
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
