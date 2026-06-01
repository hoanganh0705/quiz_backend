/**
 * User Profile Domain Errors
 */

export class ProfileDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProfileDomainError';
  }
}

export class ProfileNotFoundError extends ProfileDomainError {
  constructor(userId: string) {
    super(
      `Profile not found for user: ${userId}`,
      'PROFILE_NOT_FOUND',
      { userId },
    );
    this.name = 'ProfileNotFoundError';
  }
}

export class ProfileAccessDeniedError extends ProfileDomainError {
  constructor(userId: string) {
    super(
      `Access denied to profile: ${userId}`,
      'PROFILE_ACCESS_DENIED',
      { userId },
    );
    this.name = 'ProfileAccessDeniedError';
  }
}

export class ProfileUpdateError extends ProfileDomainError {
  constructor(userId: string, reason: string) {
    super(
      `Failed to update profile for user ${userId}: ${reason}`,
      'PROFILE_UPDATE_ERROR',
      { userId, reason },
    );
    this.name = 'ProfileUpdateError';
  }
}
