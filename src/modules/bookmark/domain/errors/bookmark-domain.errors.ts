import { BaseDomainException } from '@/common/errors/base-domain.exception';
import {
  BOOKMARK_NOT_FOUND_MESSAGE,
  BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE,
  COLLECTION_FORBIDDEN_MESSAGE,
  COLLECTION_NAME_CONFLICT_MESSAGE,
  COLLECTION_NOT_FOUND_MESSAGE,
} from '../../bookmark.constants';

/**
 * Bookmark-module namespace marker for bookmark-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * category, tag, tournament, and review modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new BookmarkDomainError' src/` returns no matches.
 */
export abstract class BookmarkDomainError extends BaseDomainException {}

/**
 * Thrown when a bookmark cannot be found. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `BookmarkNotFoundError.message` to a hardcoded generic
 * `'Resource not found'`. The global filter now preserves
 * `exception.message`.
 */
export class BookmarkNotFoundError extends BookmarkDomainError {
  readonly code = 'BOOKMARK_NOT_FOUND';
  constructor(message = BOOKMARK_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when a bookmark's collection cannot be found. 404 Not Found.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `BookmarkCollectionNotFoundError.message` to a hardcoded
 * `'Bookmark collection analytics not found'`, even for throw sites
 * that passed distinct messages (e.g.
 * `'Collection was deleted while processing this request. Please
 * retry.'` in `bookmark-command.service.ts:226`). The global filter
 * now preserves `exception.message`.
 */
export class BookmarkCollectionNotFoundError extends BookmarkDomainError {
  readonly code = 'BOOKMARK_COLLECTION_NOT_FOUND';
  constructor(message = COLLECTION_NOT_FOUND_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when the authenticated user lacks permission to manage a
 * collection. 403 Forbidden.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `CollectionForbiddenError.message` to a hardcoded generic
 * `'You do not have permission to perform this action'`. The global
 * filter now preserves `exception.message` (default:
 * `'You do not have permission to manage this collection'`).
 */
export class CollectionForbiddenError extends BookmarkDomainError {
  readonly code = 'COLLECTION_FORBIDDEN';
  constructor(message = COLLECTION_FORBIDDEN_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when a bookmark conflict is detected (e.g. the user has
 * already bookmarked this quiz in this collection). 409 Conflict.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `BookmarkConflictError.message` to a hardcoded generic
 * `'Resource already exists'`. The global filter now preserves
 * `exception.message` (default:
 * `'This quiz is already bookmarked in this collection'`).
 */
export class BookmarkConflictError extends BookmarkDomainError {
  readonly code = 'BOOKMARK_CONFLICT';
  constructor(message = BOOKMARK_QUIZ_ALREADY_EXISTS_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when a collection name conflict is detected (e.g. a
 * collection with this name already exists for the user). 409
 * Conflict.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `CollectionConflictError.message` to a hardcoded generic
 * `'Resource already exists'`. The global filter now preserves
 * `exception.message` (default:
 * `'A collection with this name already exists'`).
 */
export class CollectionConflictError extends BookmarkDomainError {
  readonly code = 'COLLECTION_CONFLICT';
  constructor(message = COLLECTION_NAME_CONFLICT_MESSAGE) {
    super(message);
  }
}

/**
 * Thrown when bookmark-related input fails validation. 400 Bad
 * Request.
 *
 * Wire-shape improvement: the prior per-module filter rewrote every
 * `BookmarkValidationError.message` to a hardcoded generic
 * `'Invalid request data'`. The global filter now preserves
 * `exception.message`.
 */
export class BookmarkValidationError extends BookmarkDomainError {
  readonly code = 'BOOKMARK_VALIDATION';
  constructor(message = 'Validation failed') {
    super(message);
  }
}
