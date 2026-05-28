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
