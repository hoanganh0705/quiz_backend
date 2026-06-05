export class CategoryDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CategoryNotFoundError extends CategoryDomainError {
  constructor(message = 'Category not found') {
    super(message);
  }
}

export class CategoryAnalyticsNotFoundError extends CategoryDomainError {
  constructor(message = 'Category analytics not found') {
    super(message);
  }
}

export class CategorySlugConflictError extends CategoryDomainError {
  constructor(message = 'A category with this slug already exists') {
    super(message);
  }
}

export class CategoryAlreadyActiveError extends CategoryDomainError {
  constructor(message = 'Category is already active and cannot be restored') {
    super(message);
  }
}

export class CategoryRestoreInvariantError extends CategoryDomainError {
  constructor(message = 'Category restore invariant violated') {
    super(message);
  }
}

export class CategoryFollowNotAllowedError extends CategoryDomainError {
  constructor(message = 'Cannot follow a deleted or inactive category') {
    super(message);
  }
}
