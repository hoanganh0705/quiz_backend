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
  QUIZ_VERSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/quiz-version-not-found',
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
   * ranking/social/comments that import the user variant of
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

  // ===========================================================================
  // CATEGORY module — src/modules/category/domain/errors/category-domain.errors.ts
  // ===========================================================================
  /** First Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  /**
   * Thrown by category read paths (`CategoryDomainService`,
   * `CategoryController` GETs) when a category cannot be found by id or
   * slug. 404 Not Found.
   */
  CATEGORY_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/category-not-found',
  },
  /**
   * Thrown when the caller tries to unfollow a category they are not
   * currently following. 404 Not Found.
   *
   * Audit issue (silent-success DELETE): the previous implementation
   * returned 204 unconditionally and logged a `category_unfollowed`
   * event when nothing actually changed. After this mapping, the
   * service checks for the active follow first and throws when
   * absent. Mirrors the social module's `SOCIAL_FRIENDSHIP_NOT_FOUND`
   * / `SOCIAL_FOLLOW_NOT_FOUND` pattern.
   */
  CATEGORY_FOLLOW_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/category-follow-not-found',
  },
  /**
   * Thrown by `CategoryQueryService` when a category's analytics entry
   * cannot be found. 404 Not Found.
   */
  CATEGORY_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/category-analytics-not-found',
  },
  /**
   * Thrown by `CategoryRepository` when a unique-slug constraint is
   * violated on insert/update. 409 Conflict.
   */
  CATEGORY_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/category-slug-conflict',
  },
  /**
   * Thrown by `CategoryDomainService` when restoring a category that is
   * already active (the restore endpoint refuses to touch active rows).
   * 409 Conflict.
   */
  CATEGORY_ALREADY_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/category-already-active',
  },
  /**
   * Thrown by `CategoryDomainService` when the restore state machine
   * reaches an invariant violation that shouldn't be reachable in normal
   * flow (corrupted state). 500 Internal Server Error.
   *
   * The prior per-module filter mapped this to 500 with a generic
   * `message: 'Internal server error'`. After Phase 2 the detail field
   * surfaces the concrete message (`'Category restore invariant
   * violated'`) — a wire-shape improvement, not a regression.
   */
  CATEGORY_RESTORE_INVARIANT: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/category-restore-invariant',
  },

  // ===========================================================================
  // TAG module — src/modules/tag/domain/errors/tag-domain.errors.ts
  // ===========================================================================
  /** Second Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  /**
   * Thrown by tag read paths (`TagDomainService`, `TagController` GETs)
   * when a tag cannot be found by id or slug. 404 Not Found.
   */
  TAG_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tag-not-found',
  },
  /**
   * Thrown by `TagApplicationService` when a tag's analytics entry
   * cannot be found. 404 Not Found.
   */
  TAG_ANALYTICS_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tag-analytics-not-found',
  },
  /**
   * Thrown by `TagDomainService` when a unique-slug constraint is
   * violated on insert/update. 409 Conflict.
   */
  TAG_SLUG_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tag-slug-conflict',
  },
  /**
   * Thrown by `TagDomainService` when restoring a tag that is already
   * active (the restore endpoint refuses to touch active rows). 409
   * Conflict.
   */
  TAG_ALREADY_ACTIVE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tag-already-active',
  },
  /**
   * Thrown by `TagDomainService` when the restore state machine reaches
   * an invariant violation that shouldn't be reachable in normal flow
   * (corrupted state). 500 Internal Server Error.
   *
   * Same wire-shape improvement as `CATEGORY_RESTORE_INVARIANT`: the
   * prior per-module filter mapped this to 500 with a generic message;
   * after Phase 2 the detail field surfaces the concrete message
   * (`'Tag restore invariant violated'`).
   */
  TAG_RESTORE_INVARIANT: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/tag-restore-invariant',
  },

  // ===========================================================================
  // TOURNAMENT module — src/modules/tournament/domain/errors/tournament-domain.errors.ts
  // ===========================================================================
  /** Third Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  // Largest Phase-2 module: 15 concrete exceptions → 4 status codes
  // (400/403/404/409). One of the 15 (TournamentAlreadyWithdrawnError)
  // was previously mapped to 500 via the filter's default branch — Phase 2
  // fixes that by routing it to 409 (semantic state conflict).

  /**
   * Thrown by `TournamentService` when a tournament cannot be found by
   * id. 404 Not Found.
   */
  TOURNAMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tournament-not-found',
  },
  /**
   * Thrown when a tournament round cannot be found. 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter hardcoded the
   * message to `'Tournament round not found'`. The global filter
   * preserves `exception.message`.
   */
  TOURNAMENT_ROUND_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tournament-round-not-found',
  },
  /**
   * Thrown when the authenticated user is not registered for the
   * tournament. 404 Not Found (the participant record does not exist).
   */
  TOURNAMENT_NOT_REGISTERED: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/tournament-not-registered',
  },
  /**
   * Thrown when the authenticated user lacks permission to perform a
   * tournament action. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `TournamentForbiddenError.message` to a hardcoded generic
   * `'You do not have permission to perform this action'`, ignoring
   * the thrown message. The global filter preserves `exception.message`,
   * so call sites that throw
   * `new TournamentForbiddenError(TOURNAMENT_FORBIDDEN_MESSAGE)` now
   * surface `'You do not have permission to manage this tournament'`
   * verbatim.
   */
  TOURNAMENT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/tournament-forbidden',
  },
  /**
   * Generic tournament state conflict (caller should usually prefer a
   * more specific subclass). 409 Conflict.
   */
  TOURNAMENT_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-conflict',
  },
  /**
   * Thrown when the user tries to register for a tournament they are
   * already actively participating in. 409 Conflict.
   */
  TOURNAMENT_ALREADY_REGISTERED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-already-registered',
  },
  /**
   * Thrown when the user tries to start an attempt for a round they
   * have already submitted. 409 Conflict.
   */
  TOURNAMENT_ATTEMPT_ALREADY_EXISTS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-attempt-already-exists',
  },
  /**
   * Thrown when the participant is in an unexpected state for the
   * requested operation. 409 Conflict.
   */
  TOURNAMENT_PARTICIPANT_STATE: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-participant-state',
  },
  /**
   * Thrown when the user tries to withdraw a second time. 409 Conflict.
   *
   * Wire-shape fix (not a regression): the prior per-module filter did
   * NOT include this exception in `mapToHttp`, so it fell through to
   * the default `INTERNAL_SERVER_ERROR` with a generic
   * `'Internal server error'` message — an implicit bug. Phase 2 routes
   * it to 409 (semantic state conflict) via this mapping entry.
   */
  TOURNAMENT_ALREADY_WITHDRAWN: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/tournament-already-withdrawn',
  },
  /**
   * Thrown when tournament parameters fail validation
   * (e.g. `endAt <= startAt`). 400 Bad Request.
   */
  TOURNAMENT_VALIDATION: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-validation',
  },
  /**
   * Thrown when the user tries to register after the registration phase
   * has ended. 400 Bad Request.
   */
  TOURNAMENT_REGISTRATION_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-registration-closed',
  },
  /**
   * Thrown when the tournament has reached `maxParticipants`. 400 Bad
   * Request.
   */
  TOURNAMENT_FULL: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-full',
  },
  /**
   * Thrown when the user tries to start an attempt for a round that
   * is not in `'open'` status. 400 Bad Request.
   */
  TOURNAMENT_ROUND_NOT_OPEN: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-round-not-open',
  },
  /**
   * Thrown when the user tries to unregister outside the registration
   * phase. 400 Bad Request.
   */
  TOURNAMENT_UNREGISTER_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-unregister-closed',
  },
  /**
   * Thrown when the user tries to withdraw outside the `'ongoing'`
   * tournament phase. 400 Bad Request.
   */
  TOURNAMENT_WITHDRAW_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/tournament-withdraw-closed',
  },

  // ===========================================================================
  // REVIEW module — src/modules/review/domain/errors/review-domain.errors.ts
  // ===========================================================================
  /** Fourth Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  // 6 concrete exceptions → 4 status codes:
  //   404: REVIEW_NOT_FOUND
  //   403: REVIEW_FORBIDDEN
  //   409: REVIEW_CONFLICT, REVIEW_ALREADY_REPORTED
  //   400: REVIEW_VALIDATION, REVIEW_ATTEMPT_REQUIRED

  /**
   * Thrown when a review cannot be found, or when a quiz is referenced
   * in a review operation but does not exist (3 throw sites pass
   * `'Quiz not found'`; the prior filter rewrote them to `'Review not
   * found'`, but Phase 2 preserves the thrown message). 404 Not Found.
   */
  REVIEW_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/review-not-found',
  },
  /**
   * Thrown when the authenticated user lacks permission to perform a
   * review operation. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `ReviewForbiddenError.message` to a hardcoded generic
   * `'You do not have permission to perform this action'`, ignoring
   * the thrown message. The global filter now preserves
   * `exception.message`, so call sites that pass distinct messages
   * (e.g. `'You do not have permission to view analytics for this
   * quiz'`) surface them verbatim.
   */
  REVIEW_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/review-forbidden',
  },
  /**
   * Thrown when a review conflict is detected (e.g. user has already
   * reviewed this quiz). 409 Conflict.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `ReviewConflictError.message` to a hardcoded `'Resource already
   * exists'`, ignoring the thrown message
   * (`REVIEW_QUIZ_USER_CONFLICT_MESSAGE = 'You have already reviewed
   * this quiz'`). The global filter now preserves `exception.message`.
   */
  REVIEW_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/review-conflict',
  },
  /**
   * Thrown when the user tries to report a review a second time. 409
   * Conflict.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `ReviewAlreadyReportedError.message` to a hardcoded `'You have
   * already reported this review'`, ignoring the thrown message. The
   * global filter now preserves `exception.message`.
   */
  REVIEW_ALREADY_REPORTED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/review-already-reported',
  },
  /**
   * Thrown when review-related input fails validation
   * (e.g. `'You cannot vote on your own review'`). 400 Bad Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `ReviewValidationError.message` to a hardcoded `'Invalid request
   * data'`. The global filter now preserves `exception.message`.
   */
  REVIEW_VALIDATION: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/review-validation',
  },
  /**
   * Thrown when a user tries to review a quiz without having completed
   * at least one attempt. 400 Bad Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `ReviewAttemptRequiredError.message` to a hardcoded `'Invalid
   * request data'`. The global filter now preserves `exception.message`
   * (default: `'You must complete at least one attempt before
   * reviewing this quiz'`).
   */
  REVIEW_ATTEMPT_REQUIRED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/review-attempt-required',
  },

  // ===========================================================================
  // BOOKMARK module — src/modules/bookmark/domain/errors/bookmark-domain.errors.ts
  // ===========================================================================
  /** Fifth Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  // 7 concrete exceptions → 4 status codes:
  //   404: BOOKMARK_NOT_FOUND, COLLECTION_NOT_FOUND, BOOKMARK_COLLECTION_NOT_FOUND
  //   403: COLLECTION_FORBIDDEN
  //   409: BOOKMARK_CONFLICT, COLLECTION_CONFLICT
  //   400: BOOKMARK_VALIDATION

  /**
   * Thrown when a bookmark cannot be found. 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `BookmarkNotFoundError.message` to a hardcoded generic
   * `'Resource not found'`. The global filter now preserves
   * `exception.message`.
   */
  BOOKMARK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/bookmark-not-found',
  },
  /**
   * Thrown when a bookmark's collection cannot be found. 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `BookmarkCollectionNotFoundError.message` to a hardcoded
   * `'Bookmark collection analytics not found'`, even for throw sites
   * that passed distinct messages (e.g.
   * `'Collection was deleted while processing this request. Please
   * retry.'` in `bookmark-command.service.ts:226`). The global filter
   * now preserves `exception.message`.
   */
  BOOKMARK_COLLECTION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/bookmark-collection-not-found',
  },
  /**
   * Thrown when the authenticated user lacks permission to manage a
   * collection. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `CollectionForbiddenError.message` to a hardcoded generic
   * `'You do not have permission to perform this action'`. The global
   * filter now preserves `exception.message` (default:
   * `'You do not have permission to manage this collection'`).
   */
  COLLECTION_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/collection-forbidden',
  },
  /**
   * Thrown when a bookmark conflict is detected (e.g. the user has
   * already bookmarked this quiz in this collection). 409 Conflict.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `BookmarkConflictError.message` to a hardcoded generic
   * `'Resource already exists'`. The global filter now preserves
   * `exception.message` (default:
   * `'This quiz is already bookmarked in this collection'`).
   */
  BOOKMARK_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/bookmark-conflict',
  },
  /**
   * Thrown when a collection name conflict is detected (e.g. a
   * collection with this name already exists for the user). 409
   * Conflict.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `CollectionConflictError.message` to a hardcoded generic
   * `'Resource already exists'`. The global filter now preserves
   * `exception.message` (default:
   * `'A collection with this name already exists'`).
   */
  COLLECTION_CONFLICT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/collection-conflict',
  },
  /**
   * Thrown when bookmark-related input fails validation. 400 Bad
   * Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `BookmarkValidationError.message` to a hardcoded generic
   * `'Invalid request data'`. The global filter now preserves
   * `exception.message`.
   */
  BOOKMARK_VALIDATION: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/bookmark-validation',
  },

  // ===========================================================================
  // INSTANCE module — src/modules/instance/domain/errors/instance-domain.errors.ts
  // ===========================================================================
  /** Sixth Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  // 7 concrete exceptions → 4 status codes:
  //   404: INSTANCE_NOT_FOUND
  //   403: INSTANCE_NOT_HOST
  //   409: PLAYER_ALREADY_JOINED (defined but currently unused in service)
  //   400: INSTANCE_NOT_OPEN, INSTANCE_FULL, INSTANCE_ALREADY_STARTED,
  //        INSTANCE_ALREADY_CLOSED
  //
  // Special note: the instance module has TWO exception filters —
  // `InstanceDomainExceptionFilter` (HTTP, controller-scoped, deleted in
  // Phase 2) and `WsExceptionFilter` (WS gateway, KEPT — handles only
  // auth/generic, not domain errors). The instance controller is the
  // only place where the HTTP filter was wired.

  /**
   * Thrown when a quiz instance cannot be found. 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `InstanceNotFoundError.message` to a hardcoded generic
   * `'Resource not found'`. The global filter now preserves
   * `exception.message` (default: `'Quiz instance not found'`).
   */
  INSTANCE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/instance-not-found',
  },
  /**
   * Thrown when the authenticated user is not the host of the
   * instance. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `InstanceNotHostError.message` to a hardcoded generic
   * `'You do not have permission to perform this action'`. The global
   * filter now preserves `exception.message` (default:
   * `'Only the host can perform this action'`).
   */
  INSTANCE_NOT_HOST: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/instance-not-host',
  },
  /**
   * Thrown when the user tries to join an instance whose state is not
   * `'open'` (e.g. the instance is already running or closed). 400 Bad
   * Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `InstanceNotOpenError.message` to a hardcoded generic
   * `'Invalid request data'`. The global filter now preserves
   * `exception.message` (default: `'Instance is not open for
   * joining'`).
   */
  INSTANCE_NOT_OPEN: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-not-open',
  },
  /**
   * Thrown when the user tries to join an instance that has already
   * reached `maxPlayers`. 400 Bad Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `InstanceFullError.message` to a hardcoded generic `'Invalid
   * request data'`. The global filter now preserves `exception.message`
   * (default: `'Instance is full'`).
   */
  INSTANCE_FULL: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-full',
  },
  /**
   * Thrown when the host tries to start an instance that has already
   * started. 400 Bad Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `InstanceAlreadyStartedError.message` to a hardcoded generic
   * `'Invalid request data'`. The global filter now preserves
   * `exception.message` (default: `'Instance has already started'`).
   */
  INSTANCE_ALREADY_STARTED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-already-started',
  },
  /**
   * Thrown when the host tries to close an instance that is already
   * closed. 400 Bad Request.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `InstanceAlreadyClosedError.message` to a hardcoded generic
   * `'Invalid request data'`. The global filter now preserves
   * `exception.message` (default: `'Instance is already closed'`).
   */
  INSTANCE_ALREADY_CLOSED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-already-closed',
  },
  /**
   * Thrown when the host tries to close an instance whose lifecycle is
   * already in the terminal `finished` state. 400 Bad Request.
   *
   * Phase 3 (audit issue 7.1): distinguished from `INSTANCE_ALREADY_CLOSED`
   * so the wire shape no longer conflates `closed` and `finished`.
   */
  INSTANCE_ALREADY_FINISHED: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/instance-already-finished',
  },
  /**
   * Thrown when the user tries to join an instance a second time. 409
   * Conflict.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `PlayerAlreadyJoinedError.message` to a hardcoded generic
   * `'Resource already exists'`. The global filter now preserves
   * `exception.message` (default: `'You have already joined this
   * instance'`).
   *
   * Phase 2 (audit issue 5.1): this code is now thrown from
   * `instance.service.ts:joinInstance` for the duplicate-join case.
   */
  PLAYER_ALREADY_JOINED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/player-already-joined',
  },
  /**
   * Thrown when a status transition's optimistic-locking predicate
   * (`WHERE version = $expectedVersion`) matches zero rows. 409 Conflict.
   *
   * Phase 1 (Foundational Correctness): previously `updateInstanceStatus`
   * performed an unconditional UPDATE keyed only on `instance_id`, so two
   * concurrent `startInstance` calls could each pass the in-memory
   * "status is open" check and both transition the row. The new
   * invariant is `WHERE instance_id = $1 AND version = $2`; a zero-row
   * result translates to `INSTANCE_OPTIMISTIC_LOCK`, signalling the caller
   * to re-read and retry the operation.
   *
   * Shares its HTTP status (409) with `PLAYER_ALREADY_JOINED` but uses
   * a distinct `typeUri` and `code` so clients dispatch on
   * `extensions.code`.
   */
  INSTANCE_OPTIMISTIC_LOCK: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/instance-optimistic-lock',
  },
  /**
   * Phase 2 (Gameplay Lifecycle) — thrown when the host tries to start
   * the countdown or the game on an instance with fewer than 2 joined
   * players. 422 Unprocessable Entity.
   *
   * The instance is a multiplayer-only room per the review's foundational
   * correctness fix; a one-player game is not a valid game. Surfacing
   * `MIN_PLAYERS_NOT_MET` as a 422 (rather than 400) signals "the request
   * is well-formed but the current server-side state rejects it" — the
   * same shape the review prescribes for capacity/full cases.
   */
  MIN_PLAYERS_NOT_MET: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/min-players-not-met',
  },
  /**
   * Phase 2 (Gameplay Lifecycle) — thrown when a countdown-only operation
   * targets an instance whose status is not `countdown`. 409 Conflict.
   */
  INSTANCE_NOT_IN_COUNTDOWN: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/instance-not-in-countdown',
  },
  /**
   * Phase 2 (Gameplay Lifecycle) — thrown when the host calls
   * `startCountdown` twice on the same instance. 409 Conflict.
   *
   * The natural idempotency guard. Controllers detect this and return
   * 200 with the existing `countdownStartedAt`, so the client sees a
   * no-op retry as success rather than as an error.
   */
  INSTANCE_COUNTDOWN_ALREADY_STARTED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/instance-countdown-already-started',
  },

  // ===========================================================================
  // SOCIAL module — src/modules/social/domain/errors/social.errors.ts
  // ===========================================================================
  /** Seventh Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  // 11 concrete exceptions → 4 status codes:
  //   404: SOCIAL_FRIEND_REQUEST_NOT_FOUND, SOCIAL_FRIENDSHIP_NOT_FOUND,
  //        SOCIAL_USER_NOT_BLOCKED, SOCIAL_FOLLOW_NOT_FOUND (4)
  //   403: SOCIAL_FRIEND_REQUEST_FORBIDDEN, SOCIAL_FRIEND_LIST_FORBIDDEN,
  //        SOCIAL_BLOCKED_USER, SOCIAL_USER_BLOCKED (4)
  //   409: SOCIAL_ALREADY_FRIENDS, SOCIAL_PENDING_REQUEST_EXISTS (2)
  //   400: SOCIAL_SELF_FRIEND_REQUEST (1)

  /**
   * Thrown when a friend request cannot be found by ID. 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter dropped the
   * request ID and rewrote every `FriendRequestNotFoundError.message`
   * to a hardcoded generic `'Friend request not found'`. The global
   * filter now preserves `exception.message` (default format:
   * `'Friend request not found: <id>'`, with the ID interpolated
   * from the constructor argument).
   */
  SOCIAL_FRIEND_REQUEST_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-friend-request-not-found',
  },
  /**
   * Thrown when the authenticated user lacks permission to respond
   * to a friend request. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `FriendRequestForbiddenError.message` to a hardcoded generic
   * `'You do not have permission to perform this action'`. The global
   * filter now preserves `exception.message` (default:
   * `'You do not have permission to respond to this friend request'`).
   */
  SOCIAL_FRIEND_REQUEST_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-friend-request-forbidden',
  },
  /**
   * Raised when a user attempts to read another user's friend list
   * without being allowed to do so. Allow-list: self, or users who
   * are mutual friends with the target (and neither side has blocked
   * the other). 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter preserved
   * the thrown message verbatim; behavior is unchanged.
   */
  SOCIAL_FRIEND_LIST_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-friend-list-forbidden',
  },
  /**
   * Thrown when a user attempts to send a friend request to
   * themselves. 400 Bad Request.
   *
   * Wire-shape improvement: the prior per-module filter preserved
   * the thrown message verbatim; behavior is unchanged.
   */
  SOCIAL_SELF_FRIEND_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/social-self-friend-request',
  },
  /**
   * Thrown when the user attempts to send a friend request to a user
   * they are already friends with. 409 Conflict.
   *
   * Wire-shape improvement: the prior per-module filter preserved
   * the thrown message verbatim; behavior is unchanged.
   */
  SOCIAL_ALREADY_FRIENDS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/social-already-friends',
  },
  /**
   * Thrown when the actor has blocked the target user and the action
   * is forbidden as a result. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter preserved
   * the thrown message verbatim; behavior is unchanged.
   */
  SOCIAL_BLOCKED_USER: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-blocked-user',
  },
  /**
   * Thrown when the target user has blocked the actor. 403 Forbidden.
   *
   * Wire-shape improvement: the prior per-module filter preserved
   * the thrown message verbatim; behavior is unchanged.
   */
  SOCIAL_USER_BLOCKED: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/social-user-blocked',
  },
  /**
   * Thrown when an attempt is made to send a friend request while one
   * is already pending between the two users. 409 Conflict.
   *
   * Wire-shape improvement: the prior per-module filter preserved
   * the thrown message verbatim; behavior is unchanged.
   */
  SOCIAL_PENDING_REQUEST_EXISTS: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/social-pending-request-exists',
  },
  /**
   * Thrown when `DELETE /social/friends/:userId` is called but no
   * accepted friendship exists between the caller and `:userId`.
   * 404 Not Found.
   *
   * Audit issue (silent-success DELETE): the previous implementation
   * returned 204 unconditionally and emitted a `friend_removed`
   * event even when nothing was removed. After this mapping, the
   * service fetches the friendship first and throws when absent;
   * cache invalidation + event emission are conditional on the row
   * existing. See `SocialService.removeFriend` and the audit report
   * in the social-module review.
   */
  SOCIAL_FRIENDSHIP_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-friendship-not-found',
  },
  /**
   * Thrown when `DELETE /social/block/:userId` is called but no
   * active block exists. 404 Not Found.
   *
   * Audit issue (silent-success DELETE): the previous implementation
   * wrote a `social.user.unblocked` audit-log entry even when no
   * unblock happened, polluting forensic queries. The audit write +
   * event emission are now conditional on the existence check.
   */
  SOCIAL_USER_NOT_BLOCKED: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-user-not-blocked',
  },
  /**
   * Thrown when `DELETE /social/follow/:userId` is called but no
   * active follow exists. 404 Not Found.
   *
   * Audit issue (silent-success DELETE): the previous implementation
   * emitted a `user_unfollowed` event even when no unfollow happened,
   * causing the notification listener to dispatch a false-positive
   * "X unfollowed you" push. The event emission is now conditional
   * on the existence check.
   */
  SOCIAL_FOLLOW_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/social-follow-not-found',
  },

  // ===========================================================================
  // ACHIEVEMENT module — src/modules/achievement/domain/errors/achievement.errors.ts
  // ===========================================================================
  /** Eighth and final Phase-2 entry: legacy `{ statusCode, message, error }` → RFC 7807. */
  // 4 concrete exceptions → 2 status codes (404 + 500). Distinct from prior
  // Phase-2 modules (most have 4 status codes) because AchievementGrantError
  // is a server-side failure (rule-engine grant failure → 500).
  //   404: BADGE_NOT_FOUND, ACHIEVEMENT_USER_NOT_FOUND,
  //        USER_BADGE_OWNERSHIP_NOT_FOUND
  //   500: ACHIEVEMENT_GRANT_ERROR (rule-engine grant failure; not used in
  //        application service today — audit at rev4.7 verified — but kept
  //        for forward-compatibility)
  //
  // Special note: the prior per-module filter
  // `@Catch(AchievementDomainError, UserProfilePrivateError)` also caught a
  // cross-module `UserProfilePrivateError` from the user module. After
  // Phase 2 the achievement filter is removed; the global filter handles
  // both via `ProblemCodeMapping['USER_PROFILE_PRIVATE']` (already declared
  // in Phase 1). This brings achievement routes into a uniform RFC 7807
  // wire shape.

  /**
   * Thrown when a badge lookup fails (no badge matches the given
   * identifier). 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `BadgeNotFoundError.message` to a hardcoded generic
   * `'Badge not found'`. The global filter now preserves
   * `exception.message` (default format: `'Badge not found: <badgeId>'`,
   * with the ID interpolated from the constructor argument).
   */
  BADGE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/badge-not-found',
  },
  /**
   * Thrown when a user lookup fails during an achievement operation.
   * 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `AchievementUserNotFoundError.message` to a hardcoded generic
   * `'User not found'`. The global filter now preserves
   * `exception.message` (default format: `'User not found: <userId>'`,
   * with the ID interpolated from the constructor argument).
   */
  ACHIEVEMENT_USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/achievement-user-not-found',
  },
  /**
   * Thrown when the user does not own the badge they are trying to
   * act on (revoke, progress-check, etc.). 404 Not Found.
   *
   * Wire-shape improvement: the prior per-module filter rewrote every
   * `UserBadgeOwnershipNotFoundError.message` to a hardcoded generic
   * `'User badge not found'`. The global filter now preserves
   * `exception.message` (default format:
   * `'Badge <badgeId> not owned by user <userId>'`, with both IDs
   * interpolated from the constructor arguments).
   */
  USER_BADGE_OWNERSHIP_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/user-badge-ownership-not-found',
  },
  /**
   * Thrown when the achievement rule engine fails to grant a badge to a
   * user for an internal reason (corrupted grant record, database
   * deadlock, etc.). 500 Internal Server Error.
   *
   * Wire-shape improvement: the prior per-module filter had NO branch
   * for `AchievementGrantError` in its `mapToHttp` — the class fell
   * through to the catch-all and was returned as `500 Internal Server
   * Error` with a hardcoded generic message
   * `'Internal server error'` (the thrown message and `context` were
   * both discarded). The global filter now resolves the code correctly
   * and returns a sanitized message without exposing internal details.
   *
   * Note: this exception is defined and exported but is currently NOT
   * thrown by `achievement.application.service.ts` (audit at rev4.7
   * completion: 0 grep hits). It is kept here as documentation /
   * forward-compatibility — the global filter will resolve the code
   * correctly if a future call site throws it.
   */
  ACHIEVEMENT_GRANT_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/achievement-grant-error',
  },

  // ===========================================================================
  // DISCUSSION module — src/modules/comments/domain/errors/comment.errors.ts
  // ===========================================================================
  /** Phase 9.5 entry: the comment module is rewritten as a comment
   * section (per the architecture document §3.6). The error set is the
   * narrow 11-class list scoped to comment-only operations: there is no
   * thread, no solved state, no subscriptions, no bookmarks. The prior
   * 12-class comments block is retired in the same change. */
  // 11 concrete exceptions → 4 status codes:
  //   404: COMMENT_NOT_FOUND, COMMENT_QUIZ_NOT_FOUND,
  //        COMMENT_PARENT_COMMENT_NOT_FOUND, COMMENT_REPORT_NOT_FOUND (4)
  //   403: COMMENT_FORBIDDEN, COMMENT_SELF_VOTE,
  //        COMMENT_SELF_REPORT, COMMENT_MODERATOR_REQUIRED (4)
  //   409: COMMENT_REPLY_LIMIT_EXCEEDED, COMMENT_DUPLICATE_REPORT (2)
  //   400: COMMENT_PARENT_COMMENT_CROSS_THREAD (1)
  //
  // Total = 4 + 4 + 2 + 1 = 11.
  //
  // Note on the cross-module `UserNotFoundError`: the prior per-module
  // filter `@Catch(CommentError, UserNotFoundError)` also caught
  // `UserNotFoundError` from the user module. After Phase 9.5 the
  // comments filter is removed; the global filter handles it via
  // `ProblemCodeMapping['USER_NOT_FOUND']` (declared in Phase 1).
  //
  // Note on the `QuizNotFoundError` class-name collision: the
  // comment module declares its own `QuizNotFoundError` class. The
  // `code` (`COMMENT_QUIZ_NOT_FOUND`) distinguishes it from the
  // quiz-module version (`QUIZ_NOT_FOUND`) and the quiz-analytics
  // version (`QUIZ_ANALYTICS_NOT_FOUND`). Clients should switch on
  // `extensions.code`, never on the class name. The §9 item-1
  // unification (merge these into a single class) is deferred.

  /**
   * Thrown when a comment cannot be found by id, or when a reply's
   * parent comment has been hidden or soft-deleted. 404 Not Found.
   */
  COMMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-not-found',
  },
  /**
   * Thrown when the comment module's `QuizNotFoundError` fires
   * (quiz lookup during a comment operation). 404 Not Found.
   *
   * This is the **comment-module** version of the class; the
   * quiz-module version uses `QUIZ_NOT_FOUND` and the quiz-analytics
   * version uses `QUIZ_ANALYTICS_NOT_FOUND`. They share the
   * JavaScript class name but are distinct at runtime. Clients
   * should switch on `extensions.code`, never on the class name.
   * The §9 item-1 unification (merge these into a single class) is
   * deferred.
   */
  COMMENT_QUIZ_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-quiz-not-found',
  },
  /**
   * Thrown when a reply references a parent comment that does not
   * exist or has been hidden / soft-deleted. 404 Not Found.
   */
  COMMENT_PARENT_COMMENT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-parent-comment-not-found',
  },
  /**
   * Thrown when a moderator tries to review a report that does not
   * exist. 404 Not Found.
   */
  COMMENT_REPORT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/comment-report-not-found',
  },
  /**
   * Thrown when the authenticated user lacks permission to perform
   * an action on a comment. 403 Forbidden.
   */
  COMMENT_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-forbidden',
  },
  /**
   * Thrown when the user attempts to vote on their own comment. 403
   * Forbidden.
   */
  COMMENT_SELF_VOTE: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-self-vote',
  },
  /**
   * Thrown when the user attempts to report their own comment. 403
   * Forbidden.
   */
  COMMENT_SELF_REPORT: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-self-report',
  },
  /**
   * Thrown when a moderator-only action is attempted by a non-
   * moderator user. 403 Forbidden.
   *
   * Plan §8.4.1 risk note: this class's 403 status is non-obvious
   * from the class name; the migration test captures it.
   */
  COMMENT_MODERATOR_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/comment-moderator-required',
  },
  /**
   * Thrown when a reply is attempted against a comment that has
   * already reached the maximum reply limit (100 replies). 409
   * Conflict.
   */
  COMMENT_REPLY_LIMIT_EXCEEDED: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/comment-reply-limit-exceeded',
  },
  /**
   * Thrown when the user attempts to report a comment that they
   * have already reported and the prior report is still `'open'`.
   * 409 Conflict.
   */
  COMMENT_DUPLICATE_REPORT: {
    status: HttpStatus.CONFLICT,
    title: 'Conflict',
    typeUri: 'https://api.quiz.local/problems/comment-duplicate-report',
  },
  /**
   * Thrown when a reply's parent comment is on a different quiz
   * than the one the reply is being posted under, or when the
   * parent comment is itself a reply (violating the two-level
   * rule). 400 Bad Request.
   *
   * Plan §8.4.1 risk note: this class's 400 status is non-obvious
   * from the class name (one might expect 409 Conflict for a
   * cross-resource mismatch); the migration test captures it.
   */
  COMMENT_PARENT_COMMENT_CROSS_THREAD: {
    status: HttpStatus.BAD_REQUEST,
    title: 'BadRequest',
    typeUri: 'https://api.quiz.local/problems/comment-parent-comment-cross-thread',
  },

  // ===========================================================================
  // RANKING module — src/modules/ranking/domain/errors/ranking-domain.errors.ts
  // ===========================================================================
  /** Phase 3.2 entry: ranking was the highest-risk Phase-3 module because
   * its per-module `RankingDomainExceptionFilter` was a `@Catch()` catch-all
   * that shadows `GlobalExceptionFilter`. After Phase 3.2 the lookup tables
   * are replaced with these mapping entries; uncaught Errors now flow through
   * the global filter's standard path. */
  // 3 concrete exceptions → 2 status codes:
  //   422: RANKING_INVALID_XP_EVENT (semantic upgrade — rejected XP event
  //        input; was 500 catch-all under the prior filter)
  //   500: RANKING_RANK_CALCULATION_ERROR, RANKING_PERIOD_RESET_ERROR
  //
  // Note on the prior `code` field: `RankingDomainError` carried a
  // constructor-injected `code` (the only domain exception class in the
  // codebase to do so, alongside `AchievementDomainError`). After Phase
  // 3.2 the constructor arg becomes a class-level `readonly code` field
  // per the plan §8.4.2 directive. Constructor signatures stay the same
  // for `RankCalculationError` and `PeriodResetError` (they take
  // `period` + `reason` + optional `context`); `InvalidXpEventError`
  // takes `event` + `reason`. The `event` field stays as a public
  // readonly instance field (separate from `code`) for in-process
  // introspection; `context` is retained on the three concrete
  // classes that use it.

  /**
   * Thrown when an XP event fails validation (negative amount,
   * malformed structure, etc.). 422 Unprocessable Entity.
   *
   * Wire-shape improvement: prior per-module filter was a `@Catch()`
   * catch-all that returned 500 with a hardcoded `'Internal server
   * error'` envelope. The thrown message and the constructor-injected
   * `code: 'INVALID_XP_EVENT'` were both discarded. After Phase 3.2
   * the global filter resolves the new code `RANKING_INVALID_XP_EVENT`
   * and preserves the thrown message.
   *
   * Status upgrade from 500 → 422: this is a semantic correction.
   * The exception represents rejected input (a malformed XP event
   * from the upstream pipeline), not an internal server failure.
   * 422 Unprocessable Entity is the correct semantic.
   */
  RANKING_INVALID_XP_EVENT: {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    title: 'UnprocessableEntity',
    typeUri: 'https://api.quiz.local/problems/ranking-invalid-xp-event',
  },
  /**
   * Thrown when an internal rank calculation fails (database deadlock,
   * consistency violation, etc.). 500 Internal Server Error.
   *
   * Wire-shape improvement: prior per-module filter was a `@Catch()`
   * catch-all that returned 500 with a hardcoded `'Internal server
   * error'` envelope. The thrown message and the constructor-injected
   * `code: 'RANK_CALCULATION_ERROR'` were both discarded. After
   * Phase 3.2 the global filter resolves the new code
   * `RANKING_RANK_CALCULATION_ERROR` and preserves the thrown message.
   */
  RANKING_RANK_CALCULATION_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/ranking-rank-calculation-error',
  },
  /**
   * Thrown when a period reset fails (scheduler failure, database
   * deadlock, etc.). 500 Internal Server Error.
   *
   * Wire-shape improvement: prior per-module filter was a `@Catch()`
   * catch-all that returned 500 with a hardcoded `'Internal server
   * error'` envelope. The thrown message and the constructor-injected
   * `code: 'PERIOD_RESET_ERROR'` were both discarded. After Phase
   * 3.2 the global filter resolves the new code
   * `RANKING_PERIOD_RESET_ERROR` and preserves the thrown message.
   */
  RANKING_PERIOD_RESET_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    title: 'InternalServerError',
    typeUri: 'https://api.quiz.local/problems/ranking-period-reset-error',
  },

  // ===========================================================================
  // NOTIFICATION module — src/modules/notification/domain/errors/notification.errors.ts
  // ===========================================================================
  /** Phase 5 (rev5.1) entry: notification was inadvertently skipped in
   * Phases 1-3 because it had no per-module filter (no
   * `NotificationDomainExceptionFilter` to delete). Its errors
   * (`NotificationError` base + `NotificationNotFoundError` +
   * `NotificationForbiddenError`) extended `Error` directly, so the
   * global filter caught them via its `instanceof Error` branch and
   * returned 500 with `title: 'InternalServerError'` — masking a
   * legitimate 404 (notification not found) as a generic 500 and
   * masking a legitimate 403 (user lacks permission for this
   * notification) the same way.
   *
   * Phase 5 fix: convert to `BaseDomainException` + class-level
   * `code`, add these two mapping entries. The global filter now
   * resolves the correct status + `extensions.code` for the 2
   * notification domain exceptions. 2 concrete exceptions → 2
   * status codes (404 + 403). The abstract base `NotificationError`
   * (no concrete instance throws it; audit at rev5.1 start: 0 grep
   * hits for `new NotificationError(`) becomes a `BaseDomainException`
   * subclass with no `code` field, matching the pattern used in all
   * 14 migrated modules. */

  /**
   * Thrown when a notification lookup fails (notification does not
   * exist or has been deleted). 404 Not Found.
   *
   * Wire-shape improvement: prior behavior routed
   * `NotificationNotFoundError` (which `extends Error`) through the
   * global filter's `instanceof Error` branch and returned 500 with
   * `title: 'InternalServerError'`. After Phase 5 the global filter
   * resolves the new code `NOTIFICATION_NOT_FOUND` and returns a
   * proper 404 with `extensions.code = 'NOTIFICATION_NOT_FOUND'`.
   */
  NOTIFICATION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/notification-not-found',
  },
  /**
   * Thrown when a notification belongs to a different user than the
   * authenticated caller (i.e. the caller is authenticated but lacks
   * permission for this specific notification resource). 403
   * Forbidden.
   *
   * Wire-shape improvement: prior behavior routed
   * `NotificationForbiddenError` (which `extends Error`) through the
   * global filter's `instanceof Error` branch and returned 500 with
   * `title: 'InternalServerError'`. After Phase 5 the global filter
   * resolves the new code `NOTIFICATION_FORBIDDEN` and returns a
   * proper 403 with `extensions.code = 'NOTIFICATION_FORBIDDEN'`.
   *
   * Note on the 401 vs 403 distinction: `NotificationForbiddenError`
   * is thrown AFTER `NotificationNotFoundError`, so the caller is
   * authenticated — 403 is correct (forbidden), not 401 (unauthenticated).
   * The throw-sites at `notification-application.service.ts:132,
   * 160, 209` all check `notification.userId !== user.sub` after a
   * successful lookup, confirming the 403 semantic.
   */
  NOTIFICATION_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/notification-forbidden',
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
