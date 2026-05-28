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

export class QuizSlugConflictError extends QuizDomainError {
  constructor(message = 'A quiz with this slug already exists') {
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

export class QuizInsufficientQuestionsError extends QuizDomainError {
  constructor(message = 'Quiz version must contain at least 5 questions before publishing') {
    super(message);
  }
}

export class QuizQuestionPositionConflictError extends QuizDomainError {
  constructor(message = 'A question with this position already exists in the quiz version') {
    super(message);
  }
}

export class QuizAnswerOptionPositionConflictError extends QuizDomainError {
  constructor(message = 'An answer option with this position already exists in the question') {
    super(message);
  }
}

export class QuizMultipleCorrectOptionsError extends QuizDomainError {
  constructor(message = 'A question must have exactly one correct answer option') {
    super(message);
  }
}
