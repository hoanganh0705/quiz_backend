import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Attempt-module namespace marker for all attempt-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth and quiz modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs the generic `code` for an unmapped operation failure. (The quiz
 * module has `QuizOperationFailedError` for this; the attempt module
 * does not need one because no repository in this module currently throws
 * a generic "unexpected DB error" — every thrown site uses a specific
 * subclass.)
 */
export abstract class AttemptDomainError extends BaseDomainException {}

/**
 * Thrown when a quiz attempt cannot be found by id. 404 Not Found.
 */
export class AttemptNotFoundError extends AttemptDomainError {
  readonly code = 'ATTEMPT_NOT_FOUND';
  constructor(message = 'Quiz attempt not found') {
    super(message);
  }
}

/**
 * Thrown when the caller lacks permission to access an attempt (e.g. not
 * the attempt's owner, or attempting to view another user's analytics).
 * 403 Forbidden.
 */
export class AttemptForbiddenError extends AttemptDomainError {
  readonly code = 'ATTEMPT_FORBIDDEN';
  constructor(message = 'You do not have permission to access this attempt') {
    super(message);
  }
}

/**
 * Thrown when a state-machine transition would violate the attempt's
 * lifecycle but the failure does not fit a more specific class (e.g.
 * option-related validation in `submitAnswer`). 400 Bad Request.
 *
 * Standalone concrete class with no children. In the prior module
 * structure, three classes (`QuizNotPublishedError`, `AttemptQuestionInvalidError`,
 * `AttemptNotCompletedError`) extended this one — they have been
 * reparented to `AttemptDomainError` so each can declare its own `code`
 * literal type. See plan §8.2 v3.4 for details.
 */
export class AttemptValidationError extends AttemptDomainError {
  readonly code = 'ATTEMPT_VALIDATION_FAILED';
  constructor(message = 'Validation failed') {
    super(message);
  }
}

/**
 * Thrown when the user attempts to start a second active attempt for the
 * same quiz version. 409 Conflict.
 */
export class AttemptAlreadyStartedError extends AttemptDomainError {
  readonly code = 'ATTEMPT_ALREADY_STARTED';
  constructor(message = 'You already have an active attempt for this quiz version') {
    super(message);
  }
}

/**
 * Thrown when a state-machine transition is attempted on an attempt that
 * is not in the active state (already completed, abandoned, or never
 * started). 409 Conflict.
 */
export class AttemptNotActiveError extends AttemptDomainError {
  readonly code = 'ATTEMPT_NOT_ACTIVE';
  constructor(message = 'Attempt is not active (already completed or abandoned)') {
    super(message);
  }
}

/**
 * Thrown when the user attempts to submit or withdraw an answer for a
 * question they've already answered in the same attempt. 409 Conflict.
 */
export class AttemptQuestionAlreadyAnsweredError extends AttemptDomainError {
  readonly code = 'ATTEMPT_QUESTION_ALREADY_ANSWERED';
  constructor(message = 'This question has already been answered in this attempt') {
    super(message);
  }
}

/**
 * Thrown when the user attempts to start an attempt on a quiz version
 * that is not yet published. 422 Unprocessable Entity.
 *
 * Wire-shape NOTE: previously extended `AttemptValidationError` and
 * inherited its 400 mapping. After Phase 1 it extends `AttemptDomainError`
 * directly and gets a 422 mapping — a deliberate upgrade because the
 * prior 400 was arguably wrong (the request is syntactically valid, the
 * resource state just doesn't permit the action). Documented in §8.2 v3.4.
 */
export class QuizNotPublishedError extends AttemptDomainError {
  readonly code = 'ATTEMPT_QUIZ_NOT_PUBLISHED';
  constructor(message = 'This quiz is not published and cannot be attempted') {
    super(message);
  }
}

/**
 * Thrown when the question id in a submit-answer request does not belong
 * to the attempt's quiz version. 422 Unprocessable Entity.
 *
 * Same reparenting rationale as `QuizNotPublishedError`.
 */
export class AttemptQuestionInvalidError extends AttemptDomainError {
  readonly code = 'ATTEMPT_QUESTION_INVALID';
  constructor(message = 'Question is invalid for this attempt') {
    super(message);
  }
}

/**
 * Thrown when an answer id passed to a withdraw-answer request does not
 * exist on the attempt. 404 Not Found.
 */
export class AttemptAnswerNotFoundError extends AttemptDomainError {
  readonly code = 'ATTEMPT_ANSWER_NOT_FOUND';
  constructor(message = 'Answer to withdraw not found') {
    super(message);
  }
}

/**
 * Thrown when analytics are requested for an attempt that has not yet
 * been completed. 422 Unprocessable Entity.
 *
 * Same reparenting rationale as `QuizNotPublishedError`. Previously
 * inherited the 400 mapping from `AttemptValidationError`; the new 422 is
 * a deliberate upgrade.
 */
export class AttemptNotCompletedError extends AttemptDomainError {
  readonly code = 'ATTEMPT_NOT_COMPLETED';
  constructor(message = 'Analytics are only available for completed attempts') {
    super(message);
  }
}
