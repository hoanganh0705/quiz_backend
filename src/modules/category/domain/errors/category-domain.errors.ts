import { BaseDomainException } from '@/common/errors/base-domain.exception';
export abstract class CategoryDomainError extends BaseDomainException {}

export class CategoryNotFoundError extends CategoryDomainError {
  readonly code = 'CATEGORY_NOT_FOUND';
  constructor(message = 'Category not found') {
    super(message);
  }
}

export class CategoryAnalyticsNotFoundError extends CategoryDomainError {
  readonly code = 'CATEGORY_ANALYTICS_NOT_FOUND';
  constructor(message = 'Category analytics not found') {
    super(message);
  }
}

export class CategorySlugConflictError extends CategoryDomainError {
  readonly code = 'CATEGORY_SLUG_CONFLICT';
  constructor(message = 'A category with this slug already exists') {
    super(message);
  }
}

export class CategoryAlreadyActiveError extends CategoryDomainError {
  readonly code = 'CATEGORY_ALREADY_ACTIVE';
  constructor(message = 'Category is already active and cannot be restored') {
    super(message);
  }
}

export class CategoryRestoreInvariantError extends CategoryDomainError {
  readonly code = 'CATEGORY_RESTORE_INVARIANT';
  constructor(message = 'Category restore invariant violated') {
    super(message);
  }
}

export class CategoryFollowNotFoundError extends CategoryDomainError {
  readonly code = 'CATEGORY_FOLLOW_NOT_FOUND';
  constructor(message = 'You are not following this category') {
    super(message);
  }
}
