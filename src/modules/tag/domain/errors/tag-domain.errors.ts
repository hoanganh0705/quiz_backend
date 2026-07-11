import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Tag-module namespace marker for tag-domain exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers are
 * removed — but a module-namespace marker is a legitimate use of an
 * intermediate class. (Today no dispatch on this class happens at the
 * global-filter level; the filter resolves each concrete exception's
 * `code` via `ProblemCodeMapping` instead. The intermediate stays as a
 * domain-side marker for symmetry with the auth, quiz, attempt, user,
 * and category modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. (The quiz
 * module has `QuizOperationFailedError` for this; the tag module does
 * not need one because no repository in this module currently throws a
 * generic "unexpected DB error" — every thrown site uses a specific
 * subclass.) Audit: `grep -rn 'new TagDomainError' src/`
 * returns no matches.
 */
export abstract class TagDomainError extends BaseDomainException {}

/**
 * Thrown by tag read paths (`TagDomainService`, `TagController` GETs)
 * when a tag cannot be found by id or slug. 404 Not Found.
 */
export class TagNotFoundError extends TagDomainError {
  readonly code = 'TAG_NOT_FOUND';
  constructor(message = 'Tag not found') {
    super(message);
  }
}

/**
 * Thrown by `TagApplicationService` when a tag's analytics entry cannot
 * be found. 404 Not Found.
 */
export class TagAnalyticsNotFoundError extends TagDomainError {
  readonly code = 'TAG_ANALYTICS_NOT_FOUND';
  constructor(message = 'Tag analytics not found') {
    super(message);
  }
}

/**
 * Thrown by `TagDomainService` when a unique-slug constraint is violated
 * on insert/update. 409 Conflict.
 */
export class TagSlugConflictError extends TagDomainError {
  readonly code = 'TAG_SLUG_CONFLICT';
  constructor(message = 'A tag with this slug already exists') {
    super(message);
  }
}

/**
 * Thrown by `TagDomainService` when restoring a tag that is already
 * active (the restore endpoint refuses to touch active rows). 409
 * Conflict.
 */
export class TagAlreadyActiveError extends TagDomainError {
  readonly code = 'TAG_ALREADY_ACTIVE';
  constructor(message = 'Tag is already active and cannot be restored') {
    super(message);
  }
}

/**
 * Thrown by `TagDomainService` when the restore state machine reaches
 * an invariant violation that shouldn't be reachable in normal flow
 * (corrupted state). 500 Internal Server Error.
 *
 * Wire-shape improvement (Phase 2): the prior per-module filter mapped
 * this to 500 with a generic `message: 'Internal server error'`. After
 * Phase 2 the detail field surfaces the concrete message
 * (`'Tag restore invariant violated'`) — same improvement as
 * `CATEGORY_RESTORE_INVARIANT`.
 */
export class TagRestoreInvariantError extends TagDomainError {
  readonly code = 'TAG_RESTORE_INVARIANT';
  constructor(message = 'Tag restore invariant violated') {
    super(message);
  }
}
