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

export class CategorySlugConflictError extends CategoryDomainError {
  constructor(message = 'A category with this slug already exists') {
    super(message);
  }
}
