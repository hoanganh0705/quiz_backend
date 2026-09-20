import { BaseDomainException } from '@/common/errors/base-domain.exception';

export abstract class AttemptDomainError extends BaseDomainException {}

export class AttemptNotFoundError extends AttemptDomainError {
  readonly code = 'ATTEMPT_NOT_FOUND';
  constructor(message = 'Quiz attempt not found') {
    super(message);
  }
}

export class AttemptForbiddenError extends AttemptDomainError {
  readonly code = 'ATTEMPT_FORBIDDEN';
  constructor(message = 'You do not have permission to access this attempt') {
    super(message);
  }
}

export class AttemptValidationError extends AttemptDomainError {
  readonly code = 'ATTEMPT_VALIDATION_FAILED';
  constructor(message = 'Validation failed') {
    super(message);
  }
}

export class AttemptAlreadyStartedError extends AttemptDomainError {
  readonly code = 'ATTEMPT_ALREADY_STARTED';
  constructor(message = 'You already have an active attempt for this quiz version') {
    super(message);
  }
}

export class AttemptNotActiveError extends AttemptDomainError {
  readonly code = 'ATTEMPT_NOT_ACTIVE';
  constructor(message = 'Attempt is not active (already completed or abandoned)') {
    super(message);
  }
}

export class AttemptQuestionAlreadyAnsweredError extends AttemptDomainError {
  readonly code = 'ATTEMPT_QUESTION_ALREADY_ANSWERED';
  constructor(message = 'This question has already been answered in this attempt') {
    super(message);
  }
}

export class QuizNotPublishedError extends AttemptDomainError {
  readonly code = 'ATTEMPT_QUIZ_NOT_PUBLISHED';
  constructor(message = 'This quiz is not published and cannot be attempted') {
    super(message);
  }
}

export class AttemptQuestionInvalidError extends AttemptDomainError {
  readonly code = 'ATTEMPT_QUESTION_INVALID';
  constructor(message = 'Question is invalid for this attempt') {
    super(message);
  }
}

export class AttemptAnswerNotFoundError extends AttemptDomainError {
  readonly code = 'ATTEMPT_ANSWER_NOT_FOUND';
  constructor(message = 'Answer to withdraw not found') {
    super(message);
  }
}

export class AttemptNotCompletedError extends AttemptDomainError {
  readonly code = 'ATTEMPT_NOT_COMPLETED';
  constructor(message = 'Analytics are only available for completed attempts') {
    super(message);
  }
}
