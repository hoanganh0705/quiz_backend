export class TagDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TagNotFoundError extends TagDomainError {
  constructor(message = 'Tag not found') {
    super(message);
  }
}

export class TagSlugConflictError extends TagDomainError {
  constructor(message = 'A tag with this slug already exists') {
    super(message);
  }
}

export class TagAlreadyActiveError extends TagDomainError {
  constructor(message = 'Tag is already active and cannot be restored') {
    super(message);
  }
}

export class TagRestoreInvariantError extends TagDomainError {
  constructor(message = 'Tag restore invariant violated') {
    super(message);
  }
}

export class TagFollowNotAllowedError extends TagDomainError {
  constructor(message = 'Cannot follow a deleted or inactive tag') {
    super(message);
  }
}
