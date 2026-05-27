import { ConflictException, NotFoundException } from '@nestjs/common';

export class CategoryNotFoundError extends NotFoundException {
  constructor() {
    super('Category not found');
  }
}

export class CategorySlugConflictError extends ConflictException {
  constructor() {
    super('A category with this slug already exists');
  }
}
