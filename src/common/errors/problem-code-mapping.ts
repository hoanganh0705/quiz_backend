/**
 * Transport-side mapping from `BaseDomainException.code` to HTTP metadata.
 *
 * Per the RFC 7807 migration plan (§6.4, §4.4), the HTTP-specific
 * information that turns a domain `code` into a Problem Details response
 * lives in the **transport layer**, not on the domain class. The domain
 * layer carries only `code` (a stable business identifier). The
 * transport layer owns the mapping from that code to `{ status, title,
 * typeUri }`.
 *
 * Sole consumer: `GlobalExceptionFilter`.
 *
 * Adding a new error: declare a `readonly code` on the concrete class
 * (domain-side) AND add the matching entry here (transport-side). The
 * unknown-code loud-failure branch in the global filter means a missing
 * entry surfaces as a 500 + `error: 'unknown_error_code'` log line.
 */
import { HttpStatus } from '@nestjs/common';

interface ProblemCodeInfo {
  readonly status: HttpStatus;
  readonly title: string;
  readonly typeUri: string;
}

export const ProblemCodeMapping: Readonly<Record<string, ProblemCodeInfo>> = {
  // ===========================================================================
  // AUTH module — src/modules/auth/domain/errors/auth-domain.errors.ts
  //   src/modules/auth/domain/oauth/errors.ts
  // ===========================================================================
  AUTH_INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-credentials',
  },
  AUTH_INVALID_REFRESH_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-refresh-token',
  },
  AUTH_TOKEN_REUSED: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-token-reused',
  },
  AUTH_SESSION_CONTEXT_MISMATCH: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-session-context-mismatch',
  },
  AUTH_USER_NOT_FOUND: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-user-not-found',
  },
  AUTH_RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    title: 'TooManyRequests',
    typeUri: 'https://api.quiz.local/problems/auth-rate-limited',
  },
  AUTH_RESOURCE_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-resource-conflict',
  },
  AUTH_SESSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/auth-session-not-found',
  },
  AUTH_INVALID_TOKEN: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-token',
  },
  AUTH_INVALID_CURRENT_PASSWORD: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-invalid-current-password',
  },
  AUTH_DELETION_FAILED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-deletion-failed',
  },
  AUTH_PASSWORD_REUSE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-password-reuse',
  },
  AUTH_OAUTH_INVALID_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    title: 'Unauthorized',
    typeUri: 'https://api.quiz.local/problems/auth-oauth-invalid-token',
  },
  AUTH_OAUTH_ACCOUNT_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-oauth-account-already-exists',
  },
  AUTH_OAUTH_LINKING_REQUIRED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/auth-oauth-linking-required',
  },

  // ===========================================================================
  // QUIZ module — src/modules/quiz/domain/errors/quiz-domain.errors.ts
  // ===========================================================================
  /**
   * Catch-all for unexpected domain operation failures (e.g. unmapped DB
   * errors in repositories). Mapped to 500 because by the time we reach this
   * code, the upstream domain layer has already failed to classify the
   * failure into a more specific exception. The wire shape is identical to
   * the prior filter's catch-all (which also returned 500 with the same
   * generic title), but `extensions.code` is now present so on-call can
   * correlate with structured logs.
   */
  QUIZ_OPERATION_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/quiz-operation-failed',
  },
  QUIZ_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/quiz-not-found',
  },
  QUIZ_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/quiz-forbidden',
  },
  QUIZ_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-slug-conflict',
  },
  QUIZ_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-conflict',
  },
  QUIZ_VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/quiz-validation-failed',
  },
  /**
   * Wire-shape NOTE (improvement): the prior `QuizDomainExceptionFilter`
   * hardcoded the `detail` for this exception to `'This quiz version
   * cannot be modified'`, ignoring the thrown message. The new global
   * filter preserves `exception.message`, so callers now receive the more
   * specific state-machine message (e.g. `'Archived versions are immutable
   * and cannot be edited'`). Documented in plan §8.2 v3.3.
   */
  QUIZ_VERSION_IMMUTABLE: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/quiz-version-immutable',
  },
  QUIZ_INSUFFICIENT_QUESTIONS: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/quiz-insufficient-questions',
  },
  QUIZ_QUESTION_POSITION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-question-position-conflict',
  },
  QUIZ_ANSWER_OPTION_POSITION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/quiz-answer-option-position-conflict',
  },
  QUIZ_MULTIPLE_CORRECT_OPTIONS: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/quiz-multiple-correct-options',
  },

  // ===========================================================================
  // QUIZ module — analytics — src/modules/quiz/domain/analytics/errors/
  // ===========================================================================
  /**
   * Wire-shape NOTE (improvement): the prior setup had no
   * `@Catch(QuizAnalyticsError)` filter, so analytics errors fell through
   * `GlobalExceptionFilter`'s plain-`Error` branch and surfaced as
   * `500 InternalServerError`. After Phase 1, `QUIZ_ANALYTICS_NOT_FOUND`
   * returns 404 (matching the prior comment in `quiz-review.controller.ts`
   * that documented the *intended* behavior) and
   * `QUIZ_ANALYTICS_CALCULATION_FAILED` returns 500 (a new explicit code
   * for the previously-uncaught error class).
   */
  QUIZ_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/quiz-analytics-not-found',
  },
  QUIZ_ANALYTICS_CALCULATION_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/quiz-analytics-calculation-failed',
  },

  // ===========================================================================
  // ATTEMPT module — src/modules/attempt/domain/errors/attempt-domain.errors.ts
  // ===========================================================================
  /**
   * Thrown when a quiz attempt cannot be found by id. 404 Not Found.
   */
  ATTEMPT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/attempt-not-found',
  },
  /**
   * Thrown when the caller lacks permission to access an attempt. 403 Forbidden.
   */
  ATTEMPT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/attempt-forbidden',
  },
  /**
   * Generic attempt-domain validation signal. Used for option-related
   * validation failures in `attempt-command.service.ts`. 400 Bad Request.
   *
   * NOTE: In the prior module structure, three child exceptions
   * (`QuizNotPublishedError`, `AttemptQuestionInvalidError`,
   * `AttemptNotCompletedError`) extended `AttemptValidationError`. After
   * Phase 1 they extend `AttemptDomainError` directly so each can carry
   * its own `code` literal type. `AttemptValidationError` itself stays as
   * a concrete standalone class for the one direct throw site in
   * `attempt-command.service.ts`. See plan §8.2 v3.4 for details.
   */
  ATTEMPT_VALIDATION_FAILED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/attempt-validation-failed',
  },
  /**
   * Thrown when the user attempts to start a second active attempt for the
   * same quiz version. 409 Conflict.
   */
  ATTEMPT_ALREADY_STARTED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/attempt-already-started',
  },
  /**
   * Thrown when a state-machine transition is attempted on an attempt
   * that is not in the active state (already completed, abandoned, or
   * never started). 409 Conflict.
   */
  ATTEMPT_NOT_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/attempt-not-active',
  },
  /**
   * Thrown when the user attempts to submit or withdraw an answer for a
   * question they've already answered in the same attempt. 409 Conflict.
   */
  ATTEMPT_QUESTION_ALREADY_ANSWERED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/attempt-question-already-answered',
  },
  /**
   * Thrown when the user attempts to start an attempt on a quiz version
   * that is not yet published. 422 Unprocessable Entity.
   */
  ATTEMPT_QUIZ_NOT_PUBLISHED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/attempt-quiz-not-published',
  },
  /**
   * Thrown when the question id in a submit-answer request does not
   * belong to the attempt's quiz version. 422 Unprocessable Entity.
   */
  ATTEMPT_QUESTION_INVALID: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/attempt-question-invalid',
  },
  /**
   * Thrown when analytics are requested for an attempt that has not yet
   * been completed. 422 Unprocessable Entity.
   */
  ATTEMPT_NOT_COMPLETED: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/attempt-not-completed',
  },
  /**
   * Thrown when a withdraw-answer request references an answer that does
   * not exist on the attempt. 404 Not Found.
   *
   * NOTE: This exception is exported but never thrown anywhere in the
   * current codebase. It is preserved with a sensible 404 mapping (the
   * semantic analogue to `AttemptNotFoundError`). If it remains dead
   * after the migration completes, delete it in a follow-up cleanup PR.
   */
  ATTEMPT_ANSWER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/attempt-answer-not-found',
  },

  // ===========================================================================
  // USER module — src/modules/user/domain/errors/
  // ===========================================================================
  /**
   * Thrown by the user module's `UserService` (and a few read paths in
   * ranking/social/discussion that import the user variant of
   * `UserNotFoundError`) when a user cannot be found by id. 404 Not Found.
   *
   * Distinct from `AUTH_USER_NOT_FOUND` (401), which is the auth-flow
   * variant thrown from refresh-token, password-change, and account-security
   * services. Clients distinguish via `extensions.code`. Unification is
   * deferred per plan §9 item 1.
   */
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-not-found',
  },
  /**
   * Thrown when a user's ranking entry cannot be found. 404 Not Found.
   *
   * NOTE: exported but never thrown in the current codebase. Preserved
   * with a sensible 404 mapping (semantic analogue to `UserNotFoundError`).
   */
  USER_RANKING_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-ranking-not-found',
  },
  /**
   * Thrown when a user's analytics entry cannot be found. 404 Not Found.
   *
   * NOTE: exported but never thrown in the current codebase. Preserved
   * with a sensible 404 mapping.
   */
  USER_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-analytics-not-found',
  },
  /**
   * Thrown when a caller attempts to read another user's profile (or
   * related analytics/ranking) but the target profile is private. 403
   * Forbidden.
   *
   * This exception is also caught by the achievement module's
   * per-module filter (out of scope for Phase 1). That filter's
   * `instanceof UserProfilePrivateError` check continues to work because
   * the class identity is preserved. The achievement filter's wire
   * shape for this code path remains the old envelope until Phase 2.
   */
  USER_PROFILE_PRIVATE: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/user-profile-private',
  },
};

const DEFAULT_TYPE_URIS: Readonly<Record<number, string>> = {
  400: 'https://api.quiz.local/problems/bad-request',
  401: 'https://api.quiz.local/problems/unauthorized',
  403: 'https://api.quiz.local/problems/forbidden',
  404: 'https://api.quiz.local/problems/not-found',
  409: 'https://api.quiz.local/problems/conflict',
  422: 'https://api.quiz.local/problems/unprocessable-entity',
  423: 'https://api.quiz.local/problems/locked',
  429: 'https://api.quiz.local/problems/too-many-requests',
  500: 'https://api.quiz.local/problems/internal-server-error',
};

/**
 * Look up the Problem Details metadata for a domain `code`.
 *
 * On hit: returns the entry from `ProblemCodeMapping`.
 * On miss: returns the unknown-code loud-failure branch — a 500 with
 * a generic title and the 500-default type URI. `GlobalExceptionFilter`
 * additionally emits an `error: 'unknown_error_code'` log line so the gap
 * is observable on-call.
 */
export function resolveProblemInfo(code: string): ProblemCodeInfo {
  const entry = ProblemCodeMapping[code];
  if (entry) return entry;
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: DEFAULT_TYPE_URIS[HttpStatus.INTERNAL_SERVER_ERROR] ?? '',
  };
}
