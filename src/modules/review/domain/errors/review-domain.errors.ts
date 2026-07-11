import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  REVIEW_ALREADY_REPORTED_MESSAGE,
  REVIEW_ATTEMPT_REQUIRED_MESSAGE,
  REVIEW_FORBIDDEN_MESSAGE,
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEW_QUIZ_USER_CONFLICT_MESSAGE,
} from '../../review.constants';

/**
 * Review-module namespace marker for review-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, and tournament modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new ReviewDomainError' src/` returns no matches.
 */
export abstract class ReviewDomainError extends BaseDomainException {}

/**
 * Thrown when a review cannot be found, or when a quiz is referenced
 * in a review operation but does not exist. 404 Not Found.
 *
 * Wire-shape improvement: 3 throw sites pass `'Quiz not found'`; the
 * prior per-module filter rewrote them to `'Review not found'`. The
 * global filter now preserves `exception.message`.
 */
export class ReviewNotFoundError extends ReviewDomainError {
  readonly code = 'REVIEW_NOT_FOUND';
  constructor(message = REVIEW_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the authenticated user lacks permission to perform a
 * review operation. 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `ReviewForbiddenError.message` to a hardcoded generic
 * `'You do not have permission to perform this action'`, ignoring the
 * thrown message. The global filter now preserves `exception.message`,
 * so call sites that pass distinct messages (e.g. `'You do not have
 * permission to view analytics for this quiz'`) surface them verbatim.
 */
export class ReviewForbiddenError extends ReviewDomainError {
  readonly code = 'REVIEW_FORBIDDEN';
  constructor(message = REVIEW_FORBIDDEN_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when a review conflict is detected (e.g. user has already
 * reviewed this quiz). 409 Conflict.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `ReviewConflictError.message` to a hardcoded `'Resource already
 * exists'`. The global filter now preserves `exception.message`
 * (default: `REVIEW_QUIZ_USER_CONFLICT_MESSAGE = 'You have already
 * reviewed this quiz'`).
 */
export class ReviewConflictError extends ReviewDomainError {
  readonly code = 'REVIEW_CONFLICT';
  constructor(message = REVIEW_QUIZ_USER_CONFLICT_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when review-related input fails validation (e.g. `'You cannot
 * vote on your own review'`). 400 Bad Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `ReviewValidationError.message` to a hardcoded `'Invalid request
 * data'`. The global filter now preserves `exception.message`.
 */
export class ReviewValidationError extends ReviewDomainError {
  readonly code = 'REVIEW_VALIDATION';
  constructor(message = 'Validation failed') {
    super(message);
  }
}

/**
 * Thrown when a user tries to review a quiz without having completed
 * at least one attempt. 400 Bad Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `ReviewAttemptRequiredError.message` to a hardcoded `'Invalid
 * request data'`. The global filter now preserves `exception.message`
 * (default: `REVIEW_ATTEMPT_REQUIRED_MESSAGE = 'You must complete at
 * least one attempt before reviewing this quiz'`).
 */
export class ReviewAttemptRequiredError extends ReviewDomainError {
  readonly code = 'REVIEW_ATTEMPT_REQUIRED';
  constructor(message = REVIEW_ATTEMPT_REQUIRED_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the user tries to report a review a second time. 409
 * Conflict.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `ReviewAlreadyReportedError.message` to a hardcoded `'You have
 * already reported this review'`. The global filter now preserves
 * `exception.message` (which already happens to match the hardcoded
 * string by default, but custom overrides now surface verbatim).
 */
export class ReviewAlreadyReportedError extends ReviewDomainError {
  readonly code = 'REVIEW_ALREADY_REPORTED';
  constructor(message = REVIEW_ALREADY_REPORTED_MESSAGE) {
    super(message);
  }
}
