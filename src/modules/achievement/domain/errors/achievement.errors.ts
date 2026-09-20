import { BaseDomainException } from '@/common/errors/base-domain.exception';
export abstract class AchievementDomainError extends BaseDomainException {}

export class BadgeNotFoundError extends AchievementDomainError {
  readonly code = 'BADGE_NOT_FOUND';
  readonly context: { readonly badgeId: string };
  constructor(badgeId: string) {
    super(`Badge not found: ${badgeId}`);
    this.context = { badgeId };
  }
}

export class AchievementGrantError extends AchievementDomainError {
  readonly code = 'ACHIEVEMENT_GRANT_ERROR';
  readonly context: { readonly userId: string; readonly reason: string };
  constructor(userId: string, reason: string) {
    super('Failed to grant achievement');
    this.context = { userId, reason };
  }
}

export class AchievementUserNotFoundError extends AchievementDomainError {
  readonly code = 'ACHIEVEMENT_USER_NOT_FOUND';
  readonly context: { readonly userId: string };
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.context = { userId };
  }
}

export class UserBadgeOwnershipNotFoundError extends AchievementDomainError {
  readonly code = 'USER_BADGE_OWNERSHIP_NOT_FOUND';
  readonly context: { readonly userId: string; readonly badgeId: string };
  constructor(userId: string, badgeId: string) {
    super(`Badge ${badgeId} not owned by user ${userId}`);
    this.context = { userId, badgeId };
  }
}
