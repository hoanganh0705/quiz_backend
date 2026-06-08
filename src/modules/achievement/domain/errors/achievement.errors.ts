/**
 * Achievement Domain Errors
 */

export class AchievementDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AchievementDomainError';
  }
}

export class BadgeNotFoundError extends AchievementDomainError {
  constructor(badgeType: string) {
    super(`Badge not found: ${badgeType}`, 'BADGE_NOT_FOUND', { badgeType });
    this.name = 'BadgeNotFoundError';
  }
}

export class AchievementGrantError extends AchievementDomainError {
  constructor(userId: string, reason: string) {
    super(`Failed to grant achievement for user ${userId}: ${reason}`, 'ACHIEVEMENT_GRANT_ERROR', {
      userId,
      reason,
    });
    this.name = 'AchievementGrantError';
  }
}

export class AchievementUserNotFoundError extends AchievementDomainError {
  constructor(userId: string) {
    super(`User not found: ${userId}`, 'ACHIEVEMENT_USER_NOT_FOUND', { userId });
    this.name = 'AchievementUserNotFoundError';
  }
}

export class UserBadgeOwnershipNotFoundError extends AchievementDomainError {
  constructor(userId: string, badgeId: string) {
    super(`Badge ${badgeId} not owned by user ${userId}`, 'USER_BADGE_OWNERSHIP_NOT_FOUND', {
      userId,
      badgeId,
    });
    this.name = 'UserBadgeOwnershipNotFoundError';
  }
}
