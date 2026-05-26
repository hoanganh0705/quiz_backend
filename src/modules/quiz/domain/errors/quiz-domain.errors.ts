export class QuizDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class QuizNotFoundError extends QuizDomainError {
  constructor(message = 'Quiz not found') {
    super(message);
  }
}

export class QuizForbiddenError extends QuizDomainError {
  constructor(message = 'You do not have permission to manage this quiz') {
    super(message);
  }
}

export class QuizConflictError extends QuizDomainError {
  constructor(message = 'Resource conflict') {
    super(message);
  }
}

export class QuizValidationError extends QuizDomainError {
  constructor(message = 'Validation failed') {
    super(message);
  }
}

export class QuizVersionImmutableError extends QuizDomainError {
  constructor(message = 'This quiz version cannot be modified') {
    super(message);
  }
}

/**
 * Raised when a business invariant is violated — e.g. attempting to publish a
 * quiz version that does not meet the minimum requirements.
 * Maps to HTTP 422 Unprocessable Entity.
 */
export class QuizInsufficientQuestionsError extends QuizDomainError {
  constructor(message = 'Quiz version must contain at least 5 questions before publishing') {
    super(message);
  }
}
