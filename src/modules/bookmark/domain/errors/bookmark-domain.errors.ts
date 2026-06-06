import {
  BOOKMARK_NOT_FOUND_MESSAGE,
  COLLECTION_FORBIDDEN_MESSAGE,
  BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE,
  COLLECTION_NOT_FOUND_MESSAGE,
  COLLECTION_ANALYTICS_NOT_FOUND_MESSAGE,
  COLLECTION_NAME_CONFLICT_MESSAGE,
} from '../../bookmark.constants';

export class BookmarkDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BookmarkNotFoundError extends BookmarkDomainError {
  constructor(message = BOOKMARK_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

export class BookmarkForbiddenError extends BookmarkDomainError {
  constructor(message = COLLECTION_FORBIDDEN_MESSAGE) {
    super(message);
  }
}

export class BookmarkConflictError extends BookmarkDomainError {
  constructor(message = BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE) {
    super(message);
  }
}

export class BookmarkAlreadyExistsError extends BookmarkDomainError {
  constructor(message = BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE) {
    super(message);
  }
}

export class BookmarkValidationError extends BookmarkDomainError {
  constructor(message = 'Validation failed') {
    super(message);
  }
}

export class CollectionNotFoundError extends BookmarkDomainError {
  constructor(message = COLLECTION_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

export class BookmarkCollectionNotFoundError extends BookmarkDomainError {
  constructor(message = COLLECTION_ANALYTICS_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

export class CollectionForbiddenError extends BookmarkDomainError {
  constructor(message = COLLECTION_FORBIDDEN_MESSAGE) {
    super(message);
  }
}

export class CollectionConflictError extends BookmarkDomainError {
  constructor(message = COLLECTION_NAME_CONFLICT_MESSAGE) {
    super(message);
  }
}
