import {
  REVIEW_FORBIDDEN_MESSAGE,
  REVIEW_NOT_FOUND_MESSAGE,
  REVIEW_QUIZ_USER_CONFLICT_MESSAGE,
  REVIEW_ATTEMPT_REQUIRED_MESSAGE,
} from '../../review.constants';

export class ReviewDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ReviewNotFoundError extends ReviewDomainError {
  constructor(message = REVIEW_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

export class ReviewForbiddenError extends ReviewDomainError {
  constructor(message = REVIEW_FORBIDDEN_MESSAGE) {
    super(message);
  }
}

export class ReviewConflictError extends ReviewDomainError {
  constructor(message = REVIEW_QUIZ_USER_CONFLICT_MESSAGE) {
    super(message);
  }
}

export class ReviewValidationError extends ReviewDomainError {
  constructor(message = 'Validation failed') {
    super(message);
  }
}

export class ReviewAttemptRequiredError extends ReviewDomainError {
  constructor(message = REVIEW_ATTEMPT_REQUIRED_MESSAGE) {
    super(message);
  }
}
