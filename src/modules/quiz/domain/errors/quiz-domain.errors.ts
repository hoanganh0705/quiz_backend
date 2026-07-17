import { BaseDomainException } from '@/common/errors/base-domain.exception';
import { QUIZ_VERSION_NOT_FOUND_MESSAGE } from '../../quiz.constants';

/**
 * Quiz-module namespace marker for all quiz-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth module's structure.)
 *
 * Abstract — does not declare a `code` — because the only concrete classes
 * in this hierarchy are the specific 11 exceptions below. The previous
 * `QuizDomainError extends Error` was directly instantiated by the
 * repositories' `mapCreateError`/`mapUpdateError` catch-alls as a generic
 * "unexpected DB error" signal; that role is now played by the explicit
 * concrete class `QuizOperationFailedError` (see below). The throw sites
 * in `quiz.repository.ts` and `quiz-question.repository.ts` were updated
 * in this change set.
 */
export abstract class QuizDomainError extends BaseDomainException {}

/**
 * Generic "unexpected DB / operation failure" thrown by repositories when
 * an unmapped Postgres error is encountered. Replaces the previous
 * `new QuizDomainError('Quiz operation failed')` pattern, which used the
 * abstract base class directly (an anti-pattern: throwing an abstract
 * class instance defeats the type system's `abstract` enforcement).
 *
 * Mapped to 500 with a generic title — by the time we reach this code, the
 * upstream domain layer has already failed to classify the failure into
 * a more specific exception. The wire shape is identical to the prior
 * filter's catch-all, but `extensions.code` is now present so on-call can
 * correlate with structured logs.
 */
export class QuizOperationFailedError extends QuizDomainError {
  readonly code = 'QUIZ_OPERATION_FAILED';
  constructor(message = 'Quiz operation failed') {
    super(message);
  }
}

/**
 * Thrown when a quiz cannot be found by id or by slug. 404 Not Found.
 *
 * NOTE: There is a sibling `QuizNotFoundError` in
 * `src/modules/quiz/domain/analytics/errors/quiz-analytics.errors.ts` with
 * code `QUIZ_ANALYTICS_NOT_FOUND`. They are distinct: the quiz-main
 * variant is a CRUD-style "quiz resource missing"; the analytics variant
 * is a "no analytics row exists for this quiz" lookup. Same name, different
 * hierarchy, different code — clients switch on `extensions.code`, never
 * on the class name. The discussion module also has its own
 * `QuizNotFoundError` in `src/modules/discussion/domain/errors` with code
 * `DISCUSSION_QUIZ_NOT_FOUND` (planned in Phase 1's user-module PR).
 */
export class QuizNotFoundError extends QuizDomainError {
  readonly code = 'QUIZ_NOT_FOUND';
  constructor(message = 'Quiz not found') {
    super(message);
  }
}

/**
 * Thrown when the caller lacks permission to manage a quiz (create,
 * update, delete, version, publish). 403 Forbidden.
 */
export class QuizForbiddenError extends QuizDomainError {
  readonly code = 'QUIZ_FORBIDDEN';
  constructor(message = 'You do not have permission to manage this quiz') {
    super(message);
  }
}

/**
 * Thrown on a unique-violation against the quiz slug. 409 Conflict.
 */
export class QuizSlugConflictError extends QuizDomainError {
  readonly code = 'QUIZ_SLUG_CONFLICT';
  constructor(message = 'A quiz with this slug already exists') {
    super(message);
  }
}

/**
 * Generic quiz-domain conflict signal. 409 Conflict.
 *
 * Today this is thrown from `QuizVersionRepository.mapVersionCreateError`
 * (and similar) when an unmapped unique-violation or other DB conflict
 * occurs that isn't already handled by `QuizSlugConflictError`. The
 * `message` carries the specific conflict reason.
 */
export class QuizConflictError extends QuizDomainError {
  readonly code = 'QUIZ_CONFLICT';
  constructor(message = 'Resource conflict') {
    super(message);
  }
}

/**
 * Thrown when a quiz/quiz-version/quiz-question input fails business
 * validation that `class-validator` doesn't already cover. 400 Bad
 * Request.
 */
export class QuizValidationError extends QuizDomainError {
  readonly code = 'QUIZ_VALIDATION_FAILED';
  constructor(message = 'Validation failed') {
    super(message);
  }
}

/**
 * Thrown when a state-machine transition would modify an immutable quiz
 * version (e.g. editing a published or archived version). 400 Bad Request.
 *
 * Wire-shape NOTE (improvement): the prior `QuizDomainExceptionFilter`
 * hardcoded `detail: 'This quiz version cannot be modified'` for this
 * exception, ignoring the thrown message. The new global filter preserves
 * `exception.message`, so the caller now sees the more specific
 * state-machine message (e.g. `'Archived versions are immutable and
 * cannot be edited'`). Documented in plan §8.2 v3.3.
 */
export class QuizVersionImmutableError extends QuizDomainError {
  readonly code = 'QUIZ_VERSION_IMMUTABLE';
  constructor(message = 'This quiz version cannot be modified') {
    super(message);
  }
}

/**
 * Thrown when a quiz version that a caller referenced cannot be found.
 * 404 Not Found.
 *
 * Today this is thrown by downstream modules (e.g. `instance` on
 * `POST /instances` with a non-existent `quizVersionId`) when the
 * `quiz_versions_quiz_version_id_fkey` foreign-key constraint fires.
 * The repository translates the raw PG `23503` violation into this
 * domain error so callers can distinguish "version not found" from a
 * generic operation failure.
 */
export class QuizVersionNotFoundError extends QuizDomainError {
  readonly code = 'QUIZ_VERSION_NOT_FOUND';
  constructor(message = QUIZ_VERSION_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when a quiz version has fewer than the required number of
 * questions for the publish transition. 422 Unprocessable Entity.
 */
export class QuizInsufficientQuestionsError extends QuizDomainError {
  readonly code = 'QUIZ_INSUFFICIENT_QUESTIONS';
  constructor(message = 'Quiz version must contain at least 5 questions before publishing') {
    super(message);
  }
}

/**
 * Thrown when an attempt to create a question with a position that is
 * already taken in the quiz version. 409 Conflict.
 */
export class QuizQuestionPositionConflictError extends QuizDomainError {
  readonly code = 'QUIZ_QUESTION_POSITION_CONFLICT';
  constructor(message = 'A question with this position already exists in the quiz version') {
    super(message);
  }
}

/**
 * Thrown when an attempt to create an answer option with a position that
 * is already taken in the question. 409 Conflict.
 */
export class QuizAnswerOptionPositionConflictError extends QuizDomainError {
  readonly code = 'QUIZ_ANSWER_OPTION_POSITION_CONFLICT';
  constructor(message = 'An answer option with this position already exists in the question') {
    super(message);
  }
}

/**
 * Thrown when a question would end up with zero or multiple correct answer
 * options after a write operation. 400 Bad Request.
 */
export class QuizMultipleCorrectOptionsError extends QuizDomainError {
  readonly code = 'QUIZ_MULTIPLE_CORRECT_OPTIONS';
  constructor(message = 'A question must have exactly one correct answer option') {
    super(message);
  }
}
