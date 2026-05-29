export class AttemptDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AttemptNotFoundError extends AttemptDomainError {
  constructor(message = 'Quiz attempt not found') {
    super(message);
  }
}

export class AttemptForbiddenError extends AttemptDomainError {
  constructor(message = 'You do not have permission to access this attempt') {
    super(message);
  }
}

export class AttemptConflictError extends AttemptDomainError {
  constructor(message = 'Attempt conflict') {
    super(message);
  }
}

export class AttemptValidationError extends AttemptDomainError {
  constructor(message = 'Validation failed') {
    super(message);
  }
}

export class AttemptAlreadyStartedError extends AttemptConflictError {
  constructor(message = 'You already have an active attempt for this quiz version') {
    super(message);
  }
}

export class AttemptNotActiveError extends AttemptConflictError {
  constructor(message = 'Attempt is not active (already completed or abandoned)') {
    super(message);
  }
}

export class AttemptQuestionAlreadyAnsweredError extends AttemptConflictError {
  constructor(message = 'This question has already been answered in this attempt') {
    super(message);
  }
}

export class QuizNotPublishedError extends AttemptValidationError {
  constructor(message = 'This quiz is not published and cannot be attempted') {
    super(message);
  }
}

export class AttemptQuestionInvalidError extends AttemptValidationError {
  constructor(message = 'Question is invalid for this attempt') {
    super(message);
  }
}
