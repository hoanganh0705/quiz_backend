import { ConflictException, NotFoundException } from '@nestjs/common';

export class TagNotFoundError extends NotFoundException {
  constructor() {
    super('Tag not found');
  }
}

export class TagSlugConflictError extends ConflictException {
  constructor() {
    super('A tag with this slug already exists');
  }
}
