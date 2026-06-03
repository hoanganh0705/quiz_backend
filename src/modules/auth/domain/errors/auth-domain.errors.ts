export class AuthDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends AuthDomainError {
  constructor(message = 'Invalid email or password') {
    super(message);
  }
}

export class InvalidRefreshTokenError extends AuthDomainError {
  constructor(message = 'Invalid or expired refresh token') {
    super(message);
  }
}

export class TokenReuseDetectedError extends AuthDomainError {
  constructor(message = 'Refresh token reuse detected. All sessions have been revoked') {
    super(message);
  }
}

export class SessionContextMismatchError extends AuthDomainError {
  constructor(message = 'Session context mismatch') {
    super(message);
  }
}

export class UserNotFoundError extends AuthDomainError {
  constructor(message = 'User not found') {
    super(message);
  }
}

export class RateLimitExceededError extends AuthDomainError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
  }
}

export class ResourceConflictError extends AuthDomainError {
  constructor(message = 'Resource conflict') {
    super(message);
  }
}

export class SessionNotFoundError extends AuthDomainError {
  constructor(message = 'Session not found') {
    super(message);
  }
}

export class InvalidTokenError extends AuthDomainError {
  constructor(message = 'Invalid or expired token') {
    super(message);
  }
}

export class InvalidPasswordError extends AuthDomainError {
  constructor(message = 'Invalid current password') {
    super(message);
  }
}
